// Runs tests/unit/qa/support/sim-cli.ts in a fresh Node process (Node 24 strips TypeScript types).
// Used by the e2e determinism checks D-5 and D-8 (architecture 14.1).

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const CLI = resolve(ROOT, 'tests/unit/qa/support/sim-cli.ts');

export function nodeSim(...args: string[]): Record<string, unknown> {
  const out = execFileSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(out) as Record<string, unknown>;
}

/** Save a browser replay under tests/out/qa/ and play it back in Node. */
export function replayInNode(
  name: string,
  replay: unknown,
): { file: string; result: Record<string, unknown> } {
  mkdirSync(resolve(ROOT, 'tests/out/qa'), { recursive: true });
  const file = resolve(ROOT, `tests/out/qa/${name}.json`);
  writeFileSync(file, JSON.stringify(replay));
  return { file, result: nodeSim('replay', file) };
}
