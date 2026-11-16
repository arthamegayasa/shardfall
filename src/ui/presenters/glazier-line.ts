// The Glazier's spoken line (ui-spec S05, CD M1 4 "Pedagang, bukan menu"). One line from the WR
// string table (glazier.<trigger>, docs/narrative/string-table.md), chosen deterministically from
// the run state so a screenshot or a replay always shows the same line. WR may add variants as
// glazier.<trigger>.2 .. .9 (and .1); they join the pool automatically.

import { RejectReason, SimEventType } from '../../core/index.ts';

export type GlazierTrigger =
  'open' | 'first' | 'no_glint' | 'reroll' | 'fuse' | 'after_temper' | 'warden_fell' | 'begin';

export interface GlazierVisit {
  /** 0-based index of the Pulse that just ended. */
  readonly pulseIndex: number;
  readonly sawReward: boolean;
  readonly sawTemper: boolean;
}

/** Highest variant suffix probed in the string table. */
const MAX_VARIANT = 9;

/** Opening trigger: Warden fell, else first visit of the run, else open or after Temper by turn. */
export function openingTrigger(v: GlazierVisit): GlazierTrigger {
  if (v.sawReward) return 'warden_fell';
  if (v.pulseIndex <= 0) return 'first';
  if (!v.sawTemper) return 'open';
  return v.pulseIndex % 2 === 0 ? 'after_temper' : 'open';
}

/** Reaction trigger for one sim event in the shop, or null. */
export function reactionTrigger(type: number, a: number): GlazierTrigger | null {
  if (type === SimEventType.ShopRerolled) return 'reroll';
  if (type === SimEventType.ItemMerged) return 'fuse';
  if (type === SimEventType.CommandRejected && a === RejectReason.NotEnoughGlint) return 'no_glint';
  return null;
}

/** Every existing key for a trigger, base key first, then numbered variants. */
export function lineKeys(trigger: GlazierTrigger, has: (key: string) => boolean): string[] {
  const base = `glazier.${trigger}`;
  const out: string[] = [];
  if (has(base)) out.push(base);
  for (let i = 1; i <= MAX_VARIANT; i++) {
    const k = `${base}.${String(i)}`;
    if (has(k)) out.push(k);
  }
  return out;
}

/** Deterministic pick: seed modulo the pool. Falls back to glazier.open; null when no line. */
export function pickLine(
  trigger: GlazierTrigger,
  seed: number,
  has: (key: string) => boolean,
): string | null {
  let pool = lineKeys(trigger, has);
  if (pool.length === 0 && trigger !== 'open') pool = lineKeys('open', has);
  if (pool.length === 0) return null;
  const i = ((Math.floor(seed) % pool.length) + pool.length) % pool.length;
  return pool[i] ?? null;
}
