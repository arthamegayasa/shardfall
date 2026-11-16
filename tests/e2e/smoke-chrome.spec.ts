// Smoke on Google Chrome (channel chrome), test-plan 11.2, M1-09. Skipped when Chrome is not installed.
import { existsSync } from 'node:fs';
import { test } from '@playwright/test';
import { runSmoke } from './support/smoke.ts';

/** Default install paths of Google Chrome stable on Windows, Linux, and macOS. */
const PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/opt/google/chrome/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
test.use({ channel: 'chrome' });

test('smoke: Google Chrome', async ({ page }) => {
  test.skip(!PATHS.some((p) => existsSync(p)), 'Chrome not installed');
  test.setTimeout(120_000);
  await runSmoke(page, 'chrome', { strictHash: true });
});
