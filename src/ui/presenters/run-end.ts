// Run end and build summary models (ui-spec S06 right column, S08).

import type { GameData } from '../../content/index.ts';
import { SourceKind, sourceIndexOf, sourceKindOf } from '../../core/index.ts';
import type { WorldView } from '../../core/index.ts';
import { floorSeconds, formatClock } from '../format.ts';
import { statValueText } from './choices.ts';
import { mementoInfo, mementoRarityOrder, weaponInfo } from './content.ts';
import type { ItemInfo } from './content.ts';

export interface BuildEntry {
  readonly item: ItemInfo;
  /** Weapon tier, or Memento stack count. */
  readonly level: number;
  readonly rarityOrder: number;
}

export interface BuildSummary {
  readonly weapons: readonly BuildEntry[];
  readonly mementos: readonly BuildEntry[];
}

export function buildSummary(view: WorldView, data: GameData): BuildSummary {
  const weapons: BuildEntry[] = [];
  for (const s of view.shop.inventory) {
    const item = s.weaponIndex >= 0 ? weaponInfo(data, s.weaponIndex) : null;
    if (item !== null) weapons.push({ item, level: s.tier, rarityOrder: Math.max(0, s.tier - 1) });
  }
  const mementos: BuildEntry[] = [];
  for (const m of view.shop.mementos) {
    const item = mementoInfo(data, m.mementoIndex);
    if (item !== null)
      mementos.push({
        item,
        level: m.count,
        rarityOrder: mementoRarityOrder(data, m.mementoIndex),
      });
  }
  return { weapons, mementos };
}

/** One line of the pause stat list (redesign-1.1 3.4): zero values are dimmed. */
export interface StatLine {
  readonly labelKey: string;
  readonly text: string;
  readonly zero: boolean;
}

/** Shown player stats in data order, values with their units ("12%", "0.2/s"). */
export function statLines(view: WorldView, data: GameData): StatLine[] {
  const out: StatLine[] = [];
  data.stats.forEach((s, i) => {
    if (!s.showInUi) return;
    const v = view.player.stats[i] ?? s.base;
    out.push({
      labelKey: s.displayKey,
      text: statValueText(v, s.unit),
      zero: Math.abs(v) < 0.005,
    });
  });
  return out;
}

/**
 * Name key for "Felled by {name}" (K4) from runStats.killedBy. Enemy contact and attacks name the
 * Unlit; other sources (boss patterns, affixes) return null until their name keys exist in data.
 */
export function killerNameKey(data: GameData, killedBy: number): string | null {
  if (killedBy <= 0) return null;
  const kind = sourceKindOf(killedBy);
  const index = sourceIndexOf(killedBy);
  if (kind === SourceKind.EnemyContact || kind === SourceKind.EnemyAttack) {
    return data.enemies[index]?.nameKey ?? null;
  }
  // TODO(UI with GP, M2): boss pattern and affix sources need a name key path in data.
  return null;
}

export interface RunEndModel {
  readonly won: boolean;
  /** 1-based Pulse reached and the run's Pulse count. */
  readonly pulseReached: number;
  readonly pulseCount: number;
  readonly timeText: string;
  readonly kills: number;
  readonly glintEarned: number;
  readonly silt: number;
  readonly killerKey: string | null;
  readonly classId: string;
  readonly difficulty: number;
  readonly build: BuildSummary;
}

export function buildRunEndModel(view: WorldView, data: GameData): RunEndModel {
  const s = view.runStats;
  const won = view.phase === 'victory';
  const count = Math.max(1, view.pulse.count);
  return {
    won,
    pulseReached: won ? count : Math.min(count, view.pulse.index + 1),
    pulseCount: count,
    timeText: formatClock(floorSeconds(s.runTicks)),
    kills: s.kills,
    glintEarned: s.glintEarned,
    silt: s.silt,
    killerKey: won ? null : killerNameKey(data, s.killedBy),
    classId: data.classes[view.player.classIndex]?.id ?? data.classes[0]?.id ?? '',
    difficulty: s.difficulty,
    build: buildSummary(view, data),
  };
}
