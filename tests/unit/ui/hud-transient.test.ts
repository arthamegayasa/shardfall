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
  createTransientClock,
  runRestarted,
  createHint,
  HINT_TICKS,
  hintStart,
  hintStep,
  moveKeysText,
  PULSE_BANNER_TICKS,
  createWeaponStrip,
  stripFired,
  stripHit,
  stripIdle,
  stripLit,
  stripNew,
  stripReset,
  stripSync,
  stripWaveStart,
  WEAPON_IDLE_TICKS,
  WEAPON_NEW_TICKS,
  WEAPON_PULSE_TICKS,
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

describe('HUD banner across runs (BUG-008)', () => {
  it('never shows the previous run boss banner once the sim clock restarted', () => {
    const b = createBanner();
    // Boss arrives late in run 1 (tick 20000); run 2 starts at tick 0 and reaches Pulse 7.
    bannerEvent(b, SimEventType.BossSpawned, 9, 20000, 15);
    expect(bannerShown(b, 20010)).toBe(BannerKind.Boss);
    expect(bannerShown(b, 0)).toBe(BannerKind.None);
    expect(bannerShown(b, 4000)).toBe(BannerKind.None);
  });

  it('detects a new run from the run-relative clock going back', () => {
    const c = createTransientClock();
    expect(runRestarted(c, 100)).toBe(false);
    expect(runRestarted(c, 20000)).toBe(false);
    expect(runRestarted(c, 20000)).toBe(false);
    expect(runRestarted(c, 0)).toBe(true);
    expect(runRestarted(c, 1)).toBe(false);
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

describe('HUD weapon strip (redesign 1.1 3.2)', () => {
  const inv = (...slots: [number, number][]): { weaponIndex: number; tier: number }[] =>
    slots.map(([weaponIndex, tier]) => ({ weaponIndex, tier }));
  const never = (): boolean => false;

  it('mirrors the owned slots and their tiers', () => {
    const s = createWeaponStrip();
    stripSync(s, inv([3, 2], [-1, 0], [5, 1]), never, 0);
    expect(s.slots).toBe(3);
    expect(Array.from(s.weaponIndex.subarray(0, 3))).toEqual([3, -1, 5]);
    expect(Array.from(s.tier.subarray(0, 3))).toEqual([2, 0, 1]);
  });

  it('starts a pulse on a fire event, at most one per pulse length', () => {
    const s = createWeaponStrip();
    stripSync(s, inv([3, 1], [3, 1]), never, 0);
    expect(stripFired(s, 1, 100)).toBe(true);
    expect(s.pulseSeq[1]).toBe(1);
    expect(s.pulseSeq[0]).toBe(0);
    expect(stripLit(s, 1, 100)).toBe(true);
    expect(stripLit(s, 1, 100 + WEAPON_PULSE_TICKS)).toBe(false);
    // A second shot inside the running pulse keeps the weapon awake but does not restart it.
    expect(stripFired(s, 1, 100 + WEAPON_PULSE_TICKS - 1)).toBe(false);
    expect(s.pulseSeq[1]).toBe(1);
    expect(stripFired(s, 1, 100 + WEAPON_PULSE_TICKS)).toBe(true);
    expect(s.pulseSeq[1]).toBe(2);
  });

  it('ignores fire events for slots it does not show', () => {
    const s = createWeaponStrip();
    stripSync(s, inv([3, 1]), never, 0);
    expect(stripFired(s, 4, 10)).toBe(false);
    expect(stripFired(s, -1, 10)).toBe(false);
    expect(stripFired(s, 99, 10)).toBe(false);
  });

  it('dims a weapon after 2.5 s without firing and wakes it on the next shot', () => {
    const s = createWeaponStrip();
    stripSync(s, inv([3, 1]), never, 0);
    stripWaveStart(s, 50);
    expect(stripIdle(s, 0, 50 + WEAPON_IDLE_TICKS - 1)).toBe(false);
    expect(stripIdle(s, 0, 50 + WEAPON_IDLE_TICKS)).toBe(true);
    stripFired(s, 0, 50 + WEAPON_IDLE_TICKS + 5);
    expect(stripIdle(s, 0, 50 + WEAPON_IDLE_TICKS + 5)).toBe(false);
    // Above the slowest base cooldown (echo_bell 2.0 s): a weapon firing normally never dims
    // between its own shots, only when nothing is in range (spec review 1.1).
    expect(WEAPON_IDLE_TICKS).toBeGreaterThan(2.0 * TICK_RATE);
  });

  it('counts timing in ticks, so a paused game neither dims nor ends a pulse', () => {
    const s = createWeaponStrip();
    stripSync(s, inv([3, 1]), never, 0);
    stripWaveStart(s, 0);
    stripFired(s, 0, 10);
    // Any amount of wall time at the same tick changes nothing.
    expect(stripLit(s, 0, 10)).toBe(true);
    expect(stripIdle(s, 0, 10)).toBe(false);
  });

  it('wakes contact weapons (orbit shards have no fire event) on their own hits', () => {
    const s = createWeaponStrip();
    const orbit = (wi: number): boolean => wi === 7;
    stripSync(s, inv([7, 1], [3, 1], [7, 2]), orbit, 0);
    stripWaveStart(s, 0);
    stripHit(s, 7, WEAPON_IDLE_TICKS + 1);
    expect(stripIdle(s, 0, WEAPON_IDLE_TICKS + 1)).toBe(false);
    expect(stripIdle(s, 2, WEAPON_IDLE_TICKS + 1)).toBe(false);
    expect(stripIdle(s, 1, WEAPON_IDLE_TICKS + 1)).toBe(true);
    expect(s.pulseSeq[0]).toBe(1);
    // A hit from a weapon that fires normally is not a contact hit.
    stripHit(s, 3, WEAPON_IDLE_TICKS + 2);
    expect(s.pulseSeq[1]).toBe(0);
  });

  it('marks slots that changed since the last wave start as new for 2 s', () => {
    const s = createWeaponStrip();
    stripSync(s, inv([3, 1], [-1, 0], [-1, 0]), never, 0);
    // First wave of the run: the starting weapon is not new.
    expect(stripWaveStart(s, 0)).toBe(0);
    expect(stripNew(s, 0, 0)).toBe(false);
    // Bought in the shop: a second copy in slot 1 and a new weapon in slot 2.
    stripSync(s, inv([3, 1], [3, 1], [5, 1]), never, 900);
    expect(stripWaveStart(s, 1000)).toBe(2);
    expect(stripNew(s, 0, 1000)).toBe(false);
    expect(stripNew(s, 1, 1000)).toBe(true);
    expect(stripNew(s, 2, 1000 + WEAPON_NEW_TICKS - 1)).toBe(true);
    expect(stripNew(s, 2, 1000 + WEAPON_NEW_TICKS)).toBe(false);
    expect(WEAPON_NEW_TICKS).toBe(TICK_RATE * 2);
    // Nothing bought before the next wave: nothing is new.
    expect(stripWaveStart(s, 3000)).toBe(0);
    expect(stripNew(s, 1, 3000)).toBe(false);
  });

  it('marks a combined slot (higher tier) but not the slot that was emptied', () => {
    const s = createWeaponStrip();
    stripSync(s, inv([3, 1], [3, 1]), never, 0);
    stripWaveStart(s, 0);
    stripSync(s, inv([3, 2], [-1, 0]), never, 500);
    expect(stripWaveStart(s, 600)).toBe(1);
    expect(stripNew(s, 0, 600)).toBe(true);
    expect(stripNew(s, 1, 600)).toBe(false);
  });

  it('forgets the previous run on reset: wave 1 of the next run shows nothing new', () => {
    const s = createWeaponStrip();
    stripSync(s, inv([3, 1]), never, 0);
    stripWaveStart(s, 0);
    stripFired(s, 0, 20000);
    stripReset(s);
    stripSync(s, inv([5, 1]), never, 0);
    expect(stripWaveStart(s, 0)).toBe(0);
    expect(stripNew(s, 0, 0)).toBe(false);
    expect(stripLit(s, 0, 0)).toBe(false);
    expect(s.pulseSeq[0]).toBe(0);
  });

  it('never allocates per frame: the same typed arrays are reused', () => {
    const s = createWeaponStrip();
    const arrays = [s.weaponIndex, s.lastFired, s.pulseSeq, s.newUntil];
    stripSync(s, inv([3, 1], [4, 1]), never, 0);
    stripWaveStart(s, 0);
    stripFired(s, 1, 3);
    expect([s.weaponIndex, s.lastFired, s.pulseSeq, s.newUntil]).toEqual(arrays);
    expect(s.weaponIndex).toBe(arrays[0]);
  });
});
