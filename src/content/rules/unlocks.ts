// Meta unlocks with Silt (GDD 17, data-schema 3.23; architecture 12). Pure rules from data, shared by
// the sim (run pools), the UI (class select, The Keeping), and the app (buying, MetaSave). LP M2-09.
//
// meta.unlocked holds meta_unlocks ids plus the class ids they open (MetaView contract). A class,
// weapon, or Memento is open when it needs no unlock, or when an owned unlock targets it.

import type { GameData, MetaUnlockDef } from '../game-data.ts';
import type { MetaSave } from '../../core/index.ts';

/**
 * Profile the app starts runs with: the run of the build's content tier (run_b in tier B), falling
 * back to run_a. Shared by the app (boot.ts) and Node tools that must match it (QA D-5). LP M2-09.
 */
export function defaultRunProfile(data: GameData): string {
  const own = `run_${data.meta.contentTier.toLowerCase()}`;
  return data.profiles[own] !== undefined ? own : 'run_a';
}

/** Silt price of an unlock in this build: cost_silt_b replaces cost_silt in content tier B. */
export function unlockCost(data: GameData, def: MetaUnlockDef): number {
  const b = def.costSiltB;
  return data.meta.contentTier === 'B' && typeof b === 'number' ? b : def.costSilt;
}

export function findUnlock(data: GameData, id: string): MetaUnlockDef | undefined {
  return data.metaUnlocks.find((u) => u.id === id);
}

/** Unlocks of a kind that target an id (a class, weapon, or Memento pack member). */
function unlocksFor(data: GameData, kind: MetaUnlockDef['kind'], target: string): MetaUnlockDef[] {
  return data.metaUnlocks.filter((u) => u.kind === kind && u.targets.includes(target));
}

/**
 * A class is playable when it costs nothing, or an owned unlock (or its own id) opens it. A class
 * with a price and no unlock row stays locked unless meta lists its id (data error, never free).
 */
export function isClassOpen(data: GameData, unlocked: readonly string[], classId: string): boolean {
  const cls = data.classes.find((c) => c.id === classId);
  if (cls === undefined) return false;
  if (unlocked.includes(classId)) return true;
  const rows = unlocksFor(data, 'class', classId);
  if (rows.length === 0) return cls.unlockSilt <= 0;
  return rows.some((u) => unlocked.includes(u.id));
}

/** The unlock row that opens a class, if any (for the price shown on locked classes). */
export function classUnlock(data: GameData, classId: string): MetaUnlockDef | undefined {
  return unlocksFor(data, 'class', classId)[0];
}

export function isWeaponOpen(
  data: GameData,
  unlocked: readonly string[],
  weaponId: string,
): boolean {
  const w = data.weapons.find((x) => x.id === weaponId);
  if (w === undefined) return false;
  const rows = unlocksFor(data, 'weapon', weaponId);
  if (rows.length === 0) return w.unlockSilt <= 0;
  return rows.some((u) => unlocked.includes(u.id));
}

export function isMementoOpen(
  data: GameData,
  unlocked: readonly string[],
  mementoId: string,
): boolean {
  const m = data.mementos.find((x) => x.id === mementoId);
  if (m === undefined) return false;
  return m.unlock === 'default' || unlocked.includes(m.unlock);
}

export type UnlockStatus = 'owned' | 'affordable' | 'poor' | 'unknown';

export function unlockStatus(data: GameData, meta: MetaSave, id: string): UnlockStatus {
  const def = findUnlock(data, id);
  if (def === undefined) return 'unknown';
  if (meta.unlocked.includes(id)) return 'owned';
  return meta.silt >= unlockCost(data, def) ? 'affordable' : 'poor';
}

/**
 * Buy an unlock: returns the new meta (Silt spent, id and class targets added, sorted), or null when
 * the id is unknown, already owned, or not affordable.
 */
export function applyUnlock(data: GameData, meta: MetaSave, id: string): MetaSave | null {
  const def = findUnlock(data, id);
  if (def === undefined || meta.unlocked.includes(id)) return null;
  const cost = unlockCost(data, def);
  if (meta.silt < cost) return null;
  const add = new Set([...meta.unlocked, id]);
  if (def.kind === 'class') for (const t of def.targets) add.add(t);
  return { ...meta, silt: meta.silt - cost, unlocked: [...add].sort() };
}

/** Meta unlock ids that exist in this build, in data order (for run.start and the save). */
export function ownedUnlockIds(data: GameData, unlocked: readonly string[]): string[] {
  return data.metaUnlocks.filter((u) => unlocked.includes(u.id)).map((u) => u.id);
}

/**
 * Set the run's open weapons and Mementos from the owned unlock ids (run.start and save load).
 * Unknown ids are ignored; ids are kept in data order so equal sets hash and save the same.
 */
export function setRunUnlocks(
  data: GameData,
  run: { unlocked: readonly string[]; weaponOpen: Uint8Array; mementoOpen: Uint8Array },
  ids: readonly string[],
): void {
  const owned = ownedUnlockIds(data, ids);
  run.unlocked = owned;
  run.weaponOpen = Uint8Array.from(data.weapons, (w) => (isWeaponOpen(data, owned, w.id) ? 1 : 0));
  run.mementoOpen = Uint8Array.from(data.mementos, (m) =>
    isMementoOpen(data, owned, m.id) ? 1 : 0,
  );
}
