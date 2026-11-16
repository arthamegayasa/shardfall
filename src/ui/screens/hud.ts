// S03 HUD during a Pulse (ui-spec S03, style guide 2.2): HP, Lv and XP bar, Pulse timer (or boss /
// held Warden bar in the same slot), Glint, Rite with icon and charges. Transient: Warden and boss
// arrival banners, "Pulse {n} Held", a short Pulse banner, and the control hint in Pulse 1.
// Every frame: fill the model without allocation, then touch the DOM only for changed fields.

import type { SimEventReader, WorldView } from '../../core/index.ts';
import { SimEventType } from '../../core/index.ts';
import { h, put, setText } from '../dom.ts';
import { formatClock, formatInt, keyLabel } from '../format.ts';
import { enemyNameKey } from '../presenters/content.ts';
import { createHudModel, fillHudModel, pendingBossType, TimerMode } from '../presenters/hud.ts';
import {
  BannerKind,
  bannerEvent,
  bannerHeld,
  bannerShown,
  createBanner,
  createHint,
  hintStart,
  hintStep,
  moveKeysText,
  RITE_DENIED_TICKS,
} from '../presenters/hud-transient.ts';
import { glintIcon, iconBox } from './components.ts';
import type { Screen, UiContext } from './types.ts';

const BANNER_CLASS: Readonly<Record<number, string>> = {
  [BannerKind.Pulse]: 'is-pulse',
  [BannerKind.Warden]: 'is-foe',
  [BannerKind.Boss]: 'is-foe',
  [BannerKind.Held]: 'is-foe',
};

export function createHudScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-hud');
  el.setAttribute('aria-hidden', 'true');
  const model = createHudModel();
  const banner = createBanner();
  const hint = createHint();
  let lowHp = false;

  // Top left: HP and level.
  const tl = h(doc, 'div', 'hud-tl');
  const hpBar = h(doc, 'div', 'bar bar-hp');
  const hpFill = h(doc, 'div', 'bar-fill');
  const hpText = h(doc, 'span', 'bar-text');
  const hpCrack = h(doc, 'span', 'hp-crack');
  put(hpBar, hpFill, hpText, hpCrack);
  const lvRow = h(doc, 'div', 'hud-lv');
  const lvText = h(doc, 'span', 'lv-text');
  const xpBar = h(doc, 'div', 'bar bar-xp');
  const xpFill = h(doc, 'div', 'bar-fill');
  put(xpBar, xpFill);
  put(tl, hpBar, put(lvRow, lvText, xpBar));

  // Top centre: timer or foe bar, then the banner.
  const tc = h(doc, 'div', 'hud-tc');
  const pulseLabel = h(doc, 'span', 'pulse-label');
  const timerText = h(doc, 'span', 'timer');
  const foeWrap = h(doc, 'div', 'foe');
  const foeLabel = h(doc, 'span', 'foe-label');
  const foeName = h(doc, 'span', 'foe-name');
  const foeBar = h(doc, 'div', 'bar bar-foe');
  const foeFill = h(doc, 'div', 'bar-fill');
  const foeEnraged = h(doc, 'span', 'foe-enraged');
  put(foeBar, foeFill);
  put(
    foeWrap,
    put(h(doc, 'div', 'foe-head'), foeLabel, foeName),
    put(h(doc, 'div', 'foe-row'), foeBar, foeEnraged),
  );
  const bannerEl = h(doc, 'div', 'hud-banner');
  const bannerMain = h(doc, 'span', 'banner-main');
  const bannerSub = h(doc, 'span', 'banner-sub');
  put(bannerEl, bannerMain, bannerSub);
  put(tc, pulseLabel, timerText, foeWrap, bannerEl);

  // Top right: Glint.
  const tr = h(doc, 'div', 'hud-tr');
  const glintText = h(doc, 'span', 'num');
  put(tr, glintIcon(ctx, 16), glintText);

  // Bottom centre: control hint, Rite.
  const bc = h(doc, 'div', 'hud-bc');
  const hintEl = h(doc, 'div', 'hud-hint');
  const hintMove = h(doc, 'span', 'hint-item');
  const hintRite = h(doc, 'span', 'hint-item');
  put(hintEl, hintMove, hintRite);
  const rite = h(doc, 'div', 'rite');
  const riteIcon = h(doc, 'span', 'rite-icon');
  const riteFill = h(doc, 'div', 'rite-fill');
  const riteSecs = h(doc, 'span', 'rite-secs');
  const riteCharges = h(doc, 'span', 'rite-charges');
  put(rite, riteIcon, riteFill, riteSecs, riteCharges);
  const riteKey = h(doc, 'span', 'rite-key');
  put(bc, hintEl, rite, riteKey);

  put(el, tl, tc, tr, bc);

  // Last written values (NaN forces the first write).
  let pHp = NaN;
  let pMax = NaN;
  let pHpFrac = NaN;
  let pLow = false;
  let pLevel = NaN;
  let pXp = NaN;
  let pPulse = NaN;
  let pMode = -1;
  let pSecs = NaN;
  let pFinal = false;
  let pFoeType = NaN;
  let pFoeFrac = NaN;
  let pPending = false;
  let pEnraged = false;
  let pGlint = NaN;
  let pRiteReady = false;
  let pRiteSecs = NaN;
  let pRiteFrac = NaN;
  let pRiteCharges = NaN;
  let pRiteIndex = NaN;
  let pBanner: number = BannerKind.None;
  let pHint = false;
  let deniedUntil = 0;
  let pDenied = false;
  let bossHintPulse = -1;
  let bossHint = -1;

  const foeNameText = (typeIndex: number): string => {
    const key = enemyNameKey(deps.data, typeIndex);
    return key === null ? '' : t(key);
  };

  const showBanner = (kind: number): void => {
    pBanner = kind;
    bannerEl.className = `hud-banner ${BANNER_CLASS[kind] ?? ''}`.trim();
    if (kind === BannerKind.None) {
      setText(bannerMain, '');
      setText(bannerSub, '');
      return;
    }
    if (kind === BannerKind.Pulse) {
      setText(bannerMain, t('ui.hud.pulse', { n: banner.pulseNumber }));
      setText(bannerSub, '');
    } else if (kind === BannerKind.Held) {
      setText(bannerMain, t('ui.banner.pulse_held', { n: banner.pulseNumber }));
      setText(bannerSub, '');
    } else {
      // Arrival: name plus epithet ("Brass Collar" / "the Thrice-Leaping"), CD K1.
      const key = enemyNameKey(deps.data, banner.typeIndex);
      setText(bannerMain, key === null ? '' : t(key));
      const epithet = key === null ? '' : `${key}.epithet`;
      setText(bannerSub, epithet !== '' && ctx.has(epithet) ? t(epithet) : '');
    }
  };

  const reset = (): void => {
    pHp = pMax = pHpFrac = pLevel = pXp = pPulse = pSecs = pFoeType = pFoeFrac = pGlint = NaN;
    pRiteSecs = pRiteFrac = pRiteCharges = pRiteIndex = NaN;
    pMode = -1;
    pLow = pFinal = pEnraged = pRiteReady = pPending = pDenied = false;
    el.classList.remove(
      'is-low',
      'is-final',
      'mode-boss',
      'mode-held',
      'is-enraged',
      'is-pending',
      'has-hint',
    );
    rite.classList.remove('is-ready', 'is-denied');
    riteKey.textContent = ctx.keyHint('rite');
    pHint = false;
    showBanner(BannerKind.None);
    const kb = deps.settings().keybinds;
    hintMove.textContent = t('ui.hud.hint_move', {
      keys: moveKeysText([
        keyLabel(kb.moveUp[0]),
        keyLabel(kb.moveLeft[0]),
        keyLabel(kb.moveDown[0]),
        keyLabel(kb.moveRight[0]),
      ]),
    });
    hintRite.textContent = t('ui.hud.hint_rite', { key: ctx.keyHint('rite') });
  };

  const setRiteIcon = (riteIndex: number): void => {
    pRiteIndex = riteIndex;
    riteIcon.textContent = '';
    const def = deps.data.rites[riteIndex];
    if (def === undefined) return;
    riteIcon.appendChild(iconBox(ctx, { kind: 'rite', id: def.id }, t(def.nameKey), [], 'big'));
  };

  return {
    el,
    focus: null,
    enter() {
      reset();
    },
    update(view: WorldView, events: SimEventReader) {
      const tick = view.tick;
      const pulseNumber = view.pulse.index + 1;
      let riteCast = false;
      for (let i = 0; i < events.count; i++) {
        const type = events.type[i] ?? 0;
        const a = events.a[i] ?? 0;
        if (type === SimEventType.PlayerHpLowChanged) lowHp = a === 1;
        else if (type === SimEventType.PulseStarted) {
          lowHp = false;
          if (a === 0) hintStart(hint, tick, view.player.x, view.player.y);
        } else if (type === SimEventType.RiteCast) riteCast = true;
        else if (type === SimEventType.RiteRejected) deniedUntil = tick + RITE_DENIED_TICKS;
        bannerEvent(banner, type, a, tick, pulseNumber);
      }
      if (view.pulse.index !== bossHintPulse) {
        bossHintPulse = view.pulse.index;
        bossHint = view.pulse.isBoss ? pendingBossType(deps.data, view.pulse.index) : -1;
      }
      fillHudModel(view, lowHp, model, bossHint);
      const m = model;
      // Compare the shown integers: regen changes HP by a fraction every tick (no DOM write then).
      const hpShown = Math.ceil(m.hp - 1e-9);
      const maxShown = Math.ceil(m.maxHp - 1e-9);
      if (hpShown !== pHp || maxShown !== pMax) {
        pHp = hpShown;
        pMax = maxShown;
        hpText.textContent = t('ui.hud.hp', { hp: formatInt(m.hp), max: formatInt(m.maxHp) });
      }
      if (m.hpFrac !== pHpFrac) {
        pHpFrac = m.hpFrac;
        hpFill.style.transform = `scaleX(${m.hpFrac})`;
      }
      if (m.lowHp !== pLow) {
        pLow = m.lowHp;
        el.classList.toggle('is-low', m.lowHp);
      }
      if (m.level !== pLevel) {
        pLevel = m.level;
        lvText.textContent = t('ui.hud.level', { n: m.level });
      }
      if (m.xpFrac !== pXp) {
        pXp = m.xpFrac;
        xpFill.style.transform = `scaleX(${m.xpFrac})`;
      }
      if (m.pulseNumber !== pPulse) {
        pPulse = m.pulseNumber;
        pulseLabel.textContent = t('ui.hud.pulse', { n: m.pulseNumber });
      }
      if (m.timerMode !== pMode) {
        // The timer slot just became the held Warden bar: announce it once (CD K3, style 2.2).
        if (m.timerMode === TimerMode.Held && pMode === TimerMode.Timer)
          bannerHeld(banner, tick, pulseNumber);
        pMode = m.timerMode;
        el.classList.toggle('mode-boss', m.timerMode === TimerMode.Boss);
        el.classList.toggle('mode-held', m.timerMode === TimerMode.Held);
        foeLabel.textContent = m.timerMode === TimerMode.Held ? t('ui.hud.held') : '';
        pFoeType = NaN;
      }
      if (m.timerMode === TimerMode.Timer) {
        if (m.timerSecs !== pSecs) {
          pSecs = m.timerSecs;
          timerText.textContent = formatClock(m.timerSecs);
        }
        if (m.finalCountdown !== pFinal) {
          pFinal = m.finalCountdown;
          el.classList.toggle('is-final', m.finalCountdown);
        }
      } else {
        if (m.foeTypeIndex !== pFoeType) {
          pFoeType = m.foeTypeIndex;
          foeName.textContent = foeNameText(m.foeTypeIndex);
        }
        if (m.foePending !== pPending) {
          pPending = m.foePending;
          el.classList.toggle('is-pending', m.foePending);
        }
        if (m.foeFrac !== pFoeFrac) {
          pFoeFrac = m.foeFrac;
          foeFill.style.transform = `scaleX(${m.foeFrac})`;
        }
        if (m.foeEnraged !== pEnraged) {
          pEnraged = m.foeEnraged;
          el.classList.toggle('is-enraged', m.foeEnraged);
        }
      }
      if (m.glint !== pGlint) {
        pGlint = m.glint;
        glintText.textContent = formatInt(m.glint);
      }
      if (m.riteIndex !== pRiteIndex) setRiteIcon(m.riteIndex);
      if (m.riteReady !== pRiteReady) {
        pRiteReady = m.riteReady;
        rite.classList.toggle('is-ready', m.riteReady);
      }
      if (m.riteSecs !== pRiteSecs) {
        pRiteSecs = m.riteSecs;
        riteSecs.textContent = m.riteSecs > 0 ? String(m.riteSecs) : '';
      }
      if (m.riteFrac !== pRiteFrac) {
        pRiteFrac = m.riteFrac;
        riteFill.style.transform = `scaleY(${m.riteFrac})`;
      }
      if (m.riteCharges !== pRiteCharges) {
        pRiteCharges = m.riteCharges;
        riteCharges.textContent = m.riteCharges > 0 ? String(m.riteCharges) : '';
      }
      const denied = tick < deniedUntil;
      if (denied !== pDenied) {
        pDenied = denied;
        rite.classList.toggle('is-denied', denied);
      }
      const shown = bannerShown(banner, tick);
      if (shown !== pBanner) showBanner(shown);
      const hintOn = hintStep(hint, tick, view.player.x, view.player.y, riteCast);
      if (hintOn !== pHint) {
        pHint = hintOn;
        el.classList.toggle('has-hint', hintOn);
      }
    },
  };
}
