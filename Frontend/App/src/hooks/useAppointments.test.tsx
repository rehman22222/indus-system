
import { renderHook, act } from '@testing-library/react-hooks';
import { useCreateAppointment } from './useAppointments';
import { MongoDB } from '@/integrations/mongodb/client';
import { vi } from 'vitest';

// Mock MongoDB
vi.mock('@/integrations/mongodb/client', () => ({
  MongoDB: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn() }))
      }))
    }))
  }
}));

describe('useCreateAppointment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an appointment without client-side quota checks', async () => {
    // Arrange
    const appointmentData = {
      patient_id: '123',
      doctor_id: '456',
      slot_id: '789',
      appointment_type: 'physical' as const,
      chief_complaint: 'Headache',
    };
    const mockResponse = { data: { id: 'new-appt-id', ...appointmentData }, error: null };
    
    // Mock the chained MongoDB calls for a successful insertion
    const fromMock = MongoDB.from as vi.Mock;
    const insertMock = fromMock().insert as vi.Mock;
    const selectMock = insertMock().select as vi.Mock;
    const singleMock = selectMock().single as vi.Mock;
    singleMock.mockResolvedValue(mockResponse);

    // Act
    const { result } = renderHook(() => useCreateAppointment());
    let response;
    await act(async () => {
      response = await result.current.createAppointment(appointmentData);
    });

    // Assert
    expect(fromMock).toHaveBeenCalledWith('appointments');
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      patient_id: '123',
      doctor_id: '456',
      slot_id: '789',
      status: 'confirmed',
    }));
    // Verify that no extra `select` calls were made for quota checking
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(response?.data.id).toBe('new-appt-id');
  });
});
