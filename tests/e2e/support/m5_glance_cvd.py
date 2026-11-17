# QA M5 accessibility A-04 step 5: the 1 s glance proxy test (test-plan 10) on deuteranopia-simulated
# frames. Reads the five glance captures of tests/e2e/m3-visual.spec.ts (<name>.png plus the hook
# answer <name>.json), applies Machado 2009 deuteranopia (severity 1.0, linear RGB), shrinks to
# 480x270 with a light blur like the M3 procedure, shuffles them under letters a to e, and writes
# the answer key. Scoring: python m5_glance_cvd.py score <answers.json> (proxy answers as
# {"a": {"player": [x, y], "threat": [x, y]}, ...}); a frame passes when both are within 30 px.
# Usage: python tests/e2e/support/m5_glance_cvd.py make [in_dir] [out_dir]
import json, math, random, sys
import numpy as np
from PIL import Image, ImageFilter

DEUT = np.array([[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]])
NAMES = ['glance-1-peak', 'glance-2-warden', 'glance-3-boss', 'glance-4-stack', 'glance-5-late']


def simulate(img):
    a = np.asarray(img.convert('RGB'), dtype=float) / 255
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    s = np.clip(lin @ DEUT.T, 0, 1)
    srgb = np.where(s <= 0.0031308, s * 12.92, 1.055 * s ** (1 / 2.4) - 0.055)
    return Image.fromarray((srgb * 255 + 0.5).astype(np.uint8))


def make(src, out):
    order = NAMES[:]
    random.Random(505).shuffle(order)
    key = {'radius_px_480': 30.0, 'answers': {}, 'scenes': {}}
    for letter, name in zip('abcde', order):
        im = Image.open(f'{src}/{name}.png')
        ans = json.load(open(f'{src}/{name}.json', encoding='utf8'))
        sx = 480 / ans['viewport']['width']
        small = simulate(im).resize((480, 270), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
        small.save(f'{out}/glance-deutan-{letter}.png')
        n = ans['nearest']
        key['answers'][letter] = [[ans['player']['x'] * sx, ans['player']['y'] * sx],
                                  [n['x'] * sx, n['y'] * sx] if n else None]
        key['scenes'][letter] = name
    json.dump(key, open(f'{out}/glance-deutan-key.json', 'w', encoding='utf8'), indent=1)
    print(json.dumps(key['scenes']))


def score(answers_file, key_file):
    key = json.load(open(key_file, encoding='utf8'))
    got = json.load(open(answers_file, encoding='utf8'))
    out, both = {}, 0
    for letter, (pl, th) in key['answers'].items():
        g = got.get(letter, {})
        pe = math.dist(pl, g.get('player', [-999, -999]))
        te = math.dist(th, g.get('threat', [-999, -999])) if th else 0
        ok = pe <= 30 and te <= 30
        both += ok
        out[letter] = {'scene': key['scenes'][letter], 'player_err': round(pe, 1), 'threat_err': round(te, 1), 'pass': ok}
    res = {'scores': out, 'both_correct': both}
    print(json.dumps(res, indent=1))
    return res


if __name__ == '__main__':
    if sys.argv[1] == 'make':
        make(sys.argv[2] if len(sys.argv) > 2 else 'tests/out/qa/m3', sys.argv[3] if len(sys.argv) > 3 else 'tests/out/qa/m5')
    else:
        res = score(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else 'tests/out/qa/m5/glance-deutan-key.json')
        json.dump(res, open('tests/out/qa/m5/glance-deutan-score.json', 'w', encoding='utf8'), indent=1)
