// Sim-side helpers for the e2e hooks (architecture.md 6.12): the stress scene as debug commands and
// replay decode and playback. The hooks in src/app/e2e call these; nothing here touches the DOM.

import {
  REPLAY_CHECKPOINT_TICKS,
  createInputFrame,
  cosTurns,
  sinTurns,
  toHex8,
} from '../core/index.ts';
import type { Command, DebugCommand, ReplayV1, Sim } from '../core/index.ts';
import type { GameData } from '../content/index.ts';

/** Profile used for the stress scene: the first profile with a boss, else the first profile. */
function stressProfile(data: GameData): string | null {
  const names = Object.keys(data.profiles).sort();
  for (const n of names) if (data.profiles[n]?.some((s) => s.kind === 'boss') === true) return n;
  return names[0] ?? null;
}

/**
 * Debug commands for spawnStress (architecture 6.12): 'peak' = composition of the last normal Pulse
 * (capped by its alive_cap) plus a late-run build (every weapon at tier 3, every Memento once);
 * 'peak-boss' = the boss of the profile plus the same build. Send after run.start, in phase pulse.
 */
export function stressCommands(data: GameData, preset: 'peak' | 'peak-boss'): DebugCommand[] {
  const out: DebugCommand[] = [];
  const profile = stressProfile(data);
  if (profile === null) return out;
  const slots = data.profiles[profile] ?? [];
  const slots6 = Math.max(1, Math.floor(data.config.weaponSlots));
  // Late-run build: weapons in data order (tier 3) for the free slots (slot 0 holds the class weapon),
  // then every Memento.
  data.weapons.slice(0, slots6 - 1).forEach((w) => {
    out.push({ type: 'debug.grant', kind: 'weapon', id: w.id, tier: 3 });
  });
  for (const m of data.mementos)
    out.push({ type: 'debug.grant', kind: 'memento', id: m.id, tier: 1 });
  const arena = data.arenas[0];
  const xs = arena?.arena.boundary.map((p) => p[0]) ?? [0];
  const ys = arena?.arena.boundary.map((p) => p[1]) ?? [0];
  const rx = (Math.max(...xs) - Math.min(...xs)) * 0.35;
  const ry = (Math.max(...ys) - Math.min(...ys)) * 0.35;
  if (preset === 'peak-boss') {
    const boss = slots.find((s) => s.kind === 'boss');
    const bossId = boss?.bossId ?? null;
    if (bossId !== null)
      out.push({ type: 'debug.spawn', enemyId: bossId, x: 0, y: -ry * 0.5, count: 1 });
    return out;
  }
  let last = null as (typeof slots)[number] | null;
  for (const s of slots) if (s.kind === 'normal') last = s;
  if (last === null) return out;
  const total = Math.min(
    last.aliveCap,
    last.spawns.reduce((a, s) => a + s.count, 0),
  );
  let k = 0;
  for (const sp of last.spawns) {
    for (let i = 0; i < sp.count && k < total; i++, k++) {
      const a = k / Math.max(1, total);
      out.push({
        type: 'debug.spawn',
        enemyId: sp.enemyId,
        x: cosTurns(a) * rx,
        y: sinTurns(a) * ry,
        count: 1,
      });
    }
  }
  return out;
}

/** Validate an unknown value as a ReplayV1 (shape only). */
export function decodeReplay(v: unknown): ReplayV1 | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Partial<ReplayV1>;
  if (r.format !== 'shardfall-replay' || r.v !== 1) return null;
  if (!Array.isArray(r.input) || !Array.isArray(r.commands) || !Array.isArray(r.checkpoints))
    return null;
  if (typeof r.seed !== 'number' || typeof r.classId !== 'string' || typeof r.profile !== 'string')
    return null;
  return r as ReplayV1;
}

export interface ReplayResult {
  readonly ticks: number;
  /** First checkpoint tick whose hash differed, or -1 when all matched. */
  readonly mismatchAt: number;
  readonly finalHash: string;
}

/**
 * Play a replay into a fresh sim (relative ticks: commands recorded at tick t are enqueued before the
 * step that advances t to t + 1). Compares checkpoints every REPLAY_CHECKPOINT_TICKS.
 */
export function playReplay(sim: Sim, replay: ReplayV1): ReplayResult {
  const input = createInputFrame();
  const byTick = new Map<number, Command[]>();
  for (const [t, c] of replay.commands) {
    const list = byTick.get(t) ?? [];
    list.push(c);
    byTick.set(t, list);
  }
  const checks = new Map<number, string>(replay.checkpoints.map(([t, h]) => [t, h]));
  let tick = 0;
  let mismatchAt = -1;
  const step = (): void => {
    for (const c of byTick.get(tick) ?? []) sim.enqueue(c);
    sim.step(input);
    tick++;
    if (tick % REPLAY_CHECKPOINT_TICKS === 0) {
      const want = checks.get(tick);
      if (want !== undefined && mismatchAt < 0 && want !== toHex8(sim.hash())) mismatchAt = tick;
    }
  };
  for (const run of replay.input) {
    const [count, mx, my, held, pressed, ax, ay] = run;
    input.moveX = mx;
    input.moveY = my;
    input.held = held;
    input.pressed = pressed;
    input.aimX = ax;
    input.aimY = ay;
    for (let i = 0; i < count; i++) step();
  }
  return { ticks: tick, mismatchAt, finalHash: toHex8(sim.hash()) };
}
