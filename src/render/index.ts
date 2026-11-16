// Public API of src/render (LP + AD). Other modules import only from here (architecture.md 5).
// Layout: pipeline/ (LP: renderer, targets, passes, upscale, quality), camera.ts (LP),
// sprites/ (LP + AD: atlas texture, sprite id mapping, batching), shaders/ (AD, LP review),
// env/ (AD: arena mesh, decor, lights), vfx/ (AD: particles and effects from events, damage numbers).

export { createRenderer } from './pipeline/renderer.ts';
export { spriteIdForClass, spriteIdForEnemy } from './sprites/sprite-ids.ts';
