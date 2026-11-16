// Shared row card, icons, tag chips, and panel builders (ui-spec 6.1, 6.2; style guide 2.1).

import type { StringParams } from '../../core/index.ts';
import { button, h, put } from '../dom.ts';
import { monogram } from '../icons.ts';
import type { IconRef } from '../icons.ts';
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
  /** Art icon to show; the monogram of the name is the fallback. */
  readonly icon?: IconRef | null;
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
  /** Entry stagger position (ui-spec 10), 0 based. */
  readonly order?: number;
}

/** Display-case label panel (style guide 2.1). `glass` adds the corner glint line. */
export function panel(ctx: UiContext, className = '', glass = false): HTMLElement {
  return h(ctx.doc, 'div', `panel${glass ? ' glass' : ''} ${className}`.trim());
}

/** Rarity pips: Plain 0, Fine 1, Rare 2, Fabled 3 (ui-spec 6.1, never colour alone). */
export function rarityPips(ctx: UiContext, order: number, row = false): HTMLElement {
  const wrap = h(ctx.doc, 'span', row ? 'pips is-row' : 'pips');
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) wrap.appendChild(h(ctx.doc, 'span', i < order ? 'pip is-on' : 'pip'));
  return wrap;
}

/** One tag chip: a per-tag shape (never colour alone, ui-spec 9) plus the WR abbreviation. */
export function tagChip(ctx: UiContext, tag: string): HTMLElement {
  const chip = h(ctx.doc, 'span', `tag-chip tag-${tag}`);
  const art = ctx.icons.icon(ctx.doc, { kind: 'tag', id: tag }, 8);
  chip.appendChild(art ?? h(ctx.doc, 'span', 'tag-shape'));
  chip.appendChild(h(ctx.doc, 'span', 'tag-abbr', ctx.t(tagAbbrKey(tag))));
  return chip;
}

export function tagChips(ctx: UiContext, tags: readonly string[]): HTMLElement {
  const wrap = h(ctx.doc, 'span', 'tag-chips');
  for (const tag of tags) wrap.appendChild(tagChip(ctx, tag));
  return wrap;
}

/**
 * Item icon: AD art when the sprite exists (integer scale), else a monogram of the display name in
 * the colour of the first tag with that tag's shape in the corner.
 */
export function iconBox(
  ctx: UiContext,
  ref: IconRef | null,
  displayName: string,
  tags: readonly string[],
  size: 'big' | 'small',
): HTMLElement {
  const first = tags[0];
  const box = h(ctx.doc, 'span', `icon icon-${size}${first === undefined ? '' : ` tag-${first}`}`);
  box.setAttribute('aria-hidden', 'true');
  const art = ref === null ? null : ctx.icons.icon(ctx.doc, ref, size === 'big' ? 32 : 16);
  if (art !== null) {
    box.classList.add('has-art');
    box.appendChild(art);
    return box;
  }
  box.appendChild(h(ctx.doc, 'span', 'icon-mono', monogram(displayName)));
  if (first !== undefined && size === 'big') box.appendChild(h(ctx.doc, 'span', 'tag-shape'));
  return box;
}

/** Glint mark: AD's icon-glint sprite when present, else the CSS diamond. box in UI units. */
export function glintIcon(ctx: UiContext, box = 8): HTMLElement {
  const art = ctx.icons.sprite(ctx.doc, 'icon-glint', box);
  if (art === null) return h(ctx.doc, 'span', 'glint-icon');
  const wrap = h(ctx.doc, 'span', 'glint-art');
  wrap.appendChild(art);
  return wrap;
}

export function glintAmount(
  ctx: UiContext,
  amount: number,
  affordable = true,
  box = 8,
): HTMLElement {
  const wrap = h(ctx.doc, 'span', `glint-amount${affordable ? '' : ' is-poor'}`);
  wrap.appendChild(glintIcon(ctx, box));
  wrap.appendChild(h(ctx.doc, 'span', 'num', String(amount)));
  return wrap;
}

/** Row card as a native button (ui-spec 6.1): icon left, name, 2 effect lines, flavor, side. */
export function rowCard(ctx: UiContext, spec: CardSpec): HTMLButtonElement {
  const { doc, t } = ctx;
  const card = button(doc, spec.dataUi, '', `card rarity-${String(spec.rarityOrder)}`);
  card.textContent = '';
  card.style.setProperty('--i', String(spec.order ?? 0));
  if (spec.locked === true) card.classList.add('is-locked');
  const name = t(spec.nameKey);
  const corner = h(doc, 'span', 'card-corner');
  if (spec.hotkey !== undefined && spec.hotkey > 0) {
    corner.appendChild(h(doc, 'span', 'card-hotkey', String(spec.hotkey)));
  }
  corner.appendChild(rarityPips(ctx, spec.rarityOrder));

  const body = h(doc, 'span', 'card-body');
  const head = h(doc, 'span', 'card-head');
  head.appendChild(h(doc, 'span', 'card-name', name));
  if (spec.tierText !== undefined && spec.tierText !== '') {
    head.appendChild(h(doc, 'span', 'card-tier', spec.tierText));
  }
  body.appendChild(head);
  body.appendChild(h(doc, 'span', 'card-effect', t(spec.descKey, spec.descParams)));
  if (spec.note !== undefined && spec.note !== '') {
    body.appendChild(h(doc, 'span', 'card-note', spec.note));
  }

  const side = h(doc, 'span', 'card-side');
  if (spec.tags !== undefined && spec.tags.length > 0) side.appendChild(tagChips(ctx, spec.tags));
  const foot = h(doc, 'span', 'card-foot');
  if (spec.badge !== undefined && spec.badge !== '')
    foot.appendChild(h(doc, 'span', 'badge', spec.badge));
  if (spec.locked === true) foot.appendChild(h(doc, 'span', 'lock-mark is-closed'));
  if (spec.price !== undefined)
    foot.appendChild(glintAmount(ctx, spec.price, spec.affordable ?? true));
  if (foot.childElementCount > 0) side.appendChild(foot);

  // Flavor under the effect; it may wrap to a second line instead of an ellipsis (BUG-003).
  const flavorKey = spec.flavorKey ?? null;
  if (flavorKey !== null && ctx.deps.settings().access.showFlavor) {
    body.appendChild(h(doc, 'span', 'card-flavor', t(flavorKey)));
    card.classList.add('has-flavor');
  }

  put(card, corner, iconBox(ctx, spec.icon ?? null, name, spec.tags ?? [], 'big'), body, side);
  return card;
}

/** Small build row (pause, run end): fixed icon and pip columns so names align (BUG-005). */
export function buildRow(
  ctx: UiContext,
  ref: IconRef | null,
  nameKey: string,
  tags: readonly string[],
  rarityOrder: number,
  trailing: string,
): HTMLElement {
  const name = ctx.t(nameKey);
  const row = h(ctx.doc, 'div', `build-row rarity-${String(rarityOrder)}`);
  put(
    row,
    iconBox(ctx, ref, name, tags, 'small'),
    rarityPips(ctx, rarityOrder, true),
    h(ctx.doc, 'span', 'build-name', name),
    h(ctx.doc, 'span', 'build-trail', trailing),
  );
  return row;
}

/** Screen title block: big title plus optional subtitle. */
export function titleBlock(ctx: UiContext, title: string, subtitle = ''): HTMLElement {
  const wrap = h(ctx.doc, 'div', 'title-block');
  wrap.appendChild(h(ctx.doc, 'h1', 'heading', title));
  if (subtitle !== '') wrap.appendChild(h(ctx.doc, 'p', 'screen-sub', subtitle));
  return wrap;
}
