// Which screen is active (ui-spec 3, 4). Menu screens are app state (AppScreen); during a run the
// choice screens derive from view.phase (architecture 6.7).

import type { AppScreen, ScreenId } from '../../core/dom.ts';
import type { RunPhase } from '../../core/index.ts';

const APP_SCREEN_IDS: Readonly<Record<Exclude<AppScreen, 'run'>, ScreenId>> = {
  title: 'title',
  classSelect: 'class-select',
  paused: 'pause',
  settings: 'settings',
  runEnd: 'run-end',
  archive: 'archive',
  credits: 'credits',
  howTo: 'how-to',
};

export function screenForPhase(phase: RunPhase): ScreenId {
  switch (phase) {
    case 'reward':
      return 'warden-reward';
    case 'levelUp':
      return 'level-up';
    case 'shop':
      return 'glazier';
    case 'victory':
    case 'defeat':
      return 'run-end';
    case 'idle':
    case 'pulse':
    case 'pulseClear':
      return 'pulse';
  }
}

/**
 * app: screen requested by app or UI. phase: current run phase (null before any view arrived).
 * staleEnd: true right after a new run was requested while the view still shows the old run's end.
 * confirmOpen: the abandon dialog is open on top of the pause screen.
 */
export function resolveScreenId(
  app: AppScreen,
  phase: RunPhase | null,
  staleEnd: boolean,
  confirmOpen: boolean,
): ScreenId {
  if (app === 'paused' && confirmOpen) return 'confirm';
  if (app !== 'run') return APP_SCREEN_IDS[app];
  if (phase === null) return 'pulse';
  const id = screenForPhase(phase);
  return id === 'run-end' && staleEnd ? 'pulse' : id;
}
