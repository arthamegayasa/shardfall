// QA CLI (M1-09b): runs the sim in a fresh Node process on the real game data
// (content/generated/game-data.json). Used by D-2 (separate processes), D-5 (scripted run hash for
// browser comparison), and D-8 (browser replay played back in Node).
//   node tests/unit/qa/support/sim-cli.ts replay <replay.json>   -> {"ticks","mismatchAt","finalHash"}
//   node tests/unit/qa/support/sim-cli.ts script <seed> <ticks>  -> {"hash","tick","phase"}
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGameData, defaultRunProfile } from '../../../../src/content/index.ts';
import type { RawGameData } from '../../../../src/content/index.ts';
import { createSim, decodeReplay, playReplay } from '../../../../src/sim/index.ts';
import { scriptedRun } from './scripted-run.ts';

const root = resolve(import.meta.dirname, '../../../..');
const raw = JSON.parse(
  readFileSync(resolve(root, 'content/generated/game-data.json'), 'utf8'),
) as RawGameData;
const data = buildGameData(raw, { freeze: true });

const [mode, a, b] = process.argv.slice(2);
if (mode === 'replay') {
  const r = decodeReplay(JSON.parse(readFileSync(resolve(a ?? ''), 'utf8')));
  if (r === null) throw new Error('not a shardfall-replay v1');
  const res = playReplay(createSim({ data }), r);
  process.stdout.write(JSON.stringify({ ...res, contentHash: data.meta.contentHash }));
} else if (mode === 'script') {
  const sim = createSim({ data });
  // Same profile as the app's startRun (D-5 compares against the browser).
  const out = scriptedRun(
    sim,
    Number(a),
    Number(b),
    data.classes[0]?.id ?? '',
    defaultRunProfile(data),
  );
  process.stdout.write(JSON.stringify(out));
} else {
  throw new Error('usage: sim-cli.ts replay <file> | script <seed> <ticks>');
}
