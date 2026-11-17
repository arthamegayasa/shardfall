// S02 Choose your hero (ui-spec 5, redesign-1.1 3.4). Tier A shows one class (Lamplighter) so the
// flow never changes. Left: hero list with portraits; locked heroes show a lock and their Silt price.
// Right: the focused hero with a large portrait, then weapon, skill, and passive as three labelled
// rows. Bottom: Back, Begin. On a locked hero Begin reads "Locked: buy in Unlocks" and opens
// Unlocks (ui-spec S02; LP M2-09 tier B activation).

import { isClassOpen } from '../../content/index.ts';
import type { ClassDef } from '../../content/index.ts';
import { button, h, put, setText } from '../dom.ts';
import { ceilSeconds, formatStatValue } from '../format.ts';
import { menuIntent } from '../menu-keys.ts';
import { overflows, scrollStep } from '../scroll.ts';
import type { ScrollMetrics } from '../scroll.ts';
import { classPassiveParams, weaponParams } from '../presenters/content.ts';
import { iconBox, panel, titleBlock } from './components.ts';
import { classPriceText } from './keeping.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

export function createClassSelectScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-class');
  const focus = ctx.newFocusList();
  let selected = 0;
  let classes: ClassDef[] = [];

  const detail = h(doc, 'div', 'class-detail panel');
  detail.dataset['ui'] = 'class-detail';
  detail.setAttribute('role', 'region');
  const metrics = (): ScrollMetrics => ({
    top: detail.scrollTop,
    client: detail.clientHeight,
    height: detail.scrollHeight,
  });
  const dPortrait = h(doc, 'div', 'class-portrait-big');
  const dLock = h(doc, 'p', 'class-lock');
  const dWeaponIcon = h(doc, 'span', 'class-item-icon');
  const dRiteIcon = h(doc, 'span', 'class-item-icon');
  const dPassiveIcon = h(doc, 'span', 'class-item-icon');
  const dName = h(doc, 'h2', 'class-name t-title');
  const dRole = h(doc, 'p', 'class-role');
  const dDesc = h(doc, 'p', 'class-desc dim');
  const dWeaponName = h(doc, 'p', 'item-name');
  const dWeaponDesc = h(doc, 'p', 'item-effect');
  const dRiteName = h(doc, 'p', 'item-name');
  const dRiteDesc = h(doc, 'p', 'item-effect');
  const dRiteCd = h(doc, 'p', 'dim');
  const dPassive = h(doc, 'p', 'item-effect');
  /** One labelled row (redesign-1.1 3.4): label, icon, then name and what it does. */
  const traitRow = (labelKey: string, icon: HTMLElement, ...text: HTMLElement[]): HTMLElement =>
    put(
      h(doc, 'div', 'class-trait'),
      h(doc, 'p', 'label class-trait-label', t(labelKey)),
      icon,
      put(h(doc, 'div', 'class-trait-text'), ...text),
    );
  put(
    detail,
    put(
      h(doc, 'div', 'class-hero'),
      dPortrait,
      put(h(doc, 'div', 'class-hero-text'), dName, dRole, dDesc, dLock),
    ),
    put(
      h(doc, 'div', 'class-traits'),
      traitRow('ui.class.weapon', dWeaponIcon, dWeaponName, dWeaponDesc),
      traitRow('ui.class.rite', dRiteIcon, dRiteName, dRiteDesc, dRiteCd),
      traitRow('ui.class.passive', dPassiveIcon, dPassive),
    ),
  );

  const isLocked = (c: ClassDef): boolean => !isClassOpen(deps.data, deps.meta().unlocked, c.id);
  /** Class portrait (AD actor sprite kept-<id>) at an integer scale inside `box` UI units. */
  const portrait = (c: ClassDef, box: number): HTMLElement => {
    const wrap = h(doc, 'span', `icon class-portrait${box > 24 ? ' icon-big' : ' icon-small'}`);
    wrap.setAttribute('aria-hidden', 'true');
    const art = ctx.icons.sprite(doc, `kept-${c.id}`, box);
    if (art !== null) {
      wrap.classList.add('has-art');
      wrap.appendChild(art);
    }
    return wrap;
  };
  let beginBtn: HTMLButtonElement | null = null;

  const showDetail = (i: number): void => {
    selected = i;
    const c = classes[i];
    if (c === undefined) return;
    const weapon = deps.data.weapons.find((w) => w.id === c.startWeapon);
    const rite = deps.data.rites.find((r) => r.id === c.riteId);
    setText(dName, t(c.nameKey));
    setText(dRole, t(`class.${c.id}.role`));
    setText(dDesc, t(c.descKey));
    setText(dWeaponName, weapon === undefined ? '' : t(weapon.nameKey));
    setText(dWeaponDesc, weapon === undefined ? '' : t(weapon.descKey, weaponParams(weapon)));
    setText(dRiteName, rite === undefined ? '' : t(rite.nameKey));
    setText(
      dRiteDesc,
      rite === undefined ? '' : t(rite.descKey, { dmg: formatStatValue(rite.dmg) }),
    );
    setText(
      dRiteCd,
      rite === undefined ? '' : t('ui.class.cooldown', { s: ceilSeconds(rite.cooldownTicks) }),
    );
    setText(dPassive, t(`class.${c.id}.passive`, classPassiveParams(deps.data, c.id)));
    const locked = isLocked(c);
    detail.classList.toggle('is-locked', locked);
    dPortrait.textContent = '';
    dPortrait.appendChild(portrait(c, 72));
    const price = classPriceText(ctx, c.id);
    setText(dLock, locked ? `${t('ui.class.locked')}${price === '' ? '' : `  ${price}`}` : '');
    dWeaponIcon.textContent = '';
    if (weapon !== undefined)
      dWeaponIcon.appendChild(
        iconBox(ctx, { kind: 'weapon', id: weapon.id }, t(weapon.nameKey), weapon.tags, 'small'),
      );
    dRiteIcon.textContent = '';
    if (rite !== undefined)
      dRiteIcon.appendChild(
        iconBox(ctx, { kind: 'rite', id: rite.id }, t(rite.nameKey), [], 'small'),
      );
    // Passive: the class tag's shape and colour (the tag its passive builds on).
    dPassiveIcon.textContent = '';
    const tagBox = h(doc, 'span', `icon icon-small class-tag tag-${c.tag}`);
    tagBox.setAttribute('aria-hidden', 'true');
    tagBox.appendChild(h(doc, 'span', 'tag-shape'));
    dPassiveIcon.appendChild(tagBox);
    if (beginBtn !== null) {
      beginBtn.textContent = t(locked ? 'ui.class.locked' : 'ui.class.begin');
      beginBtn.classList.toggle('is-locked', locked);
    }
  };

  const begin = (): void => {
    const c = classes[selected];
    if (c === undefined) {
      ctx.sound(Cue.Denied);
      return;
    }
    if (isLocked(c)) {
      // Shortcut to The Keeping only where Silt unlocks exist (tiers B and C).
      if (deps.data.metaUnlocks.length > 0) {
        ctx.sound(Cue.Confirm);
        deps.app.openArchive();
      } else ctx.sound(Cue.Denied);
      return;
    }
    ctx.sound(Cue.Confirm);
    deps.app.startRun(c.id, 0);
  };

  const enter = (): void => {
    el.textContent = '';
    focus.reset();
    classes = [...deps.data.classes].sort((a, b) => a.sort - b.sort);
    const safe = h(doc, 'div', 'safe class-safe');
    const list = panel(ctx, 'class-list');
    const lastId = deps.meta().lastClassId;
    let initial = 0;
    classes.forEach((c, i) => {
      const b = button(doc, `class-${c.id}`, '', 'class-row');
      b.textContent = '';
      const locked = isLocked(c);
      put(
        b,
        portrait(c, 24),
        h(doc, 'span', 'class-row-name', t(c.nameKey)),
        locked ? h(doc, 'span', 'class-row-price', classPriceText(ctx, c.id)) : null,
      );
      if (locked) b.classList.add('is-locked');
      list.appendChild(b);
      focus.add({
        el: b,
        group: 0,
        activate: begin,
        onFocus: () => {
          showDetail(i);
        },
      });
      if (c.id === lastId) initial = i;
    });
    const bar = h(doc, 'div', 'bottom-bar');
    const beginEl = button(doc, 'class-begin', t('ui.class.begin'), 'primary');
    beginBtn = beginEl;
    const backBtn = button(doc, 'class-back', t('ui.common.back'));
    put(bar, backBtn, beginEl);
    focus.add({
      el: backBtn,
      group: 1,
      activate: () => {
        ctx.sound(Cue.Back);
        ctx.go('title');
      },
    });
    focus.add({ el: beginEl, group: 1, activate: begin });
    put(
      el,
      put(
        safe,
        titleBlock(ctx, t('ui.class.title')),
        put(h(doc, 'div', 'class-cols'), list, detail),
        bar,
      ),
    );
    showDetail(initial);
    // Large text: a detail taller than its panel scrolls and becomes a focus stop (arrows).
    detail.scrollTop = 0;
    if (overflows(metrics())) {
      focus.add({
        el: detail,
        group: 2,
        activate: () => {
          ctx.sound(Cue.Denied);
        },
      });
    }
    if (classes.length > 0) focus.focus(initial, true);
    else focus.focus(0, true);
  };

  return {
    el,
    focus,
    enter,
    key(e) {
      if (doc.activeElement !== detail) return false;
      const intent = menuIntent(e.code, e.shiftKey, deps.settings().keybinds);
      if (intent !== 'up' && intent !== 'down') return false;
      const next = scrollStep(metrics(), intent === 'up' ? -1 : 1, detail.clientHeight / 3);
      if (next === null) return false;
      detail.scrollTop = next;
      return true;
    },
    back() {
      ctx.sound(Cue.Back);
      ctx.go('title');
    },
  };
}
