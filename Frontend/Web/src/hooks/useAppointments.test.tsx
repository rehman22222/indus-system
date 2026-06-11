import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCreateAppointment } from './useAppointments';

// Mock the MongoDB client so importing the hook doesn't construct a real
// client (and so a validation-only test makes no network calls).
vi.mock('@/integrations/mongodb/client', () => ({
  MongoDB: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

describe('useCreateAppointment validation', () => {
  it('rejects when patient_id is missing (the booking-flow guard)', async () => {
    const { result } = renderHook(() => useCreateAppointment());

    let response: { data: unknown; error: Error | null } | undefined;
    await act(async () => {
      response = await result.current.createAppointment({
        patient_id: '',
        doctor_id: '456',
        appointment_date: '2026-06-10',
        appointment_time: '09:00',
        appointment_type: 'physical',
      });
    });

    expect(response?.data).toBeNull();
    expect(response?.error?.message).toBe('Patient ID is required.');
  });

  it('rejects when doctor_id is missing', async () => {
    const { result } = renderHook(() => useCreateAppointment());

    let response: { data: unknown; error: Error | null } | undefined;
    await act(async () => {
      response = await result.current.createAppointment({
        patient_id: '123',
        doctor_id: '',
        appointment_date: '2026-06-10',
        appointment_time: '09:00',
        appointment_type: 'physical',
      });
    });

    expect(response?.error?.message).toBe('Doctor is required.');
  });
});
