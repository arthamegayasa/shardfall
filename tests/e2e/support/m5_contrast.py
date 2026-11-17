# QA M5 text and focus contrast (accessibility A-08) on tests/e2e/m5-a11y.spec.ts captures.
# For each text leaf box: pixels are split in two by Otsu's threshold on luminance; the smaller group
# is the glyphs, the larger the background behind them (panel plus game, as the player sees it).
# Text colour = mean of the glyph pixels farthest from the background, background = mean of the
# background group. Ratio by WCAG 2. Thresholds: body 4.5:1, large text (font 32 px or more, so a cap
# height of at least 24 px in the team pixel font) 3:1, dimmed or disabled 2:1 [Asumsi QA].
# Focus: kept-gold frame pixels around the focused control against the pixels just outside it.
# Usage: python tests/e2e/support/m5_contrast.py [dir] [out.json]
import json, sys
import numpy as np
from PIL import Image

D = sys.argv[1] if len(sys.argv) > 1 else 'tests/out/qa/m5/a11y'
OUTF = sys.argv[2] if len(sys.argv) > 2 else f'{D}/a08-contrast.json'
SCREENS = ['title', 'level-up', 'glazier', 'run-lost', 'settings-access', 'pulse-peak', 'pulse-peak-edge']
GOLD = np.array([0xFF, 0xC9, 0x4A], dtype=float)


def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lum(rgb):
    l = lin(np.asarray(rgb, dtype=float))
    return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]


def ratio(a, b):
    la, lb = float(lum(a)), float(lum(b))
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def otsu(v):
    hist, edges = np.histogram(v, bins=64)
    best, thr = -1, float(v.mean())
    w = hist.sum()
    for i in range(1, 64):
        w0, w1 = hist[:i].sum(), hist[i:].sum()
        if w0 == 0 or w1 == 0:
            continue
        c = (edges[:-1] + edges[1:]) / 2
        m0 = (hist[:i] * c[:i]).sum() / w0
        m1 = (hist[i:] * c[i:]).sum() / w1
        between = w0 * w1 * (m0 - m1) ** 2 / w / w
        if between > best:
            best, thr = between, edges[i]
    return thr


def measure(img, box):
    x0, y0 = max(0, int(box['x'])), max(0, int(box['y']))
    x1 = min(img.shape[1], int(box['x'] + box['w'] + 0.999))
    y1 = min(img.shape[0], int(box['y'] + box['h'] + 0.999))
    px = img[y0:y1, x0:x1].reshape(-1, 3).astype(float)
    if len(px) < 12:
        return None
    L = lum(px)
    if L.max() - L.min() < 1e-4:
        return {'ratio': 1.0, 'note': 'flat box'}
    t = otsu(L)
    hi, lo = px[L >= t], px[L < t]
    glyph, bg = (hi, lo) if len(hi) < len(lo) else (lo, hi)
    if len(glyph) == 0 or len(bg) == 0:
        return None
    bgc = bg.mean(axis=0)
    d = np.abs(lum(glyph) - float(lum(bgc)))
    core = glyph[d >= np.quantile(d, 0.5)]
    return {'ratio': round(ratio(core.mean(axis=0), bgc), 2), 'glyphShare': round(len(glyph) / len(px), 2)}


def focus_contrast(img, f):
    """kept-gold pixels in a band around the focused box vs non-gold pixels just outside the band."""
    if f is None:
        return None
    pad = 6
    x0, y0 = max(0, int(f['x']) - pad), max(0, int(f['y']) - pad)
    x1 = min(img.shape[1], int(f['x'] + f['w']) + pad)
    y1 = min(img.shape[0], int(f['y'] + f['h']) + pad)
    band = np.zeros(img.shape[:2], bool)
    band[y0:y1, x0:x1] = True
    inner = np.zeros(img.shape[:2], bool)
    inner[y0 + 2 * pad:y1 - 2 * pad, x0 + 2 * pad:x1 - 2 * pad] = True
    ring = band & ~inner
    px = img[ring].astype(float)
    dist = np.abs(px - GOLD).sum(axis=1)
    gold = px[dist < 60]
    if len(gold) < 8:
        return {'ui': f['ui'], 'note': 'no kept-gold frame pixels found in the ring'}
    o0, o1 = max(0, x0 - 4), min(img.shape[1], x1 + 4)
    p0, p1 = max(0, y0 - 4), min(img.shape[0], y1 + 4)
    outer = np.zeros(img.shape[:2], bool)
    outer[p0:p1, o0:o1] = True
    outer &= ~band
    out = img[outer].astype(float)
    out = out[np.abs(out - GOLD).sum(axis=1) >= 60]
    if len(out) == 0:
        return None
    return {'ui': f['ui'], 'ratio': round(ratio(gold.mean(axis=0), out.mean(axis=0)), 2), 'goldPixels': int(len(gold))}


result = {}
for name in SCREENS:
    try:
        img = np.asarray(Image.open(f'{D}/a08-{name}.png').convert('RGB'))
        meta = json.load(open(f'{D}/a08-{name}.json', encoding='utf8'))
    except FileNotFoundError:
        continue
    rows, fails = [], []
    for t in meta['texts']:
        m = measure(img, t)
        if m is None:
            continue
        large = t['fontPx'] >= 32
        need = 2.0 if t['dim'] else (3.0 if large else 4.5)
        row = {'text': t['text'], 'ui': t['ui'], 'cls': t['cls'], 'fontPx': t['fontPx'], 'dim': t['dim'], 'need': need, **m}
        rows.append(row)
        if m['ratio'] < need:
            fails.append(row)
    body = [r['ratio'] for r in rows if not r['dim']]
    result[name] = {
        'texts': len(rows),
        'minBody': min(body) if body else None,
        'minDim': min([r['ratio'] for r in rows if r['dim']], default=None),
        'fails': fails,
        'focus': focus_contrast(img, meta.get('focus')),
        'lowest5': sorted(rows, key=lambda r: r['ratio'])[:5],
    }
with open(OUTF, 'w', encoding='utf8') as f:
    json.dump(result, f, indent=1)
for k, v in result.items():
    print(k, 'texts', v['texts'], 'minBody', v['minBody'], 'minDim', v['minDim'], 'fails', len(v['fails']), 'focus', v['focus'])
    for r in v['fails']:
        print('   FAIL', r['ratio'], '<', r['need'], repr(r['text']), r['ui'], r['cls'], 'font', r['fontPx'], 'glyph', r.get('glyphShare'))
