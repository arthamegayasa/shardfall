# Floor legibility measurements on an HD-2D screenshot (LP, M2-02; style-guide 1.9, LD-T05).
# Usage: python tests/render/hd2d/measure.py <png at 1920x1080 or 1280x720>
# Arena interior box in reference px: x 64..576, y 100..300 (inset 8 px from the boundary).
import colorsys, statistics, sys
from PIL import Image

if sys.argv[1] == '--dof':
    a = Image.open(sys.argv[2]).convert('RGB')
    b = Image.open(sys.argv[3]).convert('RGB')
    sc = a.width // 640
    diff_in = sum(1 for y in range(54 * sc, 325 * sc) for x in range(64 * sc, 576 * sc) if a.getpixel((x, y)) != b.getpixel((x, y)))
    diff_band = sum(1 for y in range(0, 54 * sc) for x in range(0, a.width, 4) if a.getpixel((x, y)) != b.getpixel((x, y)))
    print('LD-T03 pixels differing in x 64..576, y 54..324: %d' % diff_in)
    print('top band sampled pixels differing (expected > 0): %d' % diff_band)
    sys.exit(1 if diff_in else 0)
im = Image.open(sys.argv[1]).convert('RGB')
s = im.width // 640
def lum(c):
    def lin(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(x) for x in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
blocks = []
sats = []
for by in range(112, 292, 8):
    for bx in range(88, 552, 8):
        px = [im.getpixel(((bx + i) * s + s // 2, (by + j) * s + s // 2)) for i in range(8) for j in range(8)]
        bs = [colorsys.rgb_to_hsv(*(v / 255 for v in p))[1] for p in px]
        sats.extend(bs)
        ls_ = [lum(p) for p in px]
        # Floor-only blocks: skip blocks crossed by actors, obstacles, or effects (high spread).
        if max(ls_) - min(ls_) < 0.05:
            blocks.append((statistics.median(bs), statistics.median(ls_)))
print('median floor saturation %.1f%%' % (100 * statistics.median(sats)))
print('floor blocks %d' % len(blocks))
print('max 8x8 block saturation (block median) %.1f%%' % (100 * max(b[0] for b in blocks)))
ls = [b[1] for b in blocks]
print('block luminance ratio max/min %.2f' % (max(ls) / min(ls)))
