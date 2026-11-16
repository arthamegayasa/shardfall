// effects.csv, synergies.csv, statuses.csv (data-schema 3.10, 3.11, 3.14; effect-primitives.md).

import { col, defineTable } from '../schema/index.ts';
import {
  EFFECT_ACTIONS,
  EFFECT_CONDITIONS,
  EFFECT_TRIGGERS,
  STACK_MODES,
  STATUS_IDS,
  TAGS,
} from './enums.ts';

export const effectsTable = defineTable({
  name: 'effects',
  required: true,
  columns: {
    id: col.id(),
    /** Memento id, class id, or synergies.owner (checked by the effects validator). */
    owner: col.token(),
    trigger: col.enumOf(EFFECT_TRIGGERS),
    conditions: col.conditions(EFFECT_CONDITIONS),
    chance: col.float({ min: 0, max: 1, default: 1 }),
    icd: col.seconds({ default: 0 }),
    max_per_pulse: col.int({ min: 0, default: 0 }),
    allow_proc: col.optional(col.bool()),
    stack_mode: col.enumOf(STACK_MODES, { default: 'value' }),
    action: col.enumOf(EFFECT_ACTIONS),
    params: col.params({ by: 'action' }),
  },
});

export const synergiesTable = defineTable({
  name: 'synergies',
  required: true,
  key: ['owner'],
  columns: {
    tag: col.enumOf(TAGS),
    threshold: col.int({ min: 1 }),
    content_tier: col.contentTier(),
    owner: col.id(),
    desc_key: col.key(),
  },
});

export const statusesTable = defineTable({
  name: 'statuses',
  required: true,
  columns: {
    id: col.enumOf(STATUS_IDS),
    duration: col.seconds(),
    tick: col.seconds({ default: 0 }),
    params: col.params(),
  },
});
