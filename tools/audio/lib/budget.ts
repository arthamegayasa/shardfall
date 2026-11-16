// Buffer memory and boot render cost of the audio data (audio-direction 2.2, test A-7). Renders
// exactly what AudioSystem.unlock() renders, with the same pure DSP, and measures it.

import { bootRenderOrder, liveLengthMs } from '../../../src/audio/cue-data.ts';
import type { CueTable } from '../../../src/audio/cue-data.ts';
import { runJob } from '../../../src/audio/render-jobs.ts';
import type { RenderJob } from '../../../src/audio/render-jobs.ts';
import type { InstrumentDef } from '../../../src/audio/synth/index.ts';

/** audio-direction 2.2: pre-rendered buffer memory below 8 MB. */
export const BUFFER_BUDGET_BYTES = 8 * 1024 * 1024;

export interface BudgetReport {
  readonly sfxBytes: number;
  readonly liveBytes: number;
  readonly instrumentBytes: number;
  readonly irBytes: number;
  readonly totalBytes: number;
  /** Sum of all job render times (what a worker spends, or the main thread in slices). */
  readonly renderMs: number;
  /** Longest single job: the worst main-thread stall without a worker. */
  readonly longestJobMs: number;
  readonly longestJob: string;
}

/**
 * Renders every boot job. warmup: live cue lengths warmed at boot (liveWarmupPairs).
 * IRs follow the device rate (48 kHz assumed); everything else has its own data rate.
 */
export function measureBudget(
  cues: CueTable,
  instruments: ReadonlyMap<string, InstrumentDef>,
  warmup: readonly { readonly cue: string; readonly durSec: number }[],
  deviceRate = 48000,
): BudgetReport {
  const jobs: { name: string; group: 'sfx' | 'live' | 'inst' | 'ir'; job: RenderJob }[] = [];
  for (const c of bootRenderOrder(cues)) {
    jobs.push({ name: c.id, group: 'sfx', job: { kind: 'cue', recipe: c, sampleRate: c.sampleRate, durationMs: c.durationMs } });
  }
  const seen = new Set<string>();
  for (const w of warmup) {
    const i = cues.indexOf.get(w.cue);
    const c = i === undefined ? undefined : cues.cues[i];
    const ms = liveLengthMs(w.durSec);
    const key = `${w.cue}:${ms}`;
    if (c === undefined || seen.has(key)) continue;
    seen.add(key);
    jobs.push({ name: key, group: 'live', job: { kind: 'cue', recipe: c, sampleRate: c.sampleRate, durationMs: ms } });
  }
  for (const def of instruments.values()) {
    const refs: readonly (number | null)[] = def.refNotes.length > 0 ? def.refNotes : [null];
    refs.forEach((ref) => jobs.push({ name: `${def.id}:${ref ?? '-'}`, group: 'inst', job: { kind: 'instrument', def, ref } }));
  }
  jobs.push({ name: 'ir.room', group: 'ir', job: { kind: 'ir', ir: 'room', sampleRate: deviceRate } });
  jobs.push({ name: 'ir.hall', group: 'ir', job: { kind: 'ir', ir: 'hall', sampleRate: deviceRate } });

  const bytes = { sfx: 0, live: 0, inst: 0, ir: 0 };
  let renderMs = 0;
  let longestJobMs = 0;
  let longestJob = '';
  for (const j of jobs) {
    const t0 = performance.now();
    const out = runJob(j.job);
    const ms = performance.now() - t0;
    renderMs += ms;
    if (ms > longestJobMs) {
      longestJobMs = ms;
      longestJob = j.name;
    }
    for (const ch of out) bytes[j.group] += ch.length * 4;
  }
  return {
    sfxBytes: bytes.sfx,
    liveBytes: bytes.live,
    instrumentBytes: bytes.inst,
    irBytes: bytes.ir,
    totalBytes: bytes.sfx + bytes.live + bytes.inst + bytes.ir,
    renderMs,
    longestJobMs,
    longestJob,
  };
}

export function formatBudget(r: BudgetReport): string {
  const mb = (b: number): string => `${(b / 1024 / 1024).toFixed(2)} MB`;
  return (
    `buffers ${mb(r.totalBytes)} of ${mb(BUFFER_BUDGET_BYTES)} ` +
    `(sfx ${mb(r.sfxBytes)}, live warmup ${mb(r.liveBytes)}, instruments ${mb(r.instrumentBytes)}, IR ${mb(r.irBytes)}); ` +
    `boot render ${r.renderMs.toFixed(0)} ms total, longest job ${r.longestJobMs.toFixed(1)} ms (${r.longestJob})`
  );
}
