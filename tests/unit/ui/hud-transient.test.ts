import { describe, expect, it } from 'vitest';
import { SimEventType, TICK_RATE } from '../../../src/core/index.ts';
import type { GameData } from '../../../src/content/index.ts';
import {
  createHudModel,
  fillHudModel,
  pendingBossType,
  TimerMode,
} from '../../../src/ui/presenters/hud.ts';
import {
  BANNER_TICKS,
  BannerKind,
  bannerEvent,
  bannerHeld,
  bannerShown,
  createBanner,
  createHint,
  HINT_TICKS,
  hintStart,
  hintStep,
  moveKeysText,
  PULSE_BANNER_TICKS,
} from '../../../src/ui/presenters/hud-transient.ts';
import { createFakeWorld } from '../../fixtures/fake-world.ts';
import { pl, pu } from './writable.ts';

describe('HUD boss slot before the boss emerges (review M1 LP and CD)', () => {
  it('shows the boss name with an empty bar, never the 0:00 timer', () => {
    const w = createFakeWorld();
    pu(w).isBoss = true;
    pu(w).ticksLeft = 0;
    pu(w).ticksTotal = 0;
    pu(w).boss = {
      active: false,
      typeIndex: -1,
      hp: 0,
      maxHp: 0,
      shield: 0,
      phase: 0,
      enraged: false,
    };
    const m = createHudModel();
    fillHudModel(w, false, m, 7);
    expect(m.timerMode).toBe(TimerMode.Boss);
    expect(m.foePending).toBe(true);
    expect(m.foeTypeIndex).toBe(7);
    expect(m.foeFrac).toBe(0);
    expect(m.finalCountdown).toBe(false);
  });

  it('switches to the live bar once the boss is active', () => {
    const w = createFakeWorld();
    pu(w).isBoss = true;
    pu(w).boss = {
      active: true,
      typeIndex: 3,
      hp: 50,
      maxHp: 100,
      shield: 0,
      phase: 1,
      enraged: false,
    };
    const m = createHudModel();
    fillHudModel(w, false, m, 7);
    expect(m.foePending).toBe(false);
    expect(m.foeTypeIndex).toBe(3);
    expect(m.foeFrac).toBe(0.5);
  });

  it('finds the expected boss from the profile slot, else the first boss role', () => {
    const data = {
      profiles: {
        run_x: [{ bossId: null }, { bossId: 'paper_sun' }],
      },
      enemies: [
        { id: 'moth', role: 'swarmer' },
        { id: 'old_boss', role: 'boss' },
        { id: 'paper_sun', role: 'boss' },
      ],
    } as unknown as GameData;
    expect(pendingBossType(data, 1)).toBe(2);
    expect(pendingBossType(data, 0)).toBe(1);
  });

  it('shows Rite charges only for multi-charge Rites', () => {
    const w = createFakeWorld();
    const m = createHudModel();
    pl(w).riteChargesMax = 1;
    pl(w).riteCharges = 1;
    fillHudModel(w, false, m);
    expect(m.riteCharges).toBe(0);
    pl(w).riteChargesMax = 3;
    pl(w).riteCharges = 2;
    fillHudModel(w, false, m);
    expect(m.riteCharges).toBe(2);
  });
});

describe('HUD banners', () => {
  it('shows a Warden arrival for 2.5 s and then hides it', () => {
    const b = createBanner();
    expect(bannerEvent(b, SimEventType.WardenSpawned, 4, 100, 5)).toBe(true);
    expect(bannerShown(b, 100)).toBe(BannerKind.Warden);
    expect(b.typeIndex).toBe(4);
    expect(bannerShown(b, 100 + BANNER_TICKS - 1)).toBe(BannerKind.Warden);
    expect(bannerShown(b, 100 + BANNER_TICKS)).toBe(BannerKind.None);
    expect(BANNER_TICKS).toBe(TICK_RATE * 2.5);
  });

  it('never lets a Pulse banner hide an arrival that is still showing', () => {
    const b = createBanner();
    bannerEvent(b, SimEventType.BossSpawned, 9, 10, 10);
    expect(bannerEvent(b, SimEventType.PulseStarted, 9, 11, 10)).toBe(false);
    expect(bannerShown(b, 11)).toBe(BannerKind.Boss);
    expect(bannerEvent(b, SimEventType.PulseStarted, 9, 10 + BANNER_TICKS, 10)).toBe(true);
    expect(bannerShown(b, 10 + BANNER_TICKS)).toBe(BannerKind.Pulse);
    expect(b.pulseNumber).toBe(10);
    expect(bannerShown(b, 10 + BANNER_TICKS + PULSE_BANNER_TICKS)).toBe(BannerKind.None);
  });

  it('shows Held with the Pulse number and ignores unrelated events', () => {
    const b = createBanner();
    expect(bannerEvent(b, SimEventType.EnemyKilled, 1, 5, 5)).toBe(false);
    bannerHeld(b, 50, 5);
    expect(bannerShown(b, 60)).toBe(BannerKind.Held);
    expect(b.pulseNumber).toBe(5);
  });
});

describe('Pulse 1 control hint', () => {
  it('fades after 6 s', () => {
    const s = createHint();
    expect(hintStep(s, 0, 0, 0, false)).toBe(false);
    hintStart(s, 100, 0, 0);
    expect(hintStep(s, 101, 0, 0, false)).toBe(true);
    expect(hintStep(s, 100 + HINT_TICKS, 0, 0, false)).toBe(false);
  });

  it('fades early once the player moved and used the Rite, not after only one', () => {
    const s = createHint();
    hintStart(s, 0, 2, 2);
    expect(hintStep(s, 10, 4, 2, false)).toBe(true);
    expect(hintStep(s, 20, 4, 2, true)).toBe(false);
    const r = createHint();
    hintStart(r, 0, 0, 0);
    expect(hintStep(r, 10, 0.2, 0, true)).toBe(true);
  });

  it('writes move keys compactly when every label is one character', () => {
    expect(moveKeysText(['W', 'A', 'S', 'D'])).toBe('WASD');
    expect(moveKeysText(['Up', 'Left', 'Down', 'Right'])).toBe('Up/Left/Down/Right');
    expect(moveKeysText(['W', '', 'S', 'D'])).toBe('WSD');
  });
});
