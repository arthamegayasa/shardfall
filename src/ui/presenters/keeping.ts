// The Keeping models (ui-spec S09): the two tabs and the Memento archive with its found counter.
// "Found" is MetaView.mementosFound, merged from the Mementos held at each run end (meta-store).

import type { GameData, MetaUnlockDef } from '../../content/index.ts';
import type { StringParams } from '../../core/index.ts';
import type { IconRef } from '../icons.ts';
import { mementoInfo, mementoRarityOrder } from './content.ts';

export type KeepingTab = 'kept' | 'mementos';

export const KEEPING_TABS: readonly { readonly id: KeepingTab; readonly labelKey: string }[] = [
  { id: 'kept', labelKey: 'ui.keeping.tab_kept' },
  { id: 'mementos', labelKey: 'ui.keeping.tab_mementos' },
];

/** Tab after (delta 1) or before (delta -1) the given one, wrapping (Q / E). */
export function nextKeepingTab(tab: KeepingTab, delta: 1 | -1): KeepingTab {
  const i = KEEPING_TABS.findIndex((x) => x.id === tab);
  const n = KEEPING_TABS.length;
  return KEEPING_TABS[(i + delta + n) % n]?.id ?? tab;
}

/** One archive cell. A Memento not yet found reveals nothing but its silhouette. */
export interface MementoArchiveEntry {
  readonly id: string;
  readonly found: boolean;
  /** Memento icon; drawn as a silhouette while not found. */
  readonly icon: IconRef;
  /** Null while not found (the screen shows "???"). */
  readonly nameKey: string | null;
  readonly descKey: string | null;
  readonly descParams: StringParams;
  readonly flavorKey: string | null;
  readonly tags: readonly string[];
  readonly rarityOrder: number;
}

export interface MementoArchive {
  /** Every Memento of the build tier, in data (pool) order. */
  readonly entries: readonly MementoArchiveEntry[];
  /** Found Mementos that exist in this data; ids from other tiers or old saves are ignored. */
  readonly found: number;
  readonly total: number;
}

export function mementoArchive(data: GameData, mementosFound: readonly string[]): MementoArchive {
  const seen = new Set(mementosFound);
  const entries: MementoArchiveEntry[] = [];
  let found = 0;
  data.mementos.forEach((m, i) => {
    const icon: IconRef = { kind: 'memento', id: m.id };
    const info = seen.has(m.id) ? mementoInfo(data, i) : null;
    if (info === null) {
      entries.push({
        id: m.id,
        found: false,
        icon,
        nameKey: null,
        descKey: null,
        descParams: {},
        flavorKey: null,
        tags: [],
        rarityOrder: 0,
      });
      return;
    }
    found++;
    entries.push({
      id: m.id,
      found: true,
      icon,
      nameKey: info.nameKey,
      descKey: info.descKey,
      descParams: info.params,
      flavorKey: info.flavorKey,
      tags: info.tags,
      rarityOrder: mementoRarityOrder(data, i),
    });
  });
  return { entries, found, total: data.mementos.length };
}

/** The Silt pack that opens a Memento (meta_unlocks kind memento_pack), if any (wireframe 09). */
export function mementoUnlock(data: GameData, mementoId: string): MetaUnlockDef | undefined {
  return data.metaUnlocks.find((u) => u.kind === 'memento_pack' && u.targets.includes(mementoId));
}
