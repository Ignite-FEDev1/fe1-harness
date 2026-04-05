import { test } from '@playwright/test';

test('Capture global rules page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/pipelines/global-rules');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/50-global-rules-page.png', fullPage: true });
});
