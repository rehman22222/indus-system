import { expect, test } from '@playwright/test';

test('patient can open web signup from the shared login screen', async ({ page }) => {
  await page.goto('/');

  const signup = page.getByRole('button', { name: 'Create patient account' });
  await expect(signup).toBeVisible();
  await signup.click();

  await expect(page.getByRole('heading', { name: 'Create patient account' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
});
