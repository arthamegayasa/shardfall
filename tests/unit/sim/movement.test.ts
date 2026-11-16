// K02: player movement with vertical screen compensation and boundary clamp (architecture 7.1).

import { describe, expect, it } from 'vitest';
import { DEPTH_PX_PER_U, PX_PER_U } from '../../../src/core/index.ts';
import { insideDistance } from '../../../src/sim/arena.ts';
import { harness } from './support/harness.ts';

describe('player movement (K02)', () => {
  it('moves horizontally at player_base_speed per tick', () => {
    const h = harness();
    h.start();
    h.quiet();
    const x0 = h.sim.view.player.x;
    h.input.moveX = 127;
    h.step();
    expect(h.sim.view.player.x - x0).toBeCloseTo(h.data.config.playerBaseSpeedUPerTick, 10);
  });

  it('compensates vertical movement with player_vertical_screen_ratio', () => {
    const h = harness();
    h.start();
    h.quiet();
    const y0 = h.sim.view.player.y;
    h.input.moveY = 127;
    h.step();
    const r = h.data.config.playerVerticalScreenRatio;
    // d = (0, 1): k = r, vy = k x speed x 1.6.
    const want = r * h.data.config.playerBaseSpeedUPerTick * (PX_PER_U / DEPTH_PX_PER_U);
    expect(h.sim.view.player.y - y0).toBeCloseTo(want, 10);
  });

  it('keeps the screen direction of diagonal input', () => {
    const h = harness();
    h.start();
    h.quiet();
    const p = h.sim.view.player;
    const x0 = p.x;
    const y0 = p.y;
    h.input.moveX = 127;
    h.input.moveY = 127;
    h.step();
    const dxScreen = (p.x - x0) * PX_PER_U;
    const dyScreen = (p.y - y0) * DEPTH_PX_PER_U;
    // Input is a screen direction: W+D shows at 45 degrees on screen (architecture 7.1).
    expect(dyScreen / dxScreen).toBeCloseTo(1, 9);
  });

  it('applies move_speed from stats', () => {
    const h = harness();
    h.start();
    h.quiet();
    const i = h.data.stats.findIndex((s) => s.id === 'move_speed');
    h.ctx.run.statCardAdd[i] = 50;
    h.ctx.run.statsDirty = true;
    h.step();
    const x0 = h.sim.view.player.x;
    h.input.moveX = 127;
    h.step();
    expect(h.sim.view.player.x - x0).toBeCloseTo(h.data.config.playerBaseSpeedUPerTick * 1.5, 10);
  });

  it('never leaves the arena boundary', () => {
    const h = harness();
    h.start();
    h.quiet();
    h.input.moveX = -127;
    h.input.moveY = -127;
    h.step(600);
    const arena = h.ctx.arena;
    expect(arena).not.toBeNull();
    if (arena === null) return;
    const p = h.sim.view.player;
    expect(insideDistance(arena, p.x, p.y)).toBeGreaterThanOrEqual(p.radius - 1e-9);
  });
});
