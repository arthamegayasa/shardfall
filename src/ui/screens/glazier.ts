// S05 Shop (redesign-1.1 3.1; was The Glazier, ui-spec S05). Header: title, next Wave of the run,
// HP, gold. The Glazier shrinks to one strip (portrait and one spoken line). Left: offers as glass
// panes in a 2-column grid; each pane says in one plain line what buying it does, carries its
// price in the Buy pill, and has a labelled Lock toggle on its lower right. Right: weapon slots
// with the selected slot's detail, relics, synergies. Bottom: Reroll, Sell, Combine, Stats and the
// one primary, Start Wave. The sim validates every command (UI reads, sim decides).

import { OfferKind, SimEventType } from '../../core/index.ts';
import type { SimEventReader, WorldView } from '../../core/index.ts';
import type { TagId } from '../../content/index.ts';
import { Cue } from '../cues.ts';
import { button, h, put, setText, withHint } from '../dom.ts';
import { formatInt, formatStatValue } from '../format.ts';
import type { IconRef } from '../icons.ts';
import { mementoInfo, synergiesOf, weaponInfo } from '../presenters/content.ts';
import { openingTrigger, pickLine, reactionTrigger } from '../presenters/glazier-line.ts';
import {
  buildShopModel,
  focusedSlotIndex,
  initialOfferFocus,
  purchaseToast,
  slotCombine,
  tagNextStep,
  tagPreview,
} from '../presenters/shop.ts';
import type { OfferCard, ShopModel, TagPreview } from '../presenters/shop.ts';
import { moreAbove, moreBelow, scrollStep } from '../scroll.ts';
import { glintAmount, iconBox, pane, panel, rarityPips, tagChip } from './components.ts';
import { CHOICE_LOCK_MS } from './types.ts';
import type { Screen, UiContext } from './types.ts';

const GROUP_OFFERS = 0;
const GROUP_SLOTS = 1;
const GROUP_BAR = 2;
/** Portrait sprite box in UI units (style guide 1.4), drawn at half size in the strip. */
const PORTRAIT_UNITS = 48;
const FACE_UNITS = 24;
/** Purchase motion (redesign-1.1 2): pane flash and icon flight to its slot. */
const FLY_MS = 250;
/** How long the purchase toast stays. */
const TOAST_MS = 3200;

interface Bought {
  readonly kind: number;
  readonly def: number;
  /** Tier from an ItemMerged event of the same purchase, 0 when none. */
  readonly mergedTier: number;
}

export function createGlazierScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-glazier');
  const focus = ctx.newFocusList();
  let model: ShopModel | null = null;
  let revision = -1;
  let glint = NaN;
  let showStats = false;
  /** Inventory slot that the Sell and Combine bar buttons act on (last focused slot), -1 none. */
  let selectedSlot = -1;
  let visitPulse = -1;
  let lineKey: string | null = null;
  /** The one staggered card entry plays on shop entry only, not on rebuilds after a purchase. */
  let revealNext = false;
  /** Set by T so the rebuild that hides the focused control focuses the Stats button. */
  let statsToggled = false;
  let toastTimer = 0;
  /** Parts of the current build that previews write into (null when hidden). */
  let tagBox: HTMLElement | null = null;
  let detailBox: HTMLElement | null = null;
  let offersBox: HTMLElement | null = null;
  /** Stats list of the Largest-text side view; Up and Down on Stats scroll it. */
  let statsBox: HTMLElement | null = null;

  // The Glazier strip: a small crop of the portrait and one dim line. Built once.
  const strip = h(doc, 'div', 'glazier-strip');
  const face = h(doc, 'span', 'glazier-face');
  const art = ctx.icons.portrait(doc, 'glazier', PORTRAIT_UNITS);
  if (art !== null) {
    // Half scale: the strip is one line tall; the silhouette (hat, mask, lantern) still reads.
    art.style.width = `calc(var(--u) * ${String(FACE_UNITS)})`;
    art.style.height = `calc(var(--u) * ${String(FACE_UNITS)})`;
    face.classList.add('has-art');
    face.appendChild(art);
  } else {
    // Fallback mask until AD's portrait lands: a framed pane with a cut-glass mask (CSS only).
    face.appendChild(h(doc, 'span', 'portrait-mask'));
  }
  face.setAttribute('aria-hidden', 'true');
  const lineEl = h(doc, 'p', 'glazier-line');
  put(strip, face, lineEl);

  const infoLine = h(doc, 'p', 'info-line');
  const toastEl = h(doc, 'div', 'shop-toast');
  // The live region reads the purchase (ctx.announce); the toast is the visible twin.
  toastEl.setAttribute('aria-hidden', 'true');

  /** data-ui of the focused control inside this screen, '' when none. */
  const focusedUi = (): string => {
    const a = doc.activeElement;
    return a instanceof HTMLElement && el.contains(a) ? (a.dataset['ui'] ?? '') : '';
  };

  const send = ctx.deps.commands;

  const say = (key: string | null): void => {
    lineKey = key;
    setText(lineEl, key === null ? '' : t(key));
    strip.classList.toggle('is-silent', key === null);
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

  const calm = (): boolean =>
    deps.settings().access.reduceEffects ||
    (doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false);

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

  /** Effect text of a tag's next synergy step ("At 2: ..."), '' when it has none left. */
  const nextStepText = (tag: TagId, count: number): string => {
    const step = tagNextStep(deps.data, tag, count);
    if (step === null || step.reached) return '';
    return t('ui.shop.syn_next', { n: step.threshold, effect: t(step.descKey, step.params) });
  };

  /**
   * Synergies panel. `preview` adds the focused offer's tags (ghost pips, unlock line); `explain`
   * lists the tags whose next step is spelled out (the focused offer's or slot's tags).
   */
  const renderTags = (preview: readonly TagPreview[], explain: readonly TagId[]): void => {
    if (model === null || tagBox === null) return;
    const box = tagBox;
    box.replaceChildren();
    const rows = model.tags.map((r) => ({ tag: r.tag, count: r.count, thresholds: r.thresholds }));
    for (const p of preview) {
      if (p.isNewTag && p.newCount > 0)
        rows.push({
          tag: p.tag,
          count: 0,
          thresholds: synergiesOf(deps.data, p.tag).map((s) => s.threshold),
        });
    }
    if (rows.length === 0) {
      box.appendChild(h(doc, 'p', 'side-empty', t('ui.shop.syn_empty')));
      return;
    }
    for (const r of rows) {
      const p = preview.find((x) => x.tag === r.tag);
      const add = p === undefined ? 0 : p.newCount - p.count;
      const shown = r.count + add;
      const row = h(doc, 'div', `tag-row tag-${r.tag}`);
      if (add > 0) row.classList.add('is-preview');
      const next =
        r.thresholds.find((th) => th > r.count) ?? r.thresholds[r.thresholds.length - 1] ?? 0;
      const pips = h(doc, 'span', 'tag-pips');
      pips.setAttribute('aria-hidden', 'true');
      for (const th of r.thresholds) {
        const pip = h(doc, 'span', 'tag-pip');
        if (r.count >= th) pip.classList.add('is-full');
        else if (shown >= th) pip.classList.add('is-ghost');
        pips.appendChild(pip);
      }
      put(
        row,
        tagChip(ctx, r.tag),
        h(doc, 'span', 'tag-count', next > 0 ? `${String(shown)}/${String(next)}` : String(shown)),
        pips,
      );
      if (p !== undefined && p.unlockDescKey !== null) {
        row.classList.add('is-unlock');
        row.appendChild(
          h(
            doc,
            'p',
            'tag-next',
            t('ui.shop.tag_unlocks', { effect: t(p.unlockDescKey, p.unlockParams) }),
          ),
        );
      } else if (explain.includes(r.tag)) {
        const text = nextStepText(r.tag, shown);
        if (text !== '') row.appendChild(h(doc, 'p', 'tag-next', text));
      }
      box.appendChild(row);
    }
  };

  /** Selected weapon slot: name, tier, what it does, Sell price, Combine availability. */
  const renderDetail = (slot: number): void => {
    if (detailBox === null) return;
    const box = detailBox;
    box.replaceChildren();
    const s = slot >= 0 ? model?.inventory[slot] : undefined;
    if (s === undefined || s.item === null) {
      box.classList.remove('has-item');
      box.appendChild(h(doc, 'p', 'detail-hint', t('ui.shop.slot_hint')));
      return;
    }
    box.classList.add('has-item');
    const c = slotCombine(s);
    const combine = h(doc, 'p', `detail-combine${c.ready ? ' is-ready' : ''}`);
    put(
      combine,
      h(doc, 'span', 'out-glyph'),
      h(doc, 'span', '', t(c.key, { tier: ctx.tier(c.tier) })),
    );
    const sellLine = h(doc, 'p', 'detail-sell');
    put(
      sellLine,
      h(doc, 'span', '', t('ui.shop.sell')),
      glintAmount(ctx, s.sellPrice),
      h(doc, 'span', 'key-hint', `[${ctx.keyHint('sell')}]`),
    );
    put(
      box,
      put(
        h(doc, 'p', 'detail-name'),
        h(doc, 'span', 'detail-title', t(s.item.nameKey)),
        h(doc, 'span', 'detail-tier', ctx.tier(s.tier)),
      ),
      h(doc, 'p', 'detail-desc', t(s.item.descKey, s.item.params)),
      sellLine,
      combine,
    );
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
    renderDetail(has ? slot : -1);
  };

  const clearFuseTarget = (): void => {
    el.querySelectorAll('.slot.is-fuse-target').forEach((n) => {
      n.classList.remove('is-fuse-target');
    });
  };

  /** Keeps a focused offer inside the scrolling offer area (Large and Largest text). */
  const revealInOffers = (node: HTMLElement): void => {
    const box = offersBox;
    if (box === null || box.scrollHeight <= box.clientHeight + 1) return;
    const b = box.getBoundingClientRect();
    const r = (node.closest('.offer') ?? node).getBoundingClientRect();
    if (r.top < b.top) box.scrollTop -= b.top - r.top;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom;
    syncScrollMarks();
  };

  const syncScrollMarks = (): void => {
    const box = offersBox;
    if (box === null) return;
    const m = { top: box.scrollTop, client: box.clientHeight, height: box.scrollHeight };
    box.parentElement?.classList.toggle('more-above', moreAbove(m));
    box.parentElement?.classList.toggle('more-below', moreBelow(m));
  };

  const syncStatsMarks = (): void => {
    const box = statsBox;
    if (box === null) return;
    const m = { top: box.scrollTop, client: box.clientHeight, height: box.scrollHeight };
    box.classList.toggle('more-above', moreAbove(m));
    box.classList.toggle('more-below', moreBelow(m));
  };

  /** Up or Down on the Stats button scrolls the side-view stats; null at the edge (moves on). */
  const scrollStats = (dir: -1 | 1): boolean => {
    const box = statsBox;
    if (box === null || focusedUi() !== 'shop-stats') return false;
    const m = { top: box.scrollTop, client: box.clientHeight, height: box.scrollHeight };
    const next = scrollStep(m, dir, Math.max(1, Math.floor(box.clientHeight / 2)));
    if (next === null) return false;
    box.scrollTop = next;
    syncStatsMarks();
    return true;
  };

  const focusOffer = (o: OfferCard, node: HTMLElement): void => {
    if (model === null) return;
    // Sell and Combine never act on a slot while an offer has focus (review M1 LP).
    markSelected(-1);
    renderTags(tagPreview(model, deps.data, o), o.item?.tags ?? []);
    infoLine.textContent = '';
    clearFuseTarget();
    if (o.fuseSlot >= 0)
      el.querySelector(`[data-ui="shop-slot-${String(o.fuseSlot + 1)}"]`)?.classList.add(
        'is-fuse-target',
      );
    revealInOffers(node);
  };

  const focusSlot = (slot: number): void => {
    markSelected(slot);
    clearFuseTarget();
    infoLine.textContent = '';
    renderTags([], model?.inventory[slot]?.item?.tags ?? []);
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

  const sideTitle = (key: string, extra: HTMLElement | null = null): HTMLElement =>
    put(h(doc, 'div', 'side-head'), h(doc, 'h3', 'col-title', t(key)), extra);

  const slotRow = (m: ShopModel): HTMLElement => {
    const grid = h(doc, 'div', 'slot-row');
    m.inventory.forEach((s) => {
      const b = button(
        doc,
        `shop-slot-${String(s.slot + 1)}`,
        '',
        `slot rarity-${String(Math.max(0, s.tier - 1))}`,
      );
      b.textContent = '';
      if (s.empty || s.item === null) {
        b.classList.add('is-empty');
        b.setAttribute('aria-label', t('ui.shop.slot_empty'));
      } else {
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
    return grid;
  };

  const relicList = (m: ShopModel): HTMLElement => {
    const owned = m.mementos.filter((mc) => mc.item !== null);
    if (owned.length === 0) return h(doc, 'p', 'side-empty', t('ui.shop.relics_empty'));
    const list = h(doc, 'div', 'relic-row');
    for (const mc of owned) {
      if (mc.item === null) continue;
      const name = t(mc.item.nameKey);
      const chip = h(doc, 'span', `relic-chip rarity-${String(mc.rarityOrder)}`);
      chip.dataset['relic'] = String(mc.mementoIndex);
      chip.title = name;
      put(
        chip,
        iconBox(ctx, { kind: 'memento', id: mc.item.id }, name, mc.item.tags, 'small'),
        rarityPips(ctx, mc.rarityOrder, true),
      );
      if (mc.count > 1) chip.appendChild(h(doc, 'span', 'relic-count', `x${String(mc.count)}`));
      list.appendChild(chip);
    }
    return list;
  };

  const rightColumn = (m: ShopModel, view: WorldView, side: boolean): HTMLElement => {
    const col = panel(ctx, side ? 'shop-side is-side' : 'shop-side');
    tagBox = null;
    detailBox = null;
    if (showStats && !side) {
      statsList(col, view);
      return col;
    }
    const weapons = h(doc, 'section', 'side-block side-weapons');
    const count = h(
      doc,
      'span',
      'chip slot-count',
      t('ui.shop.slots_count', { n: m.weaponsOwned, max: m.weaponSlots }),
    );
    detailBox = h(doc, 'div', 'slot-detail');
    put(
      weapons,
      sideTitle('ui.shop.weapons', count),
      slotRow(m),
      h(doc, 'p', 'fire-note', t('ui.shop.fire_note')),
      detailBox,
    );
    const relics = put(
      h(doc, 'section', 'side-block side-relics'),
      sideTitle('ui.shop.mementos'),
      relicList(m),
    );
    tagBox = h(doc, 'div', 'tag-list');
    const syn = put(h(doc, 'section', 'side-block side-syn'), sideTitle('ui.shop.tags'), tagBox);
    if (!side) return put(col, weapons, relics, syn);
    // Largest text: the inventory replaces the offers, so Stats share this view (two columns).
    const stats = h(doc, 'div', 'side-stats');
    statsList(stats, view);
    statsBox = stats;
    stats.addEventListener('scroll', syncStatsMarks, { passive: true });
    return put(col, put(h(doc, 'div', 'side-left'), weapons, relics, syn), stats);
  };

  /** Tooltip on a tag chip: what the tag's synergy does next (hover; focus shows it in the panel). */
  const chipTitle = (m: ShopModel, tag: TagId): string => {
    const count = m.tags.find((r) => r.tag === tag)?.count ?? 0;
    const text = nextStepText(tag, count);
    return text === '' ? t(`tag.${tag}.name`) : `${t(`tag.${tag}.name`)}: ${text}`;
  };

  const outcomeText = (o: OfferCard): string => {
    const out = o.outcome;
    if (out === null) return '';
    return t(out.key, { n: out.count, tier: ctx.tier(out.tier) });
  };

  interface OfferParts {
    readonly wrap: HTMLElement;
    readonly card: HTMLButtonElement;
    readonly lock: HTMLButtonElement;
  }

  const lockToggle = (o: OfferCard): HTMLButtonElement => {
    const lock = button(doc, `shop-lock-${String(o.slot + 1)}`, '', 'lock-toggle');
    const word = t(o.locked ? 'ui.shop.locked' : 'ui.shop.lock');
    const glyph = h(doc, 'span', 'lock-glyph');
    glyph.setAttribute('aria-hidden', 'true');
    lock.replaceChildren(glyph, h(doc, 'span', 'btn-label', word));
    lock.classList.toggle('is-closed', o.locked);
    lock.setAttribute('aria-pressed', o.locked ? 'true' : 'false');
    if (o.item === null) {
      lock.disabled = true;
      lock.classList.add('is-off');
    } else lock.setAttribute('aria-label', `${word} ${t(o.item.nameKey)}`);
    return lock;
  };

  /**
   * One offer as a glass pane: the strip, then the card button (what it is, what buying it does,
   * the Buy pill with the price), then the Lock toggle across the pane's foot. The card and the
   * lock are sibling buttons stacked in one column, so Up and Down step card, lock, next card and
   * back the same way (BUG-010 rule).
   */
  const offerPane = (o: OfferCard, m: ShopModel): OfferParts => {
    const dataUi = `shop-offer-${String(o.slot + 1)}`;
    const lock = lockToggle(o);
    if (o.item === null) {
      const card = button(
        doc,
        dataUi,
        o.state === 'taken' ? t('ui.shop.taken') : '',
        'offer-card card-empty is-unaffordable',
      );
      return { wrap: put(h(doc, 'div', 'offer is-empty'), card, lock), card, lock };
    }
    const isWeapon = o.isWeapon;
    const p = pane(
      doc,
      isWeapon ? 'weapon' : 'relic',
      t(isWeapon ? 'ui.shop.cat_weapon' : 'ui.shop.cat_relic'),
      t(o.isNewId ? 'ui.shop.tag_new' : 'ui.shop.owned'),
    );
    const wrap = p.root;
    wrap.classList.add('offer', `rarity-${String(o.rarityOrder)}`);
    const key = h(doc, 'span', 'offer-key', String(o.slot + 1));
    key.setAttribute('aria-hidden', 'true');
    p.strip.prepend(key);
    const name = t(o.item.nameKey);
    const ref: IconRef = { kind: isWeapon ? 'weapon' : 'memento', id: o.item.id };
    const nameRow = put(
      h(doc, 'span', 'offer-name-row'),
      h(doc, 'span', 'offer-name', name),
      isWeapon
        ? h(doc, 'span', 'offer-tier', ctx.tier(o.tier))
        : rarityPips(ctx, o.rarityOrder, true),
    );
    const chips = h(doc, 'span', 'offer-tags');
    for (const tag of o.item.tags) {
      const chip = tagChip(ctx, tag);
      chip.title = chipTitle(m, tag);
      chips.appendChild(chip);
    }
    const head = put(
      h(doc, 'span', 'offer-head'),
      iconBox(ctx, ref, name, o.item.tags, 'big'),
      put(h(doc, 'span', 'offer-title'), nameRow, chips),
    );
    const desc = h(doc, 'span', 'offer-desc', t(o.item.descKey, o.item.params));
    const flavorKey = o.item.flavorKey;
    const flavor =
      flavorKey !== null && deps.settings().access.showFlavor
        ? h(doc, 'span', 'offer-flavor', t(flavorKey))
        : null;
    const outcome = put(
      h(doc, 'span', `offer-outcome is-${o.outcome?.kind ?? 'none'}`),
      h(doc, 'span', 'out-glyph'),
      h(doc, 'span', 'out-text', outcomeText(o)),
    );
    const need =
      !o.affordable && !o.blockedNoSlot
        ? t('ui.shop.need_gold', { n: Math.max(1, o.price - m.glint) })
        : '';
    // The Buy pill is drawn for the eye (aria-hidden); screen readers get the price as words.
    const sr = h(
      doc,
      'span',
      'shop-sr',
      `${t('ui.shop.buy')} ${t('ui.common.glint', { n: o.price })}${need === '' ? '' : `. ${need}`}`,
    );
    const pill = put(
      h(doc, 'span', 'buy-pill'),
      h(doc, 'span', 'buy-word', t('ui.shop.buy')),
      glintAmount(ctx, o.price, o.buyable),
    );
    const cost = put(h(doc, 'span', 'offer-cost'), pill);
    if (need !== '') cost.appendChild(h(doc, 'span', 'need-gold', need));
    cost.setAttribute('aria-hidden', 'true');
    const card = button(doc, dataUi, '', 'offer-card');
    card.replaceChildren(head, desc);
    put(card, flavor, outcome, cost, sr);
    put(p.body, card, put(h(doc, 'span', 'offer-foot'), lock));
    if (!o.buyable) {
      card.classList.add('is-unaffordable');
      wrap.classList.add('is-unaffordable');
    }
    if (o.blockedNoSlot) wrap.classList.add('is-blocked');
    if (o.locked) wrap.classList.add('is-locked');
    // The strip belongs to the card: a click there buys like a click on the card.
    wrap.addEventListener('click', (e) => {
      const target = e.target;
      if (target instanceof Node && (card.contains(target) || lock.contains(target))) return;
      card.click();
    });
    wrap.addEventListener('mouseenter', () => {
      const i = focus.indexOf(card);
      if (i >= 0 && focus.index !== i && focus.index !== focus.indexOf(lock)) focus.focus(i);
    });
    return { wrap, card, lock };
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
    const gold = put(
      h(doc, 'span', 'shop-glint'),
      glintAmount(ctx, m.glint, true, 16),
      h(doc, 'span', 'gold-word', t('ui.shop.gold_word')),
    );
    const top = put(
      h(doc, 'div', 'shop-top'),
      h(doc, 'h1', 'heading', t('ui.shop.title')),
      h(doc, 'span', 'shop-next', t('ui.shop.next_of', { n: m.nextPulse, total: m.totalPulses })),
      h(doc, 'span', 'shop-hp', t('ui.shop.hp', { hp: formatInt(m.hp), max: formatInt(m.maxHp) })),
      gold,
    );
    // Largest text (ui-spec 7.3): offers use the whole width; T swaps them for the inventory.
    const largest = deps.settings().access.textScale === 2;
    const sideView = largest && showStats;

    const main = h(doc, 'section', 'shop-main');
    const offers = h(doc, 'div', 'shop-offers');
    offersBox = sideView ? null : offers;
    let firstIndex = -1;
    (sideView ? [] : m.offers).forEach((o) => {
      const { wrap, card, lock } = offerPane(o, m);
      if (revealNext) {
        wrap.classList.add('reveal');
        wrap.style.setProperty('--i', String(o.slot));
      }
      offers.appendChild(wrap);
      const ci = focus.add({
        el: card,
        group: GROUP_OFFERS,
        activate: () => {
          buy(o);
        },
        onFocus: () => {
          focusOffer(o, card);
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
            focusOffer(o, lock);
          },
        });
      }
      if (firstIndex < 0 && o.slot === initialOfferFocus(m)) firstIndex = ci;
    });
    revealNext = false;
    offers.addEventListener('scroll', syncScrollMarks, { passive: true });
    if (!sideView) put(main, h(doc, 'h2', 'col-title', t('ui.shop.for_sale')), offers, toastEl);

    tagBox = null;
    detailBox = null;
    statsBox = null;
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
    statsBtn.setAttribute('aria-pressed', showStats ? 'true' : 'false');
    statsBtn.classList.toggle('is-on', showStats);
    const beginBtn = withHint(
      doc,
      button(doc, 'shop-begin', t('ui.shop.begin_n', { n: m.nextPulse }), 'primary'),
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
    const statsIndex = focus.add({
      el: statsBtn,
      group: GROUP_BAR,
      activate: () => {
        toggleStats();
      },
    });
    const beginIndex = focus.add({ el: beginBtn, group: GROUP_BAR, activate: begin });

    const cols = put(h(doc, 'div', 'shop-cols'), sideView ? null : main, right);
    put(el, put(safe, top, strip, cols, bar, sideView ? toastEl : null));
    syncScrollMarks();
    syncStatsMarks();

    // Keep focus on the same control across rebuilds (a bought card stays in place as Taken).
    const prevEl = prevUi === '' ? null : el.querySelector<HTMLElement>(`[data-ui="${prevUi}"]`);
    const keepIndex = prevEl === null ? -1 : focus.indexOf(prevEl);
    // T hides the focused offer or slot: focus lands on Stats (Up and Down scroll the side stats).
    const fallback = statsToggled ? statsIndex : firstIndex >= 0 ? firstIndex : beginIndex;
    statsToggled = false;
    const start = keepIndex >= 0 ? keepIndex : fallback;
    infoLine.textContent = '';
    renderTags([], []);
    renderDetail(-1);
    focus.focus(start, true);
    // Focus on a slot or an offer already set the selection; on the bar the last slot stays
    // selected while it still holds a weapon (Sell or Combine clicked from the bar).
    const fu = focusedUi();
    if (focusedSlotIndex(fu) < 0 && !/^shop-(?:offer|lock)-/.test(fu)) {
      const s = m.inventory[prevSlot];
      markSelected(s !== undefined && !s.empty ? prevSlot : -1);
      renderTags([], []);
    }
  };

  const toggleStats = (): void => {
    showStats = !showStats;
    statsToggled = true;
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

  /** The purchase in this frame's events (ItemBought, plus ItemMerged of the same item). */
  const boughtIn = (events: SimEventReader): Bought | null => {
    let bought: Bought | null = null;
    for (let i = 0; i < events.count; i++) {
      if (events.type[i] !== SimEventType.ItemBought) continue;
      const def = events.b[i] ?? -1;
      let mergedTier = 0;
      // The sim pushes ItemMerged (a = weapon, b = new tier) right before a combining purchase.
      for (let j = 0; j < i; j++)
        if (events.type[j] === SimEventType.ItemMerged && events.a[j] === def)
          mergedTier = events.b[j] ?? 0;
      bought = { kind: events.a[i] ?? 0, def, mergedTier };
    }
    return bought;
  };

  const showToast = (text: string): void => {
    const win = doc.defaultView;
    toastEl.textContent = text;
    toastEl.classList.remove('is-on');
    // Restart the entry animation for a second purchase while the toast still shows.
    toastEl.getBoundingClientRect();
    toastEl.classList.add('is-on');
    if (win === null) return;
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(() => {
      toastEl.classList.remove('is-on');
    }, TOAST_MS);
  };

  /** Icon of the bought card flies into its slot (or relic row); the Taken pane flashes once. */
  const flyIcon = (
    from: DOMRect | undefined,
    target: Element | null,
    ref: IconRef,
    o: OfferCard,
  ) => {
    const taken = el.querySelector(`[data-ui="shop-offer-${String(o.slot + 1)}"]`);
    target?.classList.add('is-new');
    if (calm() || from === undefined || target === null || o.item === null) return;
    taken?.classList.add('is-flash');
    const to = target.getBoundingClientRect();
    const base = el.getBoundingClientRect();
    const fly = iconBox(ctx, ref, t(o.item.nameKey), o.item.tags, 'big');
    fly.classList.add('shop-fly');
    fly.style.left = `${String(from.left - base.left)}px`;
    fly.style.top = `${String(from.top - base.top)}px`;
    el.appendChild(fly);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const k = Math.max(0.3, Math.min(1, to.width / Math.max(1, from.width)));
    if (typeof fly.animate !== 'function') {
      fly.remove();
      return;
    }
    const anim = fly.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        {
          transform: `translate(${String(dx)}px, ${String(dy)}px) scale(${String(k)})`,
          opacity: 0.4,
        },
      ],
      { duration: FLY_MS, easing: 'ease-in' },
    );
    anim.onfinish = () => {
      fly.remove();
    };
  };

  const afterPurchase = (b: Bought, prev: ShopModel, iconRects: Map<number, DOMRect>): void => {
    const m = model;
    if (m === null) return;
    const isWeapon = b.kind === OfferKind.Weapon;
    const state = isWeapon ? 'weapon' : 'memento';
    const same = prev.offers.filter((o) => o.state === state && o.defIndex === b.def);
    const offer = same.find((o) => m.offers[o.slot]?.state === 'taken') ?? same[0];
    const info =
      offer?.item ?? (isWeapon ? weaponInfo(deps.data, b.def) : mementoInfo(deps.data, b.def));
    if (info === null) return;
    const combinedTier =
      b.mergedTier > 0 ? b.mergedTier : offer?.outcome?.kind === 'combine' ? offer.outcome.tier : 0;
    const line = purchaseToast({
      isWeapon,
      nameKey: info.nameKey,
      combinedTier,
      weaponsOwned: m.weaponsOwned,
      relicCount: m.mementos.find((x) => x.mementoIndex === b.def)?.count ?? 1,
    });
    const text = t(line.key, { name: t(line.nameKey), n: line.count, tier: ctx.tier(line.tier) });
    showToast(text);
    ctx.announce(`${text} ${t('ui.shop.gold_left', { n: m.glint })}`);
    if (offer === undefined) return;
    let target: Element | null = null;
    if (isWeapon) {
      const changed = m.inventory.findIndex((s, i) => {
        const p = prev.inventory[i];
        return p !== undefined && (p.item?.id !== s.item?.id || p.tier !== s.tier);
      });
      if (changed >= 0) target = el.querySelector(`[data-ui="shop-slot-${String(changed + 1)}"]`);
    } else {
      target =
        el.querySelector(`.relic-chip[data-relic="${String(b.def)}"]`) ??
        el.querySelector('.side-relics');
    }
    flyIcon(
      iconRects.get(offer.slot),
      target,
      { kind: isWeapon ? 'weapon' : 'memento', id: info.id },
      offer,
    );
  };

  /** Where each offer's icon sits before a rebuild (the flight starts there). */
  const offerIconRects = (): Map<number, DOMRect> => {
    const out = new Map<number, DOMRect>();
    el.querySelectorAll<HTMLElement>('[data-ui^="shop-offer-"]').forEach((card) => {
      const n = Number(/(\d+)$/.exec(card.dataset['ui'] ?? '')?.[1] ?? '0') - 1;
      const icon = card.querySelector('.icon');
      if (n >= 0 && icon !== null) out.set(n, icon.getBoundingClientRect());
    });
    return out;
  };

  return {
    el,
    focus,
    enter() {
      showStats = false;
      revision = -1;
      selectedSlot = -1;
      revealNext = true;
      toastEl.classList.remove('is-on');
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
      const bought = boughtIn(events);
      const prev = model;
      const rects = bought === null ? null : offerIconRects();
      if (view.shop.revision !== revision || view.player.glint !== glint) build(view);
      if (bought !== null && prev !== null && rects !== null) afterPurchase(bought, prev, rects);
    },
    key(e) {
      if (model === null) return false;
      if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && !e.shiftKey)
        return scrollStats(e.code === 'ArrowUp' ? -1 : 1);
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
    leave() {
      doc.defaultView?.clearTimeout(toastTimer);
      toastEl.classList.remove('is-on');
    },
  };
}
