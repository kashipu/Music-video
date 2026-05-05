import { test, expect } from '@playwright/test';
import { ytStubScript } from '../fixtures/ytStub';
import { resetDb, registerUser, confirmSong } from '../fixtures/apiHelpers';
import { loginAdmin } from '../fixtures/auth';

test.describe('Kiosk Skip Transitions (BH-02)', () => {
  test('admin skip durante fallback con cola pendiente cambia inmediatamente', async ({ browser }) => {
    // 0. Reset DB
    await resetDb();

    // 1. Setup contexts
    const adminCtx = await browser.newContext();
    const kioskCtx = await browser.newContext();

    const adminPage = await adminCtx.newPage();
    const kioskPage = await kioskCtx.newPage();
    
    // Inject YT Stub in kiosk
    await kioskPage.addInitScript(ytStubScript);

    // 2. Login admin + abrir kiosk
    await loginAdmin(adminPage, 'e2e-test');
    await loginAdmin(kioskPage, 'e2e-test');
    await kioskPage.goto('/e2e-test/video');
    kioskPage.on('console', msg => console.log(`[KIOSK CONSOLE] ${msg.text()}`));
    kioskPage.on('pageerror', err => console.log(`[KIOSK ERROR] ${err.message}`));
    await kioskPage.click('text=INICIAR REPRODUCTOR');
    
    // Wait for fallback track one (fb1) to load
    await expect.poll(
      () => kioskPage.evaluate(() => (window as any).__ytTest?.getLoadedVideo()),
      { timeout: 20000, message: 'A fallback track should be loaded' }
    ).toMatch(/^fb\d_vid_id\d$/);
    
    // Wait for state to sync
    await kioskPage.waitForTimeout(1000);

    // 3. Customer adds a song via API
    const userToken = await registerUser('3000000001');
    const songId = 'usr1_vid_id'; // 11 characters
    await confirmSong(userToken, songId);

    // Wait for Kiosk to see the pending song in the bottom bar
    await expect(kioskPage.locator('.bottom-next')).toBeVisible({ timeout: 10000 });
    // Title comes from youtube_service.fetch_video_metadata test mock: "Test Video {video_id}"
    await expect(kioskPage.locator('.bottom-next')).toContainText('Test Video usr1_vid_id');

    // 4. Admin clicks "Siguiente" (Saltar Fallback)
    await adminPage.click('button:has-text("Siguiente")');

    // 5. Kiosk must switch to user song (usr1) immediately
    await expect.poll(
      () => kioskPage.evaluate(() => (window as any).__ytTest?.getLoadedVideo()),
      { timeout: 5000, message: 'Kiosk should have switched to usr1' }
    ).toBe('usr1_vid_id');
  });
});
