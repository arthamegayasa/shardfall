// createUi (architecture 6.7, ui-spec 2 and 12.3): DOM overlay layers, UI scale, screen router,
// keyboard and mouse routing. Menu screens are app state; run screens derive from view.phase.

import type { AppScreen, CreateUi, ScreenId, Ui } from '../core/dom.ts';
import { OfferKind, RejectReason, SimEventType } from '../core/index.ts';
import type { ActionId, Settings, SimEventReader, WorldView } from '../core/index.ts';
import { h } from './dom.ts';
import { createFocusList } from './focus.ts';
import { createIconArt } from './icons.ts';
import { Dir } from './focus-nav.ts';
import { keyLabel } from './format.ts';
import { isBound, menuIntent, pausesRun } from './menu-keys.ts';
import { mementoInfo, tierKey, weaponInfo } from './presenters/content.ts';
import { resolveScreenId } from './presenters/phase.ts';
import { loadPixelFont } from './pixel-font.ts';
import { computeUiScale } from './scale.ts';
import { createChoiceScreen } from './screens/choice.ts';
import { createClassSelectScreen } from './screens/class-select.ts';
import { createGlazierScreen } from './screens/glazier.ts';
import { createHudScreen } from './screens/hud.ts';
import { createInfoScreen } from './screens/info.ts';
import { createPauseScreen } from './screens/pause.ts';
import { createRunEndScreen } from './screens/run-end.ts';
import { createSettingsScreen } from './screens/settings.ts';
import { createTitleScreen } from './screens/title.ts';
import type { Screen, UiContext } from './screens/types.ts';
import { createTranslator } from './strings.ts';
import './ui.css';
import { Cue } from './cues.ts';

/** ui.focus at most once per 40 ms (ui-spec 8.5). */
const FOCUS_SOUND_GAP_MS = 40;

/**
 * CommandRejected reasons that stay silent: no announcement (AU routes.json silentReasons). The
 * denied sound itself comes from AU's event map, so the UI never plays it for this event.
 */
const SILENT_REJECTS: ReadonlySet<number> = new Set([
  RejectReason.WrongPhase,
  RejectReason.UnknownId,
  RejectReason.DebugDisabled,
]);

export interface CreateUiOptions {
  /** Dev builds show [[key]] for missing strings (architecture 9.7). */
  readonly devStrings?: boolean;
}

export function createUiWith(opts: CreateUiOptions): CreateUi {
  return (deps): Ui => {
    const doc = deps.root.ownerDocument;
    const win = doc.defaultView;
    const translator = createTranslator(deps.strings, { dev: opts.devStrings === true });
    const { t } = translator;

    const layer = h(doc, 'div', 'ui-layer sf-ui');
    const screenLayer = h(doc, 'div', 'screen-layer');
    const live = h(doc, 'div', 'live-region');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    const smallWindow = h(doc, 'div', 'small-window', t('ui.common.small_window'));
    const countdown = h(doc, 'div', 'resume-countdown');
    countdown.setAttribute('aria-hidden', 'true');
    layer.append(screenLayer, countdown, live, smallWindow);
    deps.root.appendChild(layer);

    let appScreen: AppScreen = 'title';
    let prevAppScreen: AppScreen = 'title';
    let activeId: ScreenId = 'title';
    let current: Screen | null = null;
    let lastView: WorldView | null = null;
    let staleEnd = false;
    let staleRevision = -1;
    let confirmOpen = false;
    let lockUntil = 0;
    let returningFromMenu = false;
    /** Run screen that was active when the pause menu opened. */
    let pausedFrom = '';
    let lastFocusSound = -Infinity;
    let appliedSettings: Settings | null = null;
    let sawReward = false;
    let sawTemper = false;
    const icons = createIconArt(deps.art);

    const now = (): number => (win === null ? 0 : win.performance.now());

    const sound = (cueId: string): void => {
      if (cueId === Cue.Focus) {
        const tNow = now();
        if (tNow - lastFocusSound < FOCUS_SOUND_GAP_MS) return;
        lastFocusSound = tNow;
      }
      deps.sound.play(cueId);
    };

    const announce = (text: string): void => {
      live.textContent = '';
      live.textContent = text;
    };

    const syncSettings = (force = false): void => {
      const s = deps.settings();
      if (!force && s === appliedSettings) return;
      const prev = appliedSettings;
      appliedSettings = s;
      layer.classList.toggle('reduce-effects', s.access.reduceEffects);
      layer.classList.toggle('solid-panels', s.access.solidPanels);
      layer.dataset['cv'] = s.access.colorVision;
      if (prev?.access.textScale !== s.access.textScale) applyScale();
      // Rebuild a screen that shows flavor text; the Settings screen itself keeps its focus.
      if (
        prev !== null &&
        prev.access.showFlavor !== s.access.showFlavor &&
        current !== null &&
        activeId !== 'settings'
      ) {
        current.enter(activeId);
      }
    };

    const applyScale = (): void => {
      if (win === null) return;
      const s = deps.settings();
      const sc = computeUiScale(
        win.innerWidth,
        win.innerHeight,
        win.devicePixelRatio,
        s.access.textScale,
      );
      layer.style.setProperty('--u', `${sc.unitCss}px`);
      layer.style.setProperty('--f', `${sc.fontCss}px`);
      layer.style.setProperty('--fs', `${sc.smallFontCss}px`);
      layer.classList.toggle('is-too-small', sc.tooSmall);
      layer.dataset['textScale'] = String(s.access.textScale);
    };

    const ctx: UiContext = {
      doc,
      deps,
      t,
      has: (key) => translator.has(key),
      icons,
      visit: () => ({ sawReward, sawTemper }),
      sound,
      announce,
      go(screen) {
        setScreen(screen);
      },
      previous: () => prevAppScreen,
      lockInput(ms) {
        // Returning from pause or settings is not a new choice screen: no second lock (ui-spec 8.4).
        if (!returningFromMenu) lockUntil = now() + ms;
      },
      inputLocked: () => now() < lockUntil,
      view: () => lastView,
      matches: (action: ActionId, e: KeyboardEvent) =>
        isBound(deps.settings().keybinds, action, e.code),
      keyHint: (action: ActionId) => keyLabel(deps.settings().keybinds[action][0]),
      newFocusList: () =>
        createFocusList({
          onMove: () => {
            sound(Cue.Focus);
          },
          canActivate: () => now() >= lockUntil,
          onDenied: () => {
            sound(Cue.Denied);
          },
        }),
      tier(n) {
        const key = tierKey(n);
        return translator.has(key) ? t(key) : String(n);
      },
      applySettings(s) {
        deps.app.applySettings(s);
        syncSettings();
      },
      setConfirmOpen(open) {
        confirmOpen = open;
        route();
      },
    };

    const screens = new Map<string, Screen>();
    const pauseScreen = createPauseScreen(ctx);
    const screenFor = (id: ScreenId): Screen => {
      if (id === 'pause' || id === 'confirm') return pauseScreen;
      let s = screens.get(id);
      if (s !== undefined) return s;
      switch (id) {
        case 'title':
          s = createTitleScreen(ctx);
          break;
        case 'class-select':
          s = createClassSelectScreen(ctx);
          break;
        case 'pulse':
          s = createHudScreen(ctx);
          break;
        case 'level-up':
          s = createChoiceScreen(ctx, 'levelUp');
          break;
        case 'warden-reward':
          s = createChoiceScreen(ctx, 'reward');
          break;
        case 'glazier':
          s = createGlazierScreen(ctx);
          break;
        case 'settings':
          s = createSettingsScreen(ctx);
          break;
        case 'run-end':
          s = createRunEndScreen(ctx);
          break;
        case 'archive':
          s = createInfoScreen(ctx, 'archive');
          break;
        case 'credits':
          s = createInfoScreen(ctx, 'credits');
          break;
      }
      screens.set(id, s);
      return s;
    };

    const switchTo = (id: ScreenId): void => {
      const next = screenFor(id);
      const sameScreen = next === current;
      activeId = id;
      layer.dataset['screen'] = id;
      if (sameScreen) return;
      if (current !== null) {
        current.leave?.();
        current.el.remove();
      }
      const fromId = current === null ? '' : (current.el.dataset['screen'] ?? '');
      current = next;
      next.el.dataset['screen'] = id;
      screenLayer.appendChild(next.el);
      if (id === 'pulse') sawReward = sawTemper = false;
      else if (id === 'warden-reward') sawReward = true;
      else if (id === 'level-up') sawTemper = true;
      const fromMenu = fromId === 'pause' || fromId === 'confirm' || fromId === 'settings';
      if (!fromMenu && (id === 'pause' || id === 'settings')) pausedFrom = fromId;
      returningFromMenu = fromMenu && id === pausedFrom;
      next.enter(id);
      returningFromMenu = false;
    };

    const route = (): void => {
      if (staleEnd && lastView !== null && lastView.phaseRevision !== staleRevision)
        staleEnd = false;
      const id = resolveScreenId(appScreen, lastView?.phase ?? null, staleEnd, confirmOpen);
      if (id !== activeId || current === null) switchTo(id);
      else if (current.el.dataset['screen'] !== id) current.el.dataset['screen'] = id;
    };

    function setScreen(screen: AppScreen): void {
      if (screen !== appScreen) prevAppScreen = appScreen;
      appScreen = screen;
      if (screen !== 'paused') confirmOpen = false;
      // A new run started from the run end, title or class select: ignore the old run's end until
      // the sim changes phase. Resuming after Abandon must show the end, so pause is excluded.
      const newRun = activeId === 'run-end' || activeId === 'title' || activeId === 'class-select';
      if (
        screen === 'run' &&
        newRun &&
        lastView !== null &&
        (lastView.phase === 'victory' || lastView.phase === 'defeat')
      ) {
        staleEnd = true;
        staleRevision = lastView.phaseRevision;
      }
      route();
    }

    const readEvents = (view: WorldView, events: SimEventReader): void => {
      for (let i = 0; i < events.count; i++) {
        const type = events.type[i];
        if (type === SimEventType.CommandRejected) {
          const reason = events.a[i] ?? 0;
          if (SILENT_REJECTS.has(reason)) continue;
          if (reason === RejectReason.NotEnoughGlint) announce(t('ui.shop.no_glint'));
          else if (reason === RejectReason.SlotsFull) announce(t('ui.shop.slots_full'));
          else announce(t('ui.common.denied'));
        } else if (type === SimEventType.ItemBought) {
          const def = events.b[i] ?? -1;
          const info =
            events.a[i] === OfferKind.Weapon
              ? weaponInfo(deps.data, def)
              : mementoInfo(deps.data, def);
          if (info !== null)
            announce(t('ui.shop.bought', { name: t(info.nameKey), n: view.player.glint }));
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      const scr = current;
      if (scr === null) return;
      const keybinds = deps.settings().keybinds;
      if (pausesRun(activeId) && appScreen === 'run' && isBound(keybinds, 'pause', e.code)) {
        if (!e.repeat) {
          sound(Cue.PauseOpen);
          deps.app.pause();
        }
        e.preventDefault();
        return;
      }
      if (scr.focus === null) return;
      const intent = menuIntent(e.code, e.shiftKey, keybinds);
      const isNav = intent === 'up' || intent === 'down' || intent === 'left' || intent === 'right';
      // Keys held since the Pulse never act on a new screen (ui-spec 8.4); navigation may repeat.
      if (e.repeat && !isNav) {
        e.preventDefault();
        return;
      }
      if (scr.key?.(e) === true) {
        e.preventDefault();
        return;
      }
      if (intent === null) return;
      e.preventDefault();
      switch (intent) {
        case 'up':
          scr.focus.move(Dir.Up);
          break;
        case 'down':
          scr.focus.move(Dir.Down);
          break;
        case 'left':
          scr.focus.move(Dir.Left);
          break;
        case 'right':
          scr.focus.move(Dir.Right);
          break;
        case 'nextGroup':
          scr.focus.cycleGroup(1);
          break;
        case 'prevGroup':
          scr.focus.cycleGroup(-1);
          break;
        case 'confirm':
          scr.focus.activate();
          break;
        case 'back':
          scr.back?.();
          break;
      }
    };

    // Native buttons click on Enter keydown and Space keyup; the UI activates on keydown itself.
    const onKeyUp = (e: KeyboardEvent): void => {
      if ((e.code === 'Space' || e.code === 'Enter') && layer.contains(doc.activeElement))
        e.preventDefault();
    };
    const onResize = (): void => {
      applyScale();
    };

    win?.addEventListener('keydown', onKeyDown);
    win?.addEventListener('keyup', onKeyUp);
    win?.addEventListener('resize', onResize);
    syncSettings(true);
    applyScale();
    route();
    let disposed = false;
    // Team pixel font: text switches over once the browser accepted it (monospace until then).
    void loadPixelFont(doc).then((ok) => {
      if (ok && !disposed) layer.classList.add('has-pixel-font');
    });

    return {
      setScreen,
      update(view, events) {
        lastView = view;
        syncSettings();
        readEvents(view, events);
        route();
        current?.update?.(view, events);
      },
      setResumeCountdown(n) {
        const on = n > 0;
        layer.classList.toggle('is-counting', on);
        countdown.textContent = on ? String(Math.ceil(n)) : '';
      },
      get activeScreenId() {
        return activeId;
      },
      dispose() {
        disposed = true;
        win?.removeEventListener('keydown', onKeyDown);
        win?.removeEventListener('keyup', onKeyUp);
        win?.removeEventListener('resize', onResize);
        current?.leave?.();
        layer.remove();
      },
    };
  };
}
