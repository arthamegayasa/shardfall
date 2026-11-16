// Effect text parameters from data (docs/narrative/string-table.md 4). LP, M1-09a.
// One source for the numbers in Memento, synergy, and class passive texts: the UI fills its strings
// with these values and tools/data/check-strings.ts checks length and placeholders with the same
// values, so a text can never show a {placeholder} or a number that disagrees with the data.
// Values are tier I / one stack, as shown on shop cards. Pure: no DOM.

import type { EffectDef, GameData } from '../game-data.ts';

export type TextParams = Readonly<Record<string, string>>;

/** Integer when whole, otherwise one decimal (0.5 -> "0.5", 12.0 -> "12"). */
export function formatParam(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

const pct = (v: number): number => v * 100;

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    // Conditions carry strings like "5@global" or "0.12".
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function condition(e: EffectDef, name: string): number | null {
  for (const c of e.conditions) if (c.name === name) return num(c.value);
  return null;
}

function statBase(data: GameData, statId: string): number {
  return data.stats.find((s) => s.id === statId)?.base ?? 0;
}

/**
 * Candidate values per placeholder name for one effect, in priority order. The first effect of the
 * owner (row order) that yields a value wins, so a two-effect owner like syn_edge_2 reads its first row.
 */
function candidates(data: GameData, e: EffectDef): Record<string, number> {
  const out: Record<string, number> = {};
  const p = e.params;
  const set = (k: string, v: number | null): void => {
    if (v !== null && out[k] === undefined) out[k] = v;
  };
  if (e.chance < 1) set('chance', pct(e.chance));
  if (e.action === 'hit_mod') set('pct', pct(num(p['value']) ?? 0));
  set('pct', p['dmg_frac'] === undefined ? null : pct(num(p['dmg_frac']) ?? 0));
  const hpBelow = condition(e, 'target_hp_below');
  set('pct', hpBelow === null ? null : pct(hpBelow));
  set('nth', condition(e, 'every_nth'));
  if (e.action === 'status_rule' && p['rule'] === 'dmg_mult') {
    const v = num(p['value']);
    // Multiplier 1.3 reads as +30% (string-table 4).
    set(`${String(p['status'])}_pct`, v === null ? null : pct(v - 1));
  }
  if (e.action === 'stat_mod') {
    const stat = String(p['stat']);
    const v = num(p['value']);
    if (v !== null) {
      if (stat === 'burn_max_stacks') set('stacks', statBase(data, stat) + v);
      else if (stat === 'crit_chance') set('crit', v);
      else set(stat, v);
    }
  }
  if (e.action === 'buff') set('stacks', num(p['max_stacks']));
  for (const k of ['count', 'interval', 'dmg', 'radius', 'duration']) set(k, num(p[k]));
  return out;
}

/** Placeholder values for every effect owner (class id, Memento id, synergy owner). */
export function ownerTextParams(data: GameData, owner: string): TextParams {
  const merged: Record<string, number> = {};
  for (const idx of data.effectsByOwner[owner] ?? []) {
    const e = data.effects[idx];
    if (e === undefined) continue;
    const c = candidates(data, e);
    for (const k of Object.keys(c)) if (merged[k] === undefined) merged[k] = c[k] ?? 0;
  }
  const out: Record<string, string> = {};
  for (const k of Object.keys(merged)) out[k] = formatParam(merged[k] ?? 0);
  return out;
}

/** Placeholder names used in a string ({name}). */
export function placeholdersOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\{([a-z_0-9]+)\}/g)) if (m[1] !== undefined) out.push(m[1]);
  return out;
}
