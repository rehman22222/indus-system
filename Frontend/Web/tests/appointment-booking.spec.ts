import { test, expect } from '@playwright/test';

test.describe('Appointment Booking Flow', () => {
    test('Patient can book an appointment', async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'patient@test.com');
        await page.fill('[data-testid="password-input"]', 'test123');
        await page.click('[data-testid="login-button"]');
        await expect(page).toHaveURL('/patient');
        await page.click('[data-testid="book-appointment"]');
        await expect(page.locator('[data-testid="doctor-list"]')).toBeVisible();
    });

    test('Token is generated on booking confirmation', async ({ page }) => {
        await page.goto('/patient/book');
        // Select first doctor
        await page.click('[data-testid="doctor-card"]:first-child');
        await page.click('[data-testid="slot-button"]:first-child');
        await page.click('[data-testid="confirm-booking"]');
        const token = page.locator('[data-testid="booking-token"]');
        await expect(token).toBeVisible();
        await expect(token).toHaveText(/^[A-Z]-\d{4}-\d{3}$/);
    });
});

test.describe('No-Show Risk Badge', () => {
    test('Admin sees risk badge on appointments', async ({ page }) => {
        await page.goto('/admin/appointments');
        const badge = page.locator('[data-testid="noshowbadge"]').first();
        await expect(badge).toBeVisible();
    });
});
