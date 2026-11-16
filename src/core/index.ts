// Public API of src/core: pure, no DOM, no three.js (architecture.md 5). Every module may import it.
// DOM-facing contracts: src/core/dom.ts (render, ui, app only).

export * from './contracts/index.ts';
export * from './constants.ts';
export * from './ids.ts';
export { assert, AssertionError, unreachable } from './assert.ts';
export { createHasher, fnv1aString, FNV_OFFSET, hashColumn, toHex8 } from './hash.ts';
export type { Hasher } from './hash.ts';
export {
  createRng,
  createRngStreams,
  RNG_STREAMS,
  seedState,
  splitmix32,
  streamSeed,
} from './rng.ts';
export type { Rng, RngState, RngStreams } from './rng.ts';
export * from './math/index.ts';
export {
  pixelScaleFor,
  quantizeAim,
  virtualFrameFor,
  virtualToWorld,
  worldToRef,
  worldToVirtual,
} from './projection.ts';
export type { MutablePoint, VirtualFrame } from './projection.ts';
export {
  createEventBuffer,
  FRAME_EVENT_CAPACITY,
  FRAME_EVENT_CAPACITY_E2E,
  isLowPriorityEvent,
  SIM_EVENT_CAPACITY,
} from './event-buffer.ts';
export type { EventBuffer } from './event-buffer.ts';
export { createFixedStep } from './fixed-step.ts';
export type { FixedStep, FixedStepOptions } from './fixed-step.ts';
export * from './sprite/index.ts';
