// HD-2D renderer (LP; architecture.md 4, 7). World into a virtual-resolution HDR target, then
// hand-written post-processing and one composite pass at physical resolution (src/render/post).
// Frame: lights and environment update -> (static decor shadow map if dirty) -> scene L0-L3 ->
// danger L4 into its own target -> player mask -> bloom -> tilt-shift -> composite -> canvas.
// Quality (Low, Medium, High) and reduce effects come from Settings via applySettings.

import { Color, DoubleSide, Scene, ShaderMaterial, WebGLRenderer } from 'three';
import {
  DEPTH_PX_PER_U,
  PX_PER_U,
  REF_ORIGIN_X,
  REF_ORIGIN_Y,
  SimEventType,
  virtualFrameFor,
  worldToVirtual,
} from '../../core/index.ts';
import type {
  ArenaDef,
  AtlasFrameRect,
  PaletteBiomeDef,
  Settings,
  VirtualFrame,
} from '../../core/index.ts';
import type { CreateRenderer, Projector, RenderFrame, Renderer } from '../../core/dom.ts';
import { createWorldCamera, fitWorldCamera } from '../camera.ts';
import { createArenaEnvironment } from '../env/arena-env.ts';
import type { ArenaEnvironment } from '../env/arena-env.ts';
import { createPostPipeline } from '../post/post-pipeline.ts';
import { SCENE_LIGHTING_GLSL } from '../shaders/lighting.ts';
import { PLAYER_MASK_FRAGMENT } from '../shaders/player-mask.ts';
import { spriteVertex } from '../shaders/sprite.ts';
import { createSpriteAtlas } from '../sprites/atlas-texture.ts';
import { createEntityLayers } from '../sprites/entity-layers.ts';
import { createSpriteBatch } from '../sprites/sprite-batch.ts';
import { playerCoveredByDanger } from './danger-rules.ts';
import { createPulseLight, pulseClosed, pulseOpened, samplePulseLight } from './pulse-light.ts';
import type { PulseLightSample } from './pulse-light.ts';
import { defaultQuality, isSoftwareRenderer, qualityProfile, softwareCap } from './quality.ts';
import type { QualityProfile } from './quality.ts';
import { createSceneLighting } from './scene-lighting.ts';
import { addTrauma, createShake, decayShake, SHAKE_TRAUMA, shakeOffset } from './shake.ts';

/** Sprite emissive gain while bloom is on (HDR above 1.0 feeds the bloom; AD entity-layers). */
const SPRITE_EMISSIVE_GAIN_BLOOM = 1.6;
/** Renders closer together than this (wall ms) are coalesced into one on the next animation frame. */
const COALESCE_MS = 4;
/** Empty event reader for coalesced frames (their events were already delivered to UI and audio). */
const NO_EVENTS: RenderFrame['events'] = { count: 0, type: [], x: [], y: [], a: [], b: [], c: [] };
/** Depth bias of the L2 actor batch (AD sprite-batch), mirrored by the player mask pass. */
const ACTOR_DEPTH_BIAS = 1e-5;

/**
 * Hook on AD's entity layers (EntityLayers.playerSprite): the player's sprite this frame, for the
 * see-through silhouette (LD 9, CD K3).
 */
export interface PlayerSpriteState {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly rect: AtlasFrameRect | null;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly flip: number;
}

/**
 * Test-only extension on the renderer object (not part of the frozen Renderer contract): force single
 * quality switches, e.g. DoF off with bloom unchanged for S-6 / LD-T03. Reached by tools and e2e hooks.
 */
export interface RendererDebug {
  overrideQuality(o: Partial<QualityProfile> | null): void;
}

export const createRenderer: CreateRenderer = (canvas, assets, data): Renderer => {
  const gl = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  gl.setPixelRatio(1);
  // One frame = several render() calls (passes): count them all (getPerf, budget 13).
  gl.info.autoReset = false;
  const frameStats = { drawCalls: 0, triangles: 0 };
  const palette = assets.palette;
  const defaultBiome = palette.biomes[0];
  if (defaultBiome === undefined) throw new Error('render: art/palette.json has no biome');
  let biome: PaletteBiomeDef = defaultBiome;
  gl.setClearColor(new Color(biome.fog.color), 1);

  const lighting = createSceneLighting();
  const post = createPostPipeline(palette);
  const scene = new Scene();
  scene.background = new Color(biome.fog.color);
  const camera = createWorldCamera();
  const atlas = createSpriteAtlas([...assets.sprites], palette);
  const entities = createEntityLayers(atlas.texture, atlas.manifest, palette, data, {
    lighting: { glsl: SCENE_LIGHTING_GLSL, uniforms: lighting.uniforms },
  });
  for (const o of entities.sceneObjects) scene.add(o);
  const dangerScene = new Scene();
  for (const o of entities.dangerObjects) dangerScene.add(o);

  // Player mask: AD's sprite vertex shader, mask fragment reading the scene depth.
  const maskBatch = createSpriteBatch(atlas.texture, atlas.manifest.width, atlas.manifest.height, {
    capacity: 1,
    depth: false,
    renderOrder: 0,
  });
  const baseMat = maskBatch.mesh.material as ShaderMaterial;
  const maskMat = new ShaderMaterial({
    vertexShader: spriteVertex(null),
    fragmentShader: PLAYER_MASK_FRAGMENT,
    uniforms: {
      ...baseMat.uniforms,
      uDepthBias: { value: ACTOR_DEPTH_BIAS },
      uSceneDepth: { value: post.sceneDepth },
    },
    // Same as the sprite batches: flipped quads reverse winding, never cull.
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  maskBatch.mesh.material = maskMat;
  const maskScene = new Scene();
  maskScene.add(maskBatch.mesh);
  const playerHook: PlayerSpriteState = entities.playerSprite;

  let env: ArenaEnvironment | null = null;
  let currentArena: ArenaDef | null = null;
  // Software rasterizers (SwiftShader in headless CI, llvmpipe) cannot run the HD-2D passes in real
  // time: cap quality at Low and render the canvas at virtual resolution, upscaled by CSS (pixelated).
  const glInfo = gl.getContext().getExtension('WEBGL_debug_renderer_info');
  const glRenderer =
    glInfo === null ? '' : String(gl.getContext().getParameter(glInfo.UNMASKED_RENDERER_WEBGL));
  const software = isSoftwareRenderer(glRenderer);
  if (software) canvas.style.imageRendering = 'pixelated';
  const effective = (q: QualityProfile): QualityProfile => (software ? softwareCap(q) : q);

  let quality: QualityProfile = effective(defaultQuality());
  let override: Partial<QualityProfile> | null = null;
  let baseQuality: QualityProfile = quality;
  const pulse = createPulseLight();
  const pulseSample: PulseLightSample = { waveRadius: -1, waveAlpha: 0, floorLift: 0, rimFlash: 0 };
  const shake = createShake();
  const shakeOut = { x: 0, y: 0 };
  const feet = { x: 0, y: 0 };
  const viewport = { x: 0, y: 0, w: 1, h: 1 };
  const compositeParams = {
    timeSec: 0,
    shakeX: 0,
    shakeY: 0,
    silhouette: false,
    hasPlayer: false,
    feetX: 0,
    feetY: 0,
  };

  let frame: VirtualFrame = virtualFrameFor(1, 1);
  let physicalW = 1;
  let physicalH = 1;
  let offsetX = 0;
  let offsetY = 0;
  let cssPerPhysical = 1;

  const applyQuality = (): void => {
    lighting.setMaxPoints(quality.maxPointLights);
    post.setQuality(quality);
    env?.setQuality(quality);
    entities.emissiveGain.value = quality.bloomLevels > 0 ? SPRITE_EMISSIVE_GAIN_BLOOM : 1;
  };

  const projector: Projector = {
    get pixelScale() {
      return frame.pixelScale;
    },
    worldToCss(x, y, out) {
      const vx = frame.originX + REF_ORIGIN_X + PX_PER_U * x;
      const vy = frame.originY + REF_ORIGIN_Y + DEPTH_PX_PER_U * y;
      out.x = (offsetX + vx * frame.pixelScale) * cssPerPhysical;
      out.y = (offsetY + vy * frame.pixelScale) * cssPerPhysical;
    },
    cssToWorld(cssX, cssY, out) {
      const vx = (cssX / cssPerPhysical - offsetX) / frame.pixelScale;
      const vy = (cssY / cssPerPhysical - offsetY) / frame.pixelScale;
      out.x = (vx - frame.originX - REF_ORIGIN_X) / PX_PER_U;
      out.y = (vy - frame.originY - REF_ORIGIN_Y) / DEPTH_PX_PER_U;
    },
  };

  /** Render-only reactions to sim events: Pulse light clock and screen shake. */
  const readEvents = (f: RenderFrame): void => {
    const ev = f.events;
    for (let i = 0; i < ev.count; i++) {
      const type = ev.type[i];
      if (type === SimEventType.PulseStarted) pulseOpened(pulse, f.timeSec);
      else if (type === SimEventType.PulseEnded) pulseClosed(pulse, f.timeSec);
      else if (type === SimEventType.PlayerDamaged) addTrauma(shake, SHAKE_TRAUMA.playerHit);
      else if (type === SimEventType.WardenKilled) addTrauma(shake, SHAKE_TRAUMA.wardenKilled);
      else if (type === SimEventType.BossKilled) addTrauma(shake, SHAKE_TRAUMA.bossKilled);
    }
  };

  const debug: RendererDebug = {
    overrideQuality(o) {
      override = o;
      quality = effective(o === null ? baseQuality : { ...baseQuality, ...o });
      applyQuality();
    },
  };

  const renderNow = (f: RenderFrame): void => {
    gl.info.reset();
    readEvents(f);
    lighting.update(f.timeSec);
    samplePulseLight(pulse, f.timeSec, quality.flashScale, pulseSample);
    env?.update(f.timeSec, pulseSample, frame.width, frame.height);
    env?.renderShadows(gl);
    entities.update(f);

    // Scene L0 to L3 into the HDR target (depth texture kept for the player mask).
    gl.setRenderTarget(post.sceneTarget);
    gl.clear(true, true, false);
    gl.render(scene, camera);

    // Danger L4: its own transparent target, composited after post (never blurred or bloomed).
    gl.setRenderTarget(post.dangerTarget);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.render(dangerScene, camera);
    gl.setClearColor(new Color(biome.fog.color), 1);

    // Player mask for the silhouette.
    const v = f.view;
    const p = v.player;
    const px = p.prevX + (p.x - p.prevX) * f.alpha;
    const py = p.prevY + (p.y - p.prevY) * f.alpha;
    const running = v.phase === 'pulse' && currentArena !== null;
    compositeParams.hasPlayer = false;
    compositeParams.silhouette = running && playerCoveredByDanger(v, px, py);
    gl.setRenderTarget(post.maskTarget);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.setClearColor(new Color(biome.fog.color), 1);
    if (running && playerHook.visible && playerHook.rect !== null) {
      maskBatch.begin();
      maskBatch.push(
        playerHook.x,
        playerHook.y,
        0,
        playerHook.rect,
        playerHook.anchorX,
        playerHook.anchorY,
        playerHook.flip,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
      );
      maskBatch.end();
      gl.render(maskScene, camera);
      compositeParams.hasPlayer = true;
    } else if (running) {
      compositeParams.hasPlayer = true;
    }

    // Post and composite.
    decayShake(shake, f.timeSec);
    shakeOffset(shake, f.timeSec, quality.screenShake, shakeOut);
    worldToVirtual(frame, px, py, 0, feet);
    compositeParams.timeSec = f.timeSec;
    compositeParams.shakeX = shakeOut.x;
    compositeParams.shakeY = -shakeOut.y;
    compositeParams.feetX = Math.round(feet.x);
    compositeParams.feetY = frame.height - Math.round(feet.y);
    gl.setRenderTarget(null);
    gl.setViewport(0, 0, physicalW, physicalH);
    gl.clear(true, false, false);
    post.run(gl, compositeParams, viewport);

    frameStats.drawCalls = gl.info.render.calls;
    frameStats.triangles = gl.info.render.triangles;
  };

  let lastRenderWall = Number.NEGATIVE_INFINITY;
  let deferredPending = false;
  const deferred: {
    view: RenderFrame['view'];
    alpha: number;
    timeSec: number;
    events: RenderFrame['events'];
  } = {
    view: null as unknown as RenderFrame['view'],
    alpha: 0,
    timeSec: 0,
    events: NO_EVENTS,
  };
  const flushDeferred = (): void => {
    deferredPending = false;
    lastRenderWall = performance.now();
    renderNow(deferred);
  };

  const renderer: Renderer & { readonly debug: RendererDebug } = {
    projector,
    debug,
    resize(w, h) {
      // Software mode: back the canvas at virtual resolution (one virtual px per canvas px).
      const down = software ? virtualFrameFor(Math.max(1, w), Math.max(1, h)).pixelScale : 1;
      physicalW = Math.max(1, Math.floor(w / down));
      physicalH = Math.max(1, Math.floor(h / down));
      frame = virtualFrameFor(physicalW, physicalH);
      offsetX = Math.floor((physicalW - frame.width * frame.pixelScale) / 2);
      offsetY = Math.floor((physicalH - frame.height * frame.pixelScale) / 2);
      const cssW = canvas.clientWidth > 0 ? canvas.clientWidth : physicalW;
      cssPerPhysical = cssW / physicalW;
      gl.setSize(physicalW, physicalH, false);
      viewport.x = offsetX;
      // GL viewport origin is bottom-left: the letterbox offset is symmetric up to one pixel.
      viewport.y = physicalH - offsetY - frame.height * frame.pixelScale;
      viewport.w = frame.width * frame.pixelScale;
      viewport.h = frame.height * frame.pixelScale;
      post.resize(frame, viewport.w, viewport.h);
      fitWorldCamera(camera, frame);
      entities.resize(frame);
      maskBatch.setResolution(frame.width, frame.height);
    },
    applySettings(s: Settings) {
      entities.applySettings(s);
      baseQuality = qualityProfile(s);
      quality = effective(override === null ? baseQuality : { ...baseQuality, ...override });
      applyQuality();
    },
    setArena(arena: ArenaDef, biomeId: string) {
      biome = palette.biomes.find((b) => b.contentId === biomeId) ?? defaultBiome;
      currentArena = arena;
      if (env !== null) {
        scene.remove(env.group);
        env.dispose();
      }
      lighting.setBiome(biome, arena);
      env = createArenaEnvironment(arena, palette, biome, lighting, assets.tiles);
      scene.add(env.group);
      scene.background = new Color(biome.fog.color);
      gl.setClearColor(new Color(biome.fog.color), 1);
      post.setBiome(biome);
      applyQuality();
    },
    render(f: RenderFrame) {
      // Frames rendered back to back in one task (e2e step loops) are never shown: coalesce them into
      // one render on the next animation frame so the GPU queue cannot pile up (software GL in CI).
      const now = performance.now();
      if (now - lastRenderWall < COALESCE_MS) {
        // Keep the render-side clocks (Pulse light, shake) in step with the skipped frame's events.
        readEvents(f);
        deferred.view = f.view;
        deferred.alpha = f.alpha;
        deferred.timeSec = f.timeSec;
        if (!deferredPending) {
          deferredPending = true;
          requestAnimationFrame(flushDeferred);
        }
        return;
      }
      lastRenderWall = now;
      renderNow(f);
    },
    stats() {
      return frameStats;
    },
    dispose() {
      env?.dispose();
      post.dispose();
      entities.dispose();
      maskBatch.dispose();
      maskMat.dispose();
      atlas.texture.dispose();
      gl.dispose();
    },
  };
  return renderer;
};
