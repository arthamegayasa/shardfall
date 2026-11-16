# Shardfall (working title)

> The sky broke. The pieces kept us. Now we keep the light.

Shardfall is a browser arena-survival roguelike: pick a class, survive timed waves (Pulses) with auto-attacks and one active skill (Rite), spend Glint at the Glazier between waves, and build a different loadout every run. Presented as an HD-2D-style diorama: pixel-art sprites on a lit 3D stage.

Status: in development. Progress is tracked in [`docs/tasks.md`](docs/tasks.md).

## Project layout

```
docs/      design docs, specs, reviews, tasks, credits
art/       concepts, sprites, tiles, vfx, atlas
audio/     music and sfx sources
content/   game data (CSV and generated JSON)
src/       game code (core, sim, render, ui, audio)
tests/     unit and end-to-end tests
tools/     pipeline scripts
```

All assets are made by the team (procedurally, from code in this repository) or are CC0. See [`docs/credits.md`](docs/credits.md).

## Build and play

Requires Node 24 and npm 11.

```
npm ci              # install dependencies
npm run dev         # dev server at http://localhost:5173 (rebuilds data on CSV changes)
npm run build       # production build in dist/ (base /shardfall/ for GitHub Pages)
npm run preview     # serve dist/ locally
npm run check       # typecheck + lint + unit tests + data:check (run before handing in work)
npm run test:e2e    # e2e build + Playwright smoke test (local only)
npm run data        # rebuild content/generated/ after editing content/data, levels, or strings
```

Controls (prototype): WASD or arrow keys to move, Space or right click for the Rite.
The published build is deployed by GitHub Actions to GitHub Pages on every push to `main`.
