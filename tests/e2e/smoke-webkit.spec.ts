// Smoke on Playwright WebKit, the Safari proxy (tasks.md 2026-11-16; brief M1-09b). Uses the build
// Playwright expects; when only an older cached build exists it is used instead and the result is
// indicative (revision mismatch, noted in the QA report). D-5 hash recorded, not enforced.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, webkit } from '@playwright/test';
import { runSmoke } from './support/smoke.ts';

function webkitExe(): string | undefined {
  if (existsSync(webkit.executablePath())) return undefined;
  const cache = join(process.env['LOCALAPPDATA'] ?? '', 'ms-playwright');
  if (!existsSync(cache)) return undefined;
  const dirs = readdirSync(cache)
    .filter((d) => d.startsWith('webkit-'))
    .sort();
  const last = dirs[dirs.length - 1];
  const exe = last === undefined ? '' : join(cache, last, 'Playwright.exe');
  return existsSync(exe) ? exe : undefined;
}

const fallback = webkitExe();
const available = existsSync(webkit.executablePath()) || fallback !== undefined;
test.use({
  browserName: 'webkit',
  launchOptions: fallback === undefined ? {} : { executablePath: fallback },
});

test('smoke: WebKit (Playwright build, Safari proxy)', async ({ page }) => {
  test.skip(!available, 'Playwright WebKit not installed');
  test.setTimeout(120_000);
  await runSmoke(page, fallback === undefined ? 'webkit' : 'webkit-fallback', {
    strictHash: false,
  });
});
