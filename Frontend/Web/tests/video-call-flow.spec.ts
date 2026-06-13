import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect, test } from '@playwright/test';

const CALL_BASE_URL = (process.env.VIDEO_TEST_BASE_URL || 'http://localhost:5173').replace(/\/$/, '');

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function callToken(role: 'doctor' | 'patient', userId: string) {
  const envFile = readFileSync(resolve(process.cwd(), '../../Backend/.env'), 'utf8');
  const secret = envFile.match(/^JWT_SECRET=(.+)$/m)?.[1]?.trim();
  if (!secret) throw new Error('JWT_SECRET is missing from Backend/.env');

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    type: 'video-call',
    appointmentId: '64b000000000000000000001',
    userId,
    role,
    iat: now,
    exp: now + 600,
  }));
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

test('doctor and patient establish the private WebRTC call', async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const doctorContext = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const patientContext = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const doctor = await doctorContext.newPage();
  const patient = await patientContext.newPage();
  const pageErrors: string[] = [];
  doctor.on('pageerror', (error) => pageErrors.push(`doctor: ${error.message}`));
  patient.on('pageerror', (error) => pageErrors.push(`patient: ${error.message}`));

  try {
    await doctor.goto(`${CALL_BASE_URL}/video-call?token=${callToken('doctor', '64a000000000000000000001')}`);
    await patient.goto(`${CALL_BASE_URL}/video-call?token=${callToken('patient', '64a000000000000000000002')}`);
    await doctor.getByRole('button', { name: 'Enable Camera & Microphone' }).click();
    await patient.getByRole('button', { name: 'Enable Camera & Microphone' }).click();

    await expect(doctor.getByText('Connected', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(patient.getByText('Connected', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(doctor.getByText('Clinical workspace', { exact: true })).toBeVisible();
    await expect(doctor.getByTitle('Mute microphone')).toBeVisible();
    await expect(patient.getByTitle('Turn camera off')).toBeVisible();
    await expect.poll(async () => doctor.getByTestId('remote-video').evaluate((video: HTMLVideoElement) => (
      video.videoWidth > 0 && video.videoHeight > 0 &&
      ((video.srcObject as MediaStream | null)?.getVideoTracks().length || 0) > 0
    )), { timeout: 15_000 }).toBe(true);
    await expect.poll(async () => patient.getByTestId('remote-video').evaluate((video: HTMLVideoElement) => (
      video.videoWidth > 0 && video.videoHeight > 0 &&
      ((video.srcObject as MediaStream | null)?.getVideoTracks().length || 0) > 0
    )), { timeout: 15_000 }).toBe(true);
    expect(pageErrors).toEqual([]);
    await doctor.screenshot({ path: 'test-results/video-call-connected.png', fullPage: true });

    const patientCallUrl = patient.url();
    await patient.getByTitle('End consultation for everyone').click();
    await expect(patient.getByText('Consultation ended', { exact: true })).toBeVisible();
    await expect(doctor.getByText('Consultation ended', { exact: true })).toBeVisible();
    expect(patient.url()).toBe(patientCallUrl);
  } finally {
    await doctorContext.close();
    await patientContext.close();
    await browser.close();
  }
});
