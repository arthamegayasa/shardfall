#!/usr/bin/env node
// Build content/generated/ from content/data/*.csv, content/levels/*.json, content/strings/en.json.
// Usage:
//   node tools/data/build-data.ts                 build with content/build.json tier, write content/generated/
//   node tools/data/build-data.ts --check         build in memory, fail when content/generated/ is stale
//   node tools/data/build-data.ts --tier C --out tests/out/game-data-c.json
// Exit 1 on data errors. Missing tables are warnings (required for M1) or info (optional), never errors.

import { resolve } from 'node:path';
import { buildDataToDisk, checkData } from './lib/pipeline.ts';

const root = resolve(import.meta.dirname, '..', '..');
const args = process.argv.slice(2);
const argValue = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};

const tierArg = argValue('--tier');
if (tierArg !== undefined && tierArg !== 'A' && tierArg !== 'B' && tierArg !== 'C') {
  console.error('--tier must be A, B or C');
  process.exit(2);
}
const out = argValue('--out');

const result = args.includes('--check')
  ? checkData(root)
  : buildDataToDisk(root, {
      ...(tierArg !== undefined ? { tier: tierArg } : {}),
      ...(out !== undefined ? { out } : {}),
    });
for (const line of result.report) console.log(line);
process.exit(result.ok ? 0 : 1);
