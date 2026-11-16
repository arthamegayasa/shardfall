// S05 The Glazier (ui-spec 5, wireframe 05): one screen, no scroll. Left: the Glazier's portrait and
// one spoken line, then the Tag panel with synergy preview. Centre: offers with buy, lock, Fuse
// preview. Right: 6 weapon slots with Sell and Fuse, Mementos, Stats toggle. Bottom: Reroll and
// Begin Pulse. The sim validates every command (UI reads, sim decides).

import type { SimEventReader, WorldView } from '../../core/index.ts';
import { button, h, put, setText, withHint } from '../dom.ts';
import { formatInt, formatStatValue } from '../format.ts';
import { openingTrigger, pickLine, reactionTrigger } from '../presenters/glazier-line.ts';
import { tagNameKey } from '../presenters/content.ts';
import {
  buildShopModel,
  focusedSlotIndex,
  initialOfferFocus,
  tagPreview,
} from '../presenters/shop.ts';
import type { OfferCard, ShopModel, TagPreview } from '../presenters/shop.ts';
import { glintAmount, iconBox, panel, rarityPips, rowCard, tagChip } from './components.ts';
import { CHOICE_LOCK_MS } from './types.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

const GROUP_OFFERS = 0;
const GROUP_SLOTS = 1;
const GROUP_BAR = 2;
/** Portrait box in UI units (style guide 1.4: 48 x 48 sprite px). */
const PORTRAIT_UNITS = 48;

export function createGlazierScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-glazier');
  const focus = ctx.newFocusList();
  let model: ShopModel | null = null;
  let revision = -1;
  let glint = NaN;
  let showStats = false;
  /** Inventory slot that the Sell and Fuse bar buttons act on (last focused slot), -1 none. */
  let selectedSlot = -1;
  let visitPulse = -1;
  let lineKey: string | null = null;

  // Left column: portrait, line, tags. Built once; tags re-render per focus.
  const left = h(doc, 'div', 'shop-left');
  const glazier = panel(ctx, 'glazier-card', true);
  const portrait = h(doc, 'span', 'portrait');
  const art = ctx.icons.portrait(doc, 'glazier', PORTRAIT_UNITS);
  if (art !== null) {
    portrait.classList.add('has-art');
    portrait.appendChild(art);
  } else {
    // Fallback mask until AD's portrait lands: a framed pane with a cut-glass mask (CSS only).
    portrait.appendChild(h(doc, 'span', 'portrait-mask'));
  }
  portrait.setAttribute('aria-hidden', 'true');
  const lineEl = h(doc, 'p', 'glazier-line');
  put(glazier, portrait, put(h(doc, 'div', 'glazier-say'), lineEl));
  const tagPanel = panel(ctx, 'shop-tags');
  put(left, glazier, tagPanel);
  /** Compact tag strip in the top bar for Large and Largest text (ui-spec 7.3). */
  const tagStrip = h(doc, 'span', 'tag-strip');

  /** data-ui of the focused control inside this screen, '' when none. */
  const focusedUi = (): string => {
    const a = doc.activeElement;
    return a instanceof HTMLElement && el.contains(a) ? (a.dataset['ui'] ?? '') : '';
  };
  const infoLine = h(doc, 'p', 'info-line');

  const send = ctx.deps.commands;

  const say = (key: string | null): void => {
    lineKey = key;
    setText(lineEl, key === null ? '' : t(key));
    glazier.classList.toggle('is-silent', key === null);
  };

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
    tagStrip.textContent = '';
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
        tagChip(ctx, r.tag),
        h(doc, 'span', 'tag-name', t(tagNameKey(r.tag))),
        h(doc, 'span', 'tag-count', next > 0 ? `${String(shown)}/${String(next)}` : String(shown)),
        pips,
      );
      if (p !== undefined && p.isNewTag)
        row.appendChild(h(doc, 'span', 'tag-new', t('ui.shop.tag_new')));
      tagPanel.appendChild(row);
      const mini = h(doc, 'span', `tag-mini${add > 0 ? ' is-preview' : ''}`);
      put(
        mini,
        tagChip(ctx, r.tag),
        h(doc, 'span', 'tag-count', next > 0 ? `${String(shown)}/${String(next)}` : String(shown)),
      );
      tagStrip.appendChild(mini);
    }
  };

  const markSelected = (slot: number): void => {
    selectedSlot = slot;
    el.querySelectorAll('.slot.is-selected').forEach((n) => {
      n.classList.remove('is-selected');
    });
    if (slot >= 0)
      el.querySelector(`[data-ui="shop-slot-${String(slot + 1)}"]`)?.classList.add('is-selected');
    const s = slot >= 0 ? model?.inventory[slot] : undefined;
    const has = s !== undefined && !s.empty;
    el.querySelector('[data-ui="shop-sell"]')?.classList.toggle('is-idle', !has);
    el.querySelector('[data-ui="shop-fuse"]')?.classList.toggle('is-idle', s?.canFuse !== true);
  };

  const focusOffer = (o: OfferCard): void => {
    if (model === null) return;
    // Sell and Fuse never act on a slot while an offer has focus (review M1 LP).
    markSelected(-1);
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
    markSelected(slot);
    renderTags([]);
    el.querySelectorAll('.slot.is-fuse-target').forEach((n) => {
      n.classList.remove('is-fuse-target');
    });
    const s = model?.inventory[slot];
    if (s === undefined || s.item === null) {
      infoLine.textContent = '';
      return;
    }
    infoLine.textContent = `${t(s.item.nameKey)} ${ctx.tier(s.tier)}  ${t('ui.shop.sell_for', { n: s.sellPrice })}`;
  };

  const statsList = (col: HTMLElement, view: WorldView): void => {
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
  };

  const rightColumn = (m: ShopModel, view: WorldView, side: boolean): HTMLElement => {
    const col = panel(ctx, side ? 'shop-right is-side' : 'shop-right');
    if (showStats && !side) {
      statsList(col, view);
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
        const name = t(s.item.nameKey);
        put(
          b,
          iconBox(ctx, { kind: 'weapon', id: s.item.id }, name, s.item.tags, 'small'),
          h(doc, 'span', 'slot-tier', ctx.tier(s.tier)),
        );
        b.setAttribute('aria-label', `${name} ${ctx.tier(s.tier)}`);
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
      const name = t(mc.item.nameKey);
      const row = h(doc, 'div', `memento-row rarity-${String(mc.rarityOrder)}`);
      put(
        row,
        iconBox(ctx, { kind: 'memento', id: mc.item.id }, name, mc.item.tags, 'small'),
        rarityPips(ctx, mc.rarityOrder, true),
        h(doc, 'span', 'memento-name', name),
      );
      if (mc.count > 1) row.appendChild(h(doc, 'span', 'num', `x${String(mc.count)}`));
      list.appendChild(row);
    }
    col.appendChild(list);
    if (side) {
      // Largest text: the inventory replaces the offers, so Stats share this view.
      const stats = h(doc, 'div', 'side-stats');
      statsList(stats, view);
      col.appendChild(stats);
    }
    return col;
  };

  const build = (view: WorldView): void => {
    const prevUi = focusedUi();
    const prevSlot = selectedSlot;
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
      tagStrip,
      put(h(doc, 'span', 'shop-glint'), glintAmount(ctx, m.glint, true, 16)),
    );
    // Largest text (ui-spec 7.3): offers use the whole width; T swaps them for the inventory.
    const largest = deps.settings().access.textScale === 2;
    const sideView = largest && showStats;

    const offers = h(doc, 'div', 'shop-offers');
    let firstIndex = -1;
    (sideView ? [] : m.offers).forEach((o) => {
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
          icon: { kind: o.isWeapon ? 'weapon' : 'memento', id: o.item.id },
          tierText: o.isWeapon ? ctx.tier(o.tier) : '',
          hotkey: o.slot + 1,
          price: o.price,
          affordable: o.affordable,
          badge,
          locked: o.locked,
          order: o.slot,
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

    const right = largest && !showStats ? null : rightColumn(m, view, sideView);

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

    put(
      el,
      put(safe, top, put(h(doc, 'div', 'shop-cols'), left, sideView ? null : offers, right), bar),
    );

    // Keep focus on the same control across rebuilds (a bought card stays in place as Taken).
    const prevEl = prevUi === '' ? null : el.querySelector<HTMLElement>(`[data-ui="${prevUi}"]`);
    const keepIndex = prevEl === null ? -1 : focus.indexOf(prevEl);
    const start = keepIndex >= 0 ? keepIndex : firstIndex >= 0 ? firstIndex : beginIndex;
    infoLine.textContent = '';
    renderTags([]);
    focus.focus(start, true);
    // Focus on a slot or an offer already set the selection; on the bar the last slot stays
    // selected while it still holds a weapon (Sell or Fuse clicked from the bar).
    const fu = focusedUi();
    if (focusedSlotIndex(fu) < 0 && !/^shop-(?:offer|lock)-/.test(fu)) {
      const s = m.inventory[prevSlot];
      markSelected(s !== undefined && !s.empty ? prevSlot : -1);
    }
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

  /** Hotkeys X and M act on the focused slot only; elsewhere they explain why not. */
  const slotHotkey = (run: (slot: number) => void): void => {
    const slot = focusedSlotIndex(focusedUi());
    if (slot < 0) {
      denied('ui.common.denied');
      return;
    }
    run(slot);
  };

  const react = (view: WorldView, events: SimEventReader): void => {
    for (let i = 0; i < events.count; i++) {
      const trig = reactionTrigger(events.type[i] ?? 0, events.a[i] ?? 0);
      if (trig !== null) say(pickLine(trig, view.shop.revision, ctx.has));
    }
  };

  return {
    el,
    focus,
    enter() {
      showStats = false;
      revision = -1;
      selectedSlot = -1;
      const v = ctx.view();
      if (v !== null) {
        // A new visit picks the opening line; returning from pause keeps the current line.
        if (v.pulse.index !== visitPulse || lineKey === null) {
          visitPulse = v.pulse.index;
          const flags = ctx.visit();
          say(
            pickLine(
              openingTrigger({
                pulseIndex: v.pulse.index,
                sawReward: flags.sawReward,
                sawTemper: flags.sawTemper,
              }),
              v.pulse.index,
              ctx.has,
            ),
          );
        }
        build(v);
      }
      ctx.lockInput(CHOICE_LOCK_MS);
    },
    update(view, events) {
      react(view, events);
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
        slotHotkey(sell);
        return true;
      }
      if (ctx.matches('merge', e)) {
        slotHotkey(fuse);
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
