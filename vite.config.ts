// Vite and Vitest config (Lead Programmer). architecture.md 14.3 and 15.
// Modes: development (dev server), production (GitHub Pages, base /shardfall/), e2e (test hooks, dist-e2e/).
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { buildDataToDisk } from './tools/data/lib/pipeline.ts';
import { minifyGlslTemplates } from './tools/build/glsl-minify.ts';

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

/** Release version shown on the title screen (package.json is the single source). */
const APP_VERSION = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

/**
 * Packages whose code ends up in dist/ (three.js, plus the small Vite and Rolldown runtime helpers).
 * The minifier drops their license comments, so their notices ship as third-party-licenses.txt.
 */
const BUNDLED_PACKAGES = ['three', 'vite', 'rolldown'] as const;

function licenseText(pkg: string): string {
  const dir = new URL(`./node_modules/${pkg}/`, import.meta.url);
  const meta = JSON.parse(readFileSync(new URL('package.json', dir), 'utf8')) as {
    version: string;
    license: string;
  };
  let text = '';
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license']) {
    try {
      text = readFileSync(new URL(name, dir), 'utf8');
      break;
    } catch {
      // Try the next file name.
    }
  }
  if (text === '') throw new Error(`third-party-licenses: no LICENSE file for ${pkg}`);
  // vite's LICENSE.md appends the licenses of its Node-side dependencies, which are not bundled.
  const cut = text.indexOf('# Licenses of bundled dependencies');
  if (cut >= 0) text = text.slice(0, cut);
  return `${pkg} ${meta.version} (${meta.license})\n\n${text.trim()}\n`;
}

/** Builds: emit dist/third-party-licenses.txt with the notices of the bundled packages. */
function thirdPartyLicenses(): Plugin {
  return {
    name: 'shardfall-third-party-licenses',
    apply: 'build',
    generateBundle() {
      const head =
        `Shardfall ${APP_VERSION}: third-party software included in this build.\n` +
        'All game code, art, audio, and text are made by the Shardfall team (docs/credits.md).\n';
      const parts = BUNDLED_PACKAGES.map(licenseText);
      this.emitFile({
        type: 'asset',
        fileName: 'third-party-licenses.txt',
        source: [head, ...parts].join(`\n${'-'.repeat(72)}\n\n`),
      });
    },
  };
}

/** Production and e2e builds: strip comments and indentation from GLSL templates (bundle budget). */
function glslMinify(): Plugin {
  return {
    name: 'shardfall-glsl-minify',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').includes('/src/render/shaders/')) return null;
      if (!code.includes('/* glsl */')) return null;
      return { code: minifyGlslTemplates(code), map: null };
    },
  };
}

export default defineConfig(({ command, mode, isPreview }) => {
  const isE2e = mode === 'e2e';
  return {
    // `vite preview` serves dist/ with command 'serve': it needs the same base as the build (M5-01).
    base: (command === 'build' || isPreview === true) && !isE2e ? '/shardfall/' : '/',
    define: {
      // Test hooks are compiled in only for `vite build --mode e2e` (architecture 6.12, 14.3).
      __E2E__: JSON.stringify(isE2e),
      // Debug commands and dev overlays: dev server and e2e builds only.
      __DEV_TOOLS__: JSON.stringify(command === 'serve' || isE2e),
      // Release version from package.json (title screen credit line).
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    // Not under Vitest: tests must never rewrite content/generated (data:check compares it).
    plugins: mode === 'test' ? [] : [dataWatch(), glslMinify(), thirdPartyLicenses()],
    build: {
      outDir: isE2e ? 'dist-e2e' : 'dist',
      target: 'es2022',
      sourcemap: isE2e,
      assetsInlineLimit: 0,
      // three.js alone is ~500 kB minified; the real gate is the gzip budget (architecture 13).
      chunkSizeWarningLimit: 1200,
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
        'tests/render/**/*.test.ts',
      ],
      exclude: ['tests/e2e/**', 'tests/perf/**', 'node_modules/**'],
    },
  };
});
