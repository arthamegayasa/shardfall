// Public API of src/ui (UI Programmer). Other modules import only from here (architecture.md 5).
// STUB from LP (M1-01): an overlay root that reports the active screen through data-screen.
// TODO(UI, M1-04): screens per ui-spec 12.3 (title, class select, HUD, level-up, Warden reward, Glazier,
// pause, settings, run end). All player text through deps.strings (formatString from src/content).
// Develop against tests/fixtures/fake-world.ts before the real sim lands.

import type { AppScreen, CreateUi, ScreenId, Ui } from '../core/dom.ts';
import type { SimEventReader, WorldView } from '../core/index.ts';

const SCREEN_IDS: Readonly<Record<AppScreen, ScreenId>> = {
  title: 'title',
  classSelect: 'class-select',
  run: 'pulse',
  paused: 'pause',
  settings: 'settings',
  runEnd: 'run-end',
  archive: 'archive',
  credits: 'credits',
};

export const createUi: CreateUi = (deps): Ui => {
  const layer = deps.root.ownerDocument.createElement('div');
  layer.className = 'ui-layer';
  deps.root.appendChild(layer);
  let active: ScreenId = 'title';
  let lastPhaseRevision = -1;

  const show = (id: ScreenId): void => {
    if (id === active && layer.dataset['screen'] === id) return;
    active = id;
    layer.dataset['screen'] = id;
  };
  show('title');

  return {
    setScreen(screen) {
      show(SCREEN_IDS[screen]);
    },
    update(view: WorldView, _events: SimEventReader) {
      if (view.phaseRevision === lastPhaseRevision) return;
      lastPhaseRevision = view.phaseRevision;
      if (view.phase === 'reward') show('warden-reward');
      else if (view.phase === 'levelUp') show('level-up');
      else if (view.phase === 'shop') show('glazier');
      else if (view.phase === 'pulse' || view.phase === 'pulseClear') show('pulse');
      else if (view.phase === 'victory' || view.phase === 'defeat') show('run-end');
    },
    get activeScreenId() {
      return active;
    },
    dispose() {
      layer.remove();
    },
  };
};
