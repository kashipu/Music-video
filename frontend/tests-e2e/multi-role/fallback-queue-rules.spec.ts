import { test, expect } from '@playwright/test';
import { ytStubScript } from '../fixtures/ytStub';
import { resetDb } from '../fixtures/apiHelpers';
import { registerCustomerInBrowser, loginAdmin } from '../fixtures/auth';

test.describe('Fallback and Queue Rules (BH-01)', () => {
  test('reproducción transiciona de fallback a usuario y vuelve a fallback', async ({ browser }) => {
    // 0. Reset DB
    await resetDb();

    // 1. Setup contexts
    const kioskCtx = await browser.newContext();
    const userCtx = await browser.newContext();

    const kioskPage = await kioskCtx.newPage();
    const userPage = await userCtx.newPage();

    // Inject YT Stub in kiosk
    await kioskPage.addInitScript(ytStubScript);

    // 2. Kiosk starts and plays fallback
    await loginAdmin(kioskPage, 'e2e-test');
    await kioskPage.goto('/e2e-test/video');
    await kioskPage.click('text=INICIAR REPRODUCTOR');
    
    // Check fb1 is playing
    await expect.poll(
      () => kioskPage.evaluate(() => (window as any).__ytTest?.getLoadedVideo()),
      { timeout: 10000, message: 'Initial fallback track should be playing' }
    ).toMatch(/^fb\d_vid_id\d$/);
    
    // Give some time for the fallback state to propagate to backend
    await kioskPage.waitForTimeout(1000);

    // 3. User registers and searches for a song
    await registerCustomerInBrowser(userPage, 'e2e-test', '3000000002');
    
    // Search for "usr2"
    await userPage.fill('input[type="search"]', 'usr2');
    // Click first result
    await userPage.click('.result-item');
    // Confirm in preview
    await userPage.click('button:has-text("Confirmar")');

    // 4. Kiosk finishes fb1, must switch to usr2
    // Wait for Kiosk to see the pending song in the bottom bar first
    await expect(kioskPage.locator('.bottom-next')).toBeVisible({ timeout: 10000 });
    await expect(kioskPage.locator('.bottom-next')).toContainText('usr2');

    await kioskPage.evaluate(() => (window as any).__ytTest?.fire('state', 0)); // YT.PlayerState.ENDED

    // Search mock in youtube_search.py truncates id to 11 chars: (query+"_vid_id11")[:11]
    // For query="usr2" → "usr2_vid_id" (11 chars)
    await expect.poll(
      () => kioskPage.evaluate(() => (window as any).__ytTest?.getLoadedVideo()),
      { timeout: 5000, message: 'Should have switched to usr2 after fb1 ended' }
    ).toBe('usr2_vid_id');

    // 5. Kiosk finishes usr2, must return to fallback (fb2)
    await kioskPage.evaluate(() => (window as any).__ytTest?.fire('state', 0));

    await expect.poll(
      () => kioskPage.evaluate(() => (window as any).__ytTest?.getLoadedVideo()),
      { timeout: 5000, message: 'Should have returned to a fallback track after usr2 ended' }
    ).toMatch(/^fb\d_vid_id\d$/);
  });
});
