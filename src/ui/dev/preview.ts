// UI preview harness (dev server only, never bundled: vite builds index.html alone).
// Open http://localhost:5173/src/ui/dev/preview.html (optional ?screen=title|class|pulse|held|boss|
// reward|levelup|glazier|pause|settings|lost|won). Runs every M1 screen on a fake world driven by a
// tiny fake sim, with real data and strings when they build, else the test fixtures (ui-spec 12.3).

import type { AppActions, MetaView } from '../../core/dom.ts';
import { encodeSource, OfferKind, SimEventType, SourceKind, TICK_RATE } from '../../core/index.ts';
import type {
  Command,
  InventorySlotView,
  Settings,
  ShopOfferView,
  SimEventReader,
} from '../../core/index.ts';
import { buildGameData, buildRaw } from '../../content/index.ts';
import type { GameData } from '../../content/index.ts';
import { createFakeWorld } from '../../../tests/fixtures/fake-world.ts';
import { createUiWith } from '../ui-root.ts';

const realCsv = import.meta.glob('/content/data/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const fixtureCsv = import.meta.glob('/tests/fixtures/data/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const stringsText = import.meta.glob('/content/strings/en.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function byName(mods: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, text] of Object.entries(mods)) {
    const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.csv$/, '');
    if (typeof text === 'string') out[name] = text;
  }
  return out;
}

function loadData(): { data: GameData; strings: Record<string, string> } {
  const strings = Object.values(stringsText)[0];
  const stringText = typeof strings === 'string' ? strings : null;
  for (const csv of [byName(realCsv), byName(fixtureCsv)]) {
    const out = buildRaw({ csv, levels: {}, strings: stringText, contentTier: 'A' });
    if (out.ok && out.data.missingTables.length === 0) {
      return { data: buildGameData(out.data), strings: { ...out.strings } };
    }
  }
  const out = buildRaw({
    csv: byName(fixtureCsv),
    levels: {},
    strings: stringText,
    contentTier: 'A',
  });
  return { data: buildGameData(out.data), strings: { ...out.strings } };
}

const { data, strings } = loadData();
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const mut = <T>(v: T): Mutable<T> => v;
const world = createFakeWorld({
  phase: 'idle',
  statCount: data.stats.length,
  tagCount: data.tags.length,
});
const P = mut(world.player);
const PU = mut(world.pulse);

let settings: Settings = {
  v: 1,
  graphics: { quality: 'medium', screenShake: 100, fullscreen: false },
  audio: {
    master: 80,
    music: 70,
    sfx: 100,
    ui: 80,
    mono: false,
    reduceRepeats: false,
    muteWhenUnfocused: true,
  },
  access: {
    textScale: 0,
    reduceEffects: false,
    damageNumbers: true,
    colorVision: 'off',
    pauseWhenUnfocused: true,
    showFlavor: true,
    solidPanels: false,
    shopTimer: 'on',
  },
  keybinds: {
    moveUp: ['KeyW', 'ArrowUp'],
    moveDown: ['KeyS', 'ArrowDown'],
    moveLeft: ['KeyA', 'ArrowLeft'],
    moveRight: ['KeyD', 'ArrowRight'],
    rite: ['Space', null],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'Space'],
    back: ['Escape', 'Backspace'],
    reroll: ['KeyR', null],
    lock: ['KeyL', null],
    beginPulse: ['KeyB', null],
    stats: ['KeyT', null],
    merge: ['KeyM', null],
    sell: ['KeyX', null],
  },
};

// ---- Fake events (only CommandRejected and ItemBought, enough for feedback) ----
const ev = { count: 0, type: [0], x: [0], y: [0], a: [0], b: [0], c: [0] };
const events: SimEventReader = ev;
function emit(type: number, a: number, b = 0): void {
  ev.type[ev.count] = type;
  ev.a[ev.count] = a;
  ev.b[ev.count] = b;
  ev.x[ev.count] = 0;
  ev.y[ev.count] = 0;
  ev.c[ev.count] = 0;
  ev.count++;
}

// ---- Fake sim ----
const PULSE_SECS = 12;
const weaponCount = Math.max(1, data.weapons.length);
const mementoCount = Math.max(1, data.mementos.length);
let rerolls = 0;

function setPhase(p: typeof world.phase): void {
  world.phase = p;
  world.phaseRevision++;
}

function makeOffers(): ShopOfferView[] {
  const owned = new Set(
    world.shop.inventory.filter((s) => s.weaponIndex >= 0).map((s) => s.weaponIndex),
  );
  const offers: ShopOfferView[] = [];
  for (let i = 0; i < 4; i++) {
    const old = world.shop.offers[i];
    if (old?.locked === true) {
      offers.push(old);
      continue;
    }
    const isWeapon = (i + rerolls) % 3 !== 2;
    const def = isWeapon ? (i + rerolls) % weaponCount : (i + rerolls) % mementoCount;
    const price = 8 + ((i * 5 + rerolls * 3) % 14);
    const slot = isWeapon
      ? world.shop.inventory.findIndex((s) => s.weaponIndex === def && s.tier === 1)
      : -1;
    offers.push({
      kind: isWeapon ? OfferKind.Weapon : OfferKind.Memento,
      defIndex: def,
      tier: isWeapon ? 1 : 1 + (i % 2),
      price,
      locked: false,
      affordable: P.glint >= price,
      mergeSlot: slot,
      mergeToTier: slot >= 0 ? 2 : 0,
      blockedNoSlot: false,
      isNewId: isWeapon ? !owned.has(def) : true,
    });
  }
  return offers;
}

function bump(counts: Float64Array, tag: string): void {
  const i = data.tags.findIndex((t) => t.id === tag);
  if (i >= 0) counts[i] = (counts[i] ?? 0) + 1;
}

function refreshShop(offers?: readonly ShopOfferView[]): void {
  const inv = world.shop.inventory;
  const inventory: InventorySlotView[] = inv.map((s, i) => ({
    ...s,
    canMerge:
      s.weaponIndex >= 0 &&
      inv.some((o, j) => j !== i && o.weaponIndex === s.weaponIndex && o.tier === s.tier),
  }));
  const tagCounts = new Float64Array(data.tags.length);
  const seen = new Set<string>();
  for (const s of inventory) {
    const w = data.weapons[s.weaponIndex];
    if (w === undefined || seen.has(w.id)) continue;
    seen.add(w.id);
    for (const tag of w.tags) bump(tagCounts, tag);
  }
  for (const m of world.shop.mementos) {
    for (const tag of data.mementos[m.mementoIndex]?.tags ?? []) {
      bump(tagCounts, tag);
    }
  }
  world.shop = {
    ...world.shop,
    revision: world.shop.revision + 1,
    offers: (offers ?? world.shop.offers).map((o) => ({
      ...o,
      affordable: P.glint >= o.price,
    })),
    inventory,
    tagCounts,
    rerollPrice: 3 + rerolls,
  };
}

function startRun(): void {
  const p = P;
  const cls = data.classes[0];
  p.maxHp = cls?.maxHp ?? 30;
  p.hp = p.maxHp;
  p.level = 1;
  p.xp = 0;
  p.glint = 40;
  PU.index = 0;
  PU.count = 10;
  rerolls = 0;
  const start =
    cls === undefined
      ? 0
      : Math.max(
          0,
          data.weapons.findIndex((w) => w.id === cls.startWeapon),
        );
  const inventory: InventorySlotView[] = [];
  for (let i = 0; i < 6; i++) {
    inventory.push({
      weaponIndex: i === 0 ? start : -1,
      tier: i === 0 ? 1 : 0,
      sellPrice: 6,
      canMerge: false,
    });
  }
  world.shop = { ...world.shop, inventory, mementos: [], offers: [] };
  world.runStats = { ...world.runStats, kills: 0, glintEarned: 0, runTicks: 0, killedBy: 0 };
  beginPulse();
}

function beginPulse(): void {
  PU.ticksTotal = PULSE_SECS * TICK_RATE;
  PU.ticksLeft = PU.ticksTotal;
  PU.overtime = false;
  PU.wardenAlive = false;
  PU.warden = { ...PU.warden, active: false };
  PU.isBoss = false;
  PU.boss = { ...PU.boss, active: false };
  setPhase('pulse');
}

function endPulse(): void {
  P.glint += 25;
  world.runStats = {
    ...world.runStats,
    pulsesCleared: PU.index + 1,
    glintEarned: world.runStats.glintEarned + 25,
  };
  P.level += 2;
  world.levelUp = {
    revision: world.levelUp.revision + 1,
    pending: 2,
    total: 2,
    choices: levelChoices(),
  };
  if (PU.index % 2 === 0) {
    world.reward = {
      revision: world.reward.revision + 1,
      sourceTypeIndex: Math.max(
        0,
        data.enemies.findIndex((e) => e.role === 'warden'),
      ),
      choices: [0, 1, 2]
        .filter((i) => i < data.mementos.length)
        .map((i) => ({ mementoIndex: i, rarity: i % 4 })),
    };
    setPhase('reward');
  } else setPhase('levelUp');
}

function levelChoices(): { cardIndex: number; rarity: number; value: number }[] {
  const n = data.levelUpCards.length;
  const out: { cardIndex: number; rarity: number; value: number }[] = [];
  for (let i = 0; i < Math.min(3, n); i++) {
    const card = data.levelUpCards[(i + P.level) % n];
    if (card === undefined) continue;
    out.push({
      cardIndex: (i + P.level) % n,
      rarity: i,
      value: [card.plain, card.fine, card.rare][i] ?? 1,
    });
  }
  return out;
}

function openShop(): void {
  refreshShop(makeOffers());
  setPhase('shop');
}

function reject(reason: number): void {
  emit(SimEventType.CommandRejected, reason);
}

const commands = {
  send(cmd: Command): void {
    const shop = world.shop;
    switch (cmd.type) {
      case 'reward.pick': {
        const c = world.reward.choices[cmd.choice];
        if (c !== undefined)
          world.shop = {
            ...shop,
            mementos: [...shop.mementos, { mementoIndex: c.mementoIndex, count: 1 }],
          };
        setPhase('levelUp');
        break;
      }
      case 'levelup.pick': {
        const pending = world.levelUp.pending - 1;
        if (pending > 0) {
          world.levelUp = {
            ...world.levelUp,
            revision: world.levelUp.revision + 1,
            pending,
            choices: levelChoices(),
          };
        } else openShop();
        break;
      }
      case 'shop.buy': {
        const o = shop.offers[cmd.offer];
        if (o === undefined || (o.kind !== OfferKind.Weapon && o.kind !== OfferKind.Memento)) {
          reject(3);
          return;
        }
        if (P.glint < o.price) {
          reject(2);
          return;
        }
        P.glint -= o.price;
        let inventory = shop.inventory;
        let mementos = shop.mementos;
        if (o.kind === OfferKind.Weapon) {
          const free = inventory.findIndex((s) => s.weaponIndex < 0);
          if (o.mergeSlot >= 0)
            inventory = inventory.map((s, i) =>
              i === o.mergeSlot ? { ...s, tier: s.tier + 1 } : s,
            );
          else if (free >= 0)
            inventory = inventory.map((s, i) =>
              i === free ? { ...s, weaponIndex: o.defIndex, tier: o.tier } : s,
            );
          else {
            reject(4);
            return;
          }
        } else mementos = [...mementos, { mementoIndex: o.defIndex, count: 1 }];
        world.shop = { ...shop, inventory, mementos };
        emit(SimEventType.ItemBought, o.kind, o.defIndex);
        refreshShop(
          shop.offers.map((x, i) =>
            i === cmd.offer ? { ...x, kind: OfferKind.Taken, locked: false } : x,
          ),
        );
        break;
      }
      case 'shop.reroll':
        if (P.glint < shop.rerollPrice) {
          reject(2);
          return;
        }
        P.glint -= shop.rerollPrice;
        rerolls++;
        refreshShop(makeOffers());
        break;
      case 'shop.lock':
        refreshShop(
          shop.offers.map((x, i) => (i === cmd.offer ? { ...x, locked: cmd.locked } : x)),
        );
        break;
      case 'shop.sell': {
        const s = shop.inventory[cmd.inventorySlot];
        if (s === undefined || s.weaponIndex < 0) {
          reject(3);
          return;
        }
        P.glint += s.sellPrice;
        world.shop = {
          ...shop,
          inventory: shop.inventory.map((x, i) =>
            i === cmd.inventorySlot ? { ...x, weaponIndex: -1, tier: 0 } : x,
          ),
        };
        refreshShop();
        break;
      }
      case 'shop.merge': {
        const s = shop.inventory[cmd.inventorySlot];
        if (s?.canMerge !== true) {
          reject(5);
          return;
        }
        const other = shop.inventory.findIndex(
          (o, j) => j !== cmd.inventorySlot && o.weaponIndex === s.weaponIndex && o.tier === s.tier,
        );
        world.shop = {
          ...shop,
          inventory: shop.inventory.map((x, i) =>
            i === cmd.inventorySlot
              ? { ...x, tier: x.tier + 1 }
              : i === other
                ? { ...x, weaponIndex: -1, tier: 0 }
                : x,
          ),
        };
        refreshShop();
        break;
      }
      case 'pulse.begin':
        PU.index++;
        beginPulse();
        break;
      case 'run.abandon':
        world.runStats = { ...world.runStats, killedBy: 0 };
        setPhase('defeat');
        break;
      default:
        break;
    }
  },
};

// ---- Fake app ----
let held = false;
let ui: ReturnType<ReturnType<typeof createUiWith>> | null = null;
const app: AppActions = {
  startRun() {
    startRun();
    ui?.setScreen('run');
  },
  continueRun() {
    startRun();
    openShop();
    ui?.setScreen('run');
  },
  pause() {
    held = true;
    ui?.setScreen('paused');
  },
  resume() {
    held = false;
    ui?.setScreen('run');
  },
  openSettings() {
    ui?.setScreen('settings');
  },
  openArchive() {
    ui?.setScreen('archive');
  },
  applySettings(s) {
    settings = s;
  },
  unlock: () => false,
  deleteSaveData() {
    /* not in preview */
  },
  quitToTitle() {
    setPhase('idle');
    ui?.setScreen('title');
  },
};
const meta = (): MetaView => ({
  silt: 0,
  unlocked: [],
  mementosFound: [],
  highestDifficultyWon: -1,
  lastClassId: data.classes[0]?.id ?? '',
  hasRunSave: true,
});

const root = document.querySelector<HTMLElement>('#ui-root');
if (root === null) throw new Error('#ui-root missing');
ui = createUiWith({ devStrings: false })({
  root,
  strings,
  data,
  commands,
  app,
  projector: {
    worldToCss: () => undefined,
    cssToWorld: () => undefined,
  } as never,
  sound: { play: () => undefined },
  settings: () => settings,
  meta,
  art: { sprites: [], tiles: [], palette: {} as never },
});

// ---- Deep links for screenshots ----
const jump = new URLSearchParams(location.search).get('screen') ?? 'title';
const initial: Record<string, () => void> = {
  title: () => undefined,
  class: () => {
    ui.setScreen('classSelect');
  },
  pulse: () => {
    app.startRun('', 0);
  },
  held: () => {
    app.startRun('', 0);
    PU.index = 4;
    PU.ticksLeft = 0;
    PU.overtime = true;
    PU.wardenAlive = true;
    const wi = Math.max(
      0,
      data.enemies.findIndex((e) => e.role === 'warden'),
    );
    PU.warden = {
      active: true,
      typeIndex: wi,
      hp: 30,
      maxHp: 80,
      shield: 0,
      phase: 1,
      enraged: true,
    };
  },
  boss: () => {
    app.startRun('', 0);
    PU.index = 9;
    PU.isBoss = true;
    PU.ticksLeft = 0;
    PU.ticksTotal = 0;
    PU.boss = {
      active: true,
      typeIndex: 0,
      hp: 600,
      maxHp: 900,
      shield: 0,
      phase: 2,
      enraged: false,
    };
  },
  reward: () => {
    app.startRun('', 0);
    endPulse();
  },
  levelup: () => {
    app.startRun('', 0);
    PU.index = 1;
    endPulse();
  },
  glazier: () => {
    app.continueRun();
  },
  pause: () => {
    app.continueRun();
    app.pause();
  },
  settings: () => {
    app.openSettings();
  },
  lost: () => {
    app.startRun('', 0);
    PU.index = 6;
    world.runStats = {
      ...world.runStats,
      kills: 412,
      glintEarned: 230,
      runTicks: 125 * TICK_RATE,
      killedBy: encodeSource(SourceKind.EnemyContact, 0),
    };
    setPhase('defeat');
  },
  won: () => {
    app.startRun('', 0);
    PU.index = 9;
    setPhase('victory');
  },
};
const run = initial[jump] ?? initial['title'];
// Jump after the first frame so the UI has seen a view (the pause summary reads it).
let jumped = false;

// ---- Loop ----
let last = performance.now();
function frame(now: number): void {
  const dt = now - last;
  last = now;
  if (!held && world.phase === 'pulse' && !PU.overtime && !PU.isBoss) {
    PU.ticksLeft = Math.max(0, PU.ticksLeft - Math.round((dt / 1000) * TICK_RATE));
    P.riteCooldownTicks = Math.max(0, P.riteCooldownTicks - 1);
    world.runStats = { ...world.runStats, runTicks: world.runStats.runTicks + 1 };
    if (PU.ticksLeft === 0) endPulse();
  }
  if (!held) ui?.update(world, events);
  if (!jumped) {
    jumped = true;
    run?.();
  }
  ev.count = 0;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
