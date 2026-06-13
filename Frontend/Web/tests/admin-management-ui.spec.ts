import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('Enter your password').fill('123456');
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test('admin portal loads all operational sections without runtime errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/admin');
  await signIn(page, 'admin@gmail.com');
  await expect(page.getByRole('heading', { name: 'Dashboard Overview' })).toBeVisible();

  await page.getByRole('button', { name: 'Appointments' }).click();
  await expect(page.getByRole('heading', { name: 'Appointment Management' })).toBeVisible();

  await page.getByRole('button', { name: 'Doctors' }).click();
  await expect(page.getByRole('heading', { name: 'Doctor & Staff Management' })).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-settings-portal.png', fullPage: true });

  expect(pageErrors).toEqual([]);
});

test('management portal loads capacity, roster, flow, and broadcast views', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/management');
  await signIn(page, 'management1@indus.org.pk');
  await expect(page.getByRole('heading', { name: 'Live OPD Overview' })).toBeVisible();

  await page.getByRole('button', { name: 'Capacity' }).click();
  await expect(page.getByRole('heading', { name: 'Doctor Capacity Management' })).toBeVisible();

  await page.getByRole('button', { name: 'Roster' }).click();
  await expect(page.getByRole('heading', { name: 'Roster Builder' })).toBeVisible();

  await page.getByRole('button', { name: 'Flow' }).click();
  await expect(page.getByRole('heading', { name: 'Patient Flow Management' })).toBeVisible();

  await page.getByRole('button', { name: 'Broadcast' }).click();
  await expect(page.getByRole('heading', { name: 'System-Wide Broadcast' })).toBeVisible();
  await page.screenshot({ path: 'test-results/management-broadcast-portal.png', fullPage: true });

  expect(pageErrors).toEqual([]);
});
