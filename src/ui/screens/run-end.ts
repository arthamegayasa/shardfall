// S08 Run end (ui-spec 5): Kept Lost or Light Kept, "Felled by", short stats, final build, then
// Try Again (initial focus), Choose Kept, The Keeping (tiers B and C), Title. Input lock 500 ms so a key held at death never
// starts a new run.

import { unlockCost } from '../../content/index.ts';
import type { WorldView } from '../../core/index.ts';
import { button, h, put } from '../dom.ts';
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
      stats.appendChild(
        h(doc, 'p', 'end-silt-total dim', t('ui.common.silt', { n: formatInt(meta.silt) })),
      );
      const canBuy = deps.data.metaUnlocks.some(
        (u) => !meta.unlocked.includes(u.id) && meta.silt >= unlockCost(deps.data, u),
      );
      if (canBuy) stats.appendChild(h(doc, 'p', 'end-new-unlock', t('ui.end.new_unlock')));
    }

    const buildCol = panel(ctx, 'end-build');
    buildCol.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.weapons')));
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
    buildCol.appendChild(wl);
    buildCol.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.mementos')));
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
    buildCol.appendChild(ml);

    const bar = h(doc, 'div', 'bottom-bar end-bar');
    const again = button(doc, 'end-again', t('ui.end.again'), 'primary');
    const choose = button(doc, 'end-choose', t('ui.end.choose'));
    const toTitle = button(doc, 'end-title', t('ui.end.title'));
    const keeping = hasSilt ? button(doc, 'end-keeping', t('ui.end.keeping')) : null;
    put(bar, again, choose, keeping, toTitle);
    focus.add({
      el: again,
      group: 0,
      activate: guarded(() => {
        if (model !== null) deps.app.startRun(model.classId, model.difficulty);
      }),
    });
    focus.add({
      el: choose,
      group: 0,
      activate: guarded(() => {
        ctx.go('classSelect');
      }),
    });
    if (keeping !== null)
      focus.add({
        el: keeping,
        group: 0,
        activate: guarded(() => {
          deps.app.openArchive();
        }),
      });
    focus.add({
      el: toTitle,
      group: 0,
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
    focus.focus(0, true);
  };

  return {
    el,
    focus,
    enter() {
      const v = ctx.view();
      if (v !== null) build(v);
      ctx.lockInput(RUN_END_LOCK_MS);
    },
  };
}
