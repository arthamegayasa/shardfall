// window.__shardfall test hooks (architecture.md 6.12). Loaded only by a dynamic import behind __E2E__.
// Hooks use the normal APIs only (Sim, AppActions, Projector, DebugCommand); no test flags elsewhere.
// goToScreen builds every state through commands and debug commands, so screenshots show legal states.

import { toHex8 } from '../../core/index.ts';
import type { Command, PoolView } from '../../core/index.ts';
import type { E2eHooks, E2eSnapshot, ScreenId } from '../../core/dom.ts';
import { decodeReplay, playReplay, stressCommands } from '../../sim/index.ts';
import type { AppContext } from '../boot.ts';

/** Upper bound for helper loops that wait for a phase (ticks). 5 min of game time. */
const MAX_WAIT_TICKS = 60 * 300;
const STEP_CHUNK = 30;
/** Seed for runs created by goToScreen, fixed so screenshots are reproducible. */
const GOTO_SEED = 1;

type Target = ScreenId | 'run-lost' | 'run-won';

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
  const send = (cmd: Command): void => {
    ctx.commands.send(cmd);
  };
  const step = (ticks: number): void => {
    ctx.loop.stepTicks(ticks);
  };
  const phase = (): string => sim.view.phase;
  const runActive = (): boolean => {
    const ph = phase();
    return ph !== 'idle' && ph !== 'victory' && ph !== 'defeat';
  };

  /** Step until pred() holds; throws after MAX_WAIT_TICKS so a broken flow fails loudly. */
  const stepUntil = (pred: () => boolean, what: string): void => {
    for (let t = 0; t < MAX_WAIT_TICKS && !pred(); t += STEP_CHUNK) step(STEP_CHUNK);
    if (!pred()) throw new Error(`goToScreen: timed out waiting for ${what} (phase ${phase()})`);
  };

  const freshRun = (): void => {
    if (runActive()) {
      send({ type: 'run.abandon' });
      step(1);
    }
    ctx.startRun({ seed: GOTO_SEED, classId: ctx.data.classes[0]?.id ?? '' });
    step(1);
  };

  /** Keep the player alive while the helpers fast-forward. */
  const heal = (): void => {
    send({ type: 'debug.setHp', hp: sim.view.player.maxHp });
  };

  /** From pulse: end the Pulse and resolve reward and Temper picks until the Glazier (or the end). */
  const clearToShop = (): void => {
    send({ type: 'debug.endPulse' });
    step(1);
    stepUntil(() => phase() !== 'pulseClear' && phase() !== 'pulse', 'the end of the Pulse');
    for (let guard = 0; guard < 64; guard++) {
      const ph = phase();
      if (ph === 'reward') send({ type: 'reward.pick', choice: 0 });
      else if (ph === 'levelUp') send({ type: 'levelup.pick', choice: 0 });
      else break;
      step(1);
    }
  };

  /** From the Glazier: begin Pulses and clear them until the next Pulse matches kind. */
  const advanceToPulseKind = (kind: number): void => {
    for (let guard = 0; guard < 64; guard++) {
      if (phase() === 'pulse' && sim.view.pulse.kind === kind) return;
      if (phase() === 'pulse') clearToShop();
      if (phase() === 'shop') {
        send({ type: 'pulse.begin' });
        step(1);
      } else if (!runActive()) {
        throw new Error(`goToScreen: run ended before a Pulse of kind ${String(kind)}`);
      }
    }
    throw new Error(`goToScreen: no Pulse of kind ${String(kind)} in the profile`);
  };

  const build = (id: Target): void => {
    switch (id) {
      case 'title':
        if (runActive()) {
          send({ type: 'run.abandon' });
          step(1);
        }
        ctx.app.quitToTitle();
        return;
      case 'class-select':
        build('title');
        ctx.ui.setScreen('classSelect');
        return;
      case 'pulse':
        freshRun();
        return;
      case 'level-up':
        freshRun();
        send({ type: 'debug.xp', amount: sim.view.player.xpToNext });
        step(1);
        send({ type: 'debug.endPulse' });
        step(1);
        stepUntil(() => phase() === 'levelUp', 'Temper');
        return;
      case 'glazier':
        freshRun();
        clearToShop();
        return;
      case 'warden-reward':
        freshRun();
        advanceToPulseKind(1);
        stepUntil(() => {
          heal();
          return sim.view.pulse.warden.active;
        }, 'the Warden');
        send({ type: 'debug.endPulse' });
        step(1);
        stepUntil(() => phase() === 'reward', 'the Warden reward');
        return;
      case 'pause':
        freshRun();
        ctx.app.pause();
        return;
      case 'confirm':
        build('pause');
        document.querySelector<HTMLElement>('[data-ui="pause-abandon"]')?.click();
        return;
      case 'settings':
        ctx.app.openSettings();
        return;
      case 'run-end':
      case 'run-lost':
        freshRun();
        send({ type: 'run.abandon' });
        step(1);
        return;
      case 'run-won':
        freshRun();
        advanceToPulseKind(2);
        send({ type: 'debug.endPulse' });
        step(1);
        stepUntil(() => phase() === 'victory', 'victory');
        return;
      case 'archive':
        ctx.ui.setScreen('archive');
        return;
      case 'credits':
        ctx.ui.setScreen('credits');
        return;
    }
  };

  const hooks: E2eHooks = {
    version: 1,
    ready() {
      return Promise.resolve();
    },
    startRun(opts) {
      // run.start is rejected during a run (WrongPhase): end the active one first.
      if (runActive()) {
        send({ type: 'run.abandon' });
        step(1);
      }
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
    send,
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
    goToScreen(id: Target) {
      try {
        build(id);
        // One rendered frame so the UI routes to the screen derived from the new phase.
        step(0);
      } catch (err) {
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
      const want: ScreenId = id === 'run-lost' || id === 'run-won' ? 'run-end' : id;
      if (ctx.ui.activeScreenId !== want) {
        return Promise.reject(
          new Error(`goToScreen("${id}") ended on "${ctx.ui.activeScreenId}" (phase ${phase()})`),
        );
      }
      return Promise.resolve();
    },
    spawnStress(preset) {
      if (phase() !== 'pulse')
        throw new Error('spawnStress needs a running Pulse (startRun first)');
      for (const cmd of stressCommands(ctx.data, preset)) send(cmd);
      step(1);
    },
    grantItem(id, tier = 1) {
      const kind = ctx.data.weapons.some((w) => w.id === id) ? 'weapon' : 'memento';
      send({ type: 'debug.grant', kind, id, tier });
    },
    loadReplay(replay) {
      const r = decodeReplay(replay);
      if (r === null) throw new Error('loadReplay: not a shardfall-replay v1');
      if (runActive()) {
        send({ type: 'run.abandon' });
        step(1);
      }
      ctx.setHold('e2e', true);
      ctx.ui.setScreen('run');
      const result = playReplay(sim, r);
      step(0);
      if (result.mismatchAt >= 0)
        throw new Error(`loadReplay: checkpoint mismatch at tick ${String(result.mismatchAt)}`);
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
