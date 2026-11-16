// Public API of src/render (LP + AD). Other modules import only from here (architecture.md 5).
// Layout: pipeline/ (LP: renderer, quality, lights, shake, danger rules), post/ (LP: bloom,
// tilt-shift, composite), env/ (LP: diorama from arena data), camera.ts (LP), sprites/ (LP + AD:
// atlas texture, sprite id mapping, batching), shaders/ (AD sprite and area; LP environment, light,
// post), vfx/ (AD: particles and effects from events, damage numbers).

export { createRenderer } from './pipeline/renderer.ts';
export { spriteIdForClass, spriteIdForEnemy } from './sprites/sprite-ids.ts';
// UI icons and portraits (AD, M2-03): canvas or data URL per icon id, from RenderAssets.
export { createIconProvider } from './sprites/icons.ts';
export type { IconProvider } from './sprites/icons.ts';
