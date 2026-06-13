import { expect, request, test, type APIRequestContext } from '@playwright/test';

const API_BASE_URL = 'http://localhost:5000';
const TEST_DATE = '2026-06-12';

type Session = {
  token: string;
  user: { id: string; email: string; role: string };
};

async function login(api: APIRequestContext, email: string): Promise<Session> {
  const response = await api.post('/api/auth/login', {
    data: { email, password: '123456' },
  });
  expect(response.ok(), `login failed for ${email}: ${await response.text()}`).toBeTruthy();
  return response.json();
}

function auth(session: Session) {
  return { Authorization: `Bearer ${session.token}` };
}

function filters(column: string, value: unknown) {
  return JSON.stringify([{ op: 'eq', column, value }]);
}

test('admin and management changes persist and flow to the relevant portals', async () => {
  const api = await request.newContext({ baseURL: API_BASE_URL });
  const admin = await login(api, 'admin@gmail.com');
  const management = await login(api, 'management1@indus.org.pk');
  const doctor = await login(api, 'doctor1@indus.org.pk');
  const patient = await login(api, 'patient1@example.com');
  const temporaryEmail = `management.flow.${Date.now()}@indus.test`;
  const broadcastTitle = `System flow check ${Date.now()}`;

  let changedDoctor: Record<string, unknown> | undefined;
  let originalPhysicalQuota = 0;
  let originalVideoQuota = 0;
  let changedAppointment: Record<string, unknown> | undefined;
  let originalStatus = '';

  try {
    const adminDashboard = await api.get('/api/v1/admin/dashboard', { headers: auth(admin) });
    expect(adminDashboard.ok()).toBeTruthy();
    expect((await adminDashboard.json()).data.doctors).toBeGreaterThan(0);

    const managementDashboard = await api.get(`/api/v1/management/dashboard?date=${TEST_DATE}`, {
      headers: auth(management),
    });
    expect(managementDashboard.ok()).toBeTruthy();
    expect((await managementDashboard.json()).data.dailyAppointments).toBeGreaterThan(0);

    const createStaff = await api.post('/api/v1/admin/staff', {
      headers: auth(admin),
      data: {
        email: temporaryEmail,
        password: 'FlowTest123!',
        name: 'Management Flow Test',
        role: 'management',
      },
    });
    expect(createStaff.ok(), await createStaff.text()).toBeTruthy();
    const temporaryLogin = await api.post('/api/auth/login', {
      data: { email: temporaryEmail, password: 'FlowTest123!' },
    });
    expect(temporaryLogin.ok(), await temporaryLogin.text()).toBeTruthy();
    expect((await temporaryLogin.json()).user.role).toBe('management');

    const doctorsResponse = await api.get('/api/v1/doctors');
    expect(doctorsResponse.ok()).toBeTruthy();
    const doctors = (await doctorsResponse.json()).data as Array<Record<string, unknown>>;
    changedDoctor = doctors.find((row) => row.full_name === 'Dr. Sara Malik') || doctors[0];
    expect(changedDoctor).toBeTruthy();
    originalPhysicalQuota = Number(changedDoctor?.daily_physical_quota || 0);
    originalVideoQuota = Number(changedDoctor?.daily_video_quota || 0);

    const quotaUpdate = await api.patch(`/api/v1/doctors/${changedDoctor?.id}`, {
      headers: auth(management),
      data: {
        daily_physical_quota: originalPhysicalQuota + 1,
        daily_video_quota: originalVideoQuota + 1,
      },
    });
    expect(quotaUpdate.ok(), await quotaUpdate.text()).toBeTruthy();

    const doctorReadback = await api.get(`/api/v1/doctors/${changedDoctor?.id}`);
    const doctorReadbackBody = await doctorReadback.json();
    expect(Number(doctorReadbackBody.data.daily_physical_quota)).toBe(originalPhysicalQuota + 1);
    expect(Number(doctorReadbackBody.data.daily_video_quota)).toBe(originalVideoQuota + 1);

    const doctorAppointmentsResponse = await api.get(
      `/api/v1/appointments?date=${TEST_DATE}&limit=50`,
      { headers: auth(doctor) },
    );
    expect(doctorAppointmentsResponse.ok()).toBeTruthy();
    const doctorAppointments = (await doctorAppointmentsResponse.json()).data as Array<Record<string, any>>;
    changedAppointment = doctorAppointments.find((row) => ['confirmed', 'scheduled'].includes(row.status));
    expect(changedAppointment).toBeTruthy();
    originalStatus = String(changedAppointment?.status);

    const statusUpdate = await api.patch(`/api/v1/appointments/${changedAppointment?.id}`, {
      headers: auth(management),
      data: { status: 'waiting' },
    });
    expect(statusUpdate.ok(), await statusUpdate.text()).toBeTruthy();

    const doctorAppointmentReadback = await api.get(`/api/v1/appointments/${changedAppointment?.id}`, {
      headers: auth(doctor),
    });
    expect((await doctorAppointmentReadback.json()).data.status).toBe('waiting');

    const appointmentPatient = await login(api, String(changedAppointment?.patient.email));
    const patientAppointmentReadback = await api.get(`/api/v1/appointments/${changedAppointment?.id}`, {
      headers: auth(appointmentPatient),
    });
    expect(patientAppointmentReadback.ok()).toBeTruthy();
    expect((await patientAppointmentReadback.json()).data.status).toBe('waiting');

    const block = await api.post('/api/v1/management/slots/block', {
      headers: auth(management),
      data: { blocked: true },
    });
    expect(block.ok(), await block.text()).toBeTruthy();
    const blockedSlots = await api.get(`/api/v1/doctors/${changedDoctor?.id}/slots?date=${TEST_DATE}`);
    expect(blockedSlots.ok()).toBeTruthy();
    expect((await blockedSlots.json()).data).toEqual([]);

    const unblock = await api.post('/api/v1/management/slots/block', {
      headers: auth(management),
      data: { blocked: false },
    });
    expect(unblock.ok(), await unblock.text()).toBeTruthy();

    const broadcast = await api.post('/api/v1/notifications', {
      headers: auth(management),
      data: {
        title: broadcastTitle,
        message: 'This verifies that management broadcasts reach patient accounts.',
        is_broadcast: true,
        target_role: 'patient',
      },
    });
    expect(broadcast.ok(), await broadcast.text()).toBeTruthy();
    expect((await broadcast.json()).count).toBeGreaterThan(0);

    const patientNotifications = await api.get('/api/v1/notifications?limit=100', {
      headers: auth(patient),
    });
    const notifications = (await patientNotifications.json()).data as Array<{ title: string }>;
    expect(notifications.some((row) => row.title === broadcastTitle)).toBeTruthy();

    const auditLogs = await api.get('/api/v1/admin/audit-logs?limit=100', { headers: auth(admin) });
    const auditRows = (await auditLogs.json()).data as Array<{ action: string }>;
    expect(auditRows.some((row) => row.action === 'staff_account.created')).toBeTruthy();
    expect(auditRows.some((row) => row.action === 'slots.blocked_all')).toBeTruthy();
  } finally {
    await api.post('/api/v1/management/slots/block', {
      headers: auth(management),
      data: { blocked: false },
    });

    if (changedAppointment && originalStatus) {
      await api.patch(`/api/v1/appointments/${changedAppointment.id}`, {
        headers: auth(management),
        data: { status: originalStatus },
      });
    }

    if (changedDoctor) {
      await api.patch(`/api/v1/doctors/${changedDoctor.id}`, {
        headers: auth(management),
        data: {
          daily_physical_quota: originalPhysicalQuota,
          daily_video_quota: originalVideoQuota,
        },
      });
    }

    await api.delete('/api/v1/data/users', {
      headers: auth(admin),
      params: { filters: filters('email', temporaryEmail) },
    });
    await api.delete('/api/v1/data/notifications', {
      headers: auth(admin),
      params: { filters: filters('title', broadcastTitle) },
    });
    await api.dispose();
  }
});
