// Smoke on Microsoft Edge (channel msedge), test-plan 11.2, M1-09. Skipped when Edge is not installed.
import { existsSync } from 'node:fs';
import { test } from '@playwright/test';
import { runSmoke } from './support/smoke.ts';

/** Default install paths of Microsoft Edge stable on Windows, Linux, and macOS. */
const PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/opt/microsoft/msedge/msedge',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];
test.use({ channel: 'msedge' });

test('smoke: Microsoft Edge', async ({ page }) => {
  test.skip(!PATHS.some((p) => existsSync(p)), 'Edge not installed');
  test.setTimeout(120_000);
  await runSmoke(page, 'msedge', { strictHash: true });
});
