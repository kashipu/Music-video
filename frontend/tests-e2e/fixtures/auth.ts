import { Page } from '@playwright/test';

export async function loginAdmin(page: Page, venueSlug: string) {
  await page.goto(`/${venueSlug}/admin/login`);
  await page.fill('input[placeholder="admin"]', 'admin');
  await page.fill('input[placeholder="********"]', 'admin123');
  await page.click('button:has-text("ENTRAR")');
  await page.waitForURL(`**/${venueSlug}/admin`);
}

export async function registerCustomerInBrowser(page: Page, venueSlug: string, phone: string) {
  await page.goto(`/${venueSlug}/registro`);
  await page.fill('input[type="tel"]', phone);
  await page.fill('input[placeholder="Como te llamas?"]', `User ${phone}`);
  await page.click('input[type="checkbox"]'); // consent
  await page.click('button:has-text("ENTRAR")');
  await page.waitForURL(`**/${venueSlug}/usuario`);
}
