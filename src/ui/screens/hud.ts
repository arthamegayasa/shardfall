// S03 HUD during a wave (ui-spec S03, redesign 1.1 3.2): HP with a heart and "30/30", a labelled XP
// bar, "Wave 3 of 15" over the timer (or the boss / held elite bar in the same slot), gold, the
// weapon strip (one icon per owned slot, pulses on each shot, dims when idle, "New" after a
// purchase), and the Skill with icon, key and cooldown. Transient: elite and boss arrival banners,
// "Wave {n}: defeat the elite", a short wave banner, and the control hint chips in wave 1.
// Every frame: fill the model without allocation, then touch the DOM only for changed fields.

import type { SimEventReader, WorldView } from '../../core/index.ts';
import { SimEventType, SourceKind, sourceIndexOf, sourceKindOf } from '../../core/index.ts';
import { h, put, setText } from '../dom.ts';
import { formatClock, formatInt, keyLabel } from '../format.ts';
import { enemyNameKey } from '../presenters/content.ts';
import { createHudModel, fillHudModel, pendingBossType, TimerMode } from '../presenters/hud.ts';
import {
  BannerKind,
  bannerClear,
  bannerEvent,
  bannerHeld,
  bannerShown,
  createBanner,
  createTransientClock,
  createHint,
  createWeaponStrip,
  hintStart,
  hintStep,
  HIT_FLASH_TICKS,
  LEVEL_FLASH_TICKS,
  moveKeysText,
  runRestarted,
  RITE_DENIED_TICKS,
  stripFired,
  stripHit,
  stripIdle,
  stripLit,
  stripNew,
  stripReset,
  stripSync,
  stripWaveStart,
} from '../presenters/hud-transient.ts';
import { glintIcon, iconBox } from './components.ts';
import type { Screen, UiContext } from './types.ts';

const BANNER_CLASS: Readonly<Record<number, string>> = {
  [BannerKind.Pulse]: 'is-pulse',
  [BannerKind.Warden]: 'is-foe',
  [BannerKind.Boss]: 'is-foe',
  [BannerKind.Held]: 'is-foe',
};

/** DOM of one weapon strip slot plus the values last written to it. */
interface SlotEls {
  readonly root: HTMLElement;
  readonly art: HTMLElement;
  readonly tier: HTMLElement;
  readonly fresh: HTMLElement;
  /** Shown WeaponIndex (-1 hidden, NaN forces a rebuild). */
  weapon: number;
  tierN: number;
  seq: number;
  flip: boolean;
  idle: boolean;
  lit: boolean;
  isNew: boolean;
}

export function createHudScreen(ctx: UiContext): Screen {
  const { doc, t, deps } = ctx;
  const el = h(doc, 'div', 'screen screen-hud');
  el.setAttribute('aria-hidden', 'true');
  const model = createHudModel();
  const banner = createBanner();
  const hint = createHint();
  const clock = createTransientClock();
  const strip = createWeaponStrip();
  // Orbit shards hit by contact and send no fire event: their own hits wake the icon instead.
  const isContact = (wi: number): boolean => deps.data.weapons[wi]?.archetype === 'orbit';
  let lowHp = false;

  // Top left: heart and HP bar, then the labelled XP bar.
  const tl = h(doc, 'div', 'hud-tl');
  const hpRow = h(doc, 'div', 'hud-hp');
  const hpBar = h(doc, 'div', 'bar bar-hp');
  const hpFill = h(doc, 'div', 'bar-fill');
  const hpText = h(doc, 'span', 'bar-text');
  const hpCrack = h(doc, 'span', 'hp-crack');
  put(hpBar, hpFill, hpText, hpCrack);
  put(hpRow, put(h(doc, 'span', 'hp-plate'), h(doc, 'span', 'hp-heart')), hpBar);
  const lvRow = h(doc, 'div', 'hud-lv');
  const lvText = h(doc, 'span', 'lv-text');
  const xpBar = h(doc, 'div', 'bar bar-xp');
  const xpFill = h(doc, 'div', 'bar-fill');
  put(xpBar, xpFill);
  put(tl, hpRow, put(lvRow, lvText, xpBar));

  // Top centre: "Wave 3 of 15", the timer or foe bar, then the banner.
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

  // Top right: gold.
  const tr = h(doc, 'div', 'hud-tr');
  const glintText = h(doc, 'span', 'num');
  put(tr, glintIcon(ctx, 16), glintText);

  // Bottom left: the weapon strip, one icon per owned slot (built when the inventory grows).
  const bl = h(doc, 'div', 'hud-bl');
  const weaponsEl = h(doc, 'div', 'hud-weapons');
  put(bl, weaponsEl);
  const slotEls: SlotEls[] = [];
  const slotAt = (i: number): SlotEls => {
    const have = slotEls[i];
    if (have !== undefined) return have;
    const root = h(doc, 'div', 'hud-weapon');
    root.dataset['ui'] = `hud-weapon-${String(i + 1)}`;
    root.hidden = true;
    const art = h(doc, 'span', 'hud-weapon-art');
    const tier = h(doc, 'span', 'hud-weapon-tier');
    const fresh = h(doc, 'span', 'hud-weapon-new', t('ui.hud.weapon_new'));
    put(weaponsEl, put(root, art, tier, fresh));
    const made: SlotEls = {
      root,
      art,
      tier,
      fresh,
      weapon: NaN,
      tierN: NaN,
      seq: strip.pulseSeq[i] ?? 0,
      flip: false,
      idle: false,
      lit: false,
      isNew: false,
    };
    slotEls[i] = made;
    return made;
  };

  // Bottom centre: control hint chips, Skill.
  const bc = h(doc, 'div', 'hud-bc');
  const hintEl = h(doc, 'div', 'hud-hint');
  const hintMove = h(doc, 'span', 'chip hint-item');
  const hintAuto = h(doc, 'span', 'chip hint-item');
  const hintRite = h(doc, 'span', 'chip hint-item');
  put(hintEl, hintMove, hintAuto, hintRite);
  const rite = h(doc, 'div', 'rite');
  const riteIcon = h(doc, 'span', 'rite-icon');
  const riteFill = h(doc, 'div', 'rite-fill');
  const riteSecs = h(doc, 'span', 'rite-secs');
  const riteCharges = h(doc, 'span', 'rite-charges');
  put(rite, riteIcon, riteFill, riteSecs, riteCharges);
  const riteKey = h(doc, 'span', 'rite-key');
  put(bc, hintEl, rite, riteKey);

  put(el, tl, tc, tr, bl, bc);

  // Last written values (NaN forces the first write).
  let pHp = NaN;
  let pMax = NaN;
  let pHpFrac = NaN;
  let pLow = false;
  let pLevel = NaN;
  let pXp = NaN;
  let pPulse = NaN;
  let pPulseCount = NaN;
  let pShopRev = NaN;
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
  let pBannerUntil = 0;
  let pHint = false;
  let deniedUntil = 0;
  let pDenied = false;
  let levelUntil = 0;
  let pLevelFlash = false;
  let hitUntil = 0;
  let pHit = false;
  let bossHintPulse = -1;
  let bossHint = -1;

  const foeNameText = (typeIndex: number): string => {
    const key = enemyNameKey(deps.data, typeIndex);
    return key === null ? '' : t(key);
  };

  const showBanner = (kind: number): void => {
    pBanner = kind;
    pBannerUntil = banner.untilTick;
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
      // Arrival: "Elite: Brass Collar" (a boss shows its proper name), epithet below (CD K1).
      const key = enemyNameKey(deps.data, banner.typeIndex);
      const name = key === null ? '' : t(key);
      setText(
        bannerMain,
        kind === BannerKind.Warden && name !== '' ? t('ui.banner.warden', { name }) : name,
      );
      const epithet = key === null ? '' : `${key}.epithet`;
      setText(bannerSub, epithet !== '' && ctx.has(epithet) ? t(epithet) : '');
    }
  };

  /** Rebuilds a slot's icon and tier numeral, only when its weapon or tier changed. */
  const showSlot = (i: number): void => {
    const s = slotAt(i);
    const owned = i < strip.slots && (strip.weaponIndex[i] ?? -1) >= 0;
    const wi = owned ? (strip.weaponIndex[i] ?? -1) : -1;
    const tier = owned ? (strip.tier[i] ?? 0) : 0;
    if (s.weapon === wi && s.tierN === tier) return;
    s.weapon = wi;
    s.tierN = tier;
    s.root.hidden = !owned;
    s.art.textContent = '';
    const def = owned ? deps.data.weapons[wi] : undefined;
    if (def === undefined) {
      s.tier.textContent = '';
      return;
    }
    s.art.appendChild(
      iconBox(ctx, { kind: 'weapon', id: def.id }, t(def.nameKey), def.tags, 'big'),
    );
    s.tier.textContent = ctx.tier(tier);
  };

  /** Per frame: shot pulse, idle dim, reduce-effects flash and the "New" glow, on change only. */
  const stepSlot = (i: number, tick: number): void => {
    const s = slotEls[i];
    if (s === undefined || !(s.weapon >= 0)) return;
    const seq = strip.pulseSeq[i] ?? 0;
    if (seq !== s.seq) {
      s.seq = seq;
      // Two identical keyframes under two names: switching restarts the pulse without a reflow.
      s.root.classList.remove(s.flip ? 'fire-a' : 'fire-b');
      s.flip = !s.flip;
      s.root.classList.add(s.flip ? 'fire-a' : 'fire-b');
    }
    const idle = stripIdle(strip, i, tick);
    if (idle !== s.idle) {
      s.idle = idle;
      s.root.classList.toggle('is-idle', idle);
    }
    const lit = stripLit(strip, i, tick);
    if (lit !== s.lit) {
      s.lit = lit;
      s.root.classList.toggle('is-lit', lit);
    }
    const isNew = stripNew(strip, i, tick);
    if (isNew !== s.isNew) {
      s.isNew = isNew;
      s.root.classList.toggle('is-new', isNew);
    }
  };

  /** Mirrors the inventory when the shop view changed (purchase, sale, grant, new run). */
  const syncStrip = (view: WorldView, tick: number): void => {
    pShopRev = view.shop.revision;
    stripSync(strip, view.shop.inventory, isContact, tick);
    const n = Math.max(strip.slots, slotEls.length);
    for (let i = 0; i < n; i++) showSlot(i);
  };

  const reset = (): void => {
    pHp = pMax = pHpFrac = pLevel = pXp = pPulse = pSecs = pFoeType = pFoeFrac = pGlint = NaN;
    pRiteSecs = pRiteFrac = pRiteCharges = pRiteIndex = NaN;
    pPulseCount = pShopRev = NaN;
    pMode = -1;
    pLow = pFinal = pEnraged = pRiteReady = pPending = pDenied = pLevelFlash = pHit = false;
    el.classList.remove(
      'is-low',
      'is-final',
      'mode-boss',
      'mode-held',
      'is-enraged',
      'is-pending',
      'has-hint',
      'is-level-up',
      'is-hit',
    );
    for (const s of slotEls) {
      s.weapon = s.tierN = NaN;
      s.fresh.textContent = t('ui.hud.weapon_new');
    }
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
    hintAuto.textContent = t('ui.hud.hint_auto');
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
      if (runRestarted(clock, tick)) {
        // New run (BUG-008): nothing timed by the old run's clock may carry over.
        bannerClear(banner);
        hint.active = false;
        deniedUntil = levelUntil = hitUntil = 0;
        lowHp = false;
        stripReset(strip);
        pShopRev = NaN;
      }
      // Inventory first, so a wave start below compares this wave's weapons with the last one's.
      if (view.shop.revision !== pShopRev) syncStrip(view, tick);
      const pulseNumber = view.pulse.index + 1;
      let riteCast = false;
      for (let i = 0; i < events.count; i++) {
        const type = events.type[i] ?? 0;
        const a = events.a[i] ?? 0;
        if (type === SimEventType.WeaponFired) stripFired(strip, events.c[i] ?? -1, tick);
        else if (type === SimEventType.EnemyDamaged) {
          const src = events.c[i] ?? 0;
          if (sourceKindOf(src) === SourceKind.Weapon) stripHit(strip, sourceIndexOf(src), tick);
        } else if (type === SimEventType.PlayerHpLowChanged) lowHp = a === 1;
        else if (type === SimEventType.PulseStarted) {
          lowHp = false;
          // Wave 1 of a run marks nothing new; later waves glow the slots bought since the last.
          if (a === 0) strip.hasStart = false;
          stripWaveStart(strip, tick);
          // Control hint in Pulse 1 of the first run only (LP M2-09, MetaView.runs).
          if (a === 0 && (deps.meta().runs ?? 0) === 0)
            hintStart(hint, tick, view.player.x, view.player.y);
        } else if (type === SimEventType.RiteCast) riteCast = true;
        else if (type === SimEventType.RiteRejected) deniedUntil = tick + RITE_DENIED_TICKS;
        else if (type === SimEventType.PlayerLeveledUp) levelUntil = tick + LEVEL_FLASH_TICKS;
        else if (type === SimEventType.PlayerDamaged) hitUntil = tick + HIT_FLASH_TICKS;
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
      if (m.pulseNumber !== pPulse || m.pulseCount !== pPulseCount) {
        pPulse = m.pulseNumber;
        pPulseCount = m.pulseCount;
        pulseLabel.textContent =
          m.pulseCount > 0
            ? t('ui.hud.wave_of', { n: m.pulseNumber, total: m.pulseCount })
            : t('ui.hud.pulse', { n: m.pulseNumber });
      }
      if (m.timerMode !== pMode) {
        // The timer slot just became the held elite bar: announce it once (CD K3, style 2.2).
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
      const levelFlash = tick < levelUntil;
      if (levelFlash !== pLevelFlash) {
        pLevelFlash = levelFlash;
        el.classList.toggle('is-level-up', levelFlash);
      }
      const hit = tick < hitUntil;
      if (hit !== pHit) {
        pHit = hit;
        el.classList.toggle('is-hit', hit);
      }
      for (let i = 0; i < strip.slots; i++) stepSlot(i, tick);
      const shown = bannerShown(banner, tick);
      // A new banner of the same kind (back-to-back waves) still needs its text.
      if (shown !== pBanner || (shown !== BannerKind.None && banner.untilTick !== pBannerUntil))
        showBanner(shown);
      const hintOn = hintStep(hint, tick, view.player.x, view.player.y, riteCast);
      if (hintOn !== pHint) {
        pHint = hintOn;
        el.classList.toggle('has-hint', hintOn);
      }
    },
  };
}
