# QA M3 flash test (accessibility A-02 step 4, WCAG 2.3.1 general and red flash) and damage numbers
# over the player (A-03 step 2). Reads frames written by tests/e2e/m3-a11y.spec.ts.
# Usage: python tests/e2e/support/m3_flash.py [dir]   (default tests/out/qa/m3/a11y)
import glob, json, sys
from PIL import Image, ImageChops

D = sys.argv[1] if len(sys.argv) > 1 else 'tests/out/qa/m3/a11y'
LUT = [((v / 255) / 12.92 if v / 255 <= 0.04045 else ((v / 255 + 0.055) / 1.055) ** 2.4) for v in range(256)]


def frame(path):
    im = Image.open(path).convert('RGB').resize((240, 135), Image.BILINEAR)
    px = list(im.getdata())
    lum = [0.2126 * LUT[r] + 0.7152 * LUT[g] + 0.0722 * LUT[b] for r, g, b in px]
    red = [r > 2 * max(g, b) and r > 120 for r, g, b in px]
    return lum, red


def transitions(frames):
    out = []
    for i in range(1, len(frames)):
        a, ra = frames[i - 1]
        b, rb = frames[i]
        n = len(a)
        up = down = 0
        rup = rdown = 0
        for j in range(n):
            d = b[j] - a[j]
            if abs(d) >= 0.1 and min(a[j], b[j]) < 0.8:
                if d > 0:
                    up += 1
                else:
                    down += 1
            if ra[j] != rb[j]:
                if rb[j]:
                    rup += 1
                else:
                    rdown += 1
        out.append((i, up / n, down / n, rup / n, rdown / n))
    return out


def flashes(tr, k_up, k_down):
    # A flash is a pair of opposing transitions each over 25% of the screen; count per 60-frame window.
    ev = []
    for i, *v in tr:
        if v[k_up] > 0.25:
            ev.append((i, 1))
        elif v[k_down] > 0.25:
            ev.append((i, -1))
    pairs = []
    last = None
    for i, s in ev:
        if last is not None and s != last[1]:
            pairs.append(i)
            last = None
        else:
            last = (i, s)
    worst = 0
    for i in pairs:
        worst = max(worst, sum(1 for j in pairs if i <= j < i + 60))
    return len(ev), len(pairs), worst


res = {}
for mode in ['normal', 'reduce']:
    files = sorted(glob.glob(f'{D}/flash-{mode}/f*.jpg'))
    if not files:
        continue
    fr = [frame(f) for f in files]
    tr = transitions(fr)
    big = max((max(v[1], v[2]) for v in tr), default=0)
    res[mode] = {
        'frames': len(files),
        'largest_area_changed_one_frame': round(big, 3),
        'general': dict(zip(['transitions_over_25pct', 'flashes', 'max_flashes_per_second'], flashes(tr, 0, 1))),
        'red': dict(zip(['transitions_over_25pct', 'flashes', 'max_flashes_per_second'], flashes(tr, 2, 3))),
    }

# A-03: pixels that differ between damage numbers on and off inside the player sprite box.
try:
    with open(f'{D}/dmg-player.json', encoding='utf8') as f:
        p = json.load(f)
    on = sorted(glob.glob(f'{D}/dmg-on-*.png'))
    off = sorted(glob.glob(f'{D}/dmg-off-*.png'))
    s = Image.open(on[0]).width / 640
    box = (int(p['x'] - 12 * s), int(p['y'] - 24 * s), int(p['x'] + 12 * s), int(p['y'] + 2 * s))
    inside = []
    anywhere = []
    for a, b in zip(on, off):
        d = ImageChops.difference(Image.open(a).convert('RGB'), Image.open(b).convert('RGB'))
        anywhere.append(sum(1 for q in d.getdata() if q != (0, 0, 0)))
        dc = d.crop(box)
        inside.append(sum(1 for q in dc.getdata() if max(q) > 24))
    res['damage_numbers'] = {
        'frames': len(on),
        'player_box': box,
        'diff_px_whole_frame_per_frame': anywhere,
        'diff_px_inside_player_box_per_frame': inside,
    }
except (FileNotFoundError, IndexError):
    pass

print(json.dumps(res, indent=1))
