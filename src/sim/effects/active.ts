// Owners, tag counts, synergy thresholds, and the active effect list (GDD 8.1, effect-primitives 6.1).
// Runs only when the inventory changes (buy, sell, merge, reward, load), not per tick.

import { SimEventType } from '../../core/index.ts';
import { TRIGGER_COUNT } from '../codes.ts';
import type { SimCtx } from '../ctx.ts';

/** Recount tags from distinct owned weapon and Memento ids (GDD 8.1). Inactive tags count 0. */
function recountTags(ctx: SimCtx): void {
  const { sd, run, world } = ctx;
  const counts = world.shop.tagCounts;
  counts.fill(0);
  const seen = new Set<number>();
  for (let s = 0; s < run.weaponIndex.length; s++) {
    const w = run.weaponIndex[s] ?? -1;
    if (w < 0 || seen.has(w)) continue;
    seen.add(w);
    const mask = sd.weapons[w]?.tagMask ?? 0;
    for (let t = 0; t < sd.tagCount; t++) {
      if ((mask & (1 << t)) !== 0 && sd.tagActive[t] === 1) counts[t] = (counts[t] ?? 0) + 1;
    }
  }
  for (const m of run.mementoOrder) {
    const mask = sd.mementoTagMask[m] ?? 0;
    for (let t = 0; t < sd.tagCount; t++) {
      if ((mask & (1 << t)) !== 0 && sd.tagActive[t] === 1) counts[t] = (counts[t] ?? 0) + 1;
    }
  }
}

/**
 * Rebuild owners and the active effect list. emitEvents: raise SynergyActivated for thresholds that
 * became active (shop and reward changes); false on load and run start.
 */
export function rebuildActiveEffects(ctx: SimCtx, emitEvents: boolean): void {
  const { data, sd, run, active } = ctx;
  recountTags(ctx);
  const counts = ctx.world.shop.tagCounts;

  // Allocation is fine here: this runs on inventory changes only (coding-standards 5 exception).
  const ownerIds: string[] = [];
  const ownerCopies: number[] = [];
  const cls = data.classes[run.classIndex];
  if (run.started && cls !== undefined) {
    ownerIds.push(cls.id);
    ownerCopies.push(1);
  }
  for (const m of run.mementoOrder) {
    const def = data.mementos[m];
    if (def === undefined) continue;
    ownerIds.push(def.id);
    ownerCopies.push(Math.max(1, run.mementoCount[m] ?? 1));
  }
  // Weapon tier effects (weapon_tiers.csv effects column), one owner per distinct weapon and tier.
  for (let s = 0; s < run.weaponIndex.length; s++) {
    const w = run.weaponIndex[s] ?? -1;
    if (w < 0) continue;
    const tier = run.weaponTier[s] ?? 1;
    for (const t of data.weapons[w]?.tiers ?? []) {
      if (t.tier > tier) continue;
      for (const owner of t.effects) {
        if (!ownerIds.includes(owner)) {
          ownerIds.push(owner);
          ownerCopies.push(1);
        }
      }
    }
  }
  let mask = 0;
  for (const r of sd.synergyOrder) {
    const syn = data.synergies[r];
    const tag = sd.synergyTag[r] ?? -1;
    if (syn === undefined || tag < 0) continue;
    if ((counts[tag] ?? 0) >= syn.threshold) {
      mask |= 1 << r;
      ownerIds.push(syn.owner);
      ownerCopies.push(1);
      if (emitEvents && (run.synergyMask & (1 << r)) === 0) {
        ctx.events.push(SimEventType.SynergyActivated, 0, 0, tag, syn.threshold, 0);
      }
    }
  }
  run.synergyMask = mask;

  // Flatten owners into effect entries (owner order, then effects.csv order).
  let n = 0;
  for (let o = 0; o < ownerIds.length; o++) {
    const list = data.effectsByOwner[ownerIds[o] ?? ''];
    if (list === undefined) continue;
    for (const e of list) {
      if (n >= active.effect.length) break;
      active.effect[n] = e;
      active.copies[n] = ownerCopies[o] ?? 1;
      n++;
    }
  }
  active.count = n;

  // Group by trigger with a stable counting sort.
  active.start.fill(0);
  for (let i = 0; i < n; i++) {
    const t = sd.effects[active.effect[i] ?? 0]?.trigger ?? 0;
    active.start[t + 1] = (active.start[t + 1] ?? 0) + 1;
  }
  for (let t = 0; t < TRIGGER_COUNT; t++) {
    active.start[t + 1] = (active.start[t + 1] ?? 0) + (active.start[t] ?? 0);
  }
  const fill = Int32Array.from(active.start);
  for (let i = 0; i < n; i++) {
    const t = sd.effects[active.effect[i] ?? 0]?.trigger ?? 0;
    const at = fill[t] ?? 0;
    active.order[at] = i;
    fill[t] = at + 1;
  }
  run.statsDirty = true;
}
