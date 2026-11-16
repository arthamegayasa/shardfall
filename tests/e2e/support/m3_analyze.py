# QA M3 pixel analysis of tests/e2e/m3-visual.spec.ts captures (test-plan 8.2, 8.3, 8.4, 8.6;
# accessibility A-04 step 3 contrast part). Reads <name>.png plus the hook answer <name>.json.
# Usage: python tests/e2e/support/m3_analyze.py [dir]   (default tests/out/qa/m3)
# Positions from the hooks are ground points (feet); sprite bodies sit above them.
import colorsys, json, math, statistics, sys
from PIL import Image

D = sys.argv[1] if len(sys.argv) > 1 else 'tests/out/qa/m3'


def lin(v):
    v /= 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def unlin(v):
    v = max(0.0, min(1.0, v))
    return 255 * (v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)


def lum(c):
    r, g, b = (lin(x) for x in c[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def load(name):
    im = Image.open(f'{D}/{name}.png').convert('RGB')
    with open(f'{D}/{name}.json', encoding='utf8') as f:
        return im, json.load(f)


def px(im, x, y):
    x = min(im.width - 1, max(0, int(x)))
    y = min(im.height - 1, max(0, int(y)))
    return im.getpixel((x, y))


def mean(cs):
    n = len(cs)
    return tuple(sum(c[i] for c in cs) / n for i in range(3))


def floor_ref(im, a):
    """Median floor colour inside the arena box, away from every actor, telegraph, and the HUD."""
    s = im.width / 640
    pts = [(a['player']['x'], a['player']['y'])] + [(e['x'], e['y']) for e in a['enemies']]
    pts += [(e['x'], e['y']) for e in a['enemyShots']] + [(e['x'], e['y']) for e in a['dangerAreas']]
    cols = []
    for y in range(int(110 * s), int(290 * s), 6):
        for x in range(int(80 * s), int(560 * s), 6):
            if any(math.hypot(x - p[0], y - (p[1] - 20)) < 90 for p in pts):
                continue
            c = px(im, x, y)
            h, sat, v = colorsys.rgb_to_hsv(*(t / 255 for t in c))
            if sat > 0.3 or v > 0.6:
                continue
            cols.append(c)
    cols.sort(key=lum)
    return cols[len(cols) // 2], len(cols)


def body(im, x, y, up):
    """Median colour of a 7x7 patch centred `up` px above a ground point."""
    cs = [px(im, x + i, y - up + j) for i in range(-3, 4) for j in range(-3, 4)]
    cs.sort(key=lum)
    return cs[len(cs) // 2]


def brightest(im, x, y, r):
    best = None
    for j in range(-r, r + 1):
        for i in range(-r, r + 1):
            c = mean([px(im, x + i + u, y + j + v) for u in (-1, 0, 1) for v in (-1, 0, 1)])
            if best is None or lum(c) > lum(best):
                best = c
    return best


def player_box(im, a):
    s = im.width / 640
    x, y = a['player']['x'], a['player']['y']
    return int(x - 12 * s), int(y - 24 * s), int(x + 12 * s), int(y + 2 * s)


out = {}

# 8.2 and 8.3 on the peak scene (High and Low) and the enemy-shot scene.
for name in ['peak-high', 'peak-low', 'peak-reduce', 'shots-before-rite', 'glance-1-peak']:
    try:
        im, a = load(name)
    except FileNotFoundError:
        continue
    s = im.width / 640
    fl, nfl = floor_ref(im, a)
    x0, y0, x1, y1 = player_box(im, a)
    hi = brightest(im, (x0 + x1) / 2, (y0 + y1) / 2, int(9 * s))
    pl = [px(im, x, y) for x in range(x0, x1) for y in range(y0, y1)]
    pl_l = statistics.mean(255 * lum(c) ** (1 / 2.2) for c in pl)
    unlit = [body(im, e['x'], e['y'], 8 * s) for e in a['enemies'] if e['rank'] == 0]
    ur = sorted(ratio(c, fl) for c in unlit)
    shots = []
    for e in a['enemyShots']:
        # Shot sprites fly about 5 sprite px above their ground point.
        core = brightest(im, e['x'], e['y'] - 5 * s, int(3 * s))
        shots.append(ratio(core, fl))
    g = lambda c: 255 * lum(c) ** (1 / 2.2)
    r = {
        'floor': [round(v) for v in fl],
        'floor_samples': nfl,
        'player_highlight_vs_floor': round(ratio(hi, fl), 2),
        'unlit_n': len(ur),
        'unlit_vs_floor_median': round(statistics.median(ur), 2) if ur else None,
        'unlit_vs_floor_p10': round(ur[max(0, len(ur) // 10 - 1)], 2) if ur else None,
        'unlit_vs_floor_min': round(ur[0], 2) if ur else None,
        'unlit_below_1_5': [
            [round(e['x']), round(e['y']), round(ratio(c, fl), 2)]
            for e, c in zip([e for e in a['enemies'] if e['rank'] == 0], unlit)
            if ratio(c, fl) < 1.5
        ][:12],
        'enemy_shot_core_vs_floor_min': round(min(shots), 2) if shots else None,
        'enemy_shot_n': len(shots),
        'gray_player_mean': round(pl_l, 1),
        'gray_floor': round(g(fl), 1),
        'gray_unlit_median': round(statistics.median(g(c) for c in unlit), 1) if unlit else None,
    }
    out[name] = r

# 8.4 pixel scale: share of exactly uniform s x s blocks in the player sprite box (best grid offset).
for name in ['peak-low', 'peak-high', 'peak-reduce']:
    try:
        im, a = load(name)
    except FileNotFoundError:
        continue
    k = round(im.width / 640)
    x0, y0, x1, y1 = player_box(im, a)
    best = (0, 0, 0)
    for ox in range(k):
        for oy in range(k):
            uni = tot = 0
            for by in range(y0 + oy, y1 - k, k):
                for bx in range(x0 + ox, x1 - k, k):
                    cs = [im.getpixel((bx + i, by + j)) for i in range(k) for j in range(k)]
                    dev = max(max(c[ch] for c in cs) - min(c[ch] for c in cs) for ch in range(3))
                    tot += 1
                    uni += dev <= 2
            if tot and uni / tot > best[0]:
                best = (uni / tot, ox, oy)
    out.setdefault(name, {})['pixel_scale'] = k
    out[name]['player_blocks_uniform_pct'] = round(100 * best[0], 1)
    out[name]['grid_offset'] = [best[1], best[2]]

# 8.6 draw order: enemy shot cores under the Rite keep danger colours.
try:
    im, a = load('draworder-rite')
    s = im.width / 640
    ok = 0
    rows = []
    for e in a['enemyShots']:
        c = brightest(im, e['x'], e['y'] - 5 * s, int(3 * s))
        h, sat, v = colorsys.rgb_to_hsv(*(t / 255 for t in c))
        hue = h * 360
        core_like = math.dist(c, (0xFF, 0xE3, 0xEE)) < 70
        danger_hue = (hue >= 265 or hue <= 15) and sat > 0.35 and v > 0.5
        good = core_like or danger_hue
        ok += good
        rows.append([round(e['x']), round(e['y']), [round(t) for t in c], round(hue), good])
    out['draworder-rite'] = {'shots': len(rows), 'danger_coloured': ok, 'samples': rows}
except FileNotFoundError:
    pass

# A-04 step 3 (contrast part): enemy-shot cores vs floor after Machado 2009 simulation, severity 1.
M = {
    'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}


def sim(c, m):
    l = [lin(v) for v in c]
    return tuple(unlin(sum(m[i][j] * l[j] for j in range(3))) for i in range(3))


try:
    im, a = load('shots-before-rite')
    fl, _ = floor_ref(im, a)
    s = im.width / 640
    cores = [brightest(im, e['x'], e['y'] - 5 * s, int(3 * s)) for e in a['enemyShots']]
    x0, y0, x1, y1 = player_box(im, a)
    hi = brightest(im, (x0 + x1) / 2, (y0 + y1) / 2, int(9 * s))
    cv = {}
    for k, m in M.items():
        cv[k] = {
            'enemy_shot_core_vs_floor_min': round(min(ratio(sim(c, m), sim(fl, m)) for c in cores), 2),
            'player_highlight_vs_floor': round(ratio(sim(hi, m), sim(fl, m)), 2),
        }
    out['cvd-simulation-shots'] = cv
except (FileNotFoundError, ValueError):
    pass

print(json.dumps(out, indent=1))
