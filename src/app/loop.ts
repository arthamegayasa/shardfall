// Main loop (architecture.md 4.1, 6.5): requestAnimationFrame drives the pure fixed-step accumulator,
// sim steps at 60 Hz, events of every tick are copied into FrameEvents, then render, UI, and audio
// read the view and the frame events once per frame. Pausing stops ticking; sim never knows.

import { createEventBuffer, createFixedStep, createInputFrame, TICK_RATE } from '../core/index.ts';
import type { AudioSystem, EventBuffer, InputFrame, Sim } from '../core/index.ts';
import type { E2ePerf, Renderer, Ui } from '../core/dom.ts';
import type { InputSource } from './input/input.ts';
import type { ReplayRecorder } from './replay.ts';

const PERF_WINDOW = 600;

export interface LoopDeps {
  readonly sim: Sim;
  readonly renderer: Renderer;
  readonly ui: Ui;
  readonly audio: AudioSystem;
  readonly input: InputSource;
  readonly recorder: ReplayRecorder | null;
  /** Called after every sim step (autosave, run end, arena changes). Must not allocate per tick. */
  readonly afterTick?: () => void;
  readonly maxTicksPerFrame: number;
  readonly frameEventCapacity: number;
  /** performance.now, injectable for tests. */
  readonly now: () => number;
}

export interface GameLoop {
  start(): void;
  stop(): void;
  readonly running: boolean;
  /** Run ticks synchronously (e2e). input overrides the live input for those ticks, then one frame renders. */
  stepTicks(ticks: number, input?: Partial<InputFrame>): void;
  setTimeScale(scale: number): void;
  readonly frameEvents: EventBuffer;
  perf(): E2ePerf;
}

function percentile(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i] ?? 0;
}

export function createLoop(deps: LoopDeps): GameLoop {
  const { sim, renderer, ui, audio, input } = deps;
  const fixed = createFixedStep({ maxTicksPerFrame: deps.maxTicksPerFrame });
  const frameEvents = createEventBuffer(deps.frameEventCapacity);
  const frame = createInputFrame();
  const frameMs = new Float64Array(PERF_WINDOW);
  const tickMs = new Float64Array(PERF_WINDOW);
  let frameCount = 0;
  let tickCount = 0;
  let running = false;
  let rafId = 0;
  let last = 0;
  let timeScale = 1;
  let eventOverflow = 0;

  const hash = (): number => sim.hash();

  const runTick = (inp: InputFrame): void => {
    const t0 = deps.now();
    sim.step(inp);
    tickMs[tickCount % PERF_WINDOW] = deps.now() - t0;
    tickCount++;
    deps.recorder?.recordTick(inp, hash);
    frameEvents.appendFrom(sim.events, sim.view.tick);
    deps.afterTick?.();
  };

  const renderFrame = (dtSec: number): void => {
    const view = sim.view;
    renderer.render({
      view,
      alpha: fixed.alpha,
      events: frameEvents,
      timeSec: (view.tick + fixed.alpha) / TICK_RATE,
    });
    ui.update(view, frameEvents);
    audio.update(view, frameEvents, dtSec);
    eventOverflow += frameEvents.overflow;
    frameEvents.resetOverflow();
    frameEvents.clear();
  };

  const onFrame = (now: number): void => {
    if (!running) return;
    const dt = last === 0 ? 0 : now - last;
    last = now;
    const ticks = fixed.advance(dt, timeScale);
    for (let i = 0; i < ticks; i++) {
      input.sample(frame);
      runTick(frame);
    }
    renderFrame(dt / 1000);
    frameMs[frameCount % PERF_WINDOW] = dt;
    frameCount++;
    rafId = requestAnimationFrame(onFrame);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      fixed.reset();
      rafId = requestAnimationFrame(onFrame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    get running() {
      return running;
    },
    stepTicks(ticks, override) {
      const f = createInputFrame();
      for (let i = 0; i < ticks; i++) {
        input.sample(f);
        if (override !== undefined) Object.assign(f, override);
        runTick(f);
      }
      renderFrame(ticks / TICK_RATE);
    },
    setTimeScale(scale) {
      timeScale = scale;
    },
    frameEvents,
    perf() {
      const n = Math.min(frameCount, PERF_WINDOW);
      const fs = frameMs.slice(0, n).sort();
      const m = Math.min(tickCount, PERF_WINDOW);
      const ts = tickMs.slice(0, m).sort();
      const avg = (a: Float64Array): number =>
        a.length === 0 ? 0 : a.reduce((s, v) => s + v, 0) / a.length;
      const stats = renderer.stats();
      return {
        frameMs: {
          avg: avg(fs),
          p95: percentile(fs, 0.95),
          p99: percentile(fs, 0.99),
          max: fs[fs.length - 1] ?? 0,
        },
        simTickMs: { avg: avg(ts), p95: percentile(ts, 0.95) },
        drawCalls: stats.drawCalls,
        triangles: stats.triangles,
        eventOverflow,
        poolOverflow: sim.poolOverflow,
      };
    },
  };
}
