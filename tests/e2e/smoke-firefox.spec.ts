// Smoke on Playwright Firefox (test-plan 11.2; brief M1-09b). Skipped when the build is not installed
// (`npx playwright install firefox`). D-5 hash is recorded, not enforced (architecture 4.2).
import { existsSync } from 'node:fs';
import { firefox, test } from '@playwright/test';
import { runSmoke } from './support/smoke.ts';

test.use({ browserName: 'firefox' });

test('smoke: Firefox (Playwright build)', async ({ page }) => {
  test.skip(!existsSync(firefox.executablePath()), 'Playwright Firefox not installed');
  test.setTimeout(120_000);
  await runSmoke(page, 'firefox', { strictHash: false });
});
