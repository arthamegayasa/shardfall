// String table check (architecture.md 9.3, QA DV-3 to DV-5, pillar P4-b). LP, M1-09a.
// Runs inside the data build: errors fail `npm run data` and `data:check`.
// - every key referenced by data (*_key columns) and by src/ui literals or known key patterns exists;
// - effect texts filled with the real data values (src/content/rules/text-params.ts, the same values
//   the UI shows) leave no {placeholder} and fit 2 lines x 40 chars;
// - names: weapon, Memento, Rite max 3 words and 18 chars; Unlit max 2 words; class 1 word;
//   flavor 1 line max 70 chars; Glazier lines max 45 chars (string-table.md 5, style guide 4.2);
// - no em or en dash; forbidden words (style guide 4.3) are warnings for WR and CD;
// - id.json: no key outside en.json, same placeholders per key (warnings).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildGameData,
  formatString,
  ownerTextParams,
  placeholdersOf,
} from '../../../src/content/index.ts';
import type { GameData, RawGameData } from '../../../src/content/index.ts';

export interface StringCheckResult {
  readonly errors: string[];
  readonly warnings: string[];
}

type Table = Readonly<Record<string, string>>;

/** En dash and em dash (team rule: never in game text). */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const MAX_LINE = 40;
const MAX_LINES = 2;
const FORBIDDEN = [
  'octopath',
  'brotato',
  'square enix',
  'materia',
  'estus',
  'boon',
  'keepsake',
  'unkindled',
  'ashen',
  'hollow',
  'wave',
  'shop',
  'store',
  'gold',
  'coin',
  'xp',
  'exp',
  'relic',
  'elite',
  'ultimate',
  'ancient evil',
  'chosen one',
  'destiny',
  'darkness falls',
  'hero',
  'epic',
  'loot',
  'noob',
  'blood',
  'gore',
  'guts',
];

/** Literal keys in UI sources: t('key'), t("key"), and quoted keys passed to helpers. */
function uiLiteralKeys(root: string): Set<string> {
  const keys = new Set<string>();
  const walk = (dir: string): void => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) {
        if (f.name !== 'dev') walk(p);
      } else if (f.name.endsWith('.ts') && f.name !== 'cues.ts') {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/['"]((?:ui|glazier|ending)\.[a-z0-9_.]+)['"]/g))
          if (m[1] !== undefined && !m[1].endsWith('.')) keys.add(m[1]);
      }
    }
  };
  const ui = join(root, 'src', 'ui');
  if (existsSync(ui)) walk(ui);
  keys.add('ui.error.webgl2'); // src/app/boot.ts
  return keys;
}

function words(s: string): number {
  return s
    .trim()
    .split(/\s+/)
    .filter((w) => w !== '').length;
}

export function checkStrings(root: string, raw: RawGameData, en: Table): StringCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (key: string, msg: string): void => {
    errors.push(`content/strings/en.json: "${key}" ${msg}`);
  };
  let data: GameData;
  try {
    data = buildGameData(raw);
  } catch (e) {
    return { errors: [`strings: game data did not load: ${(e as Error).message}`], warnings };
  }
  const has = (k: string): boolean => Object.hasOwn(en, k);
  const need = (k: string, from: string): void => {
    if (!has(k)) errors.push(`content/strings/en.json: missing "${k}" (used by ${from})`);
  };

  // 1. Keys referenced by data rows (*_key columns, raw snake_case names).
  for (const [table, value] of Object.entries(raw.tables)) {
    const rows: readonly Readonly<Record<string, unknown>>[] = Array.isArray(value)
      ? (value as readonly Readonly<Record<string, unknown>>[])
      : [value as Readonly<Record<string, unknown>>];
    for (const row of rows) {
      for (const [col, v] of Object.entries(row)) {
        if (col.endsWith('_key') && typeof v === 'string' && v !== '') need(v, `${table}.${col}`);
      }
    }
  }
  // 2. UI literals and key patterns built from data ids.
  for (const k of uiLiteralKeys(root)) need(k, 'src/ui');
  for (let n = 1; n <= 4; n++) need(`ui.tier.${String(n)}`, 'src/ui tierKey');
  for (const c of data.classes) {
    need(`class.${c.id}.role`, 'src/ui class select');
    need(`class.${c.id}.passive`, 'src/ui class select');
  }
  for (const t of data.tags) {
    need(`tag.${t.id}.name`, 'src/ui tag panel');
    need(`tag.${t.id}.abbr`, 'src/ui tag panel');
  }
  for (const r of data.rarities) need(`rarity.${r.id}`, 'src/ui rarity');

  // 3. Effect texts with real values.
  const effectTexts: { key: string; params: Readonly<Record<string, string | number>> }[] = [];
  for (const m of data.mementos)
    effectTexts.push({ key: m.descKey, params: ownerTextParams(data, m.id) });
  for (const s of data.synergies)
    effectTexts.push({ key: s.descKey, params: ownerTextParams(data, s.owner) });
  for (const c of data.classes)
    effectTexts.push({ key: `class.${c.id}.passive`, params: ownerTextParams(data, c.id) });
  for (const w of data.weapons) {
    const p: Record<string, string | number> = { dmg: w.dmg, count: w.count, pierce: w.pierce };
    for (const [k, v] of Object.entries(w.params)) if (typeof v === 'number') p[k] = v;
    if (w.dmg2 !== null) p['dmg2'] = w.dmg2;
    effectTexts.push({ key: w.descKey, params: p });
  }
  for (const r of data.rites) effectTexts.push({ key: r.descKey, params: { dmg: r.dmg } });
  for (const c of data.levelUpCards) effectTexts.push({ key: c.descKey, params: { value: 9999 } });
  for (const { key, params } of effectTexts) {
    const text = en[key];
    if (text === undefined) continue;
    const missing = placeholdersOf(text).filter((p) => params[p] === undefined);
    if (missing.length > 0)
      err(key, `has placeholders without a data value: {${missing.join('}, {')}}`);
    const filled = formatString(en, key, params);
    const lines = filled.split('\n');
    if (lines.length > MAX_LINES)
      err(key, `has ${String(lines.length)} lines (max ${String(MAX_LINES)})`);
    for (const l of lines)
      if (l.length > MAX_LINE)
        err(key, `line "${l}" is ${String(l.length)} chars (max ${String(MAX_LINE)})`);
  }

  // 4. Names and short lines.
  const nameRule = (key: string, maxWords: number, maxChars: number): void => {
    const v = en[key];
    if (v === undefined) return;
    if (words(v) > maxWords) err(key, `"${v}" has more than ${String(maxWords)} word(s)`);
    if (v.length > maxChars) err(key, `"${v}" is longer than ${String(maxChars)} chars`);
  };
  for (const w of data.weapons) nameRule(w.nameKey, 3, 18);
  for (const m of data.mementos) nameRule(m.nameKey, 3, 18);
  for (const r of data.rites) nameRule(r.nameKey, 3, 18);
  for (const c of data.classes) nameRule(c.nameKey, 1, 18);
  for (const e of data.enemies)
    nameRule(e.nameKey, e.role === 'warden' || e.role === 'boss' ? 3 : 2, 24);
  for (const m of data.mementos) {
    const f = m.flavorKey === null ? undefined : en[m.flavorKey];
    if (f !== undefined && (f.includes('\n') || f.length > 70))
      err(m.flavorKey ?? '', 'flavor must be 1 line, max 70 chars');
  }
  for (const [k, v] of Object.entries(en)) {
    if (k.startsWith('glazier.') && v.length > 45) err(k, `is ${String(v.length)} chars (max 45)`);
    if (DASHES.test(v)) err(k, 'contains an em or en dash');
    const low = v.toLowerCase();
    for (const w of FORBIDDEN) {
      if (new RegExp(`\\b${w}\\b`).test(low))
        warnings.push(
          `content/strings/en.json: "${k}" uses forbidden word "${w}" (style guide 4.3, WR and CD)`,
        );
    }
  }

  // 5. id.json alignment (not built into the game yet; warnings only).
  const idPath = join(root, 'content', 'strings', 'id.json');
  if (existsSync(idPath)) {
    try {
      const id = JSON.parse(readFileSync(idPath, 'utf8')) as Table;
      for (const [k, v] of Object.entries(id)) {
        const base = en[k];
        if (base === undefined) {
          warnings.push(`content/strings/id.json: "${k}" is not in en.json`);
          continue;
        }
        const a = placeholdersOf(base).sort().join(',');
        const b = placeholdersOf(v).sort().join(',');
        if (a !== b)
          warnings.push(
            `content/strings/id.json: "${k}" placeholders {${b}} differ from en {${a}}`,
          );
      }
    } catch (e) {
      warnings.push(`content/strings/id.json: ${(e as Error).message}`);
    }
  }
  return { errors, warnings };
}
