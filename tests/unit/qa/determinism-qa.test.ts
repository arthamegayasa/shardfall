// QA determinism tests (test-plan 5.3, architecture 14.1; M1-09b).
// D-1 full bot run on real data, D-2 separate Node processes, D-3 seeds differ, D-6 frame-rate
// independence through the real fixed-step accumulator, D-7 golden replays on fixture data.
// D-5 (Node vs Chromium) and D-8 (browser replay in Node) live in tests/e2e/determinism.spec.ts.
//
// Golden replays: tests/unit/qa/replays/*.json [Asumsi QA: architecture 14.1 names
// tests/fixtures/replays/, outside the QA write scope of M1-09b; LP may move them]. They use
// tests/fixtures/data, so GD balance changes never touch them. A deliberate sim logic change that
// alters a hash must regenerate them with QA_UPDATE_GOLDEN=1 and a written reason in the QA report.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createFixedStep, createInputFrame, toHex8 } from '../../../src/core/index.ts';
import { defaultRunProfile } from '../../../src/content/index.ts';
import { createSim, decodeReplay, playReplay } from '../../../src/sim/index.ts';
import { fixtureGameData } from '../../support/fixture-data.ts';
import { recordBotRun } from './support/record.ts';
import { realGameData } from './support/real-data.ts';
import { scriptInput, scriptedRun } from './support/scripted-run.ts';
import { botRng } from './support/qa-bot.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const CLI = resolve(import.meta.dirname, 'support/sim-cli.ts');
const GOLDEN_DIR = resolve(import.meta.dirname, 'replays');
const real = realGameData();
const realClass = real.classes[0]?.id ?? '';

function cli(...args: string[]): Record<string, unknown> {
  const out = execFileSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8' });
  return JSON.parse(out) as Record<string, unknown>;
}

describe('QA determinism (M1-09b)', () => {
  it('D-1: a whole bot run on real data replays with every checkpoint matching (same process)', () => {
    const rec = recordBotRun(
      createSim({ data: real }),
      real,
      { seed: 2024, classId: realClass, profile: 'run_a' },
      60 * 60 * 30,
    );
    expect(rec.phase === 'victory' || rec.phase === 'defeat').toBe(true);
    expect(rec.replay.checkpoints.length).toBeGreaterThan(50);
    for (let k = 0; k < 2; k++) {
      const res = playReplay(createSim({ data: real }), rec.replay);
      expect(res.mismatchAt).toBe(-1);
      expect(res.ticks).toBe(rec.replay.ticks);
      expect(res.finalHash).toBe(rec.finalHash);
    }
  });

  it('D-2: two separate Node processes give the same hashes as this process', () => {
    // The CLI uses the app's default profile (defaultRunProfile), as the browser does (D-5).
    const profile = defaultRunProfile(real);
    const local = scriptedRun(createSim({ data: real }), 42, 3600, realClass, profile);
    const a = cli('script', '42', '3600');
    const b = cli('script', '42', '3600');
    expect(a['checkpoints']).toEqual(local.checkpoints);
    expect(b['checkpoints']).toEqual(local.checkpoints);
    expect(a['hash']).toBe(local.hash);
    // And a recorded replay plays back identically in a fresh process.
    const rec = recordBotRun(
      createSim({ data: real }),
      real,
      { seed: 77, classId: realClass, profile: 'run_a' },
      5400,
    );
    mkdirSync(resolve(ROOT, 'tests/out/qa'), { recursive: true });
    const file = resolve(ROOT, 'tests/out/qa/d2-replay.json');
    writeFileSync(file, JSON.stringify(rec.replay));
    const p = cli('replay', file);
    expect(p['mismatchAt']).toBe(-1);
    expect(p['finalHash']).toBe(rec.finalHash);
  }, 60_000);

  it('D-3: a different seed with the same input gives different hashes', () => {
    const a = scriptedRun(createSim({ data: real }), 1, 600, realClass);
    const b = scriptedRun(createSim({ data: real }), 2, 600, realClass);
    expect(b.hash).not.toBe(a.hash);
  });

  it('D-6: 30, 60, 144 fps and seeded random frame times give the hash of a pure tick run', () => {
    const TICKS = 3600;
    const pure = scriptedRun(createSim({ data: real }), 9, TICKS, realClass).hash;
    const rnd = botRng(6);
    const cadences: [string, () => number][] = [
      ['30 fps', () => 1000 / 30],
      ['60 fps', () => 1000 / 60],
      ['144 fps', () => 1000 / 144],
      ['random 4..60 ms', () => 4 + rnd() * 56],
    ];
    for (const [name, dt] of cadences) {
      const sim = createSim({ data: real });
      const fixed = createFixedStep();
      const input = createInputFrame();
      sim.enqueue({
        type: 'run.start',
        seed: 9,
        classId: realClass,
        profile: 'run_a',
        difficulty: 0,
      });
      let t = 0;
      let frames = 0;
      while (t < TICKS && frames < TICKS * 20) {
        frames++;
        const n = fixed.advance(dt());
        for (let i = 0; i < n && t < TICKS; i++, t++) {
          scriptInput(t, input);
          sim.step(input);
        }
      }
      expect(t, name).toBe(TICKS);
      expect(fixed.droppedTicks, name).toBe(0);
      expect(toHex8(sim.hash()), name).toBe(pure);
    }
  });

  describe('D-7: golden replays on fixture data', () => {
    const fixture = fixtureGameData();
    const fxClass = fixture.classes[0]?.id ?? '';
    const fxProfile = Object.keys(fixture.profiles).sort()[0] ?? '';
    for (const seed of [11, 22, 33]) {
      it(`golden replay seed ${seed} matches its stored checkpoints and final hash`, () => {
        const file = resolve(GOLDEN_DIR, `golden-${seed}.json`);
        if (process.env['QA_UPDATE_GOLDEN'] === '1') {
          const rec = recordBotRun(
            createSim({ data: fixture }),
            fixture,
            { seed, classId: fxClass, profile: fxProfile },
            60 * 60 * 3,
          );
          mkdirSync(GOLDEN_DIR, { recursive: true });
          writeFileSync(
            file,
            `${JSON.stringify({ expectedFinalHash: rec.finalHash, expectedPhase: rec.phase, replay: rec.replay })}\n`,
          );
        }
        // A missing golden file is a failure, never a silent re-record.
        expect(existsSync(file), `${file} missing: run with QA_UPDATE_GOLDEN=1 once`).toBe(true);
        const golden = JSON.parse(readFileSync(file, 'utf8')) as {
          expectedFinalHash: string;
          expectedPhase: string;
          replay: unknown;
        };
        const r = decodeReplay(golden.replay);
        expect(r).not.toBeNull();
        if (r === null) return;
        expect(r.checkpoints.length).toBeGreaterThan(10);
        const sim = createSim({ data: fixture });
        const res = playReplay(sim, r);
        expect(res.mismatchAt).toBe(-1);
        expect(res.ticks).toBe(r.ticks);
        expect(res.finalHash).toBe(golden.expectedFinalHash);
        expect(sim.view.phase).toBe(golden.expectedPhase);
      });
    }
  });
});
