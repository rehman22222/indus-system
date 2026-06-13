import { expect, request, test } from '@playwright/test';

const API_BASE_URL = 'http://localhost:5000';

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test('doctor video consultation opens in a dedicated browser tab', async ({ page }) => {
  const api = await request.newContext({ baseURL: API_BASE_URL });
  const login = await api.post('/api/auth/login', {
    data: { email: 'doctor1@indus.org.pk', password: '123456' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };

  const appointmentsResponse = await api.get('/api/v1/appointments', { headers });
  expect(appointmentsResponse.ok()).toBeTruthy();
  const appointmentsBody = await appointmentsResponse.json();
  const appointment = appointmentsBody.data.find((item: {
    appointment_type?: string;
    doctor?: { name?: string };
  }) => item.appointment_type === 'video' && item.doctor?.name === 'Dr. Sara Malik');
  expect(appointment).toBeTruthy();

  const originalStatus = appointment.status;
  await api.patch(`/api/v1/appointments/${appointment.id}`, {
    headers,
    data: { status: 'waiting' },
  });

  try {
    await page.goto('/doctor');
    await page.getByPlaceholder('you@example.com').fill('doctor1@indus.org.pk');
    await page.getByPlaceholder('Enter your password').fill('123456');
    await page.getByRole('button', { name: 'Sign In' }).click();

    const date = page.locator('input[type="date"]');
    await expect(date).toHaveCount(1);
    await date.fill(appointment.date);

    const patientRow = page.locator(`[data-patient-name="${appointment.patient.name}"]`);
    await expect(patientRow).toHaveCount(1);
    const popupPromise = page.waitForEvent('popup');
    await patientRow.getByTitle('Join Video Call').click();
    const callPage = await popupPromise;
    await callPage.waitForURL(/\/video-call\?token=/, { timeout: 15_000 });

    expect(new URL(callPage.url()).pathname).toBe('/video-call');
    expect(new URL(callPage.url()).protocol).toBe('https:');
    await callPage.getByRole('button', { name: 'Enable Camera & Microphone' }).click();
    await expect(callPage.getByRole('paragraph').filter({ hasText: 'Waiting for the other participant...' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('iframe[title="Video consultation"]')).toHaveCount(0);
    await callPage.close();
  } finally {
    await api.patch(`/api/v1/appointments/${appointment.id}`, {
      headers,
      data: { status: originalStatus },
    });
    await api.dispose();
  }
});
