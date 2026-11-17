# QA M5 colour vision check on palette tokens (accessibility A-04 step 3): Machado 2009 severity 1.0
# simulations of protanopia, deuteranopia, tritanopia applied in linear RGB to art/palette.json.
# Reports per simulation: WCAG contrast of the danger core and the player highlights against both
# floor tokens, CIEDE2000 between the player projectile and the enemy projectile (sprite colours
# weighted by pixel count), and between neighbouring rarity colours.
# Usage: python tests/e2e/support/m5_cvd.py [out.json]
import json, math, sys

PAL = json.load(open('art/palette.json', encoding='utf8'))['core']
SPR = 'art/sprites/{}.json'
MACHADO = {
    'none': [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.307900]],
}


def hexrgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def lin(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def unlin(v):
    v = max(0.0, min(1.0, v))
    return v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055


def sim(rgb, m):
    l = [lin(c) for c in rgb]
    return [unlin(sum(m[i][j] * l[j] for j in range(3))) for i in range(3)]


def lum(rgb):
    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def lab(rgb):
    r, g, b = (lin(c) for c in rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def de2000(c1, c2):
    L1, a1, b1 = lab(c1)
    L2, a2, b2 = lab(c2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dh = h2p - h1p
    if C1p * C2p == 0:
        dh = 0
    elif dh > 180:
        dh -= 360
    elif dh < -180:
        dh += 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) > 180:
        hbp = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    else:
        hbp = (h1p + h2p) / 2
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dth = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dth)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def sprite_mean(name, m):
    """Mean simulated colour of a projectile sprite's opaque texels (first frame)."""
    d = json.load(open(SPR.format(name), encoding='utf8'))
    keys = {'c': 'kept-cyan', 'w': 'kept-white', 'B': 'kept-blue', 'm': 'danger-magenta', 'p': 'danger-core'}
    frame = next(iter(d['animations'].values()))['frames'][0]
    cols = [sim(hexrgb(PAL[keys[ch]]), m) for row in frame for ch in row if ch in keys]
    return [sum(c[i] for c in cols) / len(cols) for i in range(3)]


out = {}
for name, m in MACHADO.items():
    t = {k: sim(hexrgb(v), m) for k, v in PAL.items() if isinstance(v, str)}
    r = {
        'danger-core vs floor-mid': round(contrast(t['danger-core'], t['floor-mid']), 2),
        'danger-core vs floor-lit': round(contrast(t['danger-core'], t['floor-lit']), 2),
        'kept-white vs floor-lit': round(contrast(t['kept-white'], t['floor-lit']), 2),
        'kept-cyan vs floor-lit': round(contrast(t['kept-cyan'], t['floor-lit']), 2),
        'dE00 kept-cyan vs danger-magenta': round(de2000(t['kept-cyan'], t['danger-magenta']), 1),
        'dE00 shot sprites kept vs danger (mean colour)': round(
            de2000(sprite_mean('fx-shot-kept', m), sprite_mean('fx-shot-danger', m)), 1),
        'dE00 lantern bolt vs danger shot': round(
            de2000(sprite_mean('fx-shot-lantern-bolt', m), sprite_mean('fx-shot-danger', m)), 1),
    }
    for a, b in (('plain', 'fine'), ('fine', 'rare'), ('rare', 'fabled')):
        r[f'dE00 rarity {a} vs {b}'] = round(de2000(t[f'rarity-{a}'], t[f'rarity-{b}']), 1)
    out[name] = r
print(json.dumps(out, indent=1))
if len(sys.argv) > 1:
    with open(sys.argv[1], 'w', encoding='utf8') as f:
        json.dump(out, f, indent=1)
