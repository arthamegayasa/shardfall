// Arena pre-warm (AD with LP, M4-01, BUG-006). The first arena frame used to hold the loop about 0.4 s
// on a cold browser profile: building the arena environment (textures, meshes) and compiling its shader
// programs and the decor shadow map all happened inside the first Pulse frame. The renderer now builds
// the first arena once while the title screen is idle, renders it offscreen (programs compiled, textures
// and shadow map uploaded), and hands that environment to setArena when the run asks for the same arena.

/** One pre-built environment, keyed by arena and biome. */
export interface PrewarmSlot<T> {
  key: string | null;
  value: T | null;
}

export function prewarmKey(arenaId: string, biomeId: string): string {
  return `${arenaId}|${biomeId}`;
}

/** Take the pre-built value when the key matches (the slot is emptied either way when it matches). */
export function takePrewarmed<T>(slot: PrewarmSlot<T>, key: string): T | null {
  if (slot.value === null || slot.key !== key) return null;
  const v = slot.value;
  slot.value = null;
  slot.key = null;
  return v;
}

/** Idle scheduler subset of window (tests pass a fake). */
export interface IdleHost {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  setTimeout: (cb: () => void, ms: number) => number;
}

/** Run task when the page is idle (title screen), at the latest after timeoutMs. */
export function scheduleIdle(host: IdleHost, task: () => void, timeoutMs = 600): void {
  if (typeof host.requestIdleCallback === 'function')
    host.requestIdleCallback(task, { timeout: timeoutMs });
  else host.setTimeout(task, 50);
}
