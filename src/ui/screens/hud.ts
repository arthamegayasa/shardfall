// S03 HUD during a Pulse (ui-spec S03, style guide 2.2): HP, Lv and XP bar, Pulse timer (or boss /
// held Warden bar in the same slot), Glint, Rite cooldown. Every frame: fill the model without
// allocation, then touch the DOM only for fields that changed.

import type { SimEventReader, WorldView } from '../../core/index.ts';
import { SimEventType } from '../../core/index.ts';
import { h, put } from '../dom.ts';
import { formatClock, formatInt } from '../format.ts';
import { enemyNameKey } from '../presenters/content.ts';
import { createHudModel, fillHudModel, TimerMode } from '../presenters/hud.ts';
import type { Screen, UiContext } from './types.ts';

export function createHudScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-hud');
  el.setAttribute('aria-hidden', 'true');
  const model = createHudModel();
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

  // Top centre: timer or foe bar.
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
  put(tc, pulseLabel, timerText, foeWrap);

  // Top right: Glint.
  const tr = h(doc, 'div', 'hud-tr');
  const glintText = h(doc, 'span', 'num');
  put(tr, h(doc, 'span', 'glint-icon'), glintText);

  // Bottom centre: Rite.
  const bc = h(doc, 'div', 'hud-bc');
  const rite = h(doc, 'div', 'rite');
  const riteFill = h(doc, 'div', 'rite-fill');
  const riteSecs = h(doc, 'span', 'rite-secs');
  const riteKey = h(doc, 'span', 'rite-key');
  put(rite, riteFill, riteSecs);
  put(bc, rite, riteKey);

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
  let pEnraged = false;
  let pGlint = NaN;
  let pRiteReady = false;
  let pRiteSecs = NaN;
  let pRiteFrac = NaN;

  const reset = (): void => {
    pHp = pMax = pHpFrac = pLevel = pXp = pPulse = pSecs = pFoeType = pFoeFrac = pGlint = NaN;
    pRiteSecs = pRiteFrac = NaN;
    pMode = -1;
    pLow = pFinal = pEnraged = pRiteReady = false;
    el.classList.remove('is-low', 'is-final', 'mode-boss', 'mode-held', 'is-enraged');
    rite.classList.remove('is-ready');
    riteKey.textContent = ctx.keyHint('rite');
  };

  return {
    el,
    focus: null,
    enter() {
      reset();
    },
    update(view: WorldView, events: SimEventReader) {
      for (let i = 0; i < events.count; i++) {
        if (events.type[i] === SimEventType.PlayerHpLowChanged) lowHp = events.a[i] === 1;
        else if (events.type[i] === SimEventType.PulseStarted) lowHp = false;
      }
      fillHudModel(view, lowHp, model);
      const m = model;
      if (m.hp !== pHp || m.maxHp !== pMax) {
        pHp = m.hp;
        pMax = m.maxHp;
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
          const key = enemyNameKey(deps.data, m.foeTypeIndex);
          foeName.textContent = key === null ? '' : t(key);
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
    },
  };
}
