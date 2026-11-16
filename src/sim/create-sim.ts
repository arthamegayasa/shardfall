// STUB owned by GP (architecture.md 5, 6.3). Replace the body in M1-03; keep the CreateSim signature.
// It exists so app, render, UI, audio, and e2e hooks run end-to-end before the real sim lands:
// idle -> run.start -> pulse, player moves from input at config player_base_speed, nothing else happens.
// Rules it already follows: no wall clock, no Math.random, no DOM, numbers only from GameData.

import {
  createEventBuffer,
  createHasher,
  createRngStreams,
  RejectReason,
  RNG_STREAMS,
  RunPhaseCode,
  SIM_EVENT_CAPACITY,
  SimEventType,
} from '../core/index.ts';
import type {
  Command,
  CreateSim,
  InputFrame,
  LoadResult,
  RngStreams,
  RunPhase,
  RunSave,
  Sim,
  SimConfig,
} from '../core/index.ts';
import { createStubWorld } from './stub-world.ts';

const AXIS_MAX = 127;

export const createSim: CreateSim = (config: SimConfig): Sim => {
  const { data } = config;
  const world = createStubWorld(data.stats.length, data.tags.length);
  const events = createEventBuffer(SIM_EVENT_CAPACITY);
  const queue: Command[] = [];
  let rng: RngStreams = createRngStreams(0);
  const rngWords = new Uint32Array(4);
  const hasher = createHasher();
  // TODO(GP, M1-03): read speed through the stat pipeline (move_speed) instead of the raw config value.
  const speed = data.config.playerBaseSpeedUPerTick;

  const setPhase = (next: RunPhase): void => {
    const prev = world.phase;
    world.phase = next;
    world.phaseRevision++;
    events.push(SimEventType.PhaseChanged, 0, 0, RunPhaseCode[next], RunPhaseCode[prev], 0);
  };

  const reject = (reason: number): void => {
    events.push(SimEventType.CommandRejected, 0, 0, reason, 0, 0);
  };

  const apply = (cmd: Command): void => {
    switch (cmd.type) {
      case 'run.start': {
        if (world.phase !== 'idle') {
          reject(RejectReason.WrongPhase);
          return;
        }
        rng = createRngStreams(cmd.seed);
        world.player.x = 0;
        world.player.y = 0;
        world.player.prevX = 0;
        world.player.prevY = 0;
        setPhase('pulse');
        return;
      }
      case 'run.abandon': {
        if (world.phase === 'idle') {
          reject(RejectReason.WrongPhase);
          return;
        }
        setPhase('defeat');
        return;
      }
      default:
        // TODO(GP, M1-03): every other command.
        reject(
          cmd.type.startsWith('debug.') && config.debugCommands !== true
            ? RejectReason.DebugDisabled
            : RejectReason.WrongPhase,
        );
    }
  };

  const step = (input: InputFrame): void => {
    events.clear();
    for (let i = 0; i < queue.length; i++) {
      const cmd = queue[i];
      if (cmd !== undefined) apply(cmd);
    }
    queue.length = 0;
    const p = world.player;
    p.prevX = p.x;
    p.prevY = p.y;
    if (world.phase === 'pulse' && Number.isFinite(speed)) {
      p.x += (input.moveX / AXIS_MAX) * speed;
      p.y += (input.moveY / AXIS_MAX) * speed;
      if (input.moveX !== 0) p.facing = input.moveX < 0 ? -1 : 1;
    }
    world.tick++;
  };

  const hash = (): number => {
    hasher.reset();
    hasher.u32(world.tick);
    hasher.u32(RunPhaseCode[world.phase]);
    for (const name of RNG_STREAMS) {
      rng[name].writeState(rngWords);
      for (let i = 0; i < 4; i++) hasher.u32(rngWords[i] ?? 0);
    }
    hasher.f64(world.player.x);
    hasher.f64(world.player.y);
    return hasher.value();
  };

  return {
    view: world,
    events,
    enqueue(cmd) {
      queue.push(cmd);
    },
    step,
    save(): RunSave | null {
      // TODO(GP, M1-03): real save in reward, levelUp, shop.
      return null;
    },
    load(): LoadResult {
      return { ok: false, reason: 'corrupt' };
    },
    hash,
  };
};
