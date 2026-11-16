// S02 Choose Your Kept (ui-spec 5). Tier A shows one class (Lamplighter) so the flow never changes.
// Left: class list. Right: detail of the focused class. Bottom: Begin, Back.

import type { ClassDef } from '../../content/index.ts';
import { button, h, put, setText } from '../dom.ts';
import { ceilSeconds, formatStatValue } from '../format.ts';
import { weaponParams } from '../presenters/content.ts';
import { panel, titleBlock } from './components.ts';
import type { Screen, UiContext } from './types.ts';
import { Cue } from '../cues.ts';

export function createClassSelectScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-class');
  const focus = ctx.newFocusList();
  let selected = 0;
  let classes: ClassDef[] = [];

  const detail = h(doc, 'div', 'class-detail panel');
  const dName = h(doc, 'h2', 'class-name');
  const dRole = h(doc, 'p', 'class-role');
  const dDesc = h(doc, 'p', 'class-desc dim');
  const dWeaponLabel = h(doc, 'p', 'label');
  const dWeaponName = h(doc, 'p', 'item-name');
  const dWeaponDesc = h(doc, 'p', 'item-effect');
  const dRiteLabel = h(doc, 'p', 'label');
  const dRiteName = h(doc, 'p', 'item-name');
  const dRiteDesc = h(doc, 'p', 'item-effect');
  const dRiteCd = h(doc, 'p', 'dim');
  const dPassiveLabel = h(doc, 'p', 'label');
  const dPassive = h(doc, 'p', 'item-effect');
  put(
    detail,
    dName,
    dRole,
    dDesc,
    dWeaponLabel,
    dWeaponName,
    dWeaponDesc,
    dRiteLabel,
    dRiteName,
    dRiteDesc,
    dRiteCd,
    dPassiveLabel,
    dPassive,
  );

  const isLocked = (c: ClassDef): boolean =>
    c.unlockSilt > 0 && !deps.meta().unlocked.includes(c.id);

  const showDetail = (i: number): void => {
    selected = i;
    const c = classes[i];
    if (c === undefined) return;
    const weapon = deps.data.weapons.find((w) => w.id === c.startWeapon);
    const rite = deps.data.rites.find((r) => r.id === c.riteId);
    setText(dName, t(c.nameKey));
    setText(dRole, t(`class.${c.id}.role`));
    setText(dDesc, t(c.descKey));
    setText(dWeaponLabel, t('ui.class.weapon'));
    setText(dWeaponName, weapon === undefined ? '' : t(weapon.nameKey));
    setText(dWeaponDesc, weapon === undefined ? '' : t(weapon.descKey, weaponParams(weapon)));
    setText(dRiteLabel, t('ui.class.rite'));
    setText(dRiteName, rite === undefined ? '' : t(rite.nameKey));
    setText(
      dRiteDesc,
      rite === undefined ? '' : t(rite.descKey, { dmg: formatStatValue(rite.dmg) }),
    );
    setText(
      dRiteCd,
      rite === undefined ? '' : t('ui.class.cooldown', { s: ceilSeconds(rite.cooldownTicks) }),
    );
    setText(dPassiveLabel, t('ui.class.passive'));
    setText(dPassive, t(`class.${c.id}.passive`));
    detail.classList.toggle('is-locked', isLocked(c));
  };

  const begin = (): void => {
    const c = classes[selected];
    if (c === undefined || isLocked(c)) {
      ctx.sound(Cue.Denied);
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
      const b = button(doc, `class-${c.id}`, t(c.nameKey), 'class-row');
      if (isLocked(c)) b.classList.add('is-locked');
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
    const beginBtn = button(doc, 'class-begin', t('ui.class.begin'), 'primary');
    const backBtn = button(doc, 'class-back', t('ui.common.back'));
    put(bar, backBtn, beginBtn);
    focus.add({
      el: backBtn,
      group: 1,
      activate: () => {
        ctx.sound(Cue.Back);
        ctx.go('title');
      },
    });
    focus.add({ el: beginBtn, group: 1, activate: begin });
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
    if (classes.length > 0) focus.focus(initial, true);
    else focus.focus(0, true);
  };

  return {
    el,
    focus,
    enter,
    back() {
      ctx.sound(Cue.Back);
      ctx.go('title');
    },
  };
}
