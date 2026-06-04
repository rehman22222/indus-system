import { renderHook, act } from '@testing-library/react-hooks';
import { ApiService } from '@acme/core-api';
import { useAppointments } from '../../hooks/useAppointments';

// Mock the ApiService
jest.mock('@acme/core-api', () => ({
  ApiService: {
    getAppointments: jest.fn(),
  },
}));

describe('useAppointments', () => {
  it('should fetch appointments and update state', async () => {
    const mockAppointments = [{ id: '1', doctorName: 'Dr. Smith' }];
    ApiService.getAppointments.mockResolvedValue({ data: mockAppointments });

    const { result, waitForNextUpdate } = renderHook(() => useAppointments('test-user'));

    await act(async () => {
      await waitForNextUpdate();
    });

    expect(result.current.appointments).toEqual(mockAppointments);
    expect(result.current.loading).toBe(false);
  });

  it('should handle errors when fetching appointments', async () => {
    ApiService.getAppointments.mockRejectedValue(new Error('Failed to fetch'));

    const { result, waitForNextUpdate } = renderHook(() => useAppointments('test-user'));

    await act(async () => {
      await waitForNextUpdate();
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
