// Diorama environment from arena data (LP; LD 4, 7, 8, 12.2; art-direction 6, 7, 10).
// Built once per setArena from content/levels/<arena>.json (read at runtime, nothing hardcoded) and
// art/palette.json: floor + lip + ground (1 draw), merged decor (1), obstacles (1), glass rim (1),
// backdrop flat (1), ambient particles (1). Static decor shadow map rendered on demand.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DepthTexture,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';
import { CAMERA_PITCH_SIN } from '../../core/index.ts';
import type { ArenaDef, PaletteBiomeDef, PaletteDef, SpriteSheetDef } from '../../core/index.ts';
import type { PulseLightSample } from '../pipeline/pulse-light.ts';
import type { QualityProfile } from '../pipeline/quality.ts';
import type { SceneLighting } from '../pipeline/scene-lighting.ts';
import { ENV_AMBIENT_FRAGMENT, ENV_AMBIENT_VERTEX } from '../shaders/env-ambient.ts';
import { ENV_BACKDROP_FRAGMENT, ENV_BACKDROP_VERTEX } from '../shaders/env-backdrop.ts';
import { ENV_DECOR_FRAGMENT, ENV_DECOR_VERTEX } from '../shaders/env-decor.ts';
import { ENV_FLOOR_FRAGMENT, ENV_FLOOR_VERTEX } from '../shaders/env-floor.ts';
import { ENV_RIM_FRAGMENT, ENV_RIM_VERTEX } from '../shaders/env-rim.ts';
import { SHADOW_DEPTH_FRAGMENT, SHADOW_DEPTH_VERTEX } from '../shaders/shadow-depth.ts';
import { buildDecor, buildObstacle } from './decor.ts';
import { buildEnvAtlas, hash3 } from './env-textures.ts';
import { MeshBuilder } from './mesh-builder.ts';

/** Emissive gain on lantern paper: HDR above 1.0 so it feeds the bloom (art-direction 7). */
export const EMISSIVE_GAIN = 2.6;
/** Rim thickness across the boundary line (u): reads as a 2 px line on the side edges. */
const RIM_THICKNESS_U = 0.14;
/** Backdrop flat: floor depth of its bottom edge and its size (u). */
const BACKDROP_Y = -16.6;
const BACKDROP_W = 140;
const BACKDROP_H = 40;
/** Floor quad extent (u): covers ultrawide frames (|x| up to 28 u visible) with margin. */
const FLOOR_HALF_W = 48;
const FLOOR_Y0 = -40;
const FLOOR_Y1 = 30;
/** Boss stage floor ring darkening (contrast about 1.08, under LD's 1.15 maximum). */
const BOSS_RING_DARKEN = 0.07;
/** Moth orbit radius around a lantern (u). */
const MOTH_ORBIT_U = 0.7;
const MAX_MOTH_ANCHORS = 16;

export interface ArenaEnvironment {
  /** Objects for the main scene (L0). */
  readonly group: Group;
  readonly triangles: number;
  update(timeSec: number, pulse: PulseLightSample, virtualW: number, virtualH: number): void;
  setQuality(q: QualityProfile): void;
  /** Render the static decor shadow map if needed (after setArena or a quality change). */
  renderShadows(gl: WebGLRenderer): void;
  dispose(): void;
}

function linearVec(hex: string): Vector3 {
  const c = new Color(hex);
  return new Vector3(c.r, c.g, c.b);
}

/** Outward half-planes (nx, ny, d) of a convex boundary polygon, for fog and outside distance. */
export function boundaryEdges(boundary: readonly (readonly [number, number])[]): Vector3[] {
  const n = boundary.length;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of boundary) {
    cx += x / n;
    cy += y / n;
  }
  const out: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = boundary[i] ?? [0, 0];
    const b = boundary[(i + 1) % n] ?? [0, 0];
    let nx = b[1] - a[1];
    let ny = -(b[0] - a[0]);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    if (nx * (cx - a[0]) + ny * (cy - a[1]) > 0) {
      nx = -nx;
      ny = -ny;
    }
    out.push(new Vector3(nx, ny, nx * a[0] + ny * a[1]));
  }
  return out.slice(0, 8);
}

/** Rasterise AD's floor tile variants, stacked vertically, remapped to the biome's env tokens. */
function floorTileTexture(
  tile: SpriteSheetDef | undefined,
  palette: PaletteDef,
  biome: PaletteBiomeDef,
): {
  tex: DataTexture;
  variants: number;
} {
  const resolve = (token: string): [number, number, number] => {
    const m = /^b[123]\.(.+)$/.exec(token);
    const hex =
      (m !== null ? biome.env[m[1] ?? ''] : undefined) ??
      palette.core[token] ??
      biome.env['floor-light'] ??
      '#6B6360';
    const v = Number.parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  const frames: readonly (readonly string[])[] =
    tile === undefined ? [] : (Object.values(tile.animations)[0]?.frames ?? []);
  const variants = Math.max(1, frames.length);
  const data = new Uint8Array(16 * 16 * variants * 4);
  const legend = tile?.legend ?? {};
  const fallback = resolve('b1.floor-light');
  for (let v = 0; v < variants; v++) {
    const rows = frames[v] ?? [];
    for (let y = 0; y < 16; y++) {
      const row = rows[y] ?? '';
      for (let x = 0; x < 16; x++) {
        const token = legend[row[x] ?? ''];
        const rgb = token === undefined ? fallback : resolve(token);
        const i = ((v * 16 + y) * 16 + x) * 4;
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
      }
    }
  }
  const tex = new DataTexture(data, 16, 16 * variants, RGBAFormat, UnsignedByteType);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  return { tex, variants };
}

export function createArenaEnvironment(
  arena: ArenaDef,
  palette: PaletteDef,
  biome: PaletteBiomeDef,
  lighting: SceneLighting,
  tiles: readonly SpriteSheetDef[],
): ArenaEnvironment {
  const group = new Group();
  const disposables: { dispose(): void }[] = [];
  const voidHex = biome.fog.color;
  const edges = boundaryEdges(arena.arena.boundary);
  const backY = Math.min(...arena.arena.boundary.map((p) => p[1]));
  const time = { value: 0 };
  const common = {
    uFogColor: { value: linearVec(voidHex) },
    uFog: {
      value: new Vector4(
        arena.lighting.edgeFade.startOutside,
        arena.lighting.edgeFade.endOutside,
        biome.fog.strength,
        0.5,
      ),
    },
    uEdges: { value: [...edges, ...Array.from({ length: 8 - edges.length }, () => new Vector3())] },
    uEdgeCount: { value: edges.length },
    uBackY: { value: backY },
  };

  // Env atlas (procedural pixel textures, biome tokens).
  const atlasData = buildEnvAtlas(palette, biome.id);
  const atlas = new DataTexture(
    atlasData.data,
    atlasData.width,
    atlasData.height,
    RGBAFormat,
    UnsignedByteType,
  );
  atlas.magFilter = NearestFilter;
  atlas.minFilter = NearestFilter;
  atlas.generateMipmaps = false;
  atlas.colorSpace = SRGBColorSpace;
  atlas.flipY = false;
  atlas.needsUpdate = true;
  disposables.push(atlas);

  // Floor, lip, ground.
  const tileDef = tiles.find((t) => t.id === arena.arena.floor.tileId) ?? tiles[0];
  const floorTile = floorTileTexture(tileDef, palette, biome);
  disposables.push(floorTile.tex);
  const xs = arena.arena.boundary.map((p) => p[0]);
  const ys = arena.arena.boundary.map((p) => p[1]);
  const halfW = (Math.max(...xs) - Math.min(...xs)) / 2;
  const halfD = (Math.max(...ys) - Math.min(...ys)) / 2;
  const pulse = { value: new Vector4(-1, 0, 0, 0) };
  const boss = arena.bossStage.shape;
  const floorMat = new ShaderMaterial({
    vertexShader: ENV_FLOOR_VERTEX,
    fragmentShader: ENV_FLOOR_FRAGMENT,
    uniforms: {
      ...lighting.uniforms,
      ...common,
      uTile: { value: floorTile.tex },
      uVariants: { value: floorTile.variants },
      uLip: { value: arena.arena.lip },
      uCurb: { value: linearVec(biome.env['curb'] ?? palette.core['shadow'] ?? '#3E3A46') },
      uPulse: pulse,
      uPulseOrigin: { value: new Vector2(arena.pulseOrigin[0], arena.pulseOrigin[1]) },
      uPulseExtent: { value: new Vector2(halfW, halfD) },
      uGlass: { value: linearVec(biome.env['glass'] ?? palette.core['dust'] ?? '#B7C3CB') },
      uBossRing: {
        value:
          boss.type === 'circle'
            ? new Vector4(boss.center[0], boss.center[1], boss.radius, BOSS_RING_DARKEN)
            : new Vector4(0, 0, 0, 0),
      },
    },
  });
  const floorGeo = new PlaneGeometry(FLOOR_HALF_W * 2, FLOOR_Y1 - FLOOR_Y0);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(0, 0, (FLOOR_Y0 + FLOOR_Y1) / 2);
  const floor = new Mesh(floorGeo, floorMat);
  floor.renderOrder = 0;
  floor.frustumCulled = false;
  group.add(floor);
  disposables.push(floorGeo, floorMat);

  // Decor and obstacles: one merged mesh each.
  const lightSlot = (id: string): number => arena.lighting.points.findIndex((p) => p.id === id);
  const decorBuilder = new MeshBuilder();
  for (const d of arena.decor) buildDecor(decorBuilder, d, lightSlot);
  const decorGeo = decorBuilder.build();
  const obstacleBuilder = new MeshBuilder();
  for (const o of arena.obstacles) buildObstacle(obstacleBuilder, o);
  const obstacleGeo = obstacleBuilder.build();
  const decorUniforms = {
    ...lighting.uniforms,
    ...common,
    uAtlas: { value: atlas },
    uAtlasSize: { value: new Vector2(atlasData.width, atlasData.height) },
    uFlicker: { value: lighting.flicker },
    uEmissiveGain: { value: EMISSIVE_GAIN },
    uTime: time,
  };
  const decorMat = new ShaderMaterial({
    vertexShader: ENV_DECOR_VERTEX,
    fragmentShader: ENV_DECOR_FRAGMENT,
    uniforms: decorUniforms,
    side: DoubleSide,
  });
  const decor = new Mesh(decorGeo, decorMat);
  decor.renderOrder = 0;
  decor.frustumCulled = false;
  group.add(decor);
  // Obstacles never hide actors (LD R8): no depth write, drawn before every actor layer.
  const obstacleMat = new ShaderMaterial({
    vertexShader: ENV_DECOR_VERTEX,
    fragmentShader: ENV_DECOR_FRAGMENT,
    uniforms: decorUniforms,
    side: FrontSide,
    depthWrite: false,
  });
  const obstacles = new Mesh(obstacleGeo, obstacleMat);
  obstacles.renderOrder = 0.5;
  obstacles.frustumCulled = false;
  group.add(obstacles);
  disposables.push(decorGeo, obstacleGeo, decorMat, obstacleMat);

  // Glass rim: thin boxes along every boundary edge.
  const rimBuilder = new MeshBuilder();
  const rim = arena.arena.rim;
  const b = arena.arena.boundary;
  for (let i = 0; i < b.length; i++) {
    const p0 = b[i] ?? [0, 0];
    const p1 = b[(i + 1) % b.length] ?? [0, 0];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy);
    rimBuilder.setObject(
      (p0[0] + p1[0]) / 2,
      (p0[1] + p1[1]) / 2,
      (Math.atan2(-dy, dx) * 180) / Math.PI,
    );
    rimBuilder.box({ x: 0, y: 0, z: 0 }, len + RIM_THICKNESS_U * 0.4, rim.height, RIM_THICKNESS_U, {
      mat: 0,
    });
  }
  const rimGeo = rimBuilder.build();
  const rimFlash = { value: 0 };
  const rimMat = new ShaderMaterial({
    vertexShader: ENV_RIM_VERTEX,
    fragmentShader: ENV_RIM_FRAGMENT,
    uniforms: {
      ...lighting.uniforms,
      uRimColor: {
        value: linearVec(palette.core[rim.colorToken] ?? biome.env[rim.colorToken] ?? '#A39A8C'),
      },
      uRimOpacity: { value: rim.opacity },
      uFlashColor: { value: linearVec(palette.core['bone'] ?? '#EDE6D8') },
      uFlash: rimFlash,
      uTime: time,
    },
    transparent: true,
    depthWrite: false,
    side: FrontSide,
  });
  const rimMesh = new Mesh(rimGeo, rimMat);
  rimMesh.renderOrder = 0.6;
  rimMesh.frustumCulled = false;
  group.add(rimMesh);
  disposables.push(rimGeo, rimMat);

  // Backdrop flat: camera-facing, tilted back by the camera pitch.
  const pitch = Math.asin(CAMERA_PITCH_SIN);
  const backGeo = new PlaneGeometry(BACKDROP_W, BACKDROP_H);
  backGeo.translate(0, BACKDROP_H / 2, 0);
  const voidV = linearVec(voidHex);
  const fillV = linearVec(biome.fill.color);
  const backMat = new ShaderMaterial({
    vertexShader: ENV_BACKDROP_VERTEX,
    fragmentShader: ENV_BACKDROP_FRAGMENT,
    uniforms: {
      uVoid: { value: voidV },
      uHaze: { value: voidV.clone().multiplyScalar(1.5).add(fillV.clone().multiplyScalar(0.06)) },
      uGlass: { value: linearVec(biome.env['glass'] ?? '#B7C3CB') },
      uWindow: { value: linearVec(biome.point.color) },
      uTime: time,
    },
  });
  const backdrop = new Mesh(backGeo, backMat);
  backdrop.position.set(0, 0, BACKDROP_Y);
  backdrop.rotation.x = -pitch;
  backdrop.renderOrder = -1;
  backdrop.frustumCulled = false;
  group.add(backdrop);
  disposables.push(backGeo, backMat);

  // Ambient particles (counts from arena data, scaled by quality).
  const anchors: Vector4[] = [];
  for (const d of arena.decor) {
    if (anchors.length >= MAX_MOTH_ANCHORS) break;
    const light =
      d.lightId === undefined ? undefined : arena.lighting.points.find((p) => p.id === d.lightId);
    if (light !== undefined)
      anchors.push(new Vector4(light.pos[0], light.pos[1], light.pos[2], MOTH_ORBIT_U));
  }
  while (anchors.length < MAX_MOTH_ANCHORS) anchors.push(new Vector4(0, -50, 0, 0));
  const ambientRes = { value: new Vector2(1, 1) };
  const ambientMat = new ShaderMaterial({
    vertexShader: ENV_AMBIENT_VERTEX,
    fragmentShader: ENV_AMBIENT_FRAGMENT,
    uniforms: {
      uTime: time,
      uRes: ambientRes,
      uDustBox: {
        value: new Vector4(
          Math.min(...xs) + 1,
          Math.max(...xs) - 1,
          Math.min(...ys) + 1,
          Math.max(...ys) - 0.5,
        ),
      },
      uAnchors: { value: anchors },
    },
    transparent: true,
    depthWrite: false,
  });
  const ambientGeo = new BufferGeometry();
  const ambient = new Points(ambientGeo, ambientMat);
  ambient.renderOrder = 2.5;
  ambient.frustumCulled = false;
  group.add(ambient);
  disposables.push(ambientGeo, ambientMat);
  const liveAnchors = anchors.filter((a) => a.w > 0).length;
  const buildAmbient = (fraction: number, cap: number): void => {
    const seeds: number[] = [];
    const params: number[] = [];
    const colors: number[] = [];
    let total = 0;
    arena.ambient.particles.forEach((def, k) => {
      const isDecor = def.area === 'decor';
      if (isDecor && liveAnchors === 0) return;
      const count = Math.min(Math.floor(def.max * fraction), cap - total);
      // Core token or biome token (b1.paper): biome tokens resolve in the current biome first.
      const bt = /^b[123]\.(.+)$/.exec(def.colorToken);
      const color =
        palette.core[def.colorToken] ??
        (bt === null
          ? undefined
          : (biome.env[bt[1] ?? ''] ??
            palette.biomes.find((x) => x.id === def.colorToken.slice(0, 2))?.env[bt[1] ?? '']));
      if (color === undefined) return;
      const lin = linearVec(color);
      for (let i = 0; i < count; i++) {
        seeds.push(hash3(i, k, 1), hash3(i, k, 2), hash3(i, k, 3), hash3(i, k, 4));
        colors.push(lin.x, lin.y, lin.z);
        // LD 7.3: arena particles at most 25% opacity.
        params.push(
          isDecor ? 1 : 0,
          def.sizePx,
          isDecor ? def.opacity : Math.min(def.opacity, 0.25),
          isDecor ? i % liveAnchors : 0,
        );
      }
      total += Math.max(0, count);
    });
    ambientGeo.setAttribute('position', new BufferAttribute(new Float32Array(total * 3), 3));
    ambientGeo.setAttribute('aSeed', new BufferAttribute(new Float32Array(seeds), 4));
    ambientGeo.setAttribute('aParams', new BufferAttribute(new Float32Array(params), 4));
    ambientGeo.setAttribute('aColor', new BufferAttribute(new Float32Array(colors), 3));
    ambientGeo.setDrawRange(0, total);
  };
  buildAmbient(1, 1000);

  // Static decor shadow map (key light), sized by quality.
  const shadowScene = new Scene();
  const depthMat = new ShaderMaterial({
    vertexShader: SHADOW_DEPTH_VERTEX,
    fragmentShader: SHADOW_DEPTH_FRAGMENT,
    side: DoubleSide,
  });
  shadowScene.add(new Mesh(decorGeo, depthMat), new Mesh(obstacleGeo, depthMat));
  disposables.push(depthMat);
  const shadowCam = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  let shadowRT: WebGLRenderTarget | null = null;
  let shadowDirty = true;
  let shadowSize = 0;
  let shadowPcf = false;
  const fitShadowCamera = (): void => {
    const dir = lighting.uniforms.uKeyDir.value;
    const target = new Vector3(0, 0, -6);
    shadowCam.position.copy(target).addScaledVector(dir, 60);
    shadowCam.up.set(0, 1, 0);
    shadowCam.lookAt(target);
    shadowCam.updateMatrixWorld(true);
    const inv = shadowCam.matrixWorldInverse;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    const v = new Vector3();
    for (const cx of [-30, 30])
      for (const cy of [0, 8])
        for (const cz of [-20, 14]) {
          v.set(cx, cy, cz).applyMatrix4(inv);
          x0 = Math.min(x0, v.x);
          x1 = Math.max(x1, v.x);
          y0 = Math.min(y0, v.y);
          y1 = Math.max(y1, v.y);
          z0 = Math.min(z0, v.z);
          z1 = Math.max(z1, v.z);
        }
    shadowCam.left = x0;
    shadowCam.right = x1;
    shadowCam.bottom = y0;
    shadowCam.top = y1;
    shadowCam.near = -z1 - 1;
    shadowCam.far = -z0 + 1;
    shadowCam.updateProjectionMatrix();
    lighting.uniforms.uShadowMatrix.value.multiplyMatrices(
      shadowCam.projectionMatrix,
      shadowCam.matrixWorldInverse,
    );
  };

  const triangles =
    decorBuilder.triangleCount + obstacleBuilder.triangleCount + rimBuilder.triangleCount + 4;

  return {
    group,
    triangles,
    update(timeSec, p, vw, vh) {
      time.value = timeSec;
      pulse.value.set(p.waveRadius, p.waveAlpha, p.floorLift, p.rimFlash);
      rimFlash.value = p.rimFlash;
      ambientRes.value.set(vw, vh);
    },
    setQuality(q) {
      buildAmbient(q.ambientFraction, q.particleCap);
      if (q.shadowMapSize !== shadowSize || q.shadowPcf !== shadowPcf) {
        shadowSize = q.shadowMapSize;
        shadowPcf = q.shadowPcf;
        shadowRT?.dispose();
        shadowRT = null;
        shadowDirty = true;
        lighting.uniforms.uShadowOn.value = 0;
        lighting.uniforms.uShadowMap.value = null;
      }
    },
    renderShadows(gl) {
      if (!shadowDirty) return;
      shadowDirty = false;
      if (shadowSize <= 0) {
        lighting.uniforms.uShadowOn.value = 0;
        lighting.uniforms.uShadowMap.value = null;
        return;
      }
      if (shadowRT === null) {
        const depth = new DepthTexture(shadowSize, shadowSize);
        depth.magFilter = NearestFilter;
        depth.minFilter = NearestFilter;
        shadowRT = new WebGLRenderTarget(shadowSize, shadowSize, {
          depthTexture: depth,
          depthBuffer: true,
        });
      }
      fitShadowCamera();
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(shadowRT);
      gl.clear(true, true, false);
      gl.render(shadowScene, shadowCam);
      gl.setRenderTarget(prev);
      lighting.uniforms.uShadowMap.value = shadowRT.depthTexture;
      lighting.uniforms.uShadowOn.value = 1;
      lighting.uniforms.uShadowTexel.value = 1 / shadowSize;
      lighting.uniforms.uShadowPcf.value = shadowPcf ? 1 : 0;
    },
    dispose() {
      for (const d of disposables) d.dispose();
      shadowRT?.dispose();
      lighting.uniforms.uShadowMap.value = null;
      lighting.uniforms.uShadowOn.value = 0;
    },
  };
}
