// File IO around src/content buildRaw (architecture.md 9.1, 9.5). Used by build-data.ts and the Vite dev plugin.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildRaw, canonicalJson } from '../../../src/content/index.ts';
import type { BuildInput, BuildOutput, ContentTier } from '../../../src/content/index.ts';
import { checkStrings } from './check-strings.ts';

export const GAME_DATA_PATH = 'content/generated/game-data.json';
export const STRINGS_PATH = 'content/generated/strings.json';

export interface DataPaths {
  readonly dataDir: string;
  readonly levelsDir: string;
  readonly stringsFile: string;
  readonly buildFile: string;
}

export function defaultPaths(root: string): DataPaths {
  return {
    dataDir: join(root, 'content', 'data'),
    levelsDir: join(root, 'content', 'levels'),
    stringsFile: join(root, 'content', 'strings', 'en.json'),
    buildFile: join(root, 'content', 'build.json'),
  };
}

function readDirByExt(dir: string, ext: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(ext)) continue;
    out[f.slice(0, -ext.length)] = readFileSync(join(dir, f), 'utf8');
  }
  return out;
}

/** content/build.json { "contentTier": "A" } (Producer). Defaults to A when absent. */
export function readContentTier(buildFile: string): ContentTier {
  if (!existsSync(buildFile)) return 'A';
  const json = JSON.parse(readFileSync(buildFile, 'utf8')) as { contentTier?: unknown };
  const t = json.contentTier;
  if (t !== 'A' && t !== 'B' && t !== 'C')
    throw new Error(`${buildFile}: contentTier must be "A", "B" or "C"`);
  return t;
}

export function readInputs(paths: DataPaths, tier?: ContentTier): BuildInput {
  return {
    csv: readDirByExt(paths.dataDir, '.csv'),
    levels: readDirByExt(paths.levelsDir, '.json'),
    strings: existsSync(paths.stringsFile) ? readFileSync(paths.stringsFile, 'utf8') : null,
    contentTier: tier ?? readContentTier(paths.buildFile),
  };
}

export interface RenderedOutput {
  readonly output: BuildOutput;
  readonly gameDataText: string;
  readonly stringsText: string;
}

/**
 * String table check (check-strings.ts) on a successful build of the shipped tier; its errors fail
 * the build. Builds of another tier to a custom --out (balance tools) skip it: tier B and C strings
 * are not written yet (string-table.md 6).
 */
function withStringCheck(
  root: string,
  output: BuildOutput,
  check = true,
): { ok: boolean; report: string[] } {
  const report = formatReport(output);
  if (!output.ok || !check) return { ok: output.ok, report };
  const sc = checkStrings(root, output.data, output.strings);
  return {
    ok: sc.errors.length === 0,
    report: [
      ...sc.errors.map((e) => `ERROR ${e}`),
      ...sc.warnings.map((w) => `WARN  ${w}`),
      ...report,
      `strings: ${String(sc.errors.length)} error(s), ${String(sc.warnings.length)} warning(s)`,
    ],
  };
}

export function renderOutput(output: BuildOutput): RenderedOutput {
  return {
    output,
    gameDataText: canonicalJson(output.data, 1) + '\n',
    stringsText: canonicalJson(output.strings, 1) + '\n',
  };
}

export function formatReport(output: BuildOutput): string[] {
  const { errors, warnings, infos } = output.report;
  return [
    ...errors.map((e) => `ERROR ${e}`),
    ...warnings.map((w) => `WARN  ${w}`),
    ...infos.map((i) => `info  ${i}`),
    `${errors.length} error(s), ${warnings.length} warning(s); contentHash ${output.data.contentHash}, tier ${output.data.contentTier}`,
  ];
}

function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** Build and write content/generated/ unless there are errors. */
export function buildDataToDisk(
  root: string,
  opts: { readonly tier?: ContentTier; readonly out?: string } = {},
): { readonly ok: boolean; readonly report: string[] } {
  const rendered = renderOutput(buildRaw(readInputs(defaultPaths(root), opts.tier)));
  const { ok, report } = withStringCheck(root, rendered.output, opts.out === undefined);
  if (!ok) return { ok: false, report: [...report, 'not written: fix the errors above'] };
  if (opts.out !== undefined) {
    writeText(join(root, opts.out), rendered.gameDataText);
    return { ok: true, report: [...report, `wrote ${opts.out}`] };
  }
  writeText(join(root, GAME_DATA_PATH), rendered.gameDataText);
  writeText(join(root, STRINGS_PATH), rendered.stringsText);
  return { ok: true, report: [...report, `wrote ${GAME_DATA_PATH}, ${STRINGS_PATH}`] };
}

/** Build in memory and compare with the committed files (architecture 9.5). */
export function checkData(root: string): { readonly ok: boolean; readonly report: string[] } {
  const rendered = renderOutput(buildRaw(readInputs(defaultPaths(root))));
  const { ok, report } = withStringCheck(root, rendered.output);
  if (!ok) return { ok: false, report };
  const stale: string[] = [];
  for (const [path, text] of [
    [GAME_DATA_PATH, rendered.gameDataText],
    [STRINGS_PATH, rendered.stringsText],
  ] as const) {
    const full = join(root, path);
    const current = existsSync(full) ? readFileSync(full, 'utf8').replace(/\r\n/g, '\n') : null;
    if (current !== text) stale.push(path);
  }
  if (stale.length > 0) {
    return {
      ok: false,
      report: [...report, `STALE ${stale.join(', ')}: run \`npm run data\` and commit the result`],
    };
  }
  return { ok: true, report: [...report, 'content/generated is up to date'] };
}
