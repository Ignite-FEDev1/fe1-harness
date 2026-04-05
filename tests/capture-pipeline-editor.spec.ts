import { test } from '@playwright/test';

test('Capture pipeline editor page (wide)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/pipelines/generic/' + encodeURIComponent('기사요약'));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/40-pipeline-editor-current.png', fullPage: true });
});
