import { expect, test } from '@playwright/test';

test('patient can sign in and use the web portal', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('patient1@example.com');
  await page.locator('#login-password').fill('123456');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL(/\/patient$/, { timeout: 15_000 });
  await expect(page.getByText('Book Appointment', { exact: true })).toBeVisible();
  await expect(page.getByText('My Appointments', { exact: true })).toBeVisible();
});
