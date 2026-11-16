// Web Worker entry: renders audio buffers with the pure DSP off the main thread (audio-direction
// 2.2: boot rendering must never freeze a frame). Loaded only by src/audio/index.ts.

import { runJob } from './render-jobs.ts';
import type { RenderJob } from './render-jobs.ts';

interface WorkerScope {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(msg: unknown, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (e: MessageEvent) => {
  const { id, job } = e.data as { id: number; job: RenderJob };
  try {
    const out = runJob(job);
    scope.postMessage(
      { id, out },
      out.map((b) => b.buffer),
    );
  } catch (err) {
    scope.postMessage({ id, error: String(err) }, []);
  }
};
