// window.__shardfall test hooks (architecture.md 6.12). Loaded only by a dynamic import behind __E2E__.
// Hooks use the normal APIs only (Sim, AppActions, Projector, DebugCommand); no test flags elsewhere.

import { toHex8 } from '../../core/index.ts';
import type { Command, PoolView } from '../../core/index.ts';
import type { E2eHooks, E2eSnapshot, ScreenId } from '../../core/dom.ts';
import type { AppContext } from '../boot.ts';

function countAlive(pool: PoolView): number {
  let n = 0;
  for (let i = 0; i < pool.highWater; i++) if (pool.alive[i] !== 0) n++;
  return n;
}

function screenPoints(ctx: AppContext, pool: PoolView): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < pool.highWater; i++) {
    if (pool.alive[i] === 0) continue;
    const p = { x: 0, y: 0 };
    ctx.renderer.projector.worldToCss(pool.x[i] ?? 0, pool.y[i] ?? 0, p);
    out.push(p);
  }
  return out;
}

export function installE2eHooks(ctx: AppContext): void {
  const { sim } = ctx;
  const hooks: E2eHooks = {
    version: 1,
    ready() {
      return Promise.resolve();
    },
    startRun(opts) {
      ctx.startRun(opts);
    },
    pauseLoop() {
      ctx.setHold('e2e', true);
    },
    resumeLoop() {
      ctx.setHold('e2e', false);
    },
    step(ticks, input) {
      ctx.loop.stepTicks(ticks, input);
    },
    setTimeScale(scale) {
      ctx.loop.setTimeScale(Math.min(16, Math.max(0.25, scale)));
    },
    send(cmd: Command) {
      ctx.commands.send(cmd);
    },
    getStateHash() {
      return toHex8(sim.hash());
    },
    getSnapshot(): E2eSnapshot {
      const v = sim.view;
      return {
        screen: ctx.ui.activeScreenId,
        phase: v.phase,
        tick: v.tick,
        pulseIndex: v.pulse.index,
        hp: v.player.hp,
        maxHp: v.player.maxHp,
        glint: v.player.glint,
        level: v.player.level,
        player: { x: v.player.x, y: v.player.y },
        counts: {
          enemies: countAlive(v.enemies),
          enemyShots: countAlive(v.enemyShots),
          playerShots: countAlive(v.playerShots),
          pickups: countAlive(v.pickups),
          dangerAreas: countAlive(v.dangerAreas),
          playerZones: countAlive(v.playerZones),
        },
      };
    },
    getScreenPositions() {
      const v = sim.view;
      const player = { x: 0, y: 0 };
      ctx.renderer.projector.worldToCss(v.player.x, v.player.y, player);
      const enemies: { x: number; y: number; rank: number }[] = [];
      for (let i = 0; i < v.enemies.highWater; i++) {
        if (v.enemies.alive[i] === 0) continue;
        const p = { x: 0, y: 0, rank: v.enemies.rank[i] ?? 0 };
        ctx.renderer.projector.worldToCss(v.enemies.x[i] ?? 0, v.enemies.y[i] ?? 0, p);
        enemies.push(p);
      }
      return {
        player,
        enemies,
        enemyShots: screenPoints(ctx, v.enemyShots),
        dangerAreas: screenPoints(ctx, v.dangerAreas),
      };
    },
    goToScreen(id: ScreenId | 'run-lost' | 'run-won') {
      // TODO(QA + LP, M1-09): build each state through commands and AppActions once sim and UI exist.
      if (id === ctx.ui.activeScreenId) return Promise.resolve();
      return Promise.reject(new Error(`goToScreen("${id}") is not available until M1-09`));
    },
    spawnStress(_preset) {
      // TODO(QA + GP, M1-09): last normal Pulse composition + late-run build via debug commands.
      throw new Error('spawnStress is not available until the sim supports debug.spawn');
    },
    grantItem(id, tier = 1) {
      const kind = ctx.data.weapons.some((w) => w.id === id) ? 'weapon' : 'memento';
      ctx.commands.send({ type: 'debug.grant', kind, id, tier });
    },
    loadReplay(_replay) {
      // TODO(LP, M1-09): rebuild the sim from the replay header and play input and commands back.
      throw new Error('loadReplay is not available until M1-09');
    },
    exportReplay() {
      return ctx.recorder?.export() ?? null;
    },
    getPerf() {
      return ctx.loop.perf();
    },
  };
  window.__shardfall = hooks;
}
