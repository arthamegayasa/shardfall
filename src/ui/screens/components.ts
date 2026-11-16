// Shared row card, tag chips, and panel builders (ui-spec 6.1, 6.2).

import type { StringParams } from '../../core/index.ts';
import { button, h, put } from '../dom.ts';
import { tagAbbrKey } from '../presenters/content.ts';
import type { UiContext } from './types.ts';

export interface CardSpec {
  readonly dataUi: string;
  readonly nameKey: string;
  readonly descKey: string;
  readonly descParams?: StringParams;
  readonly flavorKey?: string | null;
  readonly tags?: readonly string[];
  readonly rarityOrder: number;
  /** "II" etc. next to the name, empty for none. */
  readonly tierText?: string;
  /** Hotkey number shown in the corner (1..5), 0 for none. */
  readonly hotkey?: number;
  /** Price in Glint; undefined hides the price. */
  readonly price?: number;
  readonly affordable?: boolean;
  /** Badge text (Fuse > II, No free slot), empty for none. */
  readonly badge?: string;
  readonly locked?: boolean;
  /** Extra line under the effect (Temper stat change), empty for none. */
  readonly note?: string;
}

export function panel(ctx: UiContext, className = ''): HTMLElement {
  return h(ctx.doc, 'div', `panel ${className}`.trim());
}

/** Rarity pips: Plain 0, Fine 1, Rare 2, Fabled 3 (ui-spec 6.1, never colour alone). */
export function rarityPips(ctx: UiContext, order: number): HTMLElement {
  const wrap = h(ctx.doc, 'span', 'pips');
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < order; i++) wrap.appendChild(h(ctx.doc, 'span', 'pip'));
  return wrap;
}

export function tagChips(ctx: UiContext, tags: readonly string[]): HTMLElement {
  const wrap = h(ctx.doc, 'span', 'tag-chips');
  for (const tag of tags) {
    const chip = h(ctx.doc, 'span', `tag-chip tag-${tag}`, ctx.t(tagAbbrKey(tag)));
    wrap.appendChild(chip);
  }
  return wrap;
}

/** Placeholder icon: tag abbreviation in a framed square until AD icons land (M2). */
export function iconBox(
  ctx: UiContext,
  tags: readonly string[],
  size: 'big' | 'small',
): HTMLElement {
  const first = tags[0];
  const box = h(ctx.doc, 'span', `icon icon-${size}${first === undefined ? '' : ` tag-${first}`}`);
  box.setAttribute('aria-hidden', 'true');
  if (first !== undefined) box.textContent = ctx.t(tagAbbrKey(first));
  return box;
}

export function glintAmount(ctx: UiContext, amount: number, affordable = true): HTMLElement {
  const wrap = h(ctx.doc, 'span', `glint-amount${affordable ? '' : ' is-poor'}`);
  wrap.appendChild(h(ctx.doc, 'span', 'glint-icon'));
  wrap.appendChild(h(ctx.doc, 'span', 'num', String(amount)));
  return wrap;
}

/** Row card as a native button (ui-spec 6.1). */
export function rowCard(ctx: UiContext, spec: CardSpec): HTMLButtonElement {
  const { doc, t } = ctx;
  const card = button(doc, spec.dataUi, '', `card rarity-${String(spec.rarityOrder)}`);
  card.textContent = '';
  if (spec.locked === true) card.classList.add('is-locked');
  const corner = h(doc, 'span', 'card-corner');
  if (spec.hotkey !== undefined && spec.hotkey > 0) {
    corner.appendChild(h(doc, 'span', 'card-hotkey', String(spec.hotkey)));
  }
  corner.appendChild(rarityPips(ctx, spec.rarityOrder));

  const body = h(doc, 'span', 'card-body');
  const head = h(doc, 'span', 'card-head');
  head.appendChild(h(doc, 'span', 'card-name', t(spec.nameKey)));
  if (spec.tierText !== undefined && spec.tierText !== '') {
    head.appendChild(h(doc, 'span', 'card-tier', spec.tierText));
  }
  body.appendChild(head);
  body.appendChild(h(doc, 'span', 'card-effect', t(spec.descKey, spec.descParams)));
  if (spec.note !== undefined && spec.note !== '') {
    body.appendChild(h(doc, 'span', 'card-note', spec.note));
  }
  const flavorKey = spec.flavorKey ?? null;
  if (flavorKey !== null && ctx.deps.settings().access.showFlavor) {
    body.appendChild(h(doc, 'span', 'card-flavor', t(flavorKey)));
  }

  const side = h(doc, 'span', 'card-side');
  if (spec.tags !== undefined && spec.tags.length > 0) side.appendChild(tagChips(ctx, spec.tags));
  if (spec.price !== undefined)
    side.appendChild(glintAmount(ctx, spec.price, spec.affordable ?? true));
  if (spec.locked === true) side.appendChild(h(doc, 'span', 'lock-mark is-closed'));
  if (spec.badge !== undefined && spec.badge !== '')
    side.appendChild(h(doc, 'span', 'badge', spec.badge));

  put(card, corner, iconBox(ctx, spec.tags ?? [], 'big'), body, side);
  return card;
}

/** Screen title block: big title plus optional subtitle. */
export function titleBlock(ctx: UiContext, title: string, subtitle = ''): HTMLElement {
  const wrap = h(ctx.doc, 'div', 'title-block');
  wrap.appendChild(h(ctx.doc, 'h1', 'heading', title));
  if (subtitle !== '') wrap.appendChild(h(ctx.doc, 'p', 'screen-sub', subtitle));
  return wrap;
}
