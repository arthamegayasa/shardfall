# QA M5 retest of BUG-007 on the peak captures of tests/e2e/m3-visual.spec.ts. For every rank-0 Unlit
# (hook ground point), the sprite box above the feet (body area, 3x pixel scale) is split into: magenta
# outline pixels (danger-magenta or its pulse mix: hue 300 to 345, saturation above 0.55), and body
# pixels (the darkest half of the rest, excluding floor-like pixels). Reported per Unlit: windup or
# not (12 or more outline pixels), body contrast and outline contrast against the floor reference
# (median floor colour of m3_analyze), and grayscale values. BUG-007 failure mode: a windup Unlit
# whose body is near floor luminance (contrast under 1.5:1).
# Usage: python tests/e2e/support/m5_windup.py [dir] [names...]
import colorsys, json, statistics, sys
from PIL import Image

D = sys.argv[1] if len(sys.argv) > 1 else 'tests/out/qa/m3'
NAMES = sys.argv[2:] or ['peak-high', 'peak-low', 'peak-reduce', 'glance-1-peak', 'glance-4-stack']


def lin(v):
    v /= 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def lum(c):
    return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def gray(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def floor_ref(im, a):
    s = im.width / 640
    pts = [(a['player']['x'], a['player']['y'])] + [(e['x'], e['y']) for e in a['enemies']]
    pts += [(e['x'], e['y']) for e in a['enemyShots']] + [(e['x'], e['y']) for e in a['dangerAreas']]
    cols = []
    for y in range(int(110 * s), int(290 * s), 6):
        for x in range(int(80 * s), int(560 * s), 6):
            if any(((x - p[0]) ** 2 + (y - (p[1] - 20)) ** 2) ** 0.5 < 90 for p in pts):
                continue
            c = im.getpixel((x, y))
            h, sat, v = colorsys.rgb_to_hsv(*(t / 255 for t in c))
            if sat > 0.3 or v > 0.6:
                continue
            cols.append(c)
    cols.sort(key=lum)
    return cols[len(cols) // 2]


out = {}
for name in NAMES:
    try:
        im = Image.open(f'{D}/{name}.png').convert('RGB')
        a = json.load(open(f'{D}/{name}.json', encoding='utf8'))
    except FileNotFoundError:
        continue
    fl = floor_ref(im, a)
    s = im.width / 640
    rows = []
    for e in a['enemies']:
        if e['rank'] != 0:
            continue
        x0, x1 = int(e['x'] - 8 * s), int(e['x'] + 8 * s)
        y0, y1 = int(e['y'] - 16 * s), int(e['y'] - 1 * s)
        outline, rest = [], []
        for y in range(max(0, y0), min(im.height, y1)):
            for x in range(max(0, x0), min(im.width, x1)):
                c = im.getpixel((x, y))
                h, sat, v = colorsys.rgb_to_hsv(*(t / 255 for t in c))
                if 300 / 360 <= h <= 345 / 360 and sat > 0.55 and v > 0.5:
                    outline.append(c)
                elif ratio(c, fl) >= 1.15:  # not floor
                    rest.append(c)
        if len(rest) < 20:
            continue
        rest.sort(key=lum)
        dark = rest[: len(rest) // 2]
        body = tuple(statistics.median(c[i] for c in dark) for i in range(3))
        row = {'x': e['x'], 'y': e['y'], 'windup': len(outline) >= 12, 'outlinePx': len(outline),
               'body_vs_floor': round(ratio(body, fl), 2), 'gray_body': round(gray(body), 1)}
        if outline:
            oc = tuple(statistics.median(c[i] for c in outline) for i in range(3))
            row['outline_vs_floor'] = round(ratio(oc, fl), 2)
            row['gray_outline'] = round(gray(oc), 1)
        rows.append(row)
    w = [r for r in rows if r['windup']]
    out[name] = {
        'floor': fl, 'gray_floor': round(gray(fl), 1), 'unlit': len(rows), 'windup': len(w),
        'body_min_all': min((r['body_vs_floor'] for r in rows), default=None),
        'body_p10_all': sorted(r['body_vs_floor'] for r in rows)[max(0, len(rows) // 10 - 1)] if rows else None,
        'windup_body_min': min((r['body_vs_floor'] for r in w), default=None),
        'windup_outline_min': min((r.get('outline_vs_floor', 0) for r in w), default=None),
        'windup_gray_body_max': max((r['gray_body'] for r in w), default=None),
        'windup_rows': w,
    }
print(json.dumps(out, indent=1))
