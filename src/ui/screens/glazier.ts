// S05 The Glazier (ui-spec 5, wireframe 05): one screen, no scroll. Offers with buy, lock, Fuse
// preview; Tag panel with synergy preview; 6 weapon slots with Sell and Fuse; Memento list; Stats
// toggle; Reroll and Begin Pulse. The sim validates every command (UI reads, sim decides).

import type { WorldView } from '../../core/index.ts';
import { button, h, put, withHint } from '../dom.ts';
import { formatInt, formatStatValue } from '../format.ts';
import { tagAbbrKey, tagNameKey } from '../presenters/content.ts';
import { buildShopModel, initialOfferFocus, tagPreview } from '../presenters/shop.ts';
import type { OfferCard, ShopModel, TagPreview } from '../presenters/shop.ts';
import { glintAmount, panel, rarityPips, rowCard } from './components.ts';
import { CHOICE_LOCK_MS } from './types.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

const GROUP_OFFERS = 0;
const GROUP_SLOTS = 1;
const GROUP_BAR = 2;

export function createGlazierScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-glazier');
  const focus = ctx.newFocusList();
  let model: ShopModel | null = null;
  let revision = -1;
  let glint = NaN;
  let showStats = false;
  let selectedSlot = -1;

  const tagPanel = panel(ctx, 'shop-tags');
  /** data-ui of the focused control inside this screen, '' when none. */
  const focusedUi = (): string => {
    const a = doc.activeElement;
    return a instanceof HTMLElement && el.contains(a) ? (a.dataset['ui'] ?? '') : '';
  };
  const infoLine = h(doc, 'p', 'info-line');

  const send = ctx.deps.commands;

  const denied = (key: string): void => {
    ctx.sound(Cue.Denied);
    const text = t(key);
    infoLine.textContent = text;
    ctx.announce(text);
  };

  const guard = (): boolean => {
    if (ctx.inputLocked()) {
      ctx.sound(Cue.Denied);
      return false;
    }
    return true;
  };

  const buy = (o: OfferCard): void => {
    if (!guard()) return;
    if (o.state === 'empty' || o.state === 'taken') {
      denied('ui.shop.taken');
      return;
    }
    if (o.blockedNoSlot) {
      denied('ui.shop.slots_full');
      return;
    }
    if (!o.affordable) {
      denied('ui.shop.no_glint');
      return;
    }
    send.send({ type: 'shop.buy', offer: o.slot });
  };

  const toggleLock = (o: OfferCard): void => {
    if (!guard()) return;
    if (o.state !== 'weapon' && o.state !== 'memento') {
      denied('ui.shop.taken');
      return;
    }
    send.send({ type: 'shop.lock', offer: o.slot, locked: !o.locked });
  };

  const reroll = (): void => {
    if (!guard() || model === null) return;
    if (!model.canReroll) {
      denied('ui.shop.no_glint');
      return;
    }
    send.send({ type: 'shop.reroll' });
  };

  const sell = (slot: number): void => {
    if (!guard() || model === null) return;
    const s = model.inventory[slot];
    if (s === undefined || s.empty) {
      denied('ui.common.denied');
      return;
    }
    send.send({ type: 'shop.sell', inventorySlot: slot });
  };

  const fuse = (slot: number): void => {
    if (!guard() || model === null) return;
    const s = model.inventory[slot];
    if (s?.canFuse !== true) {
      denied('ui.common.denied');
      return;
    }
    send.send({ type: 'shop.merge', inventorySlot: slot });
  };

  const begin = (): void => {
    if (!guard()) return;
    ctx.sound(Cue.PulseBegin);
    send.send({ type: 'pulse.begin' });
  };

  const renderTags = (preview: readonly TagPreview[]): void => {
    if (model === null) return;
    tagPanel.textContent = '';
    tagPanel.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.tags')));
    const rows = model.tags.map((r) => ({ tag: r.tag, count: r.count, thresholds: r.thresholds }));
    for (const p of preview) {
      if (p.isNewTag && p.newCount > 0) rows.push({ tag: p.tag, count: 0, thresholds: [] });
    }
    for (const r of rows) {
      const p = preview.find((x) => x.tag === r.tag);
      const add = p === undefined ? 0 : p.newCount - p.count;
      const row = h(doc, 'div', `tag-row tag-${r.tag}`);
      if (add > 0) row.classList.add('is-preview');
      if (p !== undefined && p.unlockDescKey !== null) row.classList.add('is-unlock');
      const shown = r.count + add;
      const next =
        r.thresholds.find((th) => th > r.count) ?? r.thresholds[r.thresholds.length - 1] ?? 0;
      const pips = h(doc, 'span', 'tag-pips');
      for (const th of r.thresholds) {
        const pip = h(doc, 'span', 'tag-pip');
        if (r.count >= th) pip.classList.add('is-full');
        else if (shown >= th) pip.classList.add('is-ghost');
        pips.appendChild(pip);
      }
      put(
        row,
        h(doc, 'span', `tag-chip tag-${r.tag}`, t(tagAbbrKey(r.tag))),
        h(doc, 'span', 'tag-name', t(tagNameKey(r.tag))),
        pips,
        h(doc, 'span', 'tag-count', next > 0 ? `${String(shown)}/${String(next)}` : String(shown)),
      );
      if (p !== undefined && p.isNewTag)
        row.appendChild(h(doc, 'span', 'tag-new', t('ui.shop.tag_new')));
      tagPanel.appendChild(row);
    }
  };

  const focusOffer = (o: OfferCard): void => {
    if (model === null) return;
    const preview = tagPreview(model, deps.data, o);
    renderTags(preview);
    const unlock = preview.find((p) => p.unlockDescKey !== null);
    const unlockKey = unlock?.unlockDescKey ?? null;
    infoLine.textContent =
      unlock === undefined || unlockKey === null
        ? ''
        : t('ui.shop.tag_unlocks', { effect: t(unlockKey, unlock.unlockParams) });
    el.querySelectorAll('.slot.is-fuse-target').forEach((n) => {
      n.classList.remove('is-fuse-target');
    });
    if (o.fuseSlot >= 0)
      el.querySelector(`[data-ui="shop-slot-${String(o.fuseSlot + 1)}"]`)?.classList.add(
        'is-fuse-target',
      );
  };

  const focusSlot = (slot: number): void => {
    selectedSlot = slot;
    renderTags([]);
    const s = model?.inventory[slot];
    if (s === undefined || s.item === null) {
      infoLine.textContent = '';
      return;
    }
    infoLine.textContent = `${t(s.item.nameKey)} ${ctx.tier(s.tier)}  ${t('ui.shop.sell_for', { n: s.sellPrice })}`;
  };

  const rightColumn = (m: ShopModel, view: WorldView): HTMLElement => {
    const col = panel(ctx, 'shop-right');
    if (showStats) {
      col.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.stats')));
      const list = h(doc, 'div', 'stat-list');
      deps.data.stats.forEach((s, i) => {
        if (!s.showInUi) return;
        const v = view.player.stats[i] ?? s.base;
        put(
          list,
          put(
            h(doc, 'div', 'stat-row'),
            h(doc, 'span', '', t(s.displayKey)),
            h(doc, 'span', 'num', formatStatValue(v)),
          ),
        );
      });
      col.appendChild(list);
      return col;
    }
    col.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.weapons')));
    const grid = h(doc, 'div', 'slot-grid');
    m.inventory.forEach((s) => {
      const b = button(
        doc,
        `shop-slot-${String(s.slot + 1)}`,
        '',
        `slot rarity-${String(Math.max(0, s.tier - 1))}`,
      );
      b.textContent = '';
      if (s.empty || s.item === null) b.classList.add('is-empty');
      else {
        put(
          b,
          h(doc, 'span', 'slot-abbr', t(tagAbbrKey(s.item.tags[0] ?? ''))),
          h(doc, 'span', 'slot-tier', ctx.tier(s.tier)),
        );
        b.setAttribute('aria-label', `${t(s.item.nameKey)} ${ctx.tier(s.tier)}`);
        if (s.canFuse) b.classList.add('can-fuse');
      }
      grid.appendChild(b);
      focus.add({
        el: b,
        group: GROUP_SLOTS,
        activate: () => {
          if (s.canFuse) fuse(s.slot);
          else ctx.sound(Cue.Denied);
        },
        onFocus: () => {
          focusSlot(s.slot);
        },
      });
    });
    col.appendChild(grid);
    col.appendChild(h(doc, 'h3', 'col-title', t('ui.shop.mementos')));
    const list = h(doc, 'div', 'memento-list');
    for (const mc of m.mementos) {
      if (mc.item === null) continue;
      const row = h(doc, 'div', `memento-row rarity-${String(mc.rarityOrder)}`);
      put(row, rarityPips(ctx, mc.rarityOrder), h(doc, 'span', 'memento-name', t(mc.item.nameKey)));
      if (mc.count > 1) row.appendChild(h(doc, 'span', 'num', `x${String(mc.count)}`));
      list.appendChild(row);
    }
    col.appendChild(list);
    return col;
  };

  const build = (view: WorldView): void => {
    const prevUi = focusedUi();
    const m = buildShopModel(view, deps.data);
    model = m;
    revision = m.revision;
    glint = m.glint;
    el.textContent = '';
    focus.reset();

    const safe = h(doc, 'div', 'safe glazier-safe');
    const top = h(doc, 'div', 'shop-top');
    put(
      top,
      h(doc, 'h1', 'heading', t('ui.shop.title')),
      h(doc, 'span', 'shop-next', t('ui.shop.next', { n: m.nextPulse })),
      h(doc, 'span', 'shop-hp', t('ui.hud.hp', { hp: formatInt(m.hp), max: formatInt(m.maxHp) })),
      put(h(doc, 'span', 'shop-glint'), glintAmount(ctx, m.glint)),
    );

    const offers = h(doc, 'div', 'shop-offers');
    let firstIndex = -1;
    m.offers.forEach((o) => {
      const row = h(doc, 'div', 'offer-row');
      let card: HTMLButtonElement;
      if (o.item === null) {
        card = button(
          doc,
          `shop-offer-${String(o.slot + 1)}`,
          o.state === 'taken' ? t('ui.shop.taken') : '',
          'card card-empty',
        );
      } else {
        let badge = '';
        if (o.fuseTier > 0) badge = t('ui.shop.merge_tier', { tier: ctx.tier(o.fuseTier) });
        else if (o.blockedNoSlot) badge = t('ui.shop.slots_full');
        card = rowCard(ctx, {
          dataUi: `shop-offer-${String(o.slot + 1)}`,
          nameKey: o.item.nameKey,
          descKey: o.item.descKey,
          descParams: o.item.params,
          flavorKey: o.item.flavorKey,
          tags: o.item.tags,
          rarityOrder: o.rarityOrder,
          tierText: o.isWeapon ? ctx.tier(o.tier) : '',
          hotkey: o.slot + 1,
          price: o.price,
          affordable: o.affordable,
          badge,
          locked: o.locked,
        });
        if (!o.buyable) card.classList.add('is-unaffordable');
      }
      const lock = button(
        doc,
        `shop-lock-${String(o.slot + 1)}`,
        '',
        `lock-btn${o.locked ? ' is-closed' : ''}`,
      );
      lock.textContent = '';
      lock.setAttribute('aria-label', t(o.locked ? 'ui.shop.unlock' : 'ui.shop.lock'));
      lock.setAttribute('aria-pressed', o.locked ? 'true' : 'false');
      if (o.item === null) lock.disabled = true;
      put(offers, put(row, card, lock));
      const ci = focus.add({
        el: card,
        group: GROUP_OFFERS,
        activate: () => {
          buy(o);
        },
        onFocus: () => {
          focusOffer(o);
        },
      });
      if (o.item !== null) {
        focus.add({
          el: lock,
          group: GROUP_OFFERS,
          activate: () => {
            toggleLock(o);
          },
          onFocus: () => {
            focusOffer(o);
          },
        });
      }
      if (firstIndex < 0 && o.slot === initialOfferFocus(m)) firstIndex = ci;
    });

    const right = rightColumn(m, view);

    const bar = h(doc, 'div', 'bottom-bar shop-bar');
    const rerollBtn = button(doc, 'shop-reroll', t('ui.shop.reroll'));
    rerollBtn.appendChild(
      m.freeRerolls > 0
        ? h(doc, 'span', 'free', t('ui.shop.reroll_free'))
        : glintAmount(ctx, m.rerollPrice, m.canReroll),
    );
    withHint(doc, rerollBtn, ctx.keyHint('reroll'));
    const sellBtn = withHint(doc, button(doc, 'shop-sell', t('ui.shop.sell')), ctx.keyHint('sell'));
    const fuseBtn = withHint(
      doc,
      button(doc, 'shop-fuse', t('ui.shop.merge')),
      ctx.keyHint('merge'),
    );
    const statsBtn = withHint(
      doc,
      button(doc, 'shop-stats', t('ui.shop.stats')),
      ctx.keyHint('stats'),
    );
    const beginBtn = withHint(
      doc,
      button(doc, 'shop-begin', t('ui.shop.begin'), 'primary'),
      ctx.keyHint('beginPulse'),
    );
    put(bar, rerollBtn, sellBtn, fuseBtn, statsBtn, infoLine, beginBtn);
    focus.add({ el: rerollBtn, group: GROUP_BAR, activate: reroll });
    focus.add({
      el: sellBtn,
      group: GROUP_BAR,
      activate: () => {
        sell(selectedSlot);
      },
    });
    focus.add({
      el: fuseBtn,
      group: GROUP_BAR,
      activate: () => {
        fuse(selectedSlot);
      },
    });
    focus.add({
      el: statsBtn,
      group: GROUP_BAR,
      activate: () => {
        toggleStats();
      },
    });
    const beginIndex = focus.add({ el: beginBtn, group: GROUP_BAR, activate: begin });

    put(el, put(safe, top, put(h(doc, 'div', 'shop-cols'), tagPanel, offers, right), bar));

    // Keep focus on the same control across rebuilds (a bought card stays in place as Taken).
    const prevEl = prevUi === '' ? null : el.querySelector<HTMLElement>(`[data-ui="${prevUi}"]`);
    const keepIndex = prevEl === null ? -1 : focus.indexOf(prevEl);
    const start = keepIndex >= 0 ? keepIndex : firstIndex >= 0 ? firstIndex : beginIndex;
    infoLine.textContent = '';
    renderTags([]);
    focus.focus(start, true);
  };

  const toggleStats = (): void => {
    showStats = !showStats;
    ctx.sound(Cue.Toggle);
    const v = ctx.view();
    if (v !== null) build(v);
  };

  const currentOffer = (): OfferCard | null => {
    if (model === null) return null;
    const m = /^shop-(?:offer|lock)-(\d+)$/.exec(focusedUi());
    return m?.[1] === undefined ? null : (model.offers[Number(m[1]) - 1] ?? null);
  };

  return {
    el,
    focus,
    enter() {
      showStats = false;
      revision = -1;
      selectedSlot = -1;
      const v = ctx.view();
      if (v !== null) build(v);
      ctx.lockInput(CHOICE_LOCK_MS);
    },
    update(view) {
      if (view.shop.revision !== revision || view.player.glint !== glint) build(view);
    },
    key(e) {
      if (model === null) return false;
      const digit = /^Digit([1-9])$/.exec(e.code) ?? /^Numpad([1-9])$/.exec(e.code);
      if (digit?.[1] !== undefined) {
        const o = model.offers[Number(digit[1]) - 1];
        if (o === undefined) return false;
        if (e.shiftKey) toggleLock(o);
        else buy(o);
        return true;
      }
      if (ctx.matches('reroll', e)) {
        reroll();
        return true;
      }
      if (ctx.matches('beginPulse', e)) {
        begin();
        return true;
      }
      if (ctx.matches('stats', e)) {
        toggleStats();
        return true;
      }
      if (ctx.matches('lock', e)) {
        const o = currentOffer();
        if (o !== null) toggleLock(o);
        else ctx.sound(Cue.Denied);
        return true;
      }
      if (ctx.matches('sell', e)) {
        sell(selectedSlot);
        return true;
      }
      if (ctx.matches('merge', e)) {
        fuse(selectedSlot);
        return true;
      }
      return false;
    },
    back() {
      ctx.sound(Cue.PauseOpen);
      deps.app.pause();
    },
  };
}
