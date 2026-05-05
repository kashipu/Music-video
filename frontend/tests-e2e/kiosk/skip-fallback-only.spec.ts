import { test, expect } from '@playwright/test';
import { ytStubScript } from '../fixtures/ytStub';
import { resetDb } from '../fixtures/apiHelpers';
import { loginAdmin } from '../fixtures/auth';

test.describe('Kiosk Skip Fallback sin cola (BH-03)', () => {
  test('admin Siguiente con fallback sonando y cola vacía avanza a otro fallback', async ({ browser }) => {
    await resetDb();

    const adminCtx = await browser.newContext();
    const kioskCtx = await browser.newContext();

    const adminPage = await adminCtx.newPage();
    const kioskPage = await kioskCtx.newPage();

    await kioskPage.addInitScript(ytStubScript);

    await loginAdmin(adminPage, 'e2e-test');
    await loginAdmin(kioskPage, 'e2e-test');
    await kioskPage.goto('/e2e-test/video');
    await kioskPage.click('text=INICIAR REPRODUCTOR');

    // Wait for an initial fallback track to load
    await expect.poll(
      () => kioskPage.evaluate(() => (window as any).__ytTest?.getLoadedVideo()),
      { timeout: 20000, message: 'A fallback track should be loaded' }
    ).toMatch(/^fb\d_vid_id\d$/);

    const initialFallback = await kioskPage.evaluate(() =>
      (window as any).__ytTest?.getLoadedVideo()
    );

    // Admin clicks Siguiente — no user queue, must go to another fallback
    await adminPage.click('button:has-text("Siguiente")');

    // Kiosk must load a different fallback track
    await expect.poll(
      () => kioskPage.evaluate(() => (window as any).__ytTest?.getLoadedVideo()),
      { timeout: 5000, message: 'Should switch to a different fallback track' }
    ).not.toBe(initialFallback);

    // The new track must still match the fallback id pattern (fb1, fb2, fb3)
    const newTrack = await kioskPage.evaluate(() =>
      (window as any).__ytTest?.getLoadedVideo()
    );
    expect(newTrack).toMatch(/^fb\d_vid_id\d$/);
  });
});
