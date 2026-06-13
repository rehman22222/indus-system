import { expect, test } from '@playwright/test';

test('doctor can see patient-uploaded booking documents', async ({ page }) => {
  await page.goto('/doctor');
  await page.getByPlaceholder('you@example.com').fill('doctor1@indus.org.pk');
  await page.getByPlaceholder('Enter your password').fill('123456');
  await page.getByRole('button', { name: 'Sign In' }).click();

  const date = page.locator('input[type="date"]');
  await expect(date).toHaveCount(1);
  await date.fill('2026-06-12');

  const patientRow = page.locator('[data-patient-name="Hassan Iqbal"]');
  await expect(patientRow).toHaveCount(1);
  await patientRow.getByRole('button', { name: 'View patient details' }).click();

  await expect(page.getByText('Initial consultation', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Documents' }).click();
  await expect(page.getByText('CBC-BP-Report-June-2026.pdf', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/doctor-patient-documents.png', fullPage: true });
});
