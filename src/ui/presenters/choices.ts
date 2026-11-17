// Level up (was Temper) and Elite reward models (ui-spec S04, S04b; redesign-1.1 3.3). One card
// shape for both: the screen shows them as glass panes side by side.

import type { GameData, StatDef, TagId } from '../../content/index.ts';
import type { StringParams, WorldView } from '../../core/index.ts';
import { formatStatValue } from '../format.ts';
import type { IconRef } from '../icons.ts';
import { enemyNameKey, mementoInfo } from './content.ts';

/**
 * A stat value with its unit, as the player reads it: percent stats "12%", per second "0.2/s",
 * seconds "4s", flat and distance stats the bare number ("4", "1.5").
 */
export function statValueText(v: number, unit: StatDef['unit']): string {
  const n = formatStatValue(v);
  if (unit === 'pct') return `${n}%`;
  if (unit === 'per_s' || unit === 'u_per_s') return `${n}/s`;
  if (unit === 's') return `${n}s`;
  return n;
}

export interface StatChange {
  readonly statKey: string;
  readonly before: string;
  readonly after: string;
}

export interface ChoiceCard {
  /** Index into the view's choices, sent back in levelup.pick / reward.pick. */
  readonly choice: number;
  readonly nameKey: string;
  readonly descKey: string;
  readonly descParams: StringParams;
  readonly flavorKey: string | null;
  readonly tags: readonly TagId[];
  readonly rarityOrder: number;
  /** Stat icon for Temper cards, Memento icon for rewards. */
  readonly icon: IconRef | null;
  /** Level up only: "Damage 0% > 12%" preview with units (ui-spec S04, redesign-1.1 3.3). */
  readonly statChange: StatChange | null;
}

export interface LevelUpModel {
  readonly revision: number;
  /** Level being tempered now (1-based). */
  readonly level: number;
  /** "1 of 2": position in this Pulse's queue, and its size. */
  readonly queueIndex: number;
  readonly queueTotal: number;
  /** Level ups still queued after this one ("2 more waiting"), 0 when this is the last. */
  readonly waiting: number;
  readonly cards: readonly ChoiceCard[];
}

export interface RewardModel {
  readonly revision: number;
  /** Name key of the Warden or boss that dropped the reward, null when unknown. */
  readonly sourceNameKey: string | null;
  readonly cards: readonly ChoiceCard[];
}

export function buildLevelUpModel(view: WorldView, data: GameData): LevelUpModel {
  const lu = view.levelUp;
  const total = Math.max(lu.total, lu.pending, 1);
  const cards = lu.choices.map((c, i): ChoiceCard => {
    const card = data.levelUpCards[c.cardIndex];
    const statIndex = card === undefined ? -1 : data.stats.findIndex((s) => s.id === card.stat);
    const stat = data.stats[statIndex];
    const value = formatStatValue(c.value);
    let statChange: StatChange | null = null;
    if (stat !== undefined) {
      const before = view.player.stats[statIndex] ?? stat.base;
      statChange = {
        statKey: stat.displayKey,
        before: statValueText(before, stat.unit),
        after: statValueText(before + c.value, stat.unit),
      };
    }
    return {
      choice: i,
      nameKey: stat?.displayKey ?? card?.descKey ?? '',
      descKey: card?.descKey ?? '',
      descParams: { value },
      flavorKey: null,
      tags: [],
      rarityOrder: c.rarity,
      icon: card === undefined ? null : { kind: 'stat', id: card.stat },
      statChange,
    };
  });
  return {
    revision: lu.revision,
    level: Math.max(1, view.player.level - Math.max(lu.pending, 1) + 1),
    queueIndex: Math.min(total, total - Math.max(lu.pending, 1) + 1),
    queueTotal: total,
    waiting: Math.max(0, lu.pending - 1),
    cards,
  };
}

export function buildRewardModel(view: WorldView, data: GameData): RewardModel {
  const r = view.reward;
  const cards = r.choices.map((c, i): ChoiceCard => {
    const info = mementoInfo(data, c.mementoIndex);
    return {
      choice: i,
      nameKey: info?.nameKey ?? '',
      descKey: info?.descKey ?? '',
      descParams: info?.params ?? {},
      flavorKey: info?.flavorKey ?? null,
      tags: info?.tags ?? [],
      rarityOrder: c.rarity,
      icon: info === null ? null : { kind: 'memento', id: info.id },
      statChange: null,
    };
  });
  return { revision: r.revision, sourceNameKey: enemyNameKey(data, r.sourceTypeIndex), cards };
}
