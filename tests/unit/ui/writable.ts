// Test helper: the fake world fixture types player and pulse as read-only through the intersection
// with WorldView, so tests write through these views. Reported to LP (tests/fixtures/fake-world.ts).

import type { PlayerView, PulseView, WorldView } from '../../../src/core/index.ts';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export function pl(w: WorldView): Mutable<PlayerView> {
  // Mutable<T> is assignable from T structurally; the return type alone widens the view.
  return w.player;
}

export function pu(w: WorldView): Mutable<PulseView> {
  return w.pulse;
}
