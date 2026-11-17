# UI redesign 1.1 (Producer brief, 2026-11-17)

Owner request (Dok, after playing 1.0): "buying a weapon seems to change nothing; with 2 weapons both should
attack. Everything is confusing, the UI/UX is bad." Producer approved option B: clarity pass plus a full visual
restyle. This document is the single source of truth for the 1.1 UI work. It overrides `docs/ui/ui-spec.md` and
`docs/style-guide.md` where they conflict; leave those files alone except for a short pointer at their top
(Producer adds it).

The sim already fires every weapon; duplicate copies are now staggered (commit f060f1a). The remaining problem is
that the player cannot SEE or UNDERSTAND what they own and what a purchase does. Every change below serves one of
three questions a new player must be able to answer in one second:

1. What am I buying, and what happens to my hero when I buy it?
2. What weapons do I have right now, and are they firing?
3. What does this word / number mean?

## 1. Plain words on screen (terminology)

Lore names stay in lore text (flavor lines, item descriptions that are clearly flavor, the Glazier's quotes),
but every label, button, header, banner, hint, and stat name uses the plain word:

| Lore (1.0) | On-screen 1.1 | Notes |
|---|---|---|
| Pulse | Wave | "Wave 3 of 15", "Start Wave 3", "Wave 3 cleared" (was "Pulse 3 Held/Steady") |
| Glint | Gold | currency and XP pickups; "Not enough gold", "+12 gold" |
| Temper | Level up | screen title "Level up!", subtitle "Choose 1 upgrade" |
| Fuse | Combine | "Combine 2 copies into tier II" |
| Memento(s) | Relic(s) | passive items |
| Arms | Weapons | |
| Rite | Skill | "Space: Skill", "Skill ready" |
| Kept (the player) | Hero | "Choose your hero", "Hero lost" (end screen); "Kept" may remain in flavor lines |
| Unlit | enemies / foes | "Enemies defeated"; enemy proper names unchanged |
| Warden | Elite | banner "Elite: Brass Collar"; the proper name stays |
| The Glazier (screen) | Shop | title "Shop"; the Glazier stays as the shopkeeper portrait + quote |
| The Keeping | Unlocks | meta screen title "Unlocks" |
| Silt | Silt | keep, but always show what it is for once ("Silt: spend in Unlocks") |
| Tag short codes (Fl, Sh, Ed, Wa, Ec, Tr) | full tag names | "Flame", "Shard", "Edge", "Ward", "Echo", "Trade" |

Apply this to `content/strings/en.json` AND `content/strings/id.json` (Indonesian: Gelombang, Emas, Naik level,
Gabung, Relik, Senjata, Skill, Pahlawan, Musuh, Elite, Toko, Buka Kunci). String KEYS stay the same unless a
screen worker needs a new key (keep `check-strings` and key parity green). Tests that match visible text must be
updated to the new text; tests that use keys need nothing.

## 2. Visual direction: "lantern-lit display window"

Subject: a glazier's stall in a night market under a cracked glass sky. The shop is a display window; items are
panes of coloured glass; the light is lantern amber against cold night glass. The one memorable element is the
**item card as a stained-glass pane**: a coloured glass header strip (category colour) carrying a big icon, set
in a dark lead frame. Everything else stays quiet and disciplined.

Keep: the team pixel font (`Shardfall Pixel`), the `--u` / `--f` integer pixel grid, the palette tokens, the
stair-cut corners, all accessibility modes (text size, solid panels, colour vision with shape cues, reduce
motion, flash safety). Change the hierarchy, density, spacing, and composition.

### Tokens

Colour (existing palette, new roles):

| Role | Token | Use |
|---|---|---|
| Night glass (panel) | `--night` #1c1926 → `#241f33` vertical gradient | panel fill |
| Lead (frame) | `--ink` #14121c outer 2u frame + `--shadow` #3e3a46 inner 1u line | every framed element |
| Bone | `--bone` #ede6d8 | primary text |
| Dust | `--dust` #a39a8c | secondary text (descriptions' flavor line, hints) |
| Weapon glass | `--kept-blue` #3d7dff (deep `--kept-blue-deep`) | weapon category strip, weapon slots |
| Relic glass | new token `--relic-glass` #4fb08a (bottle green) | relic category strip; rarity is never shown by strip colour, only by pips and frame |
| Upgrade glass | `--kept-cyan` #4fe3f0 | level-up cards, stat changes |
| Gold | `--glint` #ffd966 | ONLY currency, prices, and the one primary action per screen |
| Focus | `--kept-white` 2u frame + `--kept-gold` outer glow step | keyboard/mouse focus (unchanged meaning) |

Gold is no longer a general accent; if something is gold it costs money or it is the main button.

Type scale (font pixel multiples only, `--f` stays the unit):

- Display: 27f line (3x) — title screen logo, run-end verdict.
- Title: 18f (2x) — screen titles, card item names on the Level up screen, big numbers (gold, timer).
- Body: 9f (1x) — everything else. Secondary lines use Dust, never smaller sizes.
- Sentence case everywhere. No ALL-CAPS section labels ("Your weapons", not "ARMS"). No middle-dot meta strings.

Spacing: one rhythm, multiples of 4u between groups, 2u inside groups. Panels never touch screen edges at less
than 6u. Empty panels must not fill half the screen: size to content, or show a useful empty state ("No relics
yet. Relics are passive items sold here.").

Motion (respect reduce-motion: all of these become instant):
- purchase: the bought card's pane flashes once and its icon flies/fades into the target slot (~250 ms);
- weapon fire in HUD: the weapon's slot icon pulses (scale 1 → 1.15 → 1, 120 ms) on each `WeaponFired`;
- level-up and shop entry: one staggered card reveal, nothing else animates on idle.

## 3. Screens

### 3.1 Shop (was The Glazier) — highest priority

```
+--------------------------------------------------------------------------------+
| Shop                    Next: Wave 2 of 15      HP 30/30            (*) 40 gold |
| [portrait] "I knew the last Kept here. Same eyes."  (one dim line, small)       |
+--------------------------------------------------+-----------------------------+
| For sale                                          | Your weapons      2 of 6    |
| +----------------------+ +----------------------+ | [II][I ][  ][  ][  ][  ]    |
| |== Weapon ===== New ==| |== Relic ============| | Each weapon fires on its own |
| |  [ big icon ]         | |  [ big icon ]        | |                             |
| |  Lantern Bolt  I      | |  Torch Glove         | | Your relics                 |
| |  Fires a lantern ...  | |  Edge hits always... | | [r][r]  or empty state      |
| |  Flame                | |  Flame  Edge         | |                             |
| |  Adds a 2nd copy      | |                      | | Synergies                   |
| |  [ Buy  (*) 8 ] [lock]| |  [ Buy (*) 18][lock] | | Flame 1/2  next: +burn ...  |
| +----------------------+ +----------------------+ |                             |
| (2 x 2 grid of offer cards)                       |                             |
+--------------------------------------------------+-----------------------------+
| Reroll (*)3 [R]   Sell [X]   Combine [M]   Stats [T]          Start Wave 2  [B] |
+--------------------------------------------------------------------------------+
```

- Offer cards in a 2 x 2 grid (or 2 x N), each with a category strip: "Weapon" (blue) or "Relic" (bottle green).
  Colour vision modes: the strip also carries the category word and a shape glyph, never colour alone.
- Every weapon card states its purchase outcome in one plain line, from `ShopOfferView`:
  - `isNewId` → "New weapon";
  - owned, free slot → "Adds another copy: both fire" (this answers the owner's complaint directly);
  - `mergeSlot >= 0` → "Slots full: combines with your copy into tier II";
  - `blockedNoSlot` → "No free weapon slot" (card disabled look, still readable).
- Relic cards: "New relic" or "You own {n}: stacks".
- Price lives in the Buy button; unaffordable shows "Need {n} more gold" in Dust.
- Lock is a labelled toggle ("Lock" / "Locked"), not a bare square.
- Tags show full names with their shape glyph; hovering/focusing a tag shows what the synergy does.
- Right column: weapon slots large enough to read the tier numeral; empty slots say nothing but look empty;
  selected slot shows its name, what it does, Sell price, and Combine availability.
- After a purchase: toast "Lantern Bolt added. You now have 2 weapons firing." (or "...combined into tier II").
- Keyboard: arrow-key focus order must follow the visual order (BUG-010 rule); all shop hotkeys unchanged.

### 3.2 HUD (during a wave)

- Top left: HP bar (wider, heart glyph, "30/30"), under it a labelled XP bar "Lv 3".
- Top centre: "Wave 3 of 15" (body) above the timer (title size). Boss/elite bars keep their slot.
- Top right: gold with "(*) 40".
- **Bottom left: weapon strip** — one icon per owned weapon slot with its tier numeral; the icon pulses on each
  `WeaponFired` for that slot (event field c = slot). Idle weapons (no enemy in range) are slightly dimmed after
  ~1 s without firing, so the player learns weapons need a target in range.
- Bottom centre: skill (was Rite) icon with key label and cooldown, unchanged position.
- Wave 1 hint: "WASD move  ·  weapons fire on their own  ·  Space skill" style hint, plain words (no middle dots;
  use spacing or separate chips).
- New weapon feedback: at the start of a wave after buying, the newly added slot glows once with "New" for 2 s.

### 3.3 Level up (was Temper)

- Title "Level up!" (title size), subtitle "Choose 1 upgrade" and, when queued, "2 more waiting".
- Three cards side by side, each a cyan glass pane: icon on the strip, name at title size, the effect as a big
  plain line ("+12% damage"), current → next in Dust ("Damage 0% → 12%").
- Cards use the full width; no half-empty screen.

### 3.4 Title, How to play, Choose your hero, Pause, Run end, Settings, Unlocks

- Title: logo at display size with the tagline, menu "Continue / New run / How to play / Settings / Credits".
  Composition: logo and menu left-aligned on a vertical axis at ~1/3 width (the arena backdrop shows on the right)
  rather than a centred box.
- **How to play** (new, reachable from Title and Pause, and shown once automatically before the first ever run;
  remember "seen" in settings with a regression test): 4 short panels with icons:
  1. Move with WASD. Your weapons fire on their own at the nearest enemy in range.
  2. Space uses your skill (cooldown shown bottom centre).
  3. Survive each wave until the timer ends. Pick up gold and XP.
  4. Between waves, spend gold in the shop. More weapons = more attacks; 2 copies of the same tier can be combined.
- Choose your hero: hero card with portrait large; weapon, skill, passive as three labelled rows.
- Pause: menu left; right panel shows "Your weapons", "Your relics", and stats in two columns with
  non-zero stats emphasised (bone) and zero stats dimmed (dust).
- Run end: verdict at display size ("Hero lost" / "Victory"), run stats as a tidy table, loadout list, buttons.
  Panels sized to content, not full-height empty boxes.
- Settings / Unlocks: restyle via shared tokens only; plain words.

## 4. Projectile readability (render)

Projectiles must read at 1280x720 on the busiest floor: every player projectile at least ~1.5x its 1.0 size,
brighter emissive core with a short trail or glow so two different weapons look different at a glance. Do not
change sim hitboxes or any deterministic state; render-only.

## 5. Constraints for every worker

- Do not run git. The Producer commits.
- Keep every `data-ui` attribute that e2e tests use (grep `tests/e2e` before renaming anything); add new ones for
  new elements.
- Keep keyboard navigation complete, focus visible, and arrow order = visual order.
- No new runtime dependencies, no web fonts, no remote assets. Bundle budget (`npm run bundle:check`) must pass.
- Strings only through the string table (`t('key')`), both `en.json` and `id.json`.
- Logic changes (presenters, settings flag, HUD fire tracking) get unit tests, red first.
- Verify visually: `node tools/zz-shot.mjs <outDir> <port> <screens>` captures the dev preview
  (`/src/ui/dev/preview.html?screen=...`) at 1280x720 — start your own `npx vite --port <port> --strictPort`.
  Look at your screenshots; check 1920x1080 and text size Largest (`&text=2`) for your screens too.
- Before handing back: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test` all green for
  the whole repo (fix your own breakage, report anything else).

## 6. Foundation API (shared styles for the screen workers)

The old `src/ui/ui.css` is now six files under `src/ui/css/`, imported from `src/ui/ui-root.ts` in this
order: `base.css`, `components.css`, `hud.css`, `shop.css`, `choice.css`, `screens.css`. The split kept every
rule's relative order (pixel-identical before the 1.1 tokens went in), so a later file may rely on winning
over an earlier one at equal specificity. Each screen worker edits only the file it owns:

| File | Owner | Contains |
|---|---|---|
| `base.css` | shared (foundation) | palette and 1.1 tokens, `.sf-ui` root, `--cut`, colour-vision and solid-panel overrides, screen shells, `.safe`, live region, keyframes, the global reduce-effects rule, `[hidden]` |
| `components.css` | shared (foundation) | small framed parts, lead frame, panels, headings, section titles, buttons, row card, pips, icons, tag shapes and chips, Glint amount, lock marks, build and stat rows, type scale, `.chip`, `.pane`, `.reveal` |
| `hud.css` | HUD worker | HUD bars, timer, foe bar, banners, hint, Skill slot, resume countdown, HUD A-08 plates and A-09 twins |
| `shop.css` | Shop worker | the Shop screen and its text-size variants, shop A-08 plates, tag counts |
| `choice.css` | Level up worker | Level up (Temper) and reward choice |
| `screens.css` | Title/menus worker | title, class select, pause, confirm dialog, settings, run end, credits/info, Unlocks (Keeping) |

Tokens (on `.sf-ui`, so the colour-vision and solid-panel modes can override them):

- `--relic-glass` #4fb08a; categories `--cat-weapon` (= `--kept-blue`), `--cat-relic` (= `--relic-glass`),
  `--cat-upgrade` (= `--kept-cyan`, follows the tritan override).
- `--panel-fill`: the night-glass vertical gradient (#1c1926 to #241f33 at 90%); solid night under
  `.solid-panels`. `--panel-bg` (flat) is still used by the small framed parts.
- Spacing: `--gap-s` (2u, inside a group), `--gap-m` (4u, between groups), `--gap-l` (8u, between blocks).

Lead frame: `.panel`, `.btn`, `.hud-banner` and `.pane` get a 2u ink lead (`--lead`), a 1u inner line
(`--edge`, default `--shadow`), the glass fill (`--fill`, default `--panel-fill`), and the stair-cut corners.
Change the look by setting those three variables, not `border` or `background`. State colours that already
set `--edge` (rarity, low HP, foe violet, active tab) now colour the inner line. `.panel` padding is 5u.
Small parts (`.bar`, `.rite`, `.icon`, `.portrait`, `.tag-chip`, `.badge`) keep the 1u frame.

Buttons: `.btn` is the quiet secondary (lead frame, bone text). `.primary` or `.btn--primary` is the one
main action per screen: gold lead and fill, ink text (Begin, Start Wave, Try again, Stay already use it).
A disabled/locked/idle primary falls back to the quiet look. Focus (`.is-focus`) is a kept-white lead with
a kept-gold inner step; a focused primary is a white lead with an ink step, so focus never looks like the
primary. Gold elsewhere means a price.

Type: `.t-display` (27f), `.t-title` (18f), `.t-body` (9f, the default), `.t-dim` (Dust). They use `--f`,
so the text-size setting scales them. Do not set `font-size` on an element that carries a `t-*` class.
Section headings: `.section-title` (or the existing `.col-title`, `.label`): sentence case, Dust, body
size; no uppercase or letter-spacing anywhere.

Chips: `.chip` is a short label on an ink plate with a shadow line (hint chips, counts). `.tag-chip`
(built by `tagChip()`) shows the tag shape in the tag colour and the full tag name in bone; keep the shape,
it is the colour-vision cue.

Glass pane: `pane(doc, kind, stripLabel, badge?, root?)` in `src/ui/screens/components.ts` returns
`{ root, strip, body, badge }` with kind `'weapon' | 'relic' | 'upgrade'` (`PANE_KINDS`). Markup:
`.pane.pane--{kind} > .pane-strip > (.pane-cat > .cat-glyph.cat-{kind} + .pane-cat-label) + .pane-badge?`,
then `.pane-body` (flex column, `--gap-s`, 4u padding) for the caller to fill. Pass a `button(...)` as
`root` for a focusable card (its children are replaced; its `data-ui` stays). The strip is the category
glass (weapon blue and relic green with bone text, upgrade cyan with ink text, 4.5:1 or more) and always
carries the word and a shape glyph (sword, flask, arrow). `paneModel()` is the DOM-free part (tested in
`tests/unit/ui/pane.test.ts`).

Motion: add `.reveal` and set `--i` (0, 1, 2...) on cards for the one staggered entry. It is instant under
reduce effects and under the system reduced-motion preference. Gate any new transition the same way.
