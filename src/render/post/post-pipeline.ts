// Hand-written post-processing (LP; architecture 1 #2, 7.5). Targets at virtual resolution, one final
// pass at physical resolution. Order: scene (HDR, external) -> bloom (1/2, and 1/4 on High) ->
// tilt-shift (2 passes, band rows only) -> composite (nearest scene, bilinear blur and bloom, vignette,
// grade, glass glint) -> danger L4 and player silhouette on top -> canvas.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import type { WebGLRenderer } from 'three';
import type { PaletteBiomeDef, PaletteDef, VirtualFrame } from '../../core/index.ts';
import type { QualityProfile } from '../pipeline/quality.ts';
import { POST_BLOOM_PREFILTER_FRAGMENT } from '../shaders/post-bloom-prefilter.ts';
import { POST_BLUR_FRAGMENT } from '../shaders/post-blur.ts';
import { POST_COMPOSITE_FRAGMENT } from '../shaders/post-composite.ts';
import { POST_FULLSCREEN_VERTEX } from '../shaders/post-fullscreen.ts';
import { POST_TILT_SHIFT_FRAGMENT } from '../shaders/post-tilt-shift.ts';

/** Bloom strength (art-direction 7: 0.8). */
export const BLOOM_INTENSITY = 0.8;
/** Bloom blur spread in source texels per tap step (about 3 virtual px radius at half res). */
const BLOOM_SPREAD = 1.0;
/** Vignette: 20% at the corners, starting at normalised distance 0.55 (art-direction 7). */
export const VIGNETTE_STRENGTH = 0.2;
export const VIGNETTE_START = 0.55;

export interface CompositeParams {
  readonly timeSec: number;
  readonly shakeX: number;
  readonly shakeY: number;
  readonly silhouette: boolean;
  readonly hasPlayer: boolean;
  /** Player feet in virtual px, GL origin (bottom-left). */
  readonly feetX: number;
  readonly feetY: number;
}

export interface PostPipeline {
  readonly sceneTarget: WebGLRenderTarget;
  readonly dangerTarget: WebGLRenderTarget;
  readonly maskTarget: WebGLRenderTarget;
  readonly sceneDepth: DepthTexture;
  resize(frame: VirtualFrame, scaledW: number, scaledH: number): void;
  setQuality(q: QualityProfile): void;
  setBiome(biome: PaletteBiomeDef): void;
  /** Post passes and the final composite into the currently set canvas viewport. */
  run(
    gl: WebGLRenderer,
    p: CompositeParams,
    viewport: { x: number; y: number; w: number; h: number },
  ): void;
  dispose(): void;
}

function rt(
  type: typeof HalfFloatType | typeof UnsignedByteType,
  linear: boolean,
): WebGLRenderTarget {
  const filter = linear ? LinearFilter : NearestFilter;
  return new WebGLRenderTarget(1, 1, {
    type,
    magFilter: filter,
    minFilter: filter,
    depthBuffer: false,
    generateMipmaps: false,
  });
}

function linearVec(hex: string): Vector3 {
  const c = new Color(hex);
  return new Vector3(c.r, c.g, c.b);
}

export function createPostPipeline(palette: PaletteDef): PostPipeline {
  const sceneDepth = new DepthTexture(1, 1);
  sceneDepth.magFilter = NearestFilter;
  sceneDepth.minFilter = NearestFilter;
  // Scene: HDR so emissive texels exceed 1.0; linear filter for the blur passes (the composite reads
  // it with texelFetch, which ignores filtering, so sprites stay exact).
  const sceneTarget = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    magFilter: LinearFilter,
    minFilter: LinearFilter,
    depthBuffer: true,
    depthTexture: sceneDepth,
    generateMipmaps: false,
  });
  const dangerTarget = rt(HalfFloatType, false);
  const maskTarget = rt(UnsignedByteType, false);
  const blurTmp = rt(HalfFloatType, true);
  const blurTarget = rt(HalfFloatType, true);
  const bloomA = rt(HalfFloatType, true);
  const bloomATmp = rt(HalfFloatType, true);
  const bloomB = rt(HalfFloatType, true);
  const bloomBTmp = rt(HalfFloatType, true);
  const targets = [
    sceneTarget,
    dangerTarget,
    maskTarget,
    blurTmp,
    blurTarget,
    bloomA,
    bloomATmp,
    bloomB,
    bloomBTmp,
  ];

  const geo = new BufferGeometry();
  geo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  const quad = new Mesh(geo);
  quad.frustumCulled = false;
  const passScene = new Scene();
  passScene.add(quad);
  const passCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const mat = (
    fragmentShader: string,
    uniforms: Record<string, { value: unknown }>,
  ): ShaderMaterial =>
    new ShaderMaterial({
      vertexShader: POST_FULLSCREEN_VERTEX,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
  const prefilter = mat(POST_BLOOM_PREFILTER_FRAGMENT, {
    uSource: { value: null },
    uTexel: { value: new Vector2() },
  });
  const blur = mat(POST_BLUR_FRAGMENT, {
    uSource: { value: null },
    uDir: { value: new Vector2() },
  });
  const tilt = mat(POST_TILT_SHIFT_FRAGMENT, {
    uSource: { value: null },
    uSize: { value: new Vector2(1, 1) },
    uAxis: { value: new Vector2(1, 0) },
    uOriginY: { value: 0 },
  });
  const cu = {
    uScene: { value: sceneTarget.texture },
    uBlur: { value: blurTarget.texture },
    uBloomA: { value: bloomA.texture },
    uBloomB: { value: bloomB.texture },
    uDanger: { value: dangerTarget.texture },
    uMask: { value: maskTarget.texture },
    uVirtual: { value: new Vector2(1, 1) },
    uViewport: { value: new Vector2(1, 1) },
    uOriginY: { value: 0 },
    uShake: { value: new Vector2() },
    uDof: { value: 0 },
    uBloomLevels: { value: 0 },
    uBloom: { value: BLOOM_INTENSITY },
    uVignette: { value: new Vector2(VIGNETTE_STRENGTH, VIGNETTE_START) },
    uLift: { value: new Vector3() },
    uGain: { value: new Vector3(1, 1, 1) },
    uGrade: { value: 0 },
    uGlint: { value: 0 },
    uGlass: { value: linearVec(palette.biomes[0]?.env['glass'] ?? '#B7C3CB') },
    uTime: { value: 0 },
    uSilhouette: { value: 0 },
    uFeet: { value: new Vector2() },
    uHasPlayer: { value: 0 },
    uKeptCyan: { value: linearVec(palette.core['kept-cyan'] ?? '#4FE3F0') },
    uKeptWhite: { value: linearVec(palette.core['kept-white'] ?? '#F2FBFF') },
  };
  const composite = mat(POST_COMPOSITE_FRAGMENT, cu);

  let quality: QualityProfile | null = null;
  let vw = 1;
  let vh = 1;
  let originY = 0;

  const pass = (gl: WebGLRenderer, m: ShaderMaterial, target: WebGLRenderTarget | null): void => {
    quad.material = m;
    gl.setRenderTarget(target);
    gl.render(passScene, passCam);
  };
  const setU = (m: ShaderMaterial, name: string, v: unknown): void => {
    const u = m.uniforms[name];
    if (u !== undefined) u.value = v;
  };
  const vec2U = (m: ShaderMaterial, name: string): Vector2 => m.uniforms[name]?.value as Vector2;

  return {
    sceneTarget,
    dangerTarget,
    maskTarget,
    sceneDepth,
    resize(frame, scaledW, scaledH) {
      vw = frame.width;
      vh = frame.height;
      originY = frame.originY;
      sceneTarget.setSize(vw, vh);
      dangerTarget.setSize(vw, vh);
      maskTarget.setSize(vw, vh);
      blurTmp.setSize(vw, vh);
      blurTarget.setSize(vw, vh);
      const hw = Math.max(1, Math.ceil(vw / 2));
      const hh = Math.max(1, Math.ceil(vh / 2));
      bloomA.setSize(hw, hh);
      bloomATmp.setSize(hw, hh);
      bloomB.setSize(Math.max(1, Math.ceil(hw / 2)), Math.max(1, Math.ceil(hh / 2)));
      bloomBTmp.setSize(Math.max(1, Math.ceil(hw / 2)), Math.max(1, Math.ceil(hh / 2)));
      cu.uVirtual.value.set(vw, vh);
      cu.uViewport.value.set(scaledW, scaledH);
      cu.uOriginY.value = originY;
    },
    setQuality(q) {
      quality = q;
      cu.uDof.value = q.dof ? 1 : 0;
      cu.uBloomLevels.value = q.bloomLevels;
      cu.uGlint.value = q.glassGlint ? 1 : 0;
    },
    setBiome(biome) {
      cu.uLift.value.copy(linearVec(biome.grade.lift));
      cu.uGain.value.copy(linearVec(biome.grade.gain));
      cu.uGrade.value = biome.grade.strength;
      cu.uGlass.value.copy(linearVec(biome.env['glass'] ?? '#B7C3CB'));
    },
    run(gl, p, viewport) {
      const q = quality;
      if (q !== null && q.bloomLevels > 0) {
        setU(prefilter, 'uSource', sceneTarget.texture);
        vec2U(prefilter, 'uTexel').set(1 / vw, 1 / vh);
        pass(gl, prefilter, bloomA);
        const hw = bloomA.width;
        const hh = bloomA.height;
        setU(blur, 'uSource', bloomA.texture);
        vec2U(blur, 'uDir').set(BLOOM_SPREAD / hw, 0);
        pass(gl, blur, bloomATmp);
        setU(blur, 'uSource', bloomATmp.texture);
        vec2U(blur, 'uDir').set(0, BLOOM_SPREAD / hh);
        pass(gl, blur, bloomA);
        if (q.bloomLevels > 1) {
          // Bilinear downsample to 1/4: the blur at zero spread is a plain copy.
          setU(blur, 'uSource', bloomA.texture);
          vec2U(blur, 'uDir').set(0, 0);
          pass(gl, blur, bloomB);
          setU(blur, 'uSource', bloomB.texture);
          vec2U(blur, 'uDir').set(BLOOM_SPREAD / bloomB.width, 0);
          pass(gl, blur, bloomBTmp);
          setU(blur, 'uSource', bloomBTmp.texture);
          vec2U(blur, 'uDir').set(0, BLOOM_SPREAD / bloomB.height);
          pass(gl, blur, bloomB);
        }
      }
      if (q !== null && q.dof) {
        vec2U(tilt, 'uSize').set(vw, vh);
        setU(tilt, 'uOriginY', originY);
        setU(tilt, 'uSource', sceneTarget.texture);
        vec2U(tilt, 'uAxis').set(1, 0);
        pass(gl, tilt, blurTmp);
        setU(tilt, 'uSource', blurTmp.texture);
        vec2U(tilt, 'uAxis').set(0, 1);
        pass(gl, tilt, blurTarget);
      }
      cu.uTime.value = p.timeSec;
      cu.uShake.value.set(p.shakeX, p.shakeY);
      cu.uSilhouette.value = p.silhouette ? 1 : 0;
      cu.uHasPlayer.value = p.hasPlayer ? 1 : 0;
      cu.uFeet.value.set(p.feetX, p.feetY);
      quad.material = composite;
      gl.setRenderTarget(null);
      gl.setViewport(viewport.x, viewport.y, viewport.w, viewport.h);
      gl.render(passScene, passCam);
    },
    dispose() {
      for (const t of targets) t.dispose();
      sceneDepth.dispose();
      geo.dispose();
      for (const m of [prefilter, blur, tilt, composite]) m.dispose();
    },
  };
}
