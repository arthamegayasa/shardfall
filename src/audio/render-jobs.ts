// Buffer rendering jobs (audio-direction 2.2, 2.3): the pure DSP runs in a Web Worker when the
// browser allows it, so boot never blocks a frame; otherwise on the main thread one job per slice.
// Pure job runner plus two renderers with the same interface.

import { IR_HALL, IR_ROOM, renderCue, renderInstrumentSample, renderIr } from './synth/index.ts';
import type { InstrumentDef, SynthRecipe } from './synth/index.ts';

export type RenderJob =
  | { readonly kind: 'cue'; readonly recipe: SynthRecipe; readonly sampleRate: number; readonly durationMs: number }
  | { readonly kind: 'instrument'; readonly def: InstrumentDef; readonly ref: number | null }
  | { readonly kind: 'ir'; readonly ir: 'hall' | 'room'; readonly sampleRate: number };

/** Runs one job. Returns the channels (one for cues and instruments, two for IRs). */
export function runJob(job: RenderJob): Float32Array[] {
  switch (job.kind) {
    case 'cue':
      return [renderCue(job.recipe, job.sampleRate, job.durationMs)];
    case 'instrument':
      return [renderInstrumentSample(job.def, job.ref)];
    case 'ir': {
      const [l, r] = renderIr(job.ir === 'hall' ? IR_HALL : IR_ROOM, job.sampleRate);
      return [l, r];
    }
  }
}

export interface BufferRenderer {
  /** True when jobs run off the main thread. */
  readonly offThread: boolean;
  render(job: RenderJob): Promise<Float32Array[]>;
  dispose(): void;
}

/** Slice length before yielding to the browser when rendering on the main thread. */
const MAIN_THREAD_SLICE_MS = 6;

/**
 * Main-thread fallback (no Worker, tests): runs jobs in order and yields through a MessageChannel
 * (no 4 ms setTimeout clamp) whenever a slice is used up, so input and frames keep flowing.
 */
export function createMainThreadRenderer(now: () => number = () => performance.now()): BufferRenderer {
  let sliceStart = now();
  let channel: MessageChannel | null = null;
  const waiting: (() => void)[] = [];
  const yieldNow = (): Promise<void> =>
    new Promise<void>((resolve) => {
      if (typeof MessageChannel === 'undefined') {
        setTimeout(resolve, 0);
        return;
      }
      if (channel === null) {
        channel = new MessageChannel();
        channel.port1.onmessage = () => {
          waiting.shift()?.();
        };
      }
      waiting.push(resolve);
      channel.port2.postMessage(0);
    });
  return {
    offThread: false,
    async render(job) {
      if (now() - sliceStart >= MAIN_THREAD_SLICE_MS) {
        await yieldNow();
        sliceStart = now();
      }
      return runJob(job);
    },
    dispose() {
      channel?.port1.close();
      channel = null;
    },
  };
}

/** Minimal worker surface used here (keeps the DOM Worker type out of tests). */
export interface WorkerLike {
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: unknown) => void) | null;
  postMessage(msg: unknown): void;
  terminate(): void;
}

interface Reply {
  readonly id: number;
  readonly out?: Float32Array[];
  readonly error?: string;
}

/**
 * Worker renderer: every job is posted at once, the worker answers in order and transfers the
 * sample memory back. A broken worker rejects all pending jobs; callers fall back per job.
 */
export function createWorkerRenderer(worker: WorkerLike): BufferRenderer {
  let nextId = 1;
  let broken = false;
  const pending = new Map<number, { resolve: (v: Float32Array[]) => void; reject: (e: Error) => void }>();
  const failAll = (msg: string): void => {
    broken = true;
    for (const p of pending.values()) p.reject(new Error(msg));
    pending.clear();
  };
  worker.onmessage = (e: MessageEvent) => {
    const r = e.data as Reply;
    const p = pending.get(r.id);
    if (p === undefined) return;
    pending.delete(r.id);
    if (r.out !== undefined) p.resolve(r.out);
    else p.reject(new Error(r.error ?? 'render failed'));
  };
  worker.onerror = () => {
    failAll('audio render worker failed');
  };
  return {
    offThread: true,
    render(job) {
      if (broken) return Promise.reject(new Error('audio render worker failed'));
      const id = nextId++;
      return new Promise<Float32Array[]>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, job });
      });
    },
    dispose() {
      failAll('disposed');
      worker.terminate();
    },
  };
}
