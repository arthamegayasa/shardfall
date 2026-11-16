// Renderer: world to a virtual-resolution target, then an integer nearest upscale to the canvas
// (architecture.md 4, 7.3, 7.5). LP. M1 scope: camera, floor, entity layers (AD, M1-05), upscale.
// The danger scene (L4) is drawn after the main scene; once post-processing lands it moves to dangerRT.
// TODO(LP + AD, M2): bloom, tilt-shift DoF band, danger pass (L4 after post), lights, quality levels.

import {
  Color,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import {
  REF_ORIGIN_X,
  REF_ORIGIN_Y,
  PX_PER_U,
  DEPTH_PX_PER_U,
  virtualFrameFor,
} from '../../core/index.ts';
import type { ArenaDef, Settings, VirtualFrame } from '../../core/index.ts';
import type { CreateRenderer, Projector, RenderFrame, Renderer } from '../../core/dom.ts';
import { createWorldCamera, fitWorldCamera } from '../camera.ts';
import { createFloorMesh, createFloorTexture, DEFAULT_ARENA_BOUNDARY } from '../env/floor.ts';
import { createSpriteAtlas } from '../sprites/atlas-texture.ts';
import { createEntityLayers } from '../sprites/entity-layers.ts';

/** Palette token used for the void around the stage until AD's biome fog lands. */
const VOID_TOKEN = 'night';
const FLOOR_FALLBACK_TOKEN = 'floor-mid';

export const createRenderer: CreateRenderer = (canvas, assets, data): Renderer => {
  const gl = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  gl.setPixelRatio(1);
  gl.outputColorSpace = SRGBColorSpace;
  const voidHex = assets.palette.core[VOID_TOKEN] ?? '#000000';
  gl.setClearColor(new Color(voidHex), 1);

  // World scene into the virtual target.
  const scene = new Scene();
  scene.background = new Color(voidHex);
  const camera = createWorldCamera();
  const atlas = createSpriteAtlas([...assets.sprites], assets.palette);
  const floorTile = assets.tiles[0];
  const floorTexture =
    floorTile !== undefined ? createFloorTexture(floorTile, assets.palette) : null;
  const floorFallback = assets.palette.core[FLOOR_FALLBACK_TOKEN] ?? '#555555';
  let floor: Mesh = createFloorMesh(DEFAULT_ARENA_BOUNDARY, floorTexture, floorFallback);
  scene.add(floor);

  // Entities (AD, M1-05): L1 to L3 in the main scene, L4 danger in its own scene drawn last.
  const entities = createEntityLayers(atlas.texture, atlas.manifest, assets.palette, data);
  for (const o of entities.sceneObjects) scene.add(o);
  const dangerScene = new Scene();
  for (const o of entities.dangerObjects) dangerScene.add(o);

  // Upscale pass: nearest, integer scale, centred letterbox.
  const target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    magFilter: NearestFilter,
    minFilter: NearestFilter,
    depthBuffer: true,
    generateMipmaps: false,
  });
  const blitScene = new Scene();
  const blitCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blitQuad = new Mesh(
    new PlaneGeometry(2, 2),
    new MeshBasicMaterial({ map: target.texture }),
  );
  blitScene.add(blitQuad);

  let frame: VirtualFrame = virtualFrameFor(1, 1);
  let physicalW = 1;
  let physicalH = 1;
  let offsetX = 0;
  let offsetY = 0;
  let cssPerPhysical = 1;

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

  return {
    projector,
    resize(w, h) {
      physicalW = Math.max(1, Math.floor(w));
      physicalH = Math.max(1, Math.floor(h));
      frame = virtualFrameFor(physicalW, physicalH);
      offsetX = Math.floor((physicalW - frame.width * frame.pixelScale) / 2);
      offsetY = Math.floor((physicalH - frame.height * frame.pixelScale) / 2);
      const cssW = canvas.clientWidth > 0 ? canvas.clientWidth : physicalW;
      cssPerPhysical = cssW / physicalW;
      gl.setSize(physicalW, physicalH, false);
      target.setSize(frame.width, frame.height);
      fitWorldCamera(camera, frame);
      entities.resize(frame);
    },
    applySettings(s: Settings) {
      entities.applySettings(s);
      // TODO(LP, M2): quality levels, reduce effects, screen shake, colour vision LUT.
    },
    setArena(arena: ArenaDef, _biomeId: string) {
      scene.remove(floor);
      floor = createFloorMesh(arena.arena.boundary, floorTexture, floorFallback);
      scene.add(floor);
      // TODO(AD, M1-05): biome palette, lip, rim, decor, lights from arena + art/palette.json.
    },
    render(f: RenderFrame) {
      entities.update(f);
      gl.setRenderTarget(target);
      gl.setViewport(0, 0, frame.width, frame.height);
      gl.render(scene, camera);
      // L4 on top of the finished scene, without clearing it.
      gl.autoClear = false;
      gl.render(dangerScene, camera);
      gl.autoClear = true;
      gl.setRenderTarget(null);
      gl.setViewport(0, 0, physicalW, physicalH);
      gl.clear();
      gl.setViewport(
        offsetX,
        offsetY,
        frame.width * frame.pixelScale,
        frame.height * frame.pixelScale,
      );
      gl.render(blitScene, blitCamera);
    },
    stats() {
      return { drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles };
    },
    dispose() {
      target.dispose();
      entities.dispose();
      atlas.texture.dispose();
      floorTexture?.dispose();
      gl.dispose();
    },
  };
};
