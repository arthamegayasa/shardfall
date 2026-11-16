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
