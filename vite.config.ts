// Vite and Vitest config (Lead Programmer). architecture.md 14.3 and 15.
// Modes: development (dev server), production (GitHub Pages, base /shardfall/), e2e (test hooks, dist-e2e/).
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { buildDataToDisk } from './tools/data/lib/pipeline.ts';

/** Rebuilds content/generated/ when CSV, level, or string files change during `npm run dev`. */
function dataWatch(): Plugin {
  const rebuild = (): void => {
    const result = buildDataToDisk(process.cwd());
    for (const line of result.report) console.log(`[data] ${line}`);
  };
  return {
    name: 'shardfall-data-watch',
    apply: 'serve',
    buildStart() {
      rebuild();
    },
    configureServer(server) {
      server.watcher.add([
        'content/data',
        'content/levels',
        'content/strings',
        'content/build.json',
      ]);
      server.watcher.on('change', (file) => {
        const f = file.replaceAll('\\', '/');
        if (/\/content\/(data|levels|strings)\/|\/content\/build\.json$/.test(f)) rebuild();
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isE2e = mode === 'e2e';
  return {
    base: command === 'build' && !isE2e ? '/shardfall/' : '/',
    define: {
      // Test hooks are compiled in only for `vite build --mode e2e` (architecture 6.12, 14.3).
      __E2E__: JSON.stringify(isE2e),
      // Debug commands and dev overlays: dev server and e2e builds only.
      __DEV_TOOLS__: JSON.stringify(command === 'serve' || isE2e),
    },
    // Not under Vitest: tests must never rewrite content/generated (data:check compares it).
    plugins: mode === 'test' ? [] : [dataWatch()],
    build: {
      outDir: isE2e ? 'dist-e2e' : 'dist',
      target: 'es2022',
      sourcemap: isE2e,
      assetsInlineLimit: 0,
      // three.js alone is ~500 kB minified; the real gate is the gzip budget (architecture 13).
      chunkSizeWarningLimit: 900,
    },
    preview: { port: isE2e ? 4174 : 4173, strictPort: true },
    server: { port: 5173 },
    test: {
      environment: 'node',
      include: [
        'tests/unit/**/*.test.ts',
        'tests/data/**/*.test.ts',
        'tests/determinism/**/*.test.ts',
        'tests/assets/**/*.test.ts',
      ],
      exclude: ['tests/e2e/**', 'tests/perf/**', 'node_modules/**'],
    },
  };
});
