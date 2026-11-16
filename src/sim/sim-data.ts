// Derived lookups built once from GameData at createSim (architecture 6.9: sim never imports JSON).
// Runs once, so plain functional style is fine here (coding-standards 5, exception for load code).

import { HitKind, SourceKind, encodeSource } from '../core/index.ts';
import type { GameData, ParamsRaw, WeaponDef } from '../content/index.ts';
import {
  ACTION_CODES,
  Action,
  ARCHETYPE_CODES,
  Archetype,
  BEHAVIOR_CODES,
  Behavior,
  COND_CODES,
  HIT_KIND_CODES,
  STATUS_CODES,
  StackMode,
  TRIGGER_CODES,
  Trigger,
} from './codes.ts';
import type { Cond } from './codes.ts';

/** Number param with fallback. Strings that are not numbers give the fallback. */
export function pnum(p: ParamsRaw, key: string, fallback: number): number {
  const v = p[key];
  return typeof v === 'number' ? v : fallback;
}

export function pstr(p: ParamsRaw, key: string, fallback: string): string {
  const v = p[key];
  return typeof v === 'string' ? v : fallback;
}

export function phas(p: ParamsRaw, key: string): boolean {
  return p[key] !== undefined;
}

/** Stat ids the sim reads by name (GDD 5.1). Missing stats resolve to -1 and read as neutral. */
export const STAT_IDS = [
  'max_hp',
  'hp_regen',
  'armor',
  'dodge',
  'move_speed',
  'damage_pct',
  'attack_speed_pct',
  'crit_chance',
  'crit_mult',
  'area_pct',
  'range_pct',
  'projectiles',
  'pierce',
  'pickup_radius_pct',
  'luck',
  'leech',
  'rite_haste',
  'burn_max_stacks',
  'barrier_max',
  'barrier_recharge',
  'rite_charges',
] as const;
export type StatId = (typeof STAT_IDS)[number];
export type StatSlots = Readonly<Record<StatId, number>>;

export interface WeaponTierSim {
  readonly dmg: number;
  readonly dmg2: number;
  readonly cooldownTicks: number;
  readonly rangeU: number;
  readonly speedUPerTick: number;
  readonly radiusU: number;
  readonly projRadiusU: number;
  readonly count: number;
  readonly pierce: number;
  readonly knockbackU: number;
  /** Tier multipliers from rarity.csv (order = tier - 1). */
  readonly dmgMult: number;
  readonly cdMult: number;
  /** Weapon params merged with tier params: `<k>_add` keys summed, other keys last-wins. */
  readonly p: ParamsRaw;
}

export interface WeaponSim {
  readonly def: WeaponDef;
  readonly archetype: Archetype;
  readonly hitKind: number;
  readonly tagMask: number;
  readonly selfTargeting: boolean;
  /** tiers[0..3] = tier I..IV. */
  readonly tiers: readonly WeaponTierSim[];
}

export interface EnemySim {
  readonly radiusU: number;
  readonly rank: number;
  readonly behavior: Behavior;
  readonly markRadiusU: number;
  readonly glintPieces: number;
  /** Affix indices (GameData.affixes) applied at spawn. */
  readonly affixes: readonly number[];
}

export interface ConditionSim {
  readonly code: Cond;
  readonly num: number;
  readonly str: string;
  /** every_nth scope: 0 global, 1 per_weapon, 2 per_target. */
  readonly scope: number;
  /** Slot in the per-target counter table for per_target scope, -1 otherwise. */
  readonly targetCounter: number;
}

export interface EffectSim {
  readonly index: number;
  readonly id: string;
  readonly owner: string;
  readonly trigger: Trigger;
  readonly conds: readonly ConditionSim[];
  readonly chance: number;
  readonly icdTicks: number;
  readonly maxPerPulse: number;
  readonly allowProc: boolean;
  readonly stackMode: StackMode;
  readonly action: Action;
  readonly p: ParamsRaw;
  /** True when the action is visible or audible (architecture 6.5 ProcTriggered rule). */
  readonly emitsProc: boolean;
  readonly sourceRef: number;
}

export interface SimData {
  readonly data: GameData;
  readonly stat: StatSlots;
  readonly statCount: number;
  readonly tagCount: number;
  /** 1 when the tag has a synergy row in this build tier (inactive tags are not counted, GDD 8.1). */
  readonly tagActive: Uint8Array;
  readonly weapons: readonly WeaponSim[];
  readonly enemies: readonly EnemySim[];
  readonly effects: readonly EffectSim[];
  /** rarities sorted by order; index = order. */
  readonly rarityByOrder: readonly (GameData['rarities'][number] | undefined)[];
  readonly rarityOrder: Readonly<Record<string, number>>;
  readonly mementoTagMask: readonly number[];
  readonly mementoRarity: readonly number[];
  readonly statusIndex: Readonly<Record<string, number>>;
  /** Enemy type used by boss trickle and Moth Call when a pattern gives none: first swarmer. */
  readonly swarmerType: number;
  /** Tables required to start a run that are missing in this build (GameData.meta.missingTables). */
  readonly missingRequired: readonly string[];
  /** Synergy rows in evaluation order: tag order, then ascending threshold (effect-primitives 6.1). */
  readonly synergyOrder: readonly number[];
  readonly synergyTag: readonly number[];
}

const REQUIRED_TABLES = [
  'config',
  'shop',
  'stats',
  'classes',
  'rites',
  'weapons',
  'rarity',
  'rarity_weights',
  'mementos',
  'effects',
  'synergies',
  'levelup',
  'statuses',
  'enemies',
  'biomes',
  'waves',
  'wave_spawns',
];

const VISIBLE_ACTIONS: ReadonlySet<Action> = new Set([
  Action.SpawnProjectile,
  Action.SpawnArea,
  Action.SpawnZone,
  Action.Repeat,
  Action.TriggerWeapons,
  Action.GainBarrier,
  Action.GainGlint,
  Action.Execute,
  Action.Heal,
]);

function tagMaskOf(data: GameData, tags: readonly string[]): number {
  let m = 0;
  for (const t of tags) {
    const i = data.tags.findIndex((d) => d.id === t);
    if (i >= 0) m |= 1 << i;
  }
  return m;
}

function resolveTier(w: WeaponDef, tier: number, data: GameData): WeaponTierSim {
  const acc: Record<string, number | string> = { ...w.params };
  for (const t of w.tiers) {
    if (t.tier > tier) continue;
    for (const [k, v] of Object.entries(t.params)) {
      if (k.endsWith('_add') && typeof v === 'number') {
        const prev = acc[k];
        acc[k] = (typeof prev === 'number' ? prev : 0) + v;
      } else {
        acc[k] = v;
      }
    }
  }
  const add = (k: string): number => {
    const v = acc[`${k}_add`];
    return typeof v === 'number' ? v : 0;
  };
  const rarity = data.rarities.find((r) => r.order === tier - 1);
  const shotRadius = data.config.playerShotRadiusU;
  return {
    dmg: w.dmg + add('dmg'),
    dmg2: (w.dmg2 ?? 0) + add('dmg2'),
    cooldownTicks: w.cooldownTicks,
    rangeU: w.rangeU + add('range'),
    speedUPerTick: w.speedUPerTick * (1 + add('speed_pct') / 100),
    radiusU: (w.radiusU ?? 0) + add('radius'),
    projRadiusU: w.projRadiusU ?? (Number.isFinite(shotRadius) ? shotRadius : 0),
    count: w.count + add('count'),
    pierce: w.pierce + add('pierce'),
    knockbackU: w.knockbackU + add('knockback'),
    dmgMult: rarity?.weaponDmgMult ?? 1,
    cdMult: rarity?.weaponCdMult ?? 1,
    p: acc,
  };
}

function enemyRadius(data: GameData, sizeClass: string, radius: number | null): number {
  if (radius !== null) return radius;
  const c = data.config;
  switch (sizeClass) {
    case 'small':
      return c.enemyRadiusSmallU;
    case 'medium':
      return c.enemyRadiusMediumU;
    case 'large':
      return c.enemyRadiusLargeU;
    case 'warden':
      return c.enemyRadiusWardenU;
    default:
      return c.enemyRadiusBossU;
  }
}

function markRadius(data: GameData, sizeClass: string): number {
  const c = data.config;
  switch (sizeClass) {
    case 'small':
      return c.spawnMarkDiamSmallU * 0.5;
    case 'medium':
      return c.spawnMarkDiamMediumU * 0.5;
    case 'large':
      return c.spawnMarkDiamLargeU * 0.5;
    default:
      return c.spawnMarkDiamWardenU * 0.5;
  }
}

/** target_is values: rank codes (EnemyRank) plus not_boss = 3. */
const TARGET_IS: Readonly<Record<string, number>> = { normal: 0, warden: 1, boss: 2, not_boss: 3 };

function defaultAllowProc(action: Action): boolean {
  return action === Action.HitMod || action === Action.ApplyStatus;
}

export function buildSimData(data: GameData): SimData {
  const statIndex = (id: string): number => data.stats.findIndex((s) => s.id === id);
  const stat = Object.fromEntries(STAT_IDS.map((id) => [id, statIndex(id)])) as Record<
    StatId,
    number
  >;

  const tagActive = new Uint8Array(data.tags.length);
  for (const s of data.synergies) {
    const i = data.tags.findIndex((t) => t.id === s.tag);
    if (i >= 0) tagActive[i] = 1;
  }

  const weapons: WeaponSim[] = data.weapons.map((w) => ({
    def: w,
    archetype: ARCHETYPE_CODES[w.archetype] ?? Archetype.Projectile,
    hitKind: HIT_KIND_CODES[w.kind] ?? HitKind.Projectile,
    tagMask: tagMaskOf(data, w.tags),
    selfTargeting: w.targeting === 'self',
    tiers: [1, 2, 3, 4].map((t) => resolveTier(w, t, data)),
  }));

  const affixIndex = (id: string): number => data.affixes.findIndex((a) => a.id === id);
  const enemies: EnemySim[] = data.enemies.map((e) => ({
    radiusU: enemyRadius(data, e.sizeClass, e.radiusU),
    rank: e.role === 'boss' ? 2 : e.role === 'warden' ? 1 : 0,
    behavior:
      BEHAVIOR_CODES[e.behavior] ??
      (e.role === 'boss'
        ? Behavior.Boss
        : e.role === 'warden'
          ? Behavior.WardenHound
          : Behavior.Chase),
    markRadiusU: markRadius(data, e.sizeClass),
    glintPieces: Math.max(1, Math.floor(pnum(e.params, 'drop_count', 1))),
    affixes: e.affixes.map(affixIndex).filter((i) => i >= 0),
  }));

  // per_target every_nth counters get a slot each, in effect order, up to the capacity.
  let perTargetSlots = 0;
  const effects: EffectSim[] = data.effects.map((e, index) => {
    const action = ACTION_CODES[e.action] ?? Action.StatMod;
    const conds: ConditionSim[] = e.conditions.map((c) => {
      const code = COND_CODES[c.name] ?? 0;
      let num = Number(c.value);
      let str = c.value;
      let scope = 0;
      let targetCounter = -1;
      // Pre-resolve string values to codes so hot-path checks compare numbers.
      if (c.name === 'source_tag') num = data.tags.findIndex((t) => t.id === c.value);
      else if (c.name === 'source_kind') num = HIT_KIND_CODES[c.value] ?? -1;
      else if (c.name === 'source_weapon') num = data.weapons.findIndex((w) => w.id === c.value);
      else if (c.name === 'target_has_status') num = STATUS_CODES[c.value] ?? -1;
      else if (c.name === 'target_is') num = TARGET_IS[c.value] ?? -1;
      if (c.name === 'every_nth') {
        const at = c.value.indexOf('@');
        num = Number(at >= 0 ? c.value.slice(0, at) : c.value);
        const sc = at >= 0 ? c.value.slice(at + 1) : 'global';
        scope = sc === 'per_weapon' ? 1 : sc === 'per_target' ? 2 : 0;
        str = sc;
        if (scope === 2) targetCounter = perTargetSlots++;
      }
      if (!Number.isFinite(num)) num = 0;
      return { code: code, num, str, scope, targetCounter };
    });
    return {
      index,
      id: e.id,
      owner: e.owner,
      trigger: TRIGGER_CODES[e.trigger] ?? Trigger.Passive,
      conds,
      chance: e.chance,
      icdTicks: e.icdTicks,
      maxPerPulse: e.maxPerPulse,
      allowProc: e.allowProc ?? defaultAllowProc(action),
      stackMode:
        e.stackMode === 'chance'
          ? StackMode.Chance
          : e.stackMode === 'none'
            ? StackMode.None
            : StackMode.Value,
      action,
      p: e.params,
      emitsProc: VISIBLE_ACTIONS.has(action),
      sourceRef: encodeSource(SourceKind.Effect, index),
    };
  });

  const rarityByOrder: (GameData['rarities'][number] | undefined)[] = [];
  const rarityOrder: Record<string, number> = {};
  for (const r of data.rarities) {
    rarityByOrder[r.order] = r;
    rarityOrder[r.id] = r.order;
  }

  const statusIndex: Record<string, number> = {};
  data.statuses.forEach((s, i) => {
    if (STATUS_CODES[s.id] !== undefined) statusIndex[s.id] = i;
  });

  const synergyTag = data.synergies.map((s) => data.tags.findIndex((t) => t.id === s.tag));
  const synergyOrder = data.synergies
    .map((_s, i) => i)
    .sort(
      (a, b) =>
        (synergyTag[a] ?? 0) - (synergyTag[b] ?? 0) ||
        (data.synergies[a]?.threshold ?? 0) - (data.synergies[b]?.threshold ?? 0) ||
        a - b,
    );

  const missing = new Set(data.meta.missingTables);
  return {
    data,
    stat,
    statCount: data.stats.length,
    tagCount: data.tags.length,
    tagActive,
    weapons,
    enemies,
    effects,
    rarityByOrder,
    rarityOrder,
    mementoTagMask: data.mementos.map((m) => tagMaskOf(data, m.tags)),
    mementoRarity: data.mementos.map((m) => rarityOrder[m.rarity] ?? 0),
    statusIndex,
    swarmerType: Math.max(
      0,
      data.enemies.findIndex((e) => e.role === 'swarmer'),
    ),
    missingRequired: REQUIRED_TABLES.filter((t) => missing.has(t)),
    synergyOrder,
    synergyTag,
  };
}
