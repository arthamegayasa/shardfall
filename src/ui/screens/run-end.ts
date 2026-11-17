// S08 Run end (ui-spec 5): Kept Lost or Light Kept, "Felled by", short stats, final build, then
// Try Again (initial focus), Choose Kept, The Keeping (tiers B and C), Title. Input lock 500 ms so a key held at death never
// starts a new run. Back from The Keeping: no lock and the last focused button again (BUG-009).
// A build list taller than its panel scrolls (wheel, or arrows while the list has focus) and shows
// a scroll mark (CD M3 10).

import { unlockCost } from '../../content/index.ts';
import type { WorldView } from '../../core/index.ts';
import { button, h, put } from '../dom.ts';
import { menuIntent } from '../menu-keys.ts';
import { moreAbove, moreBelow, overflows, scrollStep } from '../scroll.ts';
import type { ScrollMetrics } from '../scroll.ts';
import { formatInt } from '../format.ts';
import { buildRunEndModel } from '../presenters/run-end.ts';
import type { RunEndModel } from '../presenters/run-end.ts';
import { buildRow, panel, titleBlock } from './components.ts';
import { RUN_END_LOCK_MS } from './types.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

export function createRunEndScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-run-end');
  const focus = ctx.newFocusList();
  let model: RunEndModel | null = null;
  /** data-ui of the last focused control, restored when coming back from The Keeping. */
  let lastUi = '';
  /** Scrollable build list and its scroll mark (null until built). */
  let scrollBox: HTMLElement | null = null;
  let scrollMark: HTMLElement | null = null;

  const metrics = (b: HTMLElement): ScrollMetrics => ({
    top: b.scrollTop,
    client: b.clientHeight,
    height: b.scrollHeight,
  });

  const syncMark = (): void => {
    if (scrollBox === null || scrollMark === null) return;
    const m = metrics(scrollBox);
    const below = moreBelow(m);
    const above = moreAbove(m);
    scrollMark.hidden = !overflows(m);
    scrollMark.classList.toggle('is-below', below);
    scrollMark.classList.toggle('is-above', above && !below);
    scrollMark.textContent = t(below ? 'ui.end.more_below' : 'ui.end.more_above');
  };

  const guarded = (run: () => void) => (): void => {
    if (ctx.inputLocked()) {
      ctx.sound(Cue.Denied);
      return;
    }
    ctx.sound(Cue.Confirm);
    run();
  };

  const statRow = (labelKey: string, value: string): HTMLElement =>
    put(h(doc, 'div', 'stat-row'), h(doc, 'span', '', t(labelKey)), h(doc, 'span', 'num', value));

  const build = (view: WorldView): void => {
    const m = buildRunEndModel(view, deps.data);
    model = m;
    el.textContent = '';
    focus.reset();
    el.classList.toggle('is-won', m.won);
    el.dataset['variant'] = m.won ? 'run-won' : 'run-lost';
    const title = m.won
      ? titleBlock(ctx, t('ui.end.won'), t('ui.end.won_sub'))
      : titleBlock(ctx, t('ui.end.lost'), t('ui.end.lost_sub'));
    if (m.killerKey !== null) {
      title.appendChild(h(doc, 'p', 'felled-by', t('ui.end.felled_by', { name: t(m.killerKey) })));
    }
    const stats = panel(ctx, 'end-stats', true);
    put(
      stats,
      h(
        doc,
        'p',
        'end-pulse',
        t('ui.end.pulse_reached', { n: m.pulseReached, total: m.pulseCount }),
      ),
      statRow('ui.end.time', m.timeText),
      statRow('ui.end.unlit', formatInt(m.kills)),
      statRow('ui.end.glint', formatInt(m.glintEarned)),
    );
    const hasSilt = deps.data.meta.contentTier !== 'A';
    if (hasSilt) {
      stats.appendChild(statRow('ui.end.silt', formatInt(m.silt)));
      // Balance after this run and a pointer to The Keeping when an unlock is now affordable (S08).
      const meta = deps.meta();
      // Labelled balance (CD M3 10): "Silt Held  161", not a bare "161 Silt".
      const held = statRow('ui.end.silt_held', formatInt(meta.silt));
      held.classList.add('end-silt-total');
      stats.appendChild(held);
      const canBuy = deps.data.metaUnlocks.some(
        (u) => !meta.unlocked.includes(u.id) && meta.silt >= unlockCost(deps.data, u),
      );
      if (canBuy) stats.appendChild(h(doc, 'p', 'end-new-unlock', t('ui.end.new_unlock')));
    }

    const buildCol = panel(ctx, 'end-build');
    const scroll = h(doc, 'div', 'end-build-scroll');
    scroll.dataset['ui'] = 'end-build';
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', t('ui.end.build'));
    scroll.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.weapons')));
    const wl = h(doc, 'div', 'build-list');
    for (const w of m.build.weapons) {
      wl.appendChild(
        buildRow(
          ctx,
          { kind: 'weapon', id: w.item.id },
          w.item.nameKey,
          w.item.tags,
          w.rarityOrder,
          ctx.tier(w.level),
        ),
      );
    }
    scroll.appendChild(wl);
    scroll.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.mementos')));
    const ml = h(doc, 'div', 'build-list');
    for (const mm of m.build.mementos) {
      ml.appendChild(
        buildRow(
          ctx,
          { kind: 'memento', id: mm.item.id },
          mm.item.nameKey,
          mm.item.tags,
          mm.rarityOrder,
          mm.level > 1 ? `x${String(mm.level)}` : '',
        ),
      );
    }
    scroll.appendChild(ml);
    const mark = h(doc, 'p', 'end-more');
    mark.setAttribute('aria-hidden', 'true');
    mark.hidden = true;
    put(buildCol, scroll, mark);
    scroll.addEventListener('scroll', syncMark, { passive: true });
    scrollBox = scroll;
    scrollMark = mark;

    const bar = h(doc, 'div', 'bottom-bar end-bar');
    const again = button(doc, 'end-again', t('ui.end.again'), 'primary');
    const choose = button(doc, 'end-choose', t('ui.end.choose'));
    const toTitle = button(doc, 'end-title', t('ui.end.title'));
    const keeping = hasSilt ? button(doc, 'end-keeping', t('ui.end.keeping')) : null;
    put(bar, again, choose, keeping, toTitle);
    const remember = (b: HTMLElement) => (): void => {
      lastUi = b.dataset['ui'] ?? '';
    };
    focus.add({
      el: again,
      group: 0,
      onFocus: remember(again),
      activate: guarded(() => {
        if (model !== null) deps.app.startRun(model.classId, model.difficulty);
      }),
    });
    focus.add({
      el: choose,
      group: 0,
      onFocus: remember(choose),
      activate: guarded(() => {
        ctx.go('classSelect');
      }),
    });
    if (keeping !== null)
      focus.add({
        el: keeping,
        group: 0,
        onFocus: remember(keeping),
        activate: guarded(() => {
          deps.app.openArchive();
        }),
      });
    focus.add({
      el: toTitle,
      group: 0,
      onFocus: remember(toTitle),
      activate: guarded(() => {
        deps.app.quitToTitle();
      }),
    });
    put(
      el,
      put(
        h(doc, 'div', 'safe end-safe'),
        title,
        put(h(doc, 'div', 'end-cols'), stats, buildCol),
        bar,
      ),
    );
    // The screen is in the document now: only a list that does not fit becomes a focus stop.
    if (overflows(metrics(scroll))) {
      focus.add({
        el: scroll,
        group: 1,
        activate: () => {
          ctx.sound(Cue.Denied);
        },
      });
    }
    syncMark();
  };

  /** Arrow up or down while the build list has focus scrolls it until its edge. */
  const scrollKey = (e: KeyboardEvent): boolean => {
    if (scrollBox === null || doc.activeElement !== scrollBox) return false;
    const intent = menuIntent(e.code, e.shiftKey, deps.settings().keybinds);
    if (intent !== 'up' && intent !== 'down') return false;
    const row = scrollBox.querySelector('.build-row');
    const step = row instanceof HTMLElement ? row.offsetHeight * 2 : scrollBox.clientHeight / 2;
    const next = scrollStep(metrics(scrollBox), intent === 'up' ? -1 : 1, step);
    if (next === null) return false;
    scrollBox.scrollTop = next;
    syncMark();
    return true;
  };

  return {
    el,
    focus,
    enter() {
      const returning = ctx.returning();
      const keep = returning ? lastUi : '';
      const v = ctx.view();
      if (v !== null) build(v);
      const prev = keep === '' ? null : el.querySelector(`[data-ui="${keep}"]`);
      const i = prev === null ? -1 : focus.indexOf(prev);
      lastUi = '';
      focus.focus(i >= 0 ? i : 0, true);
      ctx.lockInput(RUN_END_LOCK_MS);
    },
    key(e) {
      return scrollKey(e);
    },
  };
}
