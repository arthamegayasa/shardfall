import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../../../src/core/index.ts';
import {
  createHudModel,
  FINAL_COUNTDOWN_SECS,
  fillHudModel,
  TimerMode,
} from '../../../src/ui/presenters/hud.ts';
import { createFakeWorld } from '../../fixtures/fake-world.ts';
import { pl, pu } from './writable.ts';

describe('HUD model', () => {
  it('maps player HP, level, XP, Glint and the 1-based Pulse number', () => {
    const w = createFakeWorld();
    pl(w).hp = 15;
    pl(w).maxHp = 30;
    pl(w).level = 4;
    pl(w).xp = 5;
    pl(w).xpToNext = 20;
    pl(w).glint = 37;
    pu(w).index = 6;
    const m = createHudModel();
    fillHudModel(w, false, m);
    expect(m.hpFrac).toBe(0.5);
    expect(m.level).toBe(4);
    expect(m.xpFrac).toBe(0.25);
    expect(m.glint).toBe(37);
    expect(m.pulseNumber).toBe(7);
  });

  it('shows the timer and highlights only the last seconds', () => {
    const w = createFakeWorld();
    const m = createHudModel();
    pu(w).ticksLeft = TICK_RATE * 24;
    fillHudModel(w, false, m);
    expect(m.timerMode).toBe(TimerMode.Timer);
    expect(m.timerSecs).toBe(24);
    expect(m.finalCountdown).toBe(false);
    pu(w).ticksLeft = TICK_RATE * FINAL_COUNTDOWN_SECS;
    fillHudModel(w, false, m);
    expect(m.finalCountdown).toBe(true);
    pu(w).ticksLeft = 0;
    fillHudModel(w, false, m);
    expect(m.finalCountdown).toBe(false);
  });

  it('turns the timer slot into the held Warden bar in overtime (CD K3)', () => {
    const w = createFakeWorld();
    pu(w).ticksLeft = 0;
    pu(w).overtime = true;
    pu(w).wardenAlive = true;
    pu(w).warden = {
      active: true,
      typeIndex: 2,
      hp: 20,
      maxHp: 80,
      shield: 0,
      phase: 1,
      enraged: true,
    };
    const m = createHudModel();
    fillHudModel(w, false, m);
    expect(m.timerMode).toBe(TimerMode.Held);
    expect(m.foeTypeIndex).toBe(2);
    expect(m.foeFrac).toBe(0.25);
    expect(m.foeEnraged).toBe(true);
  });

  it('turns the timer slot into the boss bar in an untimed boss Pulse', () => {
    const w = createFakeWorld();
    pu(w).isBoss = true;
    pu(w).ticksLeft = 0;
    pu(w).ticksTotal = 0;
    pu(w).boss = {
      active: true,
      typeIndex: 1,
      hp: 300,
      maxHp: 400,
      shield: 0,
      phase: 2,
      enraged: false,
    };
    const m = createHudModel();
    fillHudModel(w, false, m);
    expect(m.timerMode).toBe(TimerMode.Boss);
    expect(m.foePhase).toBe(2);
    expect(m.foeFrac).toBe(0.75);
  });

  it('reports the Rite cooldown and readiness', () => {
    const w = createFakeWorld();
    const m = createHudModel();
    pl(w).riteCooldownTicks = TICK_RATE * 3;
    pl(w).riteCooldownMaxTicks = TICK_RATE * 12;
    fillHudModel(w, false, m);
    expect(m.riteReady).toBe(false);
    expect(m.riteSecs).toBe(3);
    expect(m.riteFrac).toBe(0.25);
    pl(w).riteCooldownTicks = 0;
    fillHudModel(w, false, m);
    expect(m.riteReady).toBe(true);
    expect(m.riteSecs).toBe(0);
  });

  it('treats a multi-charge Rite as ready while a charge is left', () => {
    const w = createFakeWorld();
    pl(w).riteChargesMax = 2;
    pl(w).riteCharges = 1;
    pl(w).riteCooldownTicks = TICK_RATE;
    const m = createHudModel();
    fillHudModel(w, false, m);
    expect(m.riteReady).toBe(true);
  });

  it('shows low HP only from the sim flag and never at 0 HP', () => {
    const w = createFakeWorld();
    const m = createHudModel();
    fillHudModel(w, true, m);
    expect(m.lowHp).toBe(true);
    pl(w).hp = 0;
    fillHudModel(w, true, m);
    expect(m.lowHp).toBe(false);
  });

  it('reuses the same model object every frame', () => {
    const w = createFakeWorld();
    const m = createHudModel();
    const keys = Object.keys(m).join();
    fillHudModel(w, false, m);
    expect(Object.keys(m).join()).toBe(keys);
  });
});
