import { expect, request, test, type APIRequestContext } from '@playwright/test';

const API_BASE_URL = 'http://localhost:5000';
const BOOKING_DATE = '2026-06-15';

async function login(api: APIRequestContext, email: string) {
  const response = await api.post('/api/auth/login', {
    data: { email, password: '123456' },
  });
  expect(response.ok(), `login failed for ${email}: ${await response.text()}`).toBeTruthy();
  return response.json();
}

function auth(session: { token: string }) {
  return { Authorization: `Bearer ${session.token}` };
}

function filters(column: string, value: unknown) {
  return JSON.stringify([{ op: 'eq', column, value }]);
}

test('patient booking is persisted for patient, doctor, and admin portals', async () => {
  const api = await request.newContext({ baseURL: API_BASE_URL });
  const admin = await login(api, 'admin@gmail.com');
  const patient = await login(api, 'patient1@example.com');
  let appointmentId = '';

  try {
    await api.post('/api/v1/management/slots/block', {
      headers: auth(admin),
      data: { blocked: false },
    });

    const doctorsResponse = await api.get('/api/v1/doctors');
    expect(doctorsResponse.ok()).toBeTruthy();
    const doctors = (await doctorsResponse.json()).data as Array<{
      id: string;
      email?: string;
      full_name: string;
    }>;

    let selectedDoctor: (typeof doctors)[number] | undefined;
    let selectedSlot: { start_time: string } | undefined;

    for (const doctor of doctors) {
      await api.post('/api/v1/data/rpc/generate_daily_slots', {
        headers: auth(admin),
        data: { p_doctor_id: doctor.id, p_date: BOOKING_DATE },
      });
      const slotsResponse = await api.get(`/api/v1/doctors/${doctor.id}/slots?date=${BOOKING_DATE}`);
      const slots = (await slotsResponse.json()).data as Array<{ start_time: string }>;
      if (doctor.email && slots.length > 0) {
        selectedDoctor = doctor;
        selectedSlot = slots[0];
        break;
      }
    }

    expect(selectedDoctor).toBeTruthy();
    expect(selectedSlot).toBeTruthy();

    const create = await api.post('/api/v1/appointments', {
      headers: auth(patient),
      data: {
        patientId: patient.user.id,
        doctorId: selectedDoctor?.id,
        date: BOOKING_DATE,
        time: selectedSlot?.start_time,
        appointmentType: 'physical',
        visitType: 'new_consultation',
        chiefComplaint: 'Persistent headache for three days',
      },
    });
    expect(create.ok(), await create.text()).toBeTruthy();
    const appointment = (await create.json()).data;
    appointmentId = appointment.id;
    expect(appointment.token).toMatch(/^APT-/);
    expect(appointment.chief_complaint).toBe('Persistent headache for three days');

    const patientReadback = await api.get(`/api/v1/appointments/${appointmentId}`, {
      headers: auth(patient),
    });
    expect(patientReadback.ok()).toBeTruthy();
    expect((await patientReadback.json()).data.doctor_id).toBe(selectedDoctor?.id);

    const doctor = await login(api, String(selectedDoctor?.email));
    const doctorReadback = await api.get(`/api/v1/appointments/${appointmentId}`, {
      headers: auth(doctor),
    });
    expect(doctorReadback.ok()).toBeTruthy();
    expect((await doctorReadback.json()).data.patient_id).toBe(patient.user.id);

    const adminReadback = await api.get(`/api/v1/appointments/${appointmentId}`, {
      headers: auth(admin),
    });
    expect(adminReadback.ok()).toBeTruthy();
    const adminAppointment = (await adminReadback.json()).data;
    expect(adminAppointment.no_show_score).toEqual(expect.any(Number));

    const cancel = await api.delete(`/api/v1/appointments/${appointmentId}`, {
      headers: auth(patient),
    });
    expect(cancel.ok(), await cancel.text()).toBeTruthy();
    expect((await cancel.json()).data.status).toBe('cancelled');
  } finally {
    if (appointmentId) {
      const cleanupTargets = [
        ['appointments', 'id'],
        ['queue', 'appointment_id'],
        ['notifications', 'data.appointment_id'],
        ['audit_logs', 'record_id'],
      ] as const;
      for (const [collection, column] of cleanupTargets) {
        await api.delete(`/api/v1/data/${collection}`, {
          headers: auth(admin),
          params: { filters: filters(column, appointmentId) },
        });
      }
    }
    await api.dispose();
  }
});
