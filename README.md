# Shardfall

> The sky broke. The pieces kept us. Now we keep the light.

Shardfall is a browser arena-survival roguelike. You are one of the Kept, a figure of living glass. Survive fifteen timed waves of the Unlit in a night market under a cracked glass sky, with weapons that fire on their own and one active skill, the Rite. Between waves, spend Glint at the Glazier's shop and build a different loadout every run. Everything is presented as an HD-2D style diorama: pixel-art sprites on a lit 3D stage with bloom, depth of field, and dynamic light.

**Play it in your browser: https://arthamegayasa.github.io/shardfall/**

Version 1.1.0. Desktop browser with keyboard and mouse, WebGL2 required (current Chrome, Edge, or Firefox; Safari is only tested through a WebKit proxy).

## Controls

| Action | Default keys |
|---|---|
| Move | WASD or arrow keys |
| Rite (active skill) | Space or right mouse button; aims at the cursor |
| Pause | Esc or P |
| Menus | Arrow keys and Enter, or the mouse; Esc or Backspace to go back |
| Glazier shop | R reroll, L lock, M fuse, X sell, T stats, B begin the next Pulse |

Weapons attack automatically. Every key can be remapped in Settings. A short How to play screen opens before your first run and is always available from the title and pause menus.

Version 1.1 uses plain words on screen: Wave (Pulse), gold (Glint), Level up (Temper), Combine (Fuse), Relic (Memento), Skill (Rite), Unlocks (The Keeping). The lore names below still appear in flavor text.

## Features

- **3 classes:** Lamplighter (sets crowds alight from afar), Chorister (tolls crowds back, then hits twice), Vintner (fights up close and heals on kills). Each has its own Rite: Festival Flare, Great Toll, Glass Step.
- **15 Pulses** in The Moth Market, each a timed wave with its own pace and surges.
- **8 weapons** in four tiers (I to IV); Fuse two copies of the same tier into the next one.
- **24 Mementos**, passive items with conditional effects (18 from the start, 6 more unlocked in The Keeping).
- **6 tags** (Flame, Shard, Edge, Echo, Ward, Trade) with synergy bonuses that steer each build.
- **Wardens:** Brass Collar at Pulse 4 and Velvet Cowl at Pulse 10, elite Unlit with affixes and a reward pick.
- **Boss:** the Paper Sun at Pulse 15, a festival lantern that learned to swallow light, with two phases.
- **Temper:** pick one of three upgrade cards per level.
- **Meta progression:** every run, won or lost, earns Silt. Spend it in The Keeping to unlock the Vintner and the Chorister (you start as the Lamplighter), the Tithe Shard weapon, and two Memento packs.
- **Autosave:** close the tab and continue from the last shop.
- **Accessibility settings:** full key remapping, text size (Normal, Large, Largest), reduce effects and flash safety, screen shake slider, damage numbers on or off, color vision modes (protan, deutan, tritan) with shape cues so nothing relies on color alone, solid panels, separate volume for music, sound effects, and UI, mono audio, reduce repeated sounds, pause or mute when the window loses focus, full keyboard navigation, pause at any time, and graphics quality (low, medium, high). The game follows the system reduced-motion preference on first launch.
- An Indonesian text table is available with `?lang=id` in the URL.

## Build and test

Requires Node 24 and npm 11.

```
npm ci              # install dependencies
npm run dev         # dev server at http://localhost:5173
npm run build       # release build in dist/ (base path /shardfall/ for GitHub Pages)
npm run bundle:check  # release gate: size budget, no test hooks, no source maps, license notices
npm run preview     # serve dist/ at http://localhost:4173/shardfall/
npm run check       # full gate: data, art, arenas, audio, format, typecheck, lint, unit tests, build, bundle
npm run test:e2e    # e2e build and Playwright tests (local only)
npm run data        # rebuild content/generated/ after editing content/data, levels, or strings
```

GitHub Actions runs the checks on every push and deploys `dist/` to GitHub Pages from `main`. Details: [`docs/tech/build.md`](docs/tech/build.md).

## Project layout

```
src/
  core/      contracts, math, seeded RNG, sprite format (no DOM)
  sim/       deterministic simulation: fixed tick, systems, effects (no DOM, no three.js)
  content/   data loading, schema, string table
  render/    three.js HD-2D pipeline: camera, lighting, post-processing, sprites, VFX
  ui/        DOM UI: screens, HUD, pixel font, focus navigation
  audio/     Web Audio: synthesized SFX and music, mixing
  app/       composition root, game loop, input, autosave, settings, meta
content/     game data (CSV), arenas (JSON), strings (EN, ID), generated JSON
art/         palette, sprite and icon data, sprite generators, concepts
tools/       data pipeline, asset checks, bundle check, bots
tests/       unit, data, determinism, render, and e2e tests
docs/        design, tech, QA, reviews, credits
```

## How it was made

Shardfall was built by a team of AI agents (producer, creative director, designers, programmers, art, audio, writer, QA) working from a single handoff document ([`docs/team/HANDOFF.md`](docs/team/HANDOFF.md)). All art, music, sound, and text are made by the team: sprites and icons are pixel data written by hand or generated by code, music and sound effects are synthesized at runtime from recipes in this repository, and there are no downloaded or third-party assets. The only runtime dependency is [three.js](https://threejs.org/) (MIT).

## Documentation

- [Vision](docs/vision.md), [pillars](docs/pillars.md), [style guide](docs/style-guide.md)
- [Game design document](docs/gdd.md), [data schema](docs/systems/data-schema.md), [balance report](docs/balance-report.md)
- [Architecture](docs/tech/architecture.md), [coding standards](docs/tech/coding-standards.md), [build and release](docs/tech/build.md)
- [Art direction](docs/art-direction.md), [audio direction](docs/audio-direction.md), [UI spec](docs/ui/ui-spec.md)
- [Lore premise](docs/narrative/lore-premise.md), [glossary](docs/narrative/glossary.md)
- [Test plan](docs/qa/test-plan.md), [accessibility checklist](docs/qa/accessibility.md), [bug tracker](docs/qa/bugs.md)
- [Release notes 1.0 (Indonesian)](docs/release-notes-1.0.md), [task board (Indonesian)](docs/tasks.md)

Most team documents are written in Indonesian; code, identifiers, and in-game text are in English.

## License

Copyright the Shardfall project. All rights reserved until the owner chooses an open license. The source is public for reading and playing; no permission is granted to copy, modify, or redistribute it yet.

Third-party code in the build is listed in [`docs/credits.md`](docs/credits.md) and shipped as `third-party-licenses.txt` next to the game.
