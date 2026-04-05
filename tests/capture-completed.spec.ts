import { test } from '@playwright/test';

test('Capture completed session state', async ({ page }) => {
  await page.goto('http://localhost:3000/sessions/a4e566c1-828c-4d5c-a2c4-2426b15653b5');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/34-completed.png', fullPage: true });

  // Scroll log to bottom
  await page.evaluate(() => {
    const el = document.querySelector('.terminal-bg');
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/35-completed-bottom.png', fullPage: true });
});
