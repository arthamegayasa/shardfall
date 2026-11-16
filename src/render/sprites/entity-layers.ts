// Entity rendering from WorldView (AD with LP; architecture.md 6.4, 7.2, 7.4, 7.6).
// Layers: L1/L3 player zones (area batch), L2 actors (player, Unlit, Warden, boss, Glint; depth by feet),
// L3 player effects (player shots, Burn flames, damage numbers), L4 danger (telegraphs, spawn cracks and
// rings, enemy shots) in a separate scene the renderer draws last. Every sprite id resolves once at
// creation; update() only reads typed arrays and writes instance buffers (no allocation per frame).

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
import { createAreaBatch } from '../vfx/area-batch.ts';
import { createDamageNumbers } from '../vfx/damage-numbers.ts';
import { createAreaStyles, dangerStyleFor, linearRgb } from '../vfx/telegraph-style.ts';
import {
  dir4Index,
  facingFromMotion,
  frameIndexAt,
  frameIndexForProgress,
  isMoving,
} from './frame-select.ts';
import { createSpriteBatch } from './sprite-batch.ts';
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
}

export interface EntityLayerOptions {
  readonly actorCapacity?: number;
  readonly effectCapacity?: number;
  readonly dangerCapacity?: number;
  readonly areaCapacity?: number;
}

export interface EntityLayers {
  /** Objects for the main scene (L1 to L3). */
  readonly sceneObjects: readonly Object3D[];
  /** Objects for the danger scene (L4), drawn after the main scene. */
  readonly dangerObjects: readonly Object3D[];
  resize(frame: VirtualFrame): void;
  applySettings(s: Settings): void;
  update(frame: RenderFrame): void;
  /** Instances dropped because a batch was full, last frame (debug overlay, tests). */
  overflow(): number;
  dispose(): void;
}

/** Hit flash colours (art-direction 4): player kept-white, Unlit bone. Never red on the player. */
const PLAYER_FLASH_TOKEN = 'kept-white';
const UNLIT_FLASH_TOKEN = 'bone';
/** Burn flame sits this many px above the top of the Unlit sprite. */
const BURN_GAP_PX = 1;
/** Desync animation clocks between pool slots (ticks). */
const SLOT_PHASE_TICKS = 7;

function refFor(manifest: AtlasManifest, id: string): SpriteRef | null {
  const entry = manifest.sprites[id];
  if (entry === undefined) return null;
  const first = Object.values(entry.animations)[0];
  const idle = entry.animations['idle'] ?? first;
  if (idle === undefined) return null;
  return {
    entry,
    idle,
    walk: entry.animations['walk'] ?? null,
    dir4: entry.animations['dir4'] ?? null,
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

  const [pfR, pfG, pfB] = linearRgb(palette, PLAYER_FLASH_TOKEN);
  const [ufR, ufG, ufB] = linearRgb(palette, UNLIT_FLASH_TOKEN);
  const styles = createAreaStyles(palette);

  const W = manifest.width;
  const H = manifest.height;
  const actors = createSpriteBatch(atlasTexture, W, H, {
    capacity: opts.actorCapacity ?? 768,
    depth: true,
    renderOrder: 2,
  });
  const effects = createSpriteBatch(atlasTexture, W, H, {
    capacity: opts.effectCapacity ?? 1536,
    depth: false,
    renderOrder: 3,
  });
  const dangerSprites = createSpriteBatch(atlasTexture, W, H, {
    capacity: opts.dangerCapacity ?? 512,
    depth: false,
    renderOrder: 1,
  });
  const zones = createAreaBatch(opts.areaCapacity ?? 64, 1);
  const dangerAreas = createAreaBatch(opts.areaCapacity ?? 128, 0);
  const numbers = createDamageNumbers(digits);

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

  let playerFacing = 0;

  const enemyRefFor = (typeIndex: number, rank: number): SpriteRef =>
    enemyRefs[typeIndex] ??
    (rank === EnemyRank.Boss
      ? bossFallback
      : rank === EnemyRank.Warden
        ? wardenFallback
        : enemyFallback);

  return {
    sceneObjects: [zones.mesh, actors.mesh, effects.mesh],
    dangerObjects: [dangerAreas.mesh, dangerSprites.mesh],
    resize(frame) {
      actors.setResolution(frame.width, frame.height);
      effects.setResolution(frame.width, frame.height);
      dangerSprites.setResolution(frame.width, frame.height);
    },
    applySettings(s) {
      numbers.setEnabled(s.access.damageNumbers);
    },
    update(f) {
      const v = f.view;
      const a = f.alpha;
      const clock = Math.floor(f.timeSec * TICK_RATE);
      actors.begin();
      effects.begin();
      dangerSprites.begin();
      zones.begin();
      dangerAreas.begin();

      // Player (L2): faces its horizontal motion, walk cycle while moving, kept-white hit flash.
      const p = v.player;
      const pdx = p.x - p.prevX;
      // First frame starts from the sim facing; afterwards the sprite turns toward horizontal motion.
      playerFacing = facingFromMotion(pdx, playerFacing === 0 ? p.facing : playerFacing);
      const pref = classRefs[p.classIndex] ?? playerFallback;
      const pmoving = isMoving(pdx, p.y - p.prevY);
      const panim = pmoving && pref.walk !== null ? pref.walk : pref.idle;
      const prect = frameOf(panim, clock);
      if (prect !== undefined)
        actors.push(
          p.prevX + pdx * a,
          p.prevY + (p.y - p.prevY) * a,
          0,
          prect,
          pref.entry.anchor.x,
          pref.entry.anchor.y,
          playerFacing,
          0,
          0,
          pfR,
          pfG,
          pfB,
          p.hitFlashTicks > 0 ? 1 : 0,
          1,
        );

      // Unlit, Warden, boss (L2) plus Burn flames above the head (L3).
      const en = v.enemies;
      for (let i = 0; i < en.highWater; i++) {
        if (en.alive[i] === 0) continue;
        const ref = enemyRefFor(en.typeIndex[i] ?? -1, en.rank[i] ?? 0);
        const x0 = en.prevX[i] ?? 0;
        const y0 = en.prevY[i] ?? 0;
        const dx = (en.x[i] ?? 0) - x0;
        const dy = (en.y[i] ?? 0) - y0;
        const anim = isMoving(dx, dy) && ref.walk !== null ? ref.walk : ref.idle;
        const c = clock + i * SLOT_PHASE_TICKS + (en.serial[i] ?? 0) * 13;
        const rect = frameOf(anim, c);
        if (rect === undefined) continue;
        const x = x0 + dx * a;
        const y = y0 + dy * a;
        actors.push(
          x,
          y,
          0,
          rect,
          ref.entry.anchor.x,
          ref.entry.anchor.y,
          en.facing[i] ?? 1,
          0,
          0,
          ufR,
          ufG,
          ufB,
          (en.hitFlashTicks[i] ?? 0) > 0 ? 1 : 0,
          1,
        );
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
              ref.entry.anchor.y + 1 - rect.oy + BURN_GAP_PX,
              0,
              0,
              0,
              0,
              1,
            );
        }
      }

      // Glint (L2).
      const pk = v.pickups;
      for (let i = 0; i < pk.highWater; i++) {
        if (pk.alive[i] === 0 || pk.kind[i] !== PickupKind.Glint) continue;
        const rect = frameOf(glint.idle, clock + i * SLOT_PHASE_TICKS);
        if (rect === undefined) continue;
        const x0 = pk.prevX[i] ?? 0;
        const y0 = pk.prevY[i] ?? 0;
        actors.push(
          x0 + ((pk.x[i] ?? 0) - x0) * a,
          y0 + ((pk.y[i] ?? 0) - y0) * a,
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
      }

      // Player shots (L3): sprite per weapon, dir4 orientation for line shots, flip by travel.
      const ps = v.playerShots;
      for (let i = 0; i < ps.highWater; i++) {
        if (ps.alive[i] === 0) continue;
        const src = ps.sourceRef[i] ?? 0;
        const ref =
          sourceKindOf(src) === SourceKind.Weapon
            ? (weaponRefs[sourceIndexOf(src)] ?? playerShotFallback)
            : playerShotFallback;
        const vx = ps.vx[i] ?? 0;
        const vy = ps.vy[i] ?? 0;
        const rect =
          ref.dir4 !== null
            ? ref.dir4.frames[dir4Index(vx, vy)]
            : frameOf(ref.idle, clock + i * SLOT_PHASE_TICKS);
        if (rect === undefined) continue;
        const x0 = ps.prevX[i] ?? 0;
        const y0 = ps.prevY[i] ?? 0;
        effects.push(
          x0 + ((ps.x[i] ?? 0) - x0) * a,
          y0 + ((ps.y[i] ?? 0) - y0) * a,
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

      // Damage numbers (L3, rendered, never DOM).
      numbers.ingest(f.events, f.timeSec);
      numbers.draw(effects, f.timeSec);

      // Player zones (L3 on the floor, under actors).
      const pz = v.playerZones;
      for (let i = 0; i < pz.highWater; i++) {
        if (pz.alive[i] === 0) continue;
        zones.push(
          pz.shape[i] ?? 0,
          pz.x[i] ?? 0,
          pz.y[i] ?? 0,
          pz.x2[i] ?? 0,
          pz.y2[i] ?? 0,
          pz.radius[i] ?? 0,
          pz.p0[i] ?? 0,
          pz.p1[i] ?? 0,
          pz.p2[i] ?? 0,
          1,
          styles.playerZone,
        );
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
      dangerAreas.end();
    },
    overflow() {
      return (
        actors.overflow +
        effects.overflow +
        dangerSprites.overflow +
        zones.overflow +
        dangerAreas.overflow
      );
    },
    dispose() {
      actors.dispose();
      effects.dispose();
      dangerSprites.dispose();
      zones.dispose();
      dangerAreas.dispose();
    },
  };
}
