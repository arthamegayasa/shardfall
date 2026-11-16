// Presentation signals derived from sim state once per tick (architecture 6.5, M1-09a):
// PlayerHpLowChanged (UI HP pulse, low-HP cue) and MusicPressureChanged (adaptive music, GD Q21).
// Both are false outside the pulse phase, so a loaded save and an uninterrupted run emit the same
// events. They only produce events; no game rule reads them, so they are not part of the state hash.

import { LOW_HP_FRAC, SimEventType } from '../../core/index.ts';
import type { SimCtx } from '../ctx.ts';

export function updateSignals(ctx: SimCtx): void {
  const { world, run, events, cfg } = ctx;
  const inPulse = run.started && world.phase === 'pulse' && run.deathTicks < 0;
  const p = world.player;

  const low = inPulse && p.hp > 0 && p.hp <= p.maxHp * LOW_HP_FRAC;
  if (low !== run.lowHpSignal) {
    run.lowHpSignal = low;
    events.push(SimEventType.PlayerHpLowChanged, p.x, p.y, low ? 1 : 0, 0, 0);
  }

  // Q21: on at music_pressure_frac of alive_cap, off below music_pressure_release_frac.
  // Living Unlit of normal rank count; spawn marks do not (GD answer Q21), nor the Warden or boss.
  let pressure = false;
  if (inPulse && !world.pulse.isBoss) {
    const slot = run.slots[world.pulse.index];
    const cap = slot?.aliveCap ?? 0;
    if (cap > 0) {
      const alive = aliveNormal(ctx);
      pressure = run.pressureSignal
        ? alive >= cap * cfg.musicPressureReleaseFrac
        : alive >= cap * cfg.musicPressureFrac;
    }
  }
  if (pressure !== run.pressureSignal) {
    run.pressureSignal = pressure;
    events.push(SimEventType.MusicPressureChanged, 0, 0, pressure ? 1 : 0, 0, 0);
  }
}

function aliveNormal(ctx: SimCtx): number {
  const e = ctx.world.enemies;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) if (e.alive[i] === 1 && e.rank[i] === 0) n++;
  return n;
}
