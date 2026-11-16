// DOM-facing contracts (architecture.md 6.6, 6.7, 6.12). [Frozen M1]
// Import from render, ui, and app only. Excluded from tsconfig.sim.json; sim and content must not use it.

export * from './contracts/render.ts';
export * from './contracts/ui.ts';
export * from './contracts/e2e.ts';
