// Build-time constants defined in vite.config.ts.

/** true only in `vite build --mode e2e` (dist-e2e). Test hooks are tree-shaken out otherwise. */
declare const __E2E__: boolean;
/** true in the dev server and e2e builds: debug commands accepted, dev overlays allowed. */
declare const __DEV_TOOLS__: boolean;
/** Release version from package.json (vite.config.ts), shown on the title screen. */
declare const __APP_VERSION__: string;
