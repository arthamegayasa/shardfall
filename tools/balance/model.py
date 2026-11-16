#!/usr/bin/env python3
"""Shardfall balance model (GD, M1-02). Python 3 standard library only.

Single source for the Pulse table: PROFILES below (GDD 2 and 3.4). The model writes
content/data/waves.csv and content/data/wave_spawns.csv from it, and reads every other
number (enemies, weapons, prices, XP, rarity) from content/data/*.csv, so the curves it
prints always reflect the shipped data.

Usage (from the repo root):
  python tools/balance/model.py gen      write waves.csv and wave_spawns.csv from PROFILES
  python tools/balance/model.py check    exit 1 when those CSVs differ from PROFILES or data rules fail;
                                         balance targets (GDD 19) are printed as PASS or WARN
  python tools/balance/model.py report   print markdown tables for docs/balance-report.md

All player-power numbers are a reference model, marked [Asumsi] in the report. The bot and
playtests (M2+) replace them; never tune a test by editing this file.
"""

from __future__ import annotations

import csv
import io
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "content" / "data"

# ---------------------------------------------------------------------------------------------
# Pulse table (GDD 2 and 3.4). Columns: pulse, biome, kind, threat, duration_s (None = boss),
# then counts for swarmer, charger, shooter, tank, exploder, summoner, lobber.
# Boss Pulses: the swarmer count is the nominal trickle used for the Glint estimate only
# (the sim uses boss_trickle_* from config.csv and ignores count).

ENEMY_ORDER = ["swarmer", "charger", "shooter", "tank", "exploder", "summoner", "lobber"]

RUN_A = [
    (1, "biome_market", "normal", 1, 20, 26, 0, 0, 0, 0, 0, 0),
    (2, "biome_market", "normal", 2, 23, 32, 4, 0, 0, 0, 0, 0),
    (3, "biome_market", "normal", 3, 26, 36, 6, 4, 0, 0, 0, 0),
    (4, "biome_market", "normal", 4, 29, 40, 8, 6, 2, 0, 0, 0),
    (5, "biome_market", "warden", 5, 32, 36, 8, 6, 3, 0, 0, 0),
    (6, "biome_market", "normal", 6, 35, 50, 10, 10, 4, 0, 0, 0),
    (7, "biome_market", "normal", 7, 38, 56, 12, 12, 6, 0, 0, 0),
    (8, "biome_market", "normal", 8, 40, 62, 14, 14, 8, 0, 0, 0),
    (9, "biome_market", "normal", 9, 40, 70, 16, 16, 10, 0, 0, 0),
    (10, "biome_market", "boss", 10, None, 30, 0, 0, 0, 0, 0, 0),
]

# run_a_m1 (GDD 2.4): Pulse 5 and 10 become normal Pulses (Warden and boss arrive in M2).
RUN_A_M1 = [
    *RUN_A[:4],
    (5, "biome_market", "normal", 5, 32, 40, 10, 8, 4, 0, 0, 0),
    *RUN_A[5:9],
    (10, "biome_market", "normal", 10, 45, 88, 20, 20, 13, 0, 0, 0),
]

RUN_C = [
    (1, "biome_market", "normal", 1, 20, 26, 0, 0, 0, 0, 0, 0),
    (2, "biome_market", "normal", 2, 22, 30, 4, 0, 0, 0, 0, 0),
    (3, "biome_market", "normal", 3, 24, 34, 6, 4, 0, 0, 0, 0),
    (4, "biome_market", "warden", 4, 27, 30, 6, 4, 2, 0, 0, 0),
    (5, "biome_market", "normal", 5, 30, 46, 10, 8, 3, 0, 0, 0),
    (6, "biome_market", "normal", 6, 33, 52, 12, 10, 5, 0, 0, 0),
    (7, "biome_market", "boss", 7, None, 24, 0, 0, 0, 0, 0, 0),
    (8, "biome_cloister", "normal", 8, 34, 50, 10, 8, 4, 8, 0, 0),
    (9, "biome_cloister", "normal", 9, 36, 54, 10, 10, 5, 10, 2, 0),
    (10, "biome_cloister", "normal", 10, 38, 58, 12, 10, 6, 12, 3, 0),
    (11, "biome_cloister", "warden", 11, 38, 50, 10, 10, 6, 10, 2, 0),
    (12, "biome_cloister", "normal", 12, 40, 66, 14, 12, 8, 14, 4, 0),
    (13, "biome_cloister", "normal", 13, 40, 72, 16, 14, 9, 16, 4, 0),
    (14, "biome_cloister", "boss", 14, None, 30, 0, 0, 0, 0, 0, 0),
    (15, "biome_vineyard", "normal", 15, 40, 70, 14, 12, 9, 14, 4, 6),
    (16, "biome_vineyard", "normal", 16, 40, 76, 16, 14, 10, 16, 5, 8),
    (17, "biome_vineyard", "warden", 17, 40, 66, 14, 12, 9, 14, 4, 6),
    (18, "biome_vineyard", "normal", 18, 40, 82, 18, 16, 12, 18, 5, 10),
    (19, "biome_vineyard", "normal", 19, 40, 90, 20, 18, 14, 20, 6, 12),
    (20, "biome_vineyard", "boss", 20, None, 30, 0, 0, 0, 0, 0, 0),
]


def _derive_run_b():
    """GDD 2.2: B1-6 = C1-6, B7-12 = C8-13, B13-14 = C15-16 without lobber at 40 s, B15 boss.
    Threat = B Pulse number; the whole profile stays in biome_market."""
    by_pulse = {r[0]: r for r in RUN_C}
    src = {**{p: p for p in range(1, 7)}, **{p: p + 1 for p in range(7, 13)}, 13: 15, 14: 16}
    rows = []
    for p in range(1, 15):
        r = by_pulse[src[p]]
        counts = list(r[5:])
        dur = r[4]
        if p >= 13:
            counts[6] = 0
            dur = 40
        rows.append((p, "biome_market", r[2], p, dur, *counts))
    rows.append((15, "biome_market", "boss", 15, None, 30, 0, 0, 0, 0, 0, 0))
    return rows


RUN_B = _derive_run_b()

WARDENS = {
    ("run_a", 5): "warden_hound",
    ("run_b", 4): "warden_hound",
    ("run_b", 10): "warden_choir",
    ("run_c", 4): "warden_hound",
    ("run_c", 11): "warden_choir",
    ("run_c", 17): "warden_bulwark",
}
BOSSES = {
    ("run_a", 10): "boss_lantern",
    ("run_b", 15): "boss_lantern",
    ("run_c", 7): "boss_lantern",
    ("run_c", 14): "boss_bell",
    ("run_c", 20): "boss_vine",
}

# (profile, rows, content_tier). Row order here = row order in waves.csv.
PROFILES = [
    ("run_a_m1", RUN_A_M1, "A"),
    ("run_a", RUN_A, "A"),
    ("run_b", RUN_B, "B"),
    ("run_c", RUN_C, "C"),
]

# Spawn window and group size per enemy (GDD 3.2): swarmers in groups, others alone or in pairs,
# tanks and summoners arrive after the opening.
SPAWN_RULES = {
    "swarmer": (0.0, 1.0, 3, 6),
    "charger": (0.1, 1.0, 1, 2),
    "shooter": (0.15, 1.0, 1, 2),
    "tank": (0.3, 0.9, 1, 1),
    "exploder": (0.15, 1.0, 1, 2),
    "summoner": (0.2, 0.85, 1, 1),
    "lobber": (0.2, 0.95, 1, 1),
}
SWARMER_EARLY_GROUP_MAX = 5  # t <= 3: smaller groups while the player has one weapon [Asumsi]


def alive_cap(t: int) -> int:
    """GDD 3.2: 70 (t1-5), 90 (t6-10), 110 (t11-15), 120 (t16-20)."""
    return 70 if t <= 5 else 90 if t <= 10 else 110 if t <= 15 else 120


# ---------------------------------------------------------------------------------------------
# CSV IO


def read_table(name: str) -> list[dict[str, str]]:
    text = (DATA / f"{name}.csv").read_text(encoding="utf-8")
    lines = [ln for ln in text.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
    return list(csv.DictReader(lines))


def read_kv(name: str) -> dict[str, str]:
    return {r["key"]: r["value"] for r in read_table(name)}


def fmt(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:g}"
    return str(v)


def gen_waves_text() -> tuple[str, str]:
    waves = io.StringIO()
    spawns = io.StringIO()
    waves.write(
        "# Generated by tools/balance/model.py gen from PROFILES (GDD 2 and 3.4). Edit the model, not this file.\n"
    )
    waves.write(
        "profile,pulse,kind,biome,threat,duration_s,warden_id,boss_id,alive_cap,final,content_tier\n"
    )
    spawns.write(
        "# Generated by tools/balance/model.py gen from PROFILES and SPAWN_RULES. Edit the model, not this file.\n"
    )
    spawns.write(
        "profile,pulse,enemy_id,count,start_frac,end_frac,group_min,group_max,sectors,content_tier\n"
    )
    for profile, rows, tier in PROFILES:
        last = rows[-1][0]
        for r in rows:
            pulse, biome, kind, t, dur = r[:5]
            counts = r[5:]
            warden = WARDENS.get((profile, pulse), "") if kind == "warden" else ""
            boss = BOSSES.get((profile, pulse), "") if kind == "boss" else ""
            final = 1 if pulse == last else 0
            waves.write(
                ",".join(
                    fmt(x)
                    for x in (profile, pulse, kind, biome, t, dur, warden, boss, alive_cap(t), final, tier)
                )
                + "\n"
            )
            for enemy, n in zip(ENEMY_ORDER, counts):
                if n == 0:
                    continue
                s, e, gmin, gmax = SPAWN_RULES[enemy]
                if kind == "boss":
                    s, e, gmin, gmax = 0.0, 1.0, 2, 2  # trickle row; count is nominal
                elif enemy == "swarmer" and t <= 3:
                    gmax = SWARMER_EARLY_GROUP_MAX
                spawns.write(
                    ",".join(fmt(x) for x in (profile, pulse, enemy, n, s, e, gmin, gmax, "", tier))
                    + "\n"
                )
    return waves.getvalue(), spawns.getvalue()


# ---------------------------------------------------------------------------------------------
# Data model


class Data:
    def __init__(self) -> None:
        self.config = {k: float(v) for k, v in read_kv("config").items()}
        self.shop = read_kv("shop")
        self.rarity = read_table("rarity")
        self.weights = read_table("rarity_weights")
        self.enemies = {r["id"]: r for r in read_table("enemies")}
        self.weapons = {r["id"]: r for r in read_table("weapons")}
        self.levelup = {r["id"]: r for r in read_table("levelup")}
        self.classes = {r["id"]: r for r in read_table("classes")}

    # GDD 5.5, 5.3, 5.2
    def hp(self, t: int) -> float:
        c = self.config
        return 1 + c["enemy_hp_lin"] * (t - 1) + c["enemy_hp_quad"] * (t - 1) ** 2

    def dm(self, t: int) -> float:
        return 1 + self.config["enemy_dmg_lin"] * (t - 1)

    def proc_scale(self, t: int) -> float:
        return 1 + self.config["proc_growth"] * (t - 1)

    def growth(self, t: int) -> float:
        return 1 + self.config["price_growth"] * (t - 1)

    def price(self, base: float, t: int) -> int:
        return math.floor(base * self.growth(t) + 0.5)  # round half up (GDD 4.3)

    def reroll(self, t: int, n: int) -> int:
        s = self.shop
        return int(
            float(s["reroll_base_add"]) + math.ceil(t / float(s["reroll_t_div"])) + float(s["reroll_step"]) * n
        )

    def weight_row(self, t: int) -> dict[str, float]:
        for r in self.weights:
            if int(r["t_min"]) <= t <= int(r["t_max"]):
                return {k: float(r[k]) for k in ("plain", "fine", "rare", "fabled")}
        raise ValueError(f"no rarity weights for t{t}")

    def expected_offer_price(self, t: int) -> float:
        w = self.weight_row(t)
        total = sum(w.values())
        wc = float(self.shop["weapon_chance"])
        e = 0.0
        for r in self.rarity:
            p = w[r["id"]] / total
            e += p * (wc * float(r["weapon_price"]) + (1 - wc) * float(r["memento_price"]))
        return e * self.growth(t)

    def expected_weapon_power(self, t: int) -> float:
        """Expected DPS multiplier of a weapon bought at t (tier = rolled rarity)."""
        w = self.weight_row(t)
        total = sum(w.values())
        return sum(
            w[r["id"]] / total * float(r["weapon_dmg_mult"]) / float(r["weapon_cd_mult"]) for r in self.rarity
        )

    def expected_card(self, card: str, t: int) -> float:
        w = self.weight_row(t)
        total = sum(w.values())
        row = self.levelup[card]
        return sum(w[k] / total * float(row[k]) for k in w)

    def xp_to_next(self, level: int) -> float:
        return self.config["xp_base"] + self.config["xp_per_level"] * level

    def level_for_xp(self, xp: float) -> int:
        level = 1
        while xp >= self.xp_to_next(level):
            xp -= self.xp_to_next(level)
            level += 1
        return level

    def glint_raw(self, profile: str, row) -> int:
        counts = row[5:]
        raw = sum(n * int(self.enemies[e]["glint"]) for e, n in zip(ENEMY_ORDER, counts))
        pulse, kind = row[0], row[2]
        if kind == "warden":
            raw += int(self.enemies[WARDENS[(profile, pulse)]]["glint"])
        if kind == "boss" and pulse != PROFILE_ROWS[profile][-1][0]:
            raw += int(self.enemies[BOSSES[(profile, pulse)]]["glint"])
        return raw

    def weapon_dps(self, wid: str, class_id: str = "lantern") -> float:
        """Single-target DPS of a tier I weapon with no bonuses."""
        w = self.weapons[wid]
        dmg, cd = float(w["dmg"]), float(w["cooldown"])
        params = parse_params(w["params"])
        arch = w["archetype"]
        burn_mult = 1.3 if class_id == "lantern" else 1.0  # class passive (effects.csv class_lantern_1)
        if arch == "bolt_explode":
            blast = float(w["dmg2"] or 0)
            # Burn from the blast refreshes every shot: one stack of 30% of the blast hit.
            return (dmg + blast) / cd + 0.3 * blast * burn_mult
        if arch == "orbit":
            hits_per_s = min(float(w["count"]) / params["rev_s"], 1 / cd)
            return dmg * hits_per_s
        if arch == "chain":
            uptime = min(1.0, params.get("burn_chance", 0) * 3 / cd)
            return dmg / cd + 0.3 * dmg * uptime * burn_mult
        if arch == "boomerang":
            return 2 * dmg / cd
        if arch == "ring_echo":
            return dmg * (1 + params["echo_frac"] * params["echo_count"]) / cd
        return dmg / cd


PROFILE_ROWS = {p: rows for p, rows, _t in PROFILES}

# Reference build assumptions [Asumsi], explained in docs/balance-report.md section 3.
PICKUP_FRAC = 0.85  # share of drops picked up during the Pulse
REROLLS_BY_T = ((1, 0), (3, 1), (7, 2))  # (from threat, rerolls per shop)
WEAPON_BUY_SHARE = 0.35  # = weapon_chance; buys follow offers
MEMENTO_DPS = 0.04  # average single-target DPS bonus per Memento (many A Mementos are conditional)
OFFENSE_CARD_SHARE = 0.5  # half of Temper picks go to damage_pct or attack_speed_pct
HP_CARD_SHARE = 0.15  # share of Temper picks that go to max_hp
CRIT_GAIN = 0.05 * 0.5  # base 5% crit x (1.5 - 1)
MERGE_EFFICIENCY = 0.79  # extra copies above 6 slots fuse: tier II 1.58x vs two tier I 2.0x
WARDEN_FOCUS = 0.7  # share of DPS landing on the Warden (auto-aim hits nearest)
BOSS_FOCUS = 0.85  # share landing on the boss (trickle swarmers distract)
BOSS_UPTIME = 0.75  # share of time in range while dodging patterns (melee weapons lose most)
AVG_HIT_BASE = 9.0  # average tier I hit before bonuses, for guard


def parse_params(cell: str) -> dict[str, float]:
    out: dict[str, float] = {}
    for part in (cell or "").split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            try:
                out[k.strip()] = float(v)
            except ValueError:
                pass
    return out


def collect_frac(d: Data, kind: str) -> float:
    if kind == "boss":
        return 1.0  # everything is collected when the boss dies (GDD 3.3)
    return PICKUP_FRAC + (1 - PICKUP_FRAC) * d.config["pulse_end_collect_frac"]


def simulate(d: Data, profile: str, class_id: str = "lantern") -> list[dict]:
    """Economy and reference-power walk through one profile."""
    rows = PROFILE_ROWS[profile]
    cls = d.classes[class_id]
    starter = cls["start_weapon"]
    a_weapons = [w for w, r in d.weapons.items() if r["content_tier"] == "A"]
    avg_dps = sum(d.weapon_dps(w, class_id) for w in a_weapons) / len(a_weapons)

    budget = 0.0
    xp = 0.0
    purchases = 0.0
    weapon_copies = 0.0  # bought weapons, in tier I equivalents
    weapon_power = 0.0
    mementos = 0.0
    offense = 0.0  # damage_pct-equivalent from Temper picks, as a fraction
    hp_bonus = 0.0
    out = []
    for r in rows:
        pulse, _biome, kind, t, dur = r[:5]
        level_start = d.level_for_xp(xp)
        # Power during this Pulse uses purchases made before it.
        copies_total = 1 + weapon_copies
        slots = int(d.config["weapon_slots"])
        weapons_dps = d.weapon_dps(starter, class_id)
        if copies_total > slots:
            weapons_dps += avg_dps * weapon_power * ((slots - 1) / weapon_copies)
            weapons_dps += avg_dps * weapon_power * ((copies_total - slots) / weapon_copies) * MERGE_EFFICIENCY
        elif weapon_copies > 0:
            weapons_dps += avg_dps * weapon_power
        bonus = 1 + offense + MEMENTO_DPS * mementos
        dps = weapons_dps * bonus * (1 + CRIT_GAIN)

        raw = d.glint_raw(profile, r)
        exp_glint = raw * collect_frac(d, kind)
        xp += exp_glint
        level_end = d.level_for_xp(xp)
        # Temper picks after this Pulse, valued at this threat's rarity weights.
        gained = level_end - level_start
        offense += gained * OFFENSE_CARD_SHARE * d.expected_card("card_damage", t) / 100
        hp_bonus += gained * HP_CARD_SHARE * d.expected_card("card_max_hp", t)
        is_final = pulse == rows[-1][0]
        shop_buys = 0.0
        rerolls = 0
        if not is_final:
            budget += exp_glint
            rerolls = max(n for from_t, n in REROLLS_BY_T if t >= from_t)
            for i in range(rerolls):
                c = d.reroll(t, i)
                if budget - c >= d.expected_offer_price(t):
                    budget -= c
                else:
                    rerolls = i
                    break
            e = d.expected_offer_price(t)
            shop_buys = math.floor(budget / e)
            budget -= shop_buys * e
            purchases += shop_buys
            new_w = shop_buys * WEAPON_BUY_SHARE
            weapon_power += new_w * d.expected_weapon_power(t)
            weapon_copies += new_w
            mementos += shop_buys * (1 - WEAPON_BUY_SHARE)

        hp_max = float(cls["max_hp"]) + hp_bonus
        out.append(
            dict(
                pulse=pulse, kind=kind, t=t, dur=dur, counts=r[5:], raw=raw, exp=exp_glint,
                xp=xp, level=level_end, buys=shop_buys, rerolls=rerolls, purchases=purchases,
                budget_left=budget, dps=dps, bonus=bonus, hp_max=hp_max, mementos=mementos,
                weapons=min(1 + weapon_copies, slots),
            )
        )
    return out


def warden_ttk(d: Data, wid: str, t: int, dps: float) -> float:
    e = d.enemies[wid]
    return float(e["hp"]) * d.hp(t) / (dps * WARDEN_FOCUS)


def boss_fight_s(d: Data, bid: str, t: int, dps: float, bonus: float) -> float:
    e = d.enemies[bid]
    hp = float(e["hp"]) * d.hp(t)
    guard = float(e["guard"])
    avg_hit = AVG_HIT_BASE * bonus
    guard_factor = max(d.config["guard_min_frac"], 1 - guard / avg_hit)
    transitions = d.config["boss_entry_s"] + 1.5  # entry + one phase transition (bosses.csv)
    return hp / (dps * BOSS_FOCUS * BOSS_UPTIME * guard_factor) + transitions


# ---------------------------------------------------------------------------------------------
# Checks


def data_checks(d: Data) -> list[str]:
    errs = []
    for profile, rows, _tier in PROFILES:
        pulses = [r[0] for r in rows]
        if pulses != list(range(1, len(rows) + 1)):
            errs.append(f"{profile}: pulses must be 1..n")
        for r in rows:
            pulse, _b, kind, t, dur = r[:5]
            if kind == "boss" and dur is not None:
                errs.append(f"{profile} P{pulse}: boss Pulse has a duration")
            if kind != "boss" and not dur:
                errs.append(f"{profile} P{pulse}: timed Pulse needs a duration")
            if dur and dur > 45:
                errs.append(f"{profile} P{pulse}: duration above 45 s")
            if kind == "warden" and (profile, pulse) not in WARDENS:
                errs.append(f"{profile} P{pulse}: warden Pulse without warden id")
            if kind == "boss" and (profile, pulse) not in BOSSES:
                errs.append(f"{profile} P{pulse}: boss Pulse without boss id")
    # Telegraph minimums for enemies (P2-e; GDD 14.1). Contact-only roles need none.
    mins = {"charger": "telegraph_min_charge_s", "shooter": "telegraph_min_projectile_s",
            "exploder": "telegraph_min_area_s", "summoner": "telegraph_min_area_s",
            "lobber": "telegraph_min_area_s", "boss": "telegraph_min_boss_s"}
    for e in d.enemies.values():
        key = mins.get(e["role"])
        if e["role"] == "warden":
            key = {"warden_hound": "telegraph_min_charge_s", "warden_choir": "telegraph_min_projectile_s",
                   "warden_bulwark": "telegraph_min_area_s"}.get(e["id"])
        if key and float(e["telegraph_s"] or 0) < d.config[key]:
            errs.append(f"enemies.csv {e['id']}: telegraph_s below {key}")
    return errs


def target_checks(d: Data) -> list[tuple[str, bool, str]]:
    res = []
    sim_a = simulate(d, "run_a")
    sim_m1 = simulate(d, "run_a_m1")
    # Starter kills a swarmer with one shot (impact + blast) up to t6.
    w = d.weapons["lantern_bolt"]
    one_shot = float(w["dmg"]) + float(w["dmg2"])
    sw = float(d.enemies["swarmer"]["hp"])
    last_t = max(t for t in range(1, 21) if sw * d.hp(t) <= one_shot)
    res.append(("Starter one-shots swarmer to t6", last_t >= 6, f"one-shot up to t{last_t}"))
    buys = sim_a[-1]["purchases"]
    res.append(("Purchases per run A 12-18", 12 <= buys <= 18, f"{buys:.0f} (run_a)"))
    buys_m1 = sim_m1[-1]["purchases"]
    res.append(("Purchases per run M1 12-18", 12 <= buys_m1 <= 18, f"{buys_m1:.0f} (run_a_m1)"))
    p5 = sim_a[4]
    ttk = warden_ttk(d, "warden_hound", 5, p5["dps"])
    res.append(("Warden kill 8-15 s", 8 <= ttk <= 15, f"{ttk:.1f} s at ref DPS {p5['dps']:.0f}"))
    p10 = sim_a[9]
    fight = boss_fight_s(d, "boss_lantern", 10, p10["dps"], p10["bonus"])
    res.append(("Boss fight 45-90 s", 45 <= fight <= 90, f"{fight:.0f} s at ref DPS {p10['dps']:.0f}"))
    lv = sim_a[-1]["level"]
    res.append(("About 1 level per Pulse (A end ~ L11-13)", 11 <= lv <= 13, f"L{lv}"))
    first = sim_a[0]["exp"]
    cheapest = min(d.price(float(r["memento_price"]), 1) for r in d.rarity)
    res.append(("Pulse 1 buys at least 1 item", first >= cheapest, f"{first:.0f} Glint vs {cheapest}"))
    return res


# ---------------------------------------------------------------------------------------------
# Report


def md_table(header: list[str], rows: list[list]) -> str:
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    for r in rows:
        out.append("| " + " | ".join(str(x) for x in r) + " |")
    return "\n".join(out)


def report(d: Data) -> str:
    parts = []
    for profile in ("run_a_m1", "run_a", "run_b", "run_c"):
        sim = simulate(d, profile)
        rows = []
        for s in sim:
            total = sum(s["counts"])
            rate = f"{total / s['dur']:.1f}" if s["dur"] else ""
            rows.append([
                s["pulse"], s["kind"], s["t"], s["dur"] or "boss", total, rate, s["raw"],
                f"{s['exp']:.0f}", f"{s['xp']:.0f}", s["level"], f"{s['buys']:.0f}",
                s["rerolls"], f"{s['dps']:.0f}",
            ])
        parts.append(f"### Profil `{profile}`\n\n" + md_table(
            ["Pulse", "Jenis", "t", "Durasi (s)", "Unlit", "Laju (/s)", "Glint mentah",
             "Glint diharapkan", "Kumulatif", "Level akhir", "Beli di toko", "Reroll", "DPS ref"],
            rows) + f"\n\nTotal pembelian: {sim[-1]['purchases']:.0f}. Sisa Glint tak terpakai: {sim[-1]['budget_left']:.0f}.")

    rows = []
    for t in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 17, 20):
        rows.append([
            t, f"{d.hp(t):.2f}", f"{d.dm(t):.2f}", f"{d.proc_scale(t):.1f}",
            *(round(float(d.enemies[e]["hp"]) * d.hp(t)) for e in ("swarmer", "charger", "shooter", "tank")),
            *(f"{float(d.enemies[e]['contact_dmg']) * d.dm(t):.1f}" for e in ("swarmer", "tank")),
            f"{float(d.enemies['charger']['attack_dmg']) * d.dm(t):.1f}",
        ])
    parts.append("### Kurva musuh per threat\n\n" + md_table(
        ["t", "hp(t)", "dm(t)", "proc_scale", "HP swarmer", "HP charger", "HP shooter", "HP tank",
         "Kontak swarmer", "Kontak tank", "Terjang charger"], rows))

    rows = []
    for t in (1, 3, 5, 7, 9, 10, 12, 15, 19):
        rows.append([
            t, *(d.price(float(r["memento_price"]), t) for r in d.rarity),
            *(d.price(float(r["weapon_price"]), t) for r in d.rarity),
            f"{d.reroll(t, 0)}, {d.reroll(t, 1)}, {d.reroll(t, 2)}",
            f"{d.expected_offer_price(t):.1f}",
            math.floor(float(d.shop["sell_frac"]) * float(d.rarity[0]["weapon_price"]) * d.growth(t)),
        ])
    parts.append("### Harga per threat\n\n" + md_table(
        ["t", "Memento P", "Memento F", "Memento R", "Memento Fb", "Senjata I", "Senjata II",
         "Senjata III", "Senjata IV", "Reroll 1, 2, 3", "Rata-rata tawaran", "Jual senjata I"], rows))

    rows = []
    for wid, w in d.weapons.items():
        base = d.weapon_dps(wid)
        rows.append([f"`{wid}`", w["content_tier"], f"{base:.1f}",
                     *(f"{base * float(r['weapon_dmg_mult']) / float(r['weapon_cd_mult']):.1f}" for r in d.rarity[1:])])
    parts.append("### DPS satu target per senjata (tanpa bonus, kelas `lantern`)\n\n" + md_table(
        ["Senjata", "Tk", "Tier I", "Tier II", "Tier III", "Tier IV"], rows))

    parts.append("### Target GDD 19\n\n" + md_table(
        ["Target", "Status", "Nilai model"],
        [[n, "PASS" if ok else "WARN", v] for n, ok, v in target_checks(d)]))
    return "\n\n".join(parts) + "\n"


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else "report"
    if cmd == "gen":
        waves, spawns = gen_waves_text()
        (DATA / "waves.csv").write_text(waves, encoding="utf-8", newline="\n")
        (DATA / "wave_spawns.csv").write_text(spawns, encoding="utf-8", newline="\n")
        print("wrote content/data/waves.csv, content/data/wave_spawns.csv")
        return 0
    if cmd == "check":
        ok = True
        waves, spawns = gen_waves_text()
        for name, text in (("waves", waves), ("wave_spawns", spawns)):
            path = DATA / f"{name}.csv"
            cur = path.read_text(encoding="utf-8").replace("\r\n", "\n") if path.exists() else None
            if cur != text:
                print(f"FAIL {name}.csv differs from PROFILES: run `python tools/balance/model.py gen`")
                ok = False
        d = Data()
        for e in data_checks(d):
            print(f"FAIL {e}")
            ok = False
        for name, passed, value in target_checks(d):
            print(f"{'PASS' if passed else 'WARN'} {name}: {value}")
        print("model check ok" if ok else "model check failed")
        return 0 if ok else 1
    if cmd == "report":
        sys.stdout.write(report(Data()))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
