// Entity rendering from WorldView (AD with LP; architecture.md 6.4, 7.2, 7.4, 7.6).
// Layers: L1 decals (blob shadows, player foot ring, Warden aura, VFX rings), L1/L3 player zones,
// L2 actors (player, Unlit, Warden, boss, Glint; depth by feet), L3 player effects (shots with tails,
// Burn flames, particles, dying Unlit, damage numbers), L4 danger (telegraphs, spawn cracks and rings,
// enemy shots) in a separate scene the renderer draws last. Every sprite id resolves once at creation;
// update() only reads typed arrays and writes instance buffers (no allocation per frame).
//
// M2 (AD, M2-03): animation choice from state (walk, windup, attack, cast, hit, boss phase 2),
// per-instance light from LP's scene lighting (opts.lighting), emissive texels, Unlit hit flash,
// windup red pulse, emerge and death dissolve, Rite zones growing with a cyan edge (CD K5), crit
// digits in kept-cyan (CD K4) and the damage number cap (LP damage-cap.ts).

import type { Object3D, Texture } from 'three';
import {
  EnemyRank,
  PickupKind,
  SourceKind,
  sourceIndexOf,
  sourceKindOf,
  StatusBit,
  TICK_RATE,
} from '../../core/index.ts';
import type {
  AtlasFrameRect,
  AtlasManifest,
  AtlasSpriteEntry,
  PaletteDef,
  Settings,
  VirtualFrame,
} from '../../core/index.ts';
import type { RenderFrame } from '../../core/dom.ts';
import type { GameData } from '../../content/index.ts';
import { SpriteLight } from '../shaders/index.ts';
import { createAreaBatch } from '../vfx/area-batch.ts';
import { createDamageNumbers } from '../vfx/damage-numbers.ts';
import { createVfx } from '../vfx/effects.ts';
import type { VfxSystem } from '../vfx/effects.ts';
import { createAreaStyles, dangerStyleFor, linearRgb } from '../vfx/telegraph-style.ts';
import {
  dir4Index,
  facingFromMotion,
  frameIndexAt,
  frameIndexForProgress,
  isMoving,
} from './frame-select.ts';
import { createSpriteBatch } from './sprite-batch.ts';
import type { SpriteLightingSource } from './sprite-batch.ts';
import {
  FALLBACK_SPRITES,
  resolveClassSpriteId,
  resolveEnemySpriteId,
  resolveWeaponSpriteId,
} from './sprite-ids.ts';

type AtlasAnim = AtlasSpriteEntry['animations'][string];

/** A sprite resolved once: the atlas entry plus the animations the renderer asks for. */
interface SpriteRef {
  readonly entry: AtlasSpriteEntry;
  readonly idle: AtlasAnim;
  /** null when the sprite has no walk cycle (idle doubles as walk). */
  readonly walk: AtlasAnim | null;
  /** dir4 line orientation frames, null for round sprites. */
  readonly dir4: AtlasAnim | null;
  /** Telegraph pose (AiState Windup), attack pose (AiState Attack), Rite cast, hit recoil. */
  readonly windup: AtlasAnim | null;
  readonly attack: AtlasAnim | null;
  readonly cast: AtlasAnim | null;
  readonly hit: AtlasAnim | null;
  /** Boss second phase (BigFoeView.phase >= 2). */
  readonly idle2: AtlasAnim | null;
  readonly windup2: AtlasAnim | null;
}

export interface EntityLayerOptions {
  readonly actorCapacity?: number;
  readonly effectCapacity?: number;
  readonly dangerCapacity?: number;
  readonly areaCapacity?: number;
  /**
   * LP scene lighting (src/render/pipeline/scene-lighting.ts uniforms plus SCENE_LIGHTING_GLSL from
   * src/render/shaders/lighting.ts). When given, actors take per-instance light at their feet.
   */
  readonly lighting?: SpriteLightingSource;
}

export interface EntityLayers {
  /** Objects for the main scene (L1 to L3). */
  readonly sceneObjects: readonly Object3D[];
  /** Objects for the danger scene (L4), drawn after the main scene. */
  readonly dangerObjects: readonly Object3D[];
  /**
   * Shared emissive gain for every sprite batch (1 = palette colour). LP raises it (about 1.6) when
   * the bloom pass is on so emissive texels exceed 1.0 in the HDR target.
   */
  readonly emissiveGain: { value: number };
  /**
   * The player's sprite this frame (LP hook, M2-02): the renderer redraws it into a mask for the
   * see-through silhouette above the danger layer (CD K3, LD 9). Mutated in place by update().
   */
  readonly playerSprite: PlayerSpriteHook;
  resize(frame: VirtualFrame): void;
  applySettings(s: Settings): void;
  update(frame: RenderFrame): void;
  /** Instances dropped because a batch was full, last frame (debug overlay, tests). */
  overflow(): number;
  dispose(): void;
}

/** Player sprite state read by the renderer's silhouette pass (src/render/pipeline/renderer.ts). */
export interface PlayerSpriteHook {
  visible: boolean;
  x: number;
  y: number;
  rect: AtlasFrameRect | null;
  anchorX: number;
  anchorY: number;
  flip: number;
}

/** AI state codes for animation (mirror of src/sim/codes.ts AiState; render may not import sim). */
export const AiAnim = {
  Idle: 0,
  Move: 1,
  Windup: 2,
  Attack: 3,
  Recover: 4,
  Transition: 5,
  Emerging: 6,
} as const;

/** Hit flash colours (art-direction 4): player kept-white, Unlit bone. Never red on the player. */
const PLAYER_FLASH_TOKEN = 'kept-white';
const UNLIT_FLASH_TOKEN = 'bone';
/** Burn flame sits this many px above the top of the Unlit sprite. */
const BURN_GAP_PX = 1;
/** Desync animation clocks between pool slots (ticks). */
const SLOT_PHASE_TICKS = 7;
/** Player hit flash length in sim ticks (hitFlashTicks counts down from about this). */
const PLAYER_HIT_TICKS = 8;
/**
 * Player hit flash strength: a kept-white tint, not a full replacement, so the class silhouette and
 * colours stay readable when hits come often in a dense Pulse (LP M2-09 legibility; was 1).
 */
export const PLAYER_HIT_FLASH_ALPHA = 0.6;
/** Normal Unlit rise out of their crack over this many ticks (dissolve in reverse). */
const EMERGE_TICKS = 18;
/** Player death dissolve (art-direction 8.2: 0.8 s). */
const PLAYER_DEATH_SEC = 0.8;
/** Warden leap hop height in px while AiState Attack. */
const WARDEN_HOP_PX = 7;
/** Windup red pulse on the sprite (telegraph: outline and eyes blink danger-red, art-direction 5.1). */
const WINDUP_PULSE_AMOUNT = 0.35;
const WINDUP_PULSE_TICKS = 4;
/** Rite zones grow from the centre over this time (CD M1 review AD item 3). */
const ZONE_GROW_SEC = 0.2;
/** Blob shadow radius per px of sprite width (u per px); 16 px across = 1 u. */
const SHADOW_U_PER_PX = 0.42 / 16;
/** Player foot ring radius (u). */
const FOOT_RING_U = 0.55;
/** Warden aura radius (art-direction 8.2). */
const WARDEN_AURA_U = 1.75;
/** Glint and player shot tails (render ticks of travel between dots). */
const TAIL_STEP_TICKS = 2;
const TAIL_MIN_SPEED = 0.03;

function animOf(entry: AtlasSpriteEntry, name: string): AtlasAnim | null {
  return entry.animations[name] ?? null;
}

function refFor(manifest: AtlasManifest, id: string): SpriteRef | null {
  const entry = manifest.sprites[id];
  if (entry === undefined) return null;
  const first = Object.values(entry.animations)[0];
  const idle = entry.animations['idle'] ?? first;
  if (idle === undefined) return null;
  return {
    entry,
    idle,
    walk: animOf(entry, 'walk'),
    dir4: animOf(entry, 'dir4'),
    windup: animOf(entry, 'windup'),
    attack: animOf(entry, 'attack'),
    cast: animOf(entry, 'cast'),
    hit: animOf(entry, 'hit'),
    idle2: animOf(entry, 'idle2'),
    windup2: animOf(entry, 'windup2'),
  };
}

export function createEntityLayers(
  atlasTexture: Texture,
  manifest: AtlasManifest,
  palette: PaletteDef,
  data: GameData,
  opts: EntityLayerOptions = {},
): EntityLayers {
  const has = (id: string): boolean => manifest.sprites[id] !== undefined;
  const must = (id: string): SpriteRef => {
    const r = refFor(manifest, id);
    if (r === null)
      throw new Error(`render: sprite "${id}" missing from atlas (run npm run art:check)`);
    return r;
  };
  const classRefs = data.classes.map((c) => must(resolveClassSpriteId(c.id, has)));
  const enemyRefs = data.enemies.map((e) => must(resolveEnemySpriteId(e, has)));
  const weaponRefs = data.weapons.map((w) => must(resolveWeaponSpriteId(w.id, has)));
  const orbitWeapon = data.weapons.map((w) => w.id === 'orbit_shards');
  const playerFallback = must(FALLBACK_SPRITES.player);
  const playerShotFallback = must(FALLBACK_SPRITES.playerShot);
  const enemyFallback = must(FALLBACK_SPRITES.bySize.medium);
  const wardenFallback = must(FALLBACK_SPRITES.bySize.warden);
  const bossFallback = must(FALLBACK_SPRITES.bySize.boss);
  const enemyShot = must(FALLBACK_SPRITES.enemyShot);
  const glint = must(FALLBACK_SPRITES.glint);
  const burn = must(FALLBACK_SPRITES.burn);
  const crackEntry = must(FALLBACK_SPRITES.spawnCrack).entry;
  const crack = crackEntry.animations['grow'] ?? must(FALLBACK_SPRITES.spawnCrack).idle;
  const digits = must(FALLBACK_SPRITES.digits).entry;
  const trailRef = refFor(manifest, 'fx-trail');
  const glintTrailRef = refFor(manifest, 'fx-glint-trail');
  const rites: readonly unknown[] = (data as { rites?: readonly unknown[] }).rites ?? [];

  const [pfR, pfG, pfB] = linearRgb(palette, PLAYER_FLASH_TOKEN);
  const [ufR, ufG, ufB] = linearRgb(palette, UNLIT_FLASH_TOKEN);
  const [drR, drG, drB] = linearRgb(palette, 'danger-red');
  const styles = createAreaStyles(palette);

  const W = manifest.width;
  const H = manifest.height;
  const emissiveGain = { value: 1 };
  const lit = opts.lighting;
  const actors = createSpriteBatch(atlasTexture, W, H, {
    capacity: opts.actorCapacity ?? 768,
    depth: true,
    renderOrder: 2,
    emissiveGain,
    ...(lit === undefined ? {} : { lighting: lit }),
  });
  const effects = createSpriteBatch(atlasTexture, W, H, {
    capacity: opts.effectCapacity ?? 2048,
    depth: false,
    renderOrder: 3,
    emissiveGain,
    ...(lit === undefined ? {} : { lighting: lit }),
  });
  const dangerSprites = createSpriteBatch(atlasTexture, W, H, {
    capacity: opts.dangerCapacity ?? 512,
    depth: false,
    renderOrder: 1,
    emissiveGain,
  });
  const zones = createAreaBatch(opts.areaCapacity ?? 64, 1);
  const decals = createAreaBatch(1024, 1.5);
  const fxAreas = createAreaBatch(48, 1.6);
  const dangerAreas = createAreaBatch(opts.areaCapacity ?? 128, 0);
  const numbers = createDamageNumbers(digits);
  const vfx: VfxSystem = createVfx(manifest, palette, rites);

  // Timing views reused every frame (stable shape, no allocation in update).
  const t = { ticksPerFrame: 0, loop: true, frameCount: 1 };
  const setTiming = (a: AtlasAnim): typeof t => {
    t.ticksPerFrame = a.ticksPerFrame;
    t.loop = a.loop;
    t.frameCount = a.frames.length;
    return t;
  };
  const frameOf = (a: AtlasAnim, clock: number): AtlasFrameRect | undefined =>
    a.frames[frameIndexAt(setTiming(a), clock)];

  // Last-frame copy of each enemy slot, so a slot that dies or vanishes (kill, Pulse end sweep)
  // dissolves where it stood. Sized on first use from the pool capacity.
  let slotCap = 0;
  let wasAlive = new Uint8Array(0);
  let wasSerial = new Uint32Array(0);
  let lastX = new Float32Array(0);
  let lastY = new Float32Array(0);
  let lastFlip = new Int8Array(0);
  let lastRank = new Uint8Array(0);
  let lastRect: (AtlasFrameRect | undefined)[] = [];
  let lastRef: (SpriteRef | undefined)[] = [];
  // Rite zone birth times per zone slot (serial change = new zone).
  let zoneCap = 0;
  let zoneSerial = new Uint32Array(0);
  let zoneBorn = new Float64Array(0);
  let lastTime = Number.NEGATIVE_INFINITY;

  let playerFacing = 0;

  const enemyRefFor = (typeIndex: number, rank: number): SpriteRef =>
    enemyRefs[typeIndex] ??
    (rank === EnemyRank.Boss
      ? bossFallback
      : rank === EnemyRank.Warden
        ? wardenFallback
        : enemyFallback);

  const pushShadow = (x: number, y: number, widthPx: number): void => {
    const r = Math.max(0.25, widthPx * SHADOW_U_PER_PX);
    decals.push(0, x, y, 0, 0, r, 0, 0, 0, 1, styles.shadow);
  };

  const playerSprite: PlayerSpriteHook = {
    visible: false,
    x: 0,
    y: 0,
    rect: null,
    anchorX: 0,
    anchorY: 0,
    flip: 1,
  };

  return {
    sceneObjects: [zones.mesh, decals.mesh, fxAreas.mesh, actors.mesh, effects.mesh],
    dangerObjects: [dangerAreas.mesh, dangerSprites.mesh],
    emissiveGain,
    playerSprite,
    resize(frame) {
      actors.setResolution(frame.width, frame.height);
      effects.setResolution(frame.width, frame.height);
      dangerSprites.setResolution(frame.width, frame.height);
    },
    applySettings(s) {
      numbers.setEnabled(s.access.damageNumbers);
      vfx.setReduced(s.access.reduceEffects);
    },
    update(f) {
      const v = f.view;
      const a = f.alpha;
      const now = f.timeSec;
      const clock = Math.floor(now * TICK_RATE);
      // Render clock went backwards: a new run or a reload. Drop transient effects.
      if (now < lastTime - 0.5) {
        vfx.clear();
        numbers.clear();
      }
      lastTime = now;
      actors.begin();
      effects.begin();
      dangerSprites.begin();
      zones.begin();
      decals.begin();
      fxAreas.begin();
      dangerAreas.begin();

      // Player (L2): faces horizontal motion; cast, hit, walk, idle; kept-white hit flash.
      const p = v.player;
      const pdx = p.x - p.prevX;
      const pX = p.prevX + pdx * a;
      const pY = p.prevY + (p.y - p.prevY) * a;
      vfx.ingest(f.events, now, pX, pY);
      const ps0 = vfx.player;
      // First frame starts from the sim facing; afterwards the sprite turns toward horizontal motion.
      playerFacing = facingFromMotion(pdx, playerFacing === 0 ? p.facing : playerFacing);
      const pref = classRefs[p.classIndex] ?? playerFallback;
      const pmoving = isMoving(pdx, p.y - p.prevY);
      let prect: AtlasFrameRect | undefined;
      let pDissolve = 0;
      if (ps0.deadAt >= 0 && now >= ps0.deadAt) {
        const anim = pref.hit ?? pref.idle;
        prect = anim.frames[anim.frames.length - 1];
        pDissolve = Math.min(1, (now - ps0.deadAt) / PLAYER_DEATH_SEC);
      } else if (p.hitFlashTicks > 0 && pref.hit !== null) {
        const n = pref.hit.frames.length;
        prect =
          pref.hit.frames[
            Math.min(
              n - 1,
              Math.max(0, n - 1 - Math.floor((p.hitFlashTicks * n) / PLAYER_HIT_TICKS)),
            )
          ];
      } else if (now < ps0.castUntil && pref.cast !== null) {
        prect =
          pref.cast.frames[
            frameIndexForProgress(
              pref.cast.frames.length,
              (now - ps0.castFrom) / (ps0.castUntil - ps0.castFrom),
            )
          ];
      } else {
        prect = frameOf(pmoving && pref.walk !== null ? pref.walk : pref.idle, clock);
      }
      let flR = pfR;
      let flG = pfG;
      let flB = pfB;
      let flA = p.hitFlashTicks > 0 ? PLAYER_HIT_FLASH_ALPHA : 0;
      if (flA === 0 && now < ps0.flashUntil) {
        flR = ps0.flashR;
        flG = ps0.flashG;
        flB = ps0.flashB;
        flA = 0.55;
      }
      if (pDissolve > 0) {
        [flR, flG, flB] = linearRgb(palette, 'kept-cyan');
        flA = 0;
      }
      playerSprite.visible = prect !== undefined && pDissolve < 1;
      if (prect !== undefined && pDissolve < 1) {
        playerSprite.x = pX;
        playerSprite.y = pY;
        playerSprite.rect = prect;
        playerSprite.anchorX = pref.entry.anchor.x;
        playerSprite.anchorY = pref.entry.anchor.y;
        playerSprite.flip = playerFacing;
        actors.push(
          pX,
          pY,
          0,
          prect,
          pref.entry.anchor.x,
          pref.entry.anchor.y,
          playerFacing,
          0,
          0,
          flR,
          flG,
          flB,
          flA,
          1,
          pDissolve,
          SpriteLight.Kept,
        );
        pushShadow(pX, pY, prect.w);
        decals.push(0, pX, pY, 0, 0, FOOT_RING_U, 0, 0, 0, 1, styles.footRing);
      }

      // Unlit, Warden, boss (L2) plus Burn flames above the head (L3).
      const en = v.enemies;
      if (slotCap < en.capacity) {
        slotCap = en.capacity;
        wasAlive = new Uint8Array(slotCap);
        wasSerial = new Uint32Array(slotCap);
        lastX = new Float32Array(slotCap);
        lastY = new Float32Array(slotCap);
        lastFlip = new Int8Array(slotCap);
        lastRank = new Uint8Array(slotCap);
        lastRect = new Array<AtlasFrameRect | undefined>(slotCap);
        lastRef = new Array<SpriteRef | undefined>(slotCap);
      }
      const bossPhase2 = v.pulse.boss.active && v.pulse.boss.phase >= 2;
      for (let i = 0; i < slotCap; i++) {
        const alive = i < en.highWater && en.alive[i] !== 0;
        const ser = en.serial[i] ?? 0;
        if (wasAlive[i] === 1 && (!alive || ser !== wasSerial[i])) {
          const r = lastRect[i];
          const ref = lastRef[i];
          if (r !== undefined && ref !== undefined)
            vfx.ghost(
              r,
              ref.entry.anchor.x,
              ref.entry.anchor.y,
              lastFlip[i] ?? 1,
              lastX[i] ?? 0,
              lastY[i] ?? 0,
              lastRank[i] ?? 0,
              now,
            );
          wasAlive[i] = 0;
        }
        if (!alive) continue;
        const rank = en.rank[i] ?? 0;
        const ref = enemyRefFor(en.typeIndex[i] ?? -1, rank);
        const x0 = en.prevX[i] ?? 0;
        const y0 = en.prevY[i] ?? 0;
        const dx = (en.x[i] ?? 0) - x0;
        const dy = (en.y[i] ?? 0) - y0;
        const ai = en.aiState[i] ?? 0;
        const phase2 = rank === EnemyRank.Boss && bossPhase2;
        let anim: AtlasAnim;
        if (ai === AiAnim.Windup) anim = (phase2 ? ref.windup2 : null) ?? ref.windup ?? ref.idle;
        else if (ai === AiAnim.Attack) anim = ref.attack ?? ref.windup ?? ref.idle;
        else if (phase2 && ref.idle2 !== null) anim = ref.idle2;
        else anim = isMoving(dx, dy) && ref.walk !== null ? ref.walk : ref.idle;
        const c = clock + i * SLOT_PHASE_TICKS + ser * 13;
        const rect = frameOf(anim, c);
        if (rect === undefined) continue;
        const x = x0 + dx * a;
        const y = y0 + dy * a;
        const facing = en.facing[i] ?? 1;
        let fr = ufR;
        let fg = ufG;
        let fb = ufB;
        let fa = (en.hitFlashTicks[i] ?? 0) > 0 ? 1 : 0;
        if (fa === 0 && ai === AiAnim.Windup && rank !== EnemyRank.Boss) {
          fr = drR;
          fg = drG;
          fb = drB;
          fa = Math.floor(c / WINDUP_PULSE_TICKS) % 2 === 0 ? WINDUP_PULSE_AMOUNT : 0;
        }
        const age = en.ageTicks[i] ?? EMERGE_TICKS;
        const dissolve =
          ai === AiAnim.Emerging
            ? 0.55
            : rank === EnemyRank.Normal && age < EMERGE_TICKS
              ? 1 - age / EMERGE_TICKS
              : 0;
        const hop = rank === EnemyRank.Warden && ai === AiAnim.Attack ? WARDEN_HOP_PX : 0;
        actors.push(
          x,
          y,
          0,
          rect,
          ref.entry.anchor.x,
          ref.entry.anchor.y,
          facing,
          0,
          hop,
          fr,
          fg,
          fb,
          fa,
          1,
          dissolve,
          SpriteLight.Unlit,
        );
        pushShadow(x, y, rank === EnemyRank.Boss ? rect.w * 0.7 : rect.w);
        if (rank === EnemyRank.Warden)
          decals.push(0, x, y, 0, 0, WARDEN_AURA_U, 0, 0, 0, 1, styles.wardenAura);
        wasAlive[i] = 1;
        wasSerial[i] = ser;
        lastX[i] = x;
        lastY[i] = y;
        lastFlip[i] = facing < 0 ? -1 : 1;
        lastRank[i] = rank;
        lastRect[i] = rect;
        lastRef[i] = ref;
        if (((en.statusMask[i] ?? 0) & StatusBit.Burn) !== 0) {
          const brect = frameOf(burn.idle, c);
          if (brect !== undefined)
            effects.push(
              x,
              y,
              0,
              brect,
              burn.entry.anchor.x,
              burn.entry.anchor.y,
              1,
              0,
              ref.entry.anchor.y + 1 - rect.oy + BURN_GAP_PX + hop,
              0,
              0,
              0,
              0,
              1,
            );
        }
      }

      // Glint (L2), with a gold tail while it flies to the player.
      const pk = v.pickups;
      for (let i = 0; i < pk.highWater; i++) {
        if (pk.alive[i] === 0 || pk.kind[i] !== PickupKind.Glint) continue;
        const rect = frameOf(glint.idle, clock + i * SLOT_PHASE_TICKS);
        if (rect === undefined) continue;
        const x0 = pk.prevX[i] ?? 0;
        const y0 = pk.prevY[i] ?? 0;
        const gdx = (pk.x[i] ?? 0) - x0;
        const gdy = (pk.y[i] ?? 0) - y0;
        const gx = x0 + gdx * a;
        const gy = y0 + gdy * a;
        actors.push(
          gx,
          gy,
          0,
          rect,
          glint.entry.anchor.x,
          glint.entry.anchor.y,
          1,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
        );
        if (
          glintTrailRef !== null &&
          (pk.magnetized[i] ?? 0) !== 0 &&
          gdx * gdx + gdy * gdy > TAIL_MIN_SPEED * TAIL_MIN_SPEED
        ) {
          for (let k = 1; k <= 2; k++) {
            const tr = glintTrailRef.idle.frames[k - 1];
            if (tr === undefined) continue;
            effects.push(
              gx - gdx * k * TAIL_STEP_TICKS,
              gy - gdy * k * TAIL_STEP_TICKS,
              0,
              tr,
              glintTrailRef.entry.anchor.x,
              glintTrailRef.entry.anchor.y,
              1,
              0,
              1,
              0,
              0,
              0,
              0,
              1 - k * 0.3,
            );
          }
        }
      }

      // Player shots (L3): sprite per weapon, dir4 orientation for line shots, flip by travel,
      // a two-dot cyan tail behind fast shots (CD M1 review AD item 2).
      const shots = v.playerShots;
      for (let i = 0; i < shots.highWater; i++) {
        if (shots.alive[i] === 0) continue;
        const src = shots.sourceRef[i] ?? 0;
        const isWeapon = sourceKindOf(src) === SourceKind.Weapon;
        const wi = sourceIndexOf(src);
        const ref = isWeapon ? (weaponRefs[wi] ?? playerShotFallback) : playerShotFallback;
        const vx = shots.vx[i] ?? 0;
        const vy = shots.vy[i] ?? 0;
        const rect =
          ref.dir4 !== null
            ? ref.dir4.frames[dir4Index(vx, vy)]
            : frameOf(ref.idle, clock + i * SLOT_PHASE_TICKS);
        if (rect === undefined) continue;
        const x0 = shots.prevX[i] ?? 0;
        const y0 = shots.prevY[i] ?? 0;
        const sx = x0 + ((shots.x[i] ?? 0) - x0) * a;
        const sy = y0 + ((shots.y[i] ?? 0) - y0) * a;
        if (
          trailRef !== null &&
          !(isWeapon && orbitWeapon[wi] === true) &&
          vx * vx + vy * vy > TAIL_MIN_SPEED * TAIL_MIN_SPEED
        ) {
          for (let k = 2; k >= 1; k--) {
            const tr = trailRef.idle.frames[k - 1];
            if (tr === undefined) continue;
            effects.push(
              sx - vx * k * TAIL_STEP_TICKS,
              sy - vy * k * TAIL_STEP_TICKS,
              0,
              tr,
              trailRef.entry.anchor.x,
              trailRef.entry.anchor.y - 2,
              1,
              0,
              0,
              0,
              0,
              0,
              0,
              k === 1 ? 0.9 : 0.55,
            );
          }
        }
        effects.push(
          sx,
          sy,
          0,
          rect,
          ref.entry.anchor.x,
          ref.entry.anchor.y,
          ref.dir4 === null && vx < 0 ? -1 : 1,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
        );
      }

      // Particles, Rite flights, dying Unlit (L3), then damage numbers on top (rendered, never DOM).
      vfx.drawSprites(effects, now);
      vfx.drawAreas(fxAreas, now);
      numbers.ingest(f.events, now);
      numbers.draw(effects, now, pX, pY);

      // Player zones (L3 on the floor, under actors). Rite zones grow from the centre and carry a
      // solid 1 px cyan edge; other zones (trails) are a faint fill without edge (CD K5).
      const pz = v.playerZones;
      if (zoneCap < pz.capacity) {
        zoneCap = pz.capacity;
        zoneSerial = new Uint32Array(zoneCap).fill(0xffffffff);
        zoneBorn = new Float64Array(zoneCap);
      }
      for (let i = 0; i < pz.highWater; i++) {
        if (pz.alive[i] === 0) continue;
        const ser = pz.serial[i] ?? 0;
        if (zoneSerial[i] !== ser) {
          zoneSerial[i] = ser;
          zoneBorn[i] = now;
        }
        const rite = sourceKindOf(pz.sourceRef[i] ?? 0) === SourceKind.Rite;
        const ageZ = now - (zoneBorn[i] ?? now);
        const grow = rite ? Math.min(1, Math.max(0.05, ageZ / ZONE_GROW_SEC)) : 1;
        const g = 1 - (1 - grow) * (1 - grow);
        const x = pz.x[i] ?? 0;
        const y = pz.y[i] ?? 0;
        const r = (pz.radius[i] ?? 0) * g;
        zones.push(
          pz.shape[i] ?? 0,
          x,
          y,
          pz.x2[i] ?? 0,
          pz.y2[i] ?? 0,
          r,
          (pz.p0[i] ?? 0) * g,
          pz.p1[i] ?? 0,
          pz.p2[i] ?? 0,
          1,
          rite ? styles.riteZone : styles.trailZone,
        );
        if (rite && r > 0.5) {
          // Soft flame flicker: an ember every 1/10 s from a hashed point inside the zone.
          const step = Math.floor(now * 10);
          const prevStep = Math.floor((now - 1 / 60) * 10);
          if (step !== prevStep) {
            const s = step * 31 + i * 7;
            const ang = ((s * 0.6180339) % 1) * Math.PI * 2;
            const rr = r * Math.sqrt((s * 0.7548776) % 1);
            vfx.ember(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, s, now);
          }
        }
      }

      // L4: telegraphs fill as they count down.
      const da = v.dangerAreas;
      for (let i = 0; i < da.highWater; i++) {
        if (da.alive[i] === 0) continue;
        const total = da.ticksTotal[i] ?? 0;
        const progress = total > 0 ? 1 - (da.ticksLeft[i] ?? 0) / total : 1;
        dangerAreas.push(
          da.shape[i] ?? 0,
          da.x[i] ?? 0,
          da.y[i] ?? 0,
          da.x2[i] ?? 0,
          da.y2[i] ?? 0,
          da.radius[i] ?? 0,
          da.p0[i] ?? 0,
          da.p1[i] ?? 0,
          da.p2[i] ?? 0,
          progress,
          dangerStyleFor(styles, da.kind[i] ?? 0),
        );
      }

      // L4: spawn cracks grow with the telegraph, ring edge at the mark radius.
      const sm = v.spawnMarks;
      for (let i = 0; i < sm.highWater; i++) {
        if (sm.alive[i] === 0) continue;
        const total = sm.ticksTotal[i] ?? 0;
        const progress = total > 0 ? 1 - (sm.ticksLeft[i] ?? 0) / total : 1;
        const x = sm.x[i] ?? 0;
        const y = sm.y[i] ?? 0;
        const r = sm.radius[i] ?? 0;
        if (r > 0) dangerAreas.push(0, x, y, 0, 0, r, 0, 0, 0, progress, styles.spawn);
        const rect = crack.frames[frameIndexForProgress(crack.frames.length, progress)];
        if (rect !== undefined)
          dangerSprites.push(
            x,
            y,
            0,
            rect,
            crackEntry.anchor.x,
            crackEntry.anchor.y,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            1,
          );
      }

      // L4: enemy shots.
      const es = v.enemyShots;
      for (let i = 0; i < es.highWater; i++) {
        if (es.alive[i] === 0) continue;
        const rect = frameOf(enemyShot.idle, clock + i * SLOT_PHASE_TICKS);
        if (rect === undefined) continue;
        const x0 = es.prevX[i] ?? 0;
        const y0 = es.prevY[i] ?? 0;
        dangerSprites.push(
          x0 + ((es.x[i] ?? 0) - x0) * a,
          y0 + ((es.y[i] ?? 0) - y0) * a,
          0,
          rect,
          enemyShot.entry.anchor.x,
          enemyShot.entry.anchor.y,
          1,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
        );
      }

      actors.end();
      effects.end();
      dangerSprites.end();
      zones.end();
      decals.end();
      fxAreas.end();
      dangerAreas.end();
    },
    overflow() {
      return (
        actors.overflow +
        effects.overflow +
        dangerSprites.overflow +
        zones.overflow +
        decals.overflow +
        fxAreas.overflow +
        dangerAreas.overflow
      );
    },
    dispose() {
      actors.dispose();
      effects.dispose();
      dangerSprites.dispose();
      zones.dispose();
      decals.dispose();
      fxAreas.dispose();
      dangerAreas.dispose();
    },
  };
}
