// Look-ups from view indices to GameData rows and string keys (shared by presenters).
// Out-of-range indices return null so a fake or partial view never crashes a screen.

import { ownerTextParams } from '../../content/index.ts';
import type { GameData, TagId, WeaponDef } from '../../content/index.ts';
import type { StringParams } from '../../core/index.ts';
import { formatStatValue } from '../format.ts';

export interface ItemInfo {
  readonly id: string;
  readonly nameKey: string;
  readonly descKey: string;
  readonly flavorKey: string | null;
  readonly tags: readonly TagId[];
  /** Values for {placeholders} in the effect text (tier I values from data). */
  readonly params: StringParams;
}

export function weaponInfo(data: GameData, weaponIndex: number): ItemInfo | null {
  const w = data.weapons[weaponIndex];
  if (w === undefined) return null;
  return {
    id: w.id,
    nameKey: w.nameKey,
    descKey: w.descKey,
    flavorKey: null,
    tags: w.tags,
    params: weaponParams(w),
  };
}

export function mementoInfo(data: GameData, mementoIndex: number): ItemInfo | null {
  const m = data.mementos[mementoIndex];
  if (m === undefined) return null;
  return {
    id: m.id,
    nameKey: m.nameKey,
    descKey: m.descKey,
    flavorKey: m.flavorKey ?? null,
    tags: m.tags,
    params: ownerTextParams(data, m.id),
  };
}

/** Rarity order (0 Plain .. 3 Fabled) of a Memento, 0 when unknown. */
export function mementoRarityOrder(data: GameData, mementoIndex: number): number {
  const m = data.mementos[mementoIndex];
  if (m === undefined) return 0;
  return data.rarities.find((r) => r.id === m.rarity)?.order ?? 0;
}

export function enemyNameKey(data: GameData, typeIndex: number): string | null {
  return data.enemies[typeIndex]?.nameKey ?? null;
}

export interface SynergyStep {
  readonly threshold: number;
  readonly descKey: string;
  /** Values for the {placeholders} of descKey (string-table 4). */
  readonly params: StringParams;
}

/** Synergy thresholds and their description keys for one tag, ascending. */
export function synergiesOf(data: GameData, tag: TagId): readonly SynergyStep[] {
  return data.synergies
    .filter((s) => s.tag === tag)
    .map((s) => ({
      threshold: s.threshold,
      descKey: s.descKey,
      params: ownerTextParams(data, s.owner),
    }))
    .sort((a, b) => a.threshold - b.threshold);
}

/** Tag name key (WR pattern tag.<id>.name). */
export function tagNameKey(tag: string): string {
  return `tag.${tag}.name`;
}

/** Two-letter tag abbreviation key (WR pattern tag.<id>.abbr). */
export function tagAbbrKey(tag: string): string {
  return `tag.${tag}.abbr`;
}

/** Roman tier label key, ui.tier.1 .. ui.tier.4. */
export function tierKey(tier: number): string {
  return `ui.tier.${String(Math.min(4, Math.max(1, Math.floor(tier))))}`;
}

/**
 * Effect text parameters of a weapon (WR placeholders {dmg}, {dmg2}, {count}, {pierce}, and numeric
 * params such as {jumps}). Tier I values from data.
 */
export function weaponParams(w: WeaponDef): StringParams {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(w.params))
    if (typeof v === 'number') out[k] = formatStatValue(v);
  out['dmg'] = formatStatValue(w.dmg);
  out['count'] = String(w.count);
  out['pierce'] = String(w.pierce);
  if (w.dmg2 !== null) out['dmg2'] = formatStatValue(w.dmg2);
  return out;
}

/** Class passive text parameters ({burn_pct}), from the class's effects (string-table 4). */
export function classPassiveParams(data: GameData, classId: string): StringParams {
  return ownerTextParams(data, classId);
}
