// Balance bots (GD, M2-01). Read the WorldView, act only through InputFrame and Commands, like a player.
// Three policies:
// - expert and good: sample 16 move directions plus standing still, score each by predicted danger
//          (Unlit bodies, enemy shots, telegraphs and danger zones), Glint pull, boss/Warden reach and
//          walls. Cast the Rite at the densest cluster. Buy by tag (class tag first, then the leading
//          tag), prefer weapon merges, reroll when nothing fits, pick Temper cards by priority with
//          diminishing returns. good adds human limits (see SKILLS); expert has none.
// - naive: flees the nearest Unlit with a pull to the centre, buys random affordable offers, picks
//          random cards (same behaviour as QA dodgerRandom, test-plan 6.3).
// Bot numbers below are bot behaviour, not game balance: they never feed the sim.

import {
  AreaShape,
  Button,
  DEPTH_PX_PER_U,
  INPUT_AXIS_MAX,
  OfferKind,
  PX_PER_U,
} from '../../../src/core/index.ts';
import type { Command, InputFrame, WorldView } from '../../../src/core/index.ts';
import type { GameData } from '../../../src/content/index.ts';

export type BotKind = 'expert' | 'good' | 'naive';

/**
 * Movement skill of the sampling bots. good approximates an attentive human: a new decision about
 * every 200 ms (visual reaction time 0.2 to 0.25 s), input held in between, shots noticed only
 * within 5 u, and about one decision in eight not the best one. expert has none of these limits and
 * marks the ceiling of what the data allows.
 */
interface Skill {
  readonly decideTicks: number;
  readonly mistakeChance: number;
  readonly shotAwarenessU: number;
  /** Unlit bodies tracked at once (nearest first). */
  readonly attention: number;
  /** Ticks between a decision and the input that carries it out (perception to action). */
  readonly lagTicks: number;
}
const SKILLS: Readonly<Record<'expert' | 'good', Skill>> = {
  expert: { decideTicks: 2, mistakeChance: 0, shotAwarenessU: 99, attention: 256, lagTicks: 0 },
  good: { decideTicks: 15, mistakeChance: 0.15, shotAwarenessU: 5, attention: 8, lagTicks: 9 },
};

/** Bot-only RNG (mulberry32). Never shared with the sim. */
export function botRng(seed: number): () => number {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

const DIRS = 16;
/** Lookahead horizons in seconds and their weights: near danger first, then where the path leads. */
const HORIZONS: readonly (readonly [number, number])[] = [
  [0.15, 0.4],
  [0.3, 1],
  [0.6, 0.5],
];
const LOOKAHEAD_S = 0.3;
const AIM_UNITS = 16;
/** AiState.Windup and Attack (src/sim/codes.ts): charge lines are also danger areas. */
const AI_WINDUP = 2;
const AI_ATTACK = 3;
/** A ring still in its telegraph has radius = band thickness; expanding speed is not in the view. */
const RING_TELEGRAPH_R = 0.61;
const RING_SPEED_GUESS = 4;

/** Temper card priority by stat id (good bot). Higher = preferred. */
const CARD_PRIORITY: Readonly<Record<string, number>> = {
  damage_pct: 10,
  attack_speed_pct: 9.5,
  max_hp: 8,
  armor: 7,
  area_pct: 6.5,
  crit_chance: 6,
  hp_regen: 6,
  dodge: 5.5,
  leech: 5,
  move_speed: 5,
  rite_haste: 4,
  range_pct: 4,
  pickup_radius_pct: 3.5,
  luck: 2,
};

function atan2Turns(y: number, x: number): number {
  return Math.atan2(y, x) / (Math.PI * 2);
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + vx * t);
  const dy = py - (ay + vy * t);
  return Math.sqrt(dx * dx + dy * dy);
}

export class BotPolicy {
  readonly kind: BotKind;
  private readonly data: GameData;
  private readonly rnd: () => number;
  private readonly statMove: number;
  private readonly classTag: number;
  private readonly weaponTags: number[][];
  private readonly mementoTags: number[][];
  private rerollsThisShop = 0;
  private readonly picks = new Map<string, number>();
  private readonly skill: Skill;
  private lastMoveX = 0;
  private lastMoveY = 0;
  private moveX = 0;
  private moveY = 0;
  /** Decisions waiting for their action tick: [tick, moveX, moveY]. */
  private readonly pending: [number, number, number][] = [];

  constructor(kind: BotKind, data: GameData, seed: number, classId: string) {
    this.kind = kind;
    this.skill = SKILLS[kind === 'naive' ? 'good' : kind];
    this.data = data;
    this.rnd = botRng(seed);
    this.statMove = data.index.stat('move_speed');
    const cls = data.classes.find((c) => c.id === classId);
    this.classTag = cls !== undefined ? data.index.tag(cls.tag) : 0;
    this.weaponTags = data.weapons.map((w) => w.tags.map((t) => data.index.tag(t)));
    this.mementoTags = data.mementos.map((m) => m.tags.map((t) => data.index.tag(t)));
  }

  // ---------------------------------------------------------------------------------------------
  // Pulse input

  pulseInput(v: WorldView, out: InputFrame, bounds: Bounds): void {
    out.pressed = 0;
    out.held = 0;
    if (this.kind === 'naive') {
      this.naiveMove(v, out);
      return;
    }
    if (v.tick % this.skill.decideTicks === 0) {
      this.goodMove(v, bounds);
      this.pending.push([v.tick + this.skill.lagTicks, this.lastMoveX, this.lastMoveY]);
    }
    while (this.pending.length > 0 && (this.pending[0]?.[0] ?? Infinity) <= v.tick) {
      const d = this.pending.shift();
      if (d !== undefined) {
        this.moveX = d[1];
        this.moveY = d[2];
      }
    }
    out.moveX = this.moveX;
    out.moveY = this.moveY;
    this.rite(v, out);
  }

  private naiveMove(v: WorldView, out: InputFrame): void {
    const p = v.player;
    const e = v.enemies;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < e.highWater; i++) {
      if (e.alive[i] === 0) continue;
      const dx = (e.x[i] ?? 0) - p.x;
      const dy = (e.y[i] ?? 0) - p.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    let mx = -p.x * 0.08;
    let my = -p.y * 0.12;
    if (best >= 0) {
      const dx = p.x - (e.x[best] ?? 0);
      const dy = p.y - (e.y[best] ?? 0);
      const d = Math.sqrt(bestD) || 1;
      mx += dx / d;
      my += dy / d;
      out.aimX = Math.round((e.x[best] ?? 0) * AIM_UNITS);
      out.aimY = Math.round((e.y[best] ?? 0) * AIM_UNITS);
      if (p.riteCharges > 0 && d < 6) out.pressed = Button.Rite;
    }
    const len = Math.sqrt(mx * mx + my * my);
    out.moveX = len > 0 ? Math.round((mx / len) * INPUT_AXIS_MAX) : 0;
    out.moveY = len > 0 ? Math.round((my / len) * INPUT_AXIS_MAX) : 0;
  }

  /** World displacement per second for a screen direction (mirrors src/sim player inputVelocity). */
  private velocity(v: WorldView, dx: number, dy: number, out: { x: number; y: number }): void {
    const speed =
      this.data.config.playerBaseSpeedUPerTick *
      60 *
      (1 + (v.player.stats[this.statMove] ?? 0) / 100);
    const r = this.data.config.playerVerticalScreenRatio;
    const k = 1 / Math.sqrt(dx * dx + (dy / r) * (dy / r));
    out.x = dx * k * speed;
    out.y = dy * k * speed * (PX_PER_U / DEPTH_PX_PER_U);
  }

  private goodMove(v: WorldView, bounds: Bounds): void {
    this.pickWatched(v);
    const vel = { x: 0, y: 0 };
    let bestCost = Infinity;
    let secondCost = Infinity;
    let bx = 0;
    let by = 0;
    let sx = 0;
    let sy = 0;
    for (let k = -1; k < DIRS; k++) {
      let dx = 0;
      let dy = 0;
      if (k >= 0) {
        const a = (k / DIRS) * Math.PI * 2;
        dx = Math.cos(a);
        dy = Math.sin(a);
        this.velocity(v, dx, dy, vel);
      } else {
        vel.x = 0;
        vel.y = 0;
      }
      let c = k < 0 ? 0.15 : 0; // small bias to keep moving
      for (const [h, w] of HORIZONS)
        c += w * this.cost(v, v.player.x + vel.x * h, v.player.y + vel.y * h, bounds, h);
      if (c < bestCost) {
        secondCost = bestCost;
        sx = bx;
        sy = by;
        bestCost = c;
        bx = dx;
        by = dy;
      } else if (c < secondCost) {
        secondCost = c;
        sx = dx;
        sy = dy;
      }
    }
    if (this.skill.mistakeChance > 0 && this.rnd() < this.skill.mistakeChance) {
      bx = sx;
      by = sy;
    }
    this.lastMoveX = Math.round(bx * INPUT_AXIS_MAX);
    this.lastMoveY = Math.round(by * INPUT_AXIS_MAX);
  }

  /** Slots of the Unlit the bot pays attention to this decision (nearest first). */
  private watched: number[] = [];

  private pickWatched(v: WorldView): void {
    const e = v.enemies;
    const p = v.player;
    const all: [number, number][] = [];
    for (let i = 0; i < e.highWater; i++) {
      if (e.alive[i] === 0) continue;
      const d =
        Math.hypot((e.x[i] ?? 0) - p.x, (e.y[i] ?? 0) - p.y) - ((e.rank[i] ?? 0) > 0 ? 100 : 0);
      all.push([d, i]);
    }
    all.sort((a, b) => a[0] - b[0]);
    this.watched = all.slice(0, this.skill.attention).map((x) => x[1]);
  }

  /** Danger cost of standing at (x, y) h seconds from now. */
  private cost(v: WorldView, x: number, y: number, b: Bounds, h: number): number {
    const pr = v.player.radius;
    let c = 0;
    // Walls: corners are traps in a swarm game.
    const wall = Math.min(x - b.minX, b.maxX - x, y - b.minY, b.maxY - y);
    if (wall < pr + 0.05) c += 200;
    else if (wall < 2.5) c += (2.5 - wall) * 2.5;
    c += (x * x) / 400 + (y * y) / 160; // gentle centre pull

    // Unlit bodies.
    const e = v.enemies;
    let nearest = Infinity;
    let bigX = 0;
    let bigY = 0;
    let bigActive = false;
    for (const i of this.watched) {
      const ex = e.x[i] ?? 0;
      const ey = e.y[i] ?? 0;
      const dx = x - ex;
      const dy = y - ey;
      const d = Math.sqrt(dx * dx + dy * dy);
      const gap = d - (e.radius[i] ?? 0.3) - pr;
      if (gap < nearest) nearest = gap;
      if ((e.rank[i] ?? 0) > 0) {
        bigActive = true;
        bigX = ex;
        bigY = ey;
      }
      const st = e.aiState[i] ?? 0;
      const w = st === AI_ATTACK ? 3 : st === AI_WINDUP ? 1.5 : 1;
      if (gap < 0.35) c += 60 * w;
      else if (gap < 3) c += (w * 1.2) / (gap * gap + 0.05);
    }

    // Enemy shots: predicted positions over the lookahead.
    const s = v.enemyShots;
    for (let i = 0; i < s.highWater; i++) {
      if (s.alive[i] === 0) continue;
      const aw = this.skill.shotAwarenessU;
      if (Math.abs((s.x[i] ?? 0) - v.player.x) > aw || Math.abs((s.y[i] ?? 0) - v.player.y) > aw)
        continue;
      const rr = (s.radius[i] ?? 0.2) + pr + 0.3;
      for (let step = 1; step <= 3; step++) {
        const t = (Math.max(h, LOOKAHEAD_S) * 60 * step) / 3;
        const sx = (s.x[i] ?? 0) + (s.vx[i] ?? 0) * t;
        const sy = (s.y[i] ?? 0) + (s.vy[i] ?? 0) * t;
        const dx = x - sx;
        const dy = y - sy;
        if (dx * dx + dy * dy < rr * rr) {
          c += 90;
          break;
        }
      }
    }

    // Telegraphs and danger zones.
    const da = v.dangerAreas;
    for (let i = 0; i < da.highWater; i++) {
      if (da.alive[i] === 0) continue;
      if (this.inArea(v, i, x, y, pr + 0.35)) {
        // Weight by time to impact so the next hit wins over a later one (double rings).
        let tta = (da.ticksLeft[i] ?? 0) / 60;
        if (da.shape[i] === AreaShape.Ring) {
          const d = Math.hypot(x - (da.x[i] ?? 0), y - (da.y[i] ?? 0));
          const r = da.radius[i] ?? 0;
          tta =
            r <= RING_TELEGRAPH_R
              ? tta + d / RING_SPEED_GUESS
              : Math.max(0, d - r) / RING_SPEED_GUESS;
        }
        c += 30 + 110 * Math.exp(-tta / 0.7);
      }
    }

    // Big foe: stay in weapon reach (most weapons reach 6 u, melee 2 u).
    if (bigActive) {
      const d = Math.hypot(x - bigX, y - bigY);
      if (d > 4.5) c += (d - 4.5) * 0.6;
    } else if (nearest > 5) {
      // Nothing near: drift toward Unlit so weapons keep firing.
      c += (nearest - 5) * 0.15;
    }

    // Glint: worth a detour only when the spot is calm.
    if (c < 20) {
      const pk = v.pickups;
      let best = Infinity;
      for (let i = 0; i < pk.highWater; i++) {
        if (pk.alive[i] === 0 || pk.magnetized[i] === 1) continue;
        const d = Math.hypot(x - (pk.x[i] ?? 0), y - (pk.y[i] ?? 0));
        if (d < best) best = d;
      }
      if (best < Infinity) c += Math.min(best, 12) * 0.35;
    }
    return c;
  }

  private inArea(v: WorldView, i: number, px: number, py: number, margin: number): boolean {
    const da = v.dangerAreas;
    const x = da.x[i] ?? 0;
    const y = da.y[i] ?? 0;
    const dx = px - x;
    const dy = py - y;
    const r = da.radius[i] ?? 0;
    switch (da.shape[i]) {
      case AreaShape.Circle: {
        const rr = r + margin;
        return dx * dx + dy * dy <= rr * rr;
      }
      case AreaShape.Line:
        return segDist(px, py, x, y, da.x2[i] ?? x, da.y2[i] ?? y) <= (da.p0[i] ?? 0) + margin;
      case AreaShape.Ring: {
        // Rings expand outward from their centre: anywhere outside the current radius will be
        // swept, so outside the gap angle is unsafe, more so the closer the band is.
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < (da.p0[i] ?? 0) - margin) return false;
        if (d > r + margin + 7) return false;
        const gap = da.p2[i] ?? 0;
        if (gap <= 0) return d <= r + margin + 1.5;
        let a = atan2Turns(dy, dx) - (da.p1[i] ?? 0);
        a -= Math.floor(a + 0.5);
        return Math.abs(a) > gap * 0.6;
      }
      case AreaShape.Cone: {
        const d2 = dx * dx + dy * dy;
        if (d2 > (r + margin) * (r + margin)) return false;
        let a = atan2Turns(dy, dx) - atan2Turns((da.y2[i] ?? y) - y, (da.x2[i] ?? x) - x);
        a -= Math.floor(a + 0.5);
        return Math.abs(a) <= (da.p0[i] ?? 0) + 0.03;
      }
      default:
        return false;
    }
  }

  private rite(v: WorldView, out: InputFrame): void {
    const p = v.player;
    if (p.riteCharges <= 0) return;
    const e = v.enemies;
    let bestN = 0;
    let bx = 0;
    let by = 0;
    for (let i = 0; i < e.highWater; i++) {
      if (e.alive[i] === 0) continue;
      const ex = e.x[i] ?? 0;
      const ey = e.y[i] ?? 0;
      if (Math.hypot(ex - p.x, ey - p.y) > 6) continue;
      let n = (e.rank[i] ?? 0) > 0 ? 6 : 0;
      for (let j = 0; j < e.highWater; j++) {
        if (e.alive[j] === 0) continue;
        if (Math.hypot((e.x[j] ?? 0) - ex, (e.y[j] ?? 0) - ey) <= 3) n++;
      }
      if (n > bestN) {
        bestN = n;
        bx = ex;
        by = ey;
      }
    }
    if (bestN >= 5) {
      out.aimX = Math.round(bx * AIM_UNITS);
      out.aimY = Math.round(by * AIM_UNITS);
      out.pressed = Button.Rite;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Choice phases. Returns the number of shop purchases made by the commands.

  choose(v: WorldView, out: Command[]): number {
    out.length = 0;
    switch (v.phase) {
      case 'reward':
        out.push({ type: 'reward.pick', choice: this.pickReward(v) });
        return 0;
      case 'levelUp':
        out.push({ type: 'levelup.pick', choice: this.pickCard(v) });
        return 0;
      case 'shop':
        return this.shop(v, out);
      default:
        return 0;
    }
  }

  private pickReward(v: WorldView): number {
    const ch = v.reward.choices;
    if (ch.length === 0) return 0;
    if (this.kind === 'naive') return Math.floor(this.rnd() * ch.length);
    const lead = this.leadTag(v);
    let best = 0;
    let bestS = -Infinity;
    ch.forEach((c, i) => {
      const tags = this.mementoTags[c.mementoIndex] ?? [];
      const s = c.rarity + (tags.includes(lead) ? 1.5 : 0);
      if (s > bestS) {
        bestS = s;
        best = i;
      }
    });
    return best;
  }

  private pickCard(v: WorldView): number {
    const ch = v.levelUp.choices;
    if (ch.length === 0) return 0;
    if (this.kind === 'naive') return Math.floor(this.rnd() * ch.length);
    const p = v.player;
    let best = 0;
    let bestS = -Infinity;
    let bestStat = '';
    ch.forEach((c, i) => {
      const card = this.data.levelUpCards[c.cardIndex];
      const stat = card?.stat ?? '';
      let s = CARD_PRIORITY[stat] ?? 1;
      s -= 1.5 * (this.picks.get(stat) ?? 0); // spread picks like a player balancing a build
      if (stat === 'max_hp' && p.maxHp < 30 + 4 * p.level) s += 3;
      s *= 1 + 0.35 * c.rarity;
      if (s > bestS) {
        bestS = s;
        best = i;
        bestStat = stat;
      }
    });
    this.picks.set(bestStat, (this.picks.get(bestStat) ?? 0) + 1);
    return best;
  }

  /** Tag with the highest count; ties and early game prefer the class tag. */
  private leadTag(v: WorldView): number {
    const counts = v.shop.tagCounts;
    let best = this.classTag;
    let bestN = (counts[this.classTag] ?? 0) + 0.5;
    for (let t = 0; t < counts.length; t++) {
      const n = counts[t] ?? 0;
      if (n > bestN) {
        bestN = n;
        best = t;
      }
    }
    return best;
  }

  private shop(v: WorldView, out: Command[]): number {
    if (this.kind === 'naive') {
      const ok: number[] = [];
      v.shop.offers.forEach((o, i) => {
        if (o.kind !== OfferKind.Weapon && o.kind !== OfferKind.Memento) return;
        if (o.affordable && !o.blockedNoSlot) ok.push(i);
      });
      if (ok.length > 0) {
        out.push({ type: 'shop.buy', offer: ok[Math.floor(this.rnd() * ok.length)] ?? 0 });
        return 1;
      }
      out.push({ type: 'pulse.begin' });
      return 0;
    }
    // Merge two equal weapons already owned.
    const inv = v.shop.inventory;
    for (let i = 0; i < inv.length; i++) {
      const slot = inv[i];
      if (slot !== undefined && slot.weaponIndex >= 0 && slot.canMerge && slot.tier < 4) {
        out.push({ type: 'shop.merge', inventorySlot: i });
        return 0;
      }
    }
    const lead = this.leadTag(v);
    const counts = v.shop.tagCounts;
    const weaponsOwned = inv.filter((s) => s.weaponIndex >= 0).length;
    let best = -1;
    let bestS = 2.2; // below this the bot would rather keep Glint
    v.shop.offers.forEach((o, i) => {
      if (o.kind !== OfferKind.Weapon && o.kind !== OfferKind.Memento) return;
      if (!o.affordable || o.blockedNoSlot) return;
      const tags =
        o.kind === OfferKind.Weapon ? this.weaponTags[o.defIndex] : this.mementoTags[o.defIndex];
      let s: number;
      if (o.kind === OfferKind.Weapon) {
        s = o.mergeSlot >= 0 ? 3 + o.mergeToTier * 0.5 : weaponsOwned < 4 ? 3.2 : 2.4;
        s += (o.tier - 1) * 0.6;
      } else s = 1.6 + o.tier * 0.5;
      for (const t of tags ?? []) {
        if (t === lead) s += 1.4;
        else if ((counts[t] ?? 0) > 0) s += 0.3;
        // Reaching a synergy threshold (2, 4, 6) is worth more.
        if (o.isNewId && ((counts[t] ?? 0) + 1) % 2 === 0 && t === lead) s += 0.6;
      }
      if (
        tags !== undefined &&
        tags.length > 0 &&
        !tags.includes(lead) &&
        o.kind === OfferKind.Memento
      )
        s -= 0.8;
      if (s > bestS) {
        bestS = s;
        best = i;
      }
    });
    if (best >= 0) {
      out.push({ type: 'shop.buy', offer: best });
      return 1;
    }
    // Reroll at most twice per visit while a reasonable buy stays affordable afterwards.
    const cheapest = Math.min(
      ...v.shop.offers
        .filter((o) => o.kind === OfferKind.Weapon || o.kind === OfferKind.Memento)
        .map((o) => o.price),
      Infinity,
    );
    const floor = Number.isFinite(cheapest) ? cheapest : 15;
    if (this.rerollsThisShop < 2 && v.player.glint >= v.shop.rerollPrice + floor) {
      this.rerollsThisShop++;
      out.push({ type: 'shop.reroll' });
      return 0;
    }
    this.rerollsThisShop = 0;
    out.push({ type: 'pulse.begin' });
    return 0;
  }
}
