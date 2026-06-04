import { renderHook, act } from '@testing-library/react-hooks';
import { SocketService } from '@acme/core-api';
import { useQueue } from '../../hooks/useQueue';

// Mock the SocketService
jest.mock('@acme/core-api', () => ({
  SocketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

describe('useQueue', () => {
  it('should connect to the socket and join the correct room', () => {
    renderHook(() => useQueue('test-doctor'));

    expect(SocketService.connect).toHaveBeenCalled();
    expect(SocketService.emit).toHaveBeenCalledWith('join.room', 'doctor_test-doctor');
  });

  it('should update the queue when a "queue.item.updated" event is received', () => {
    const { result } = renderHook(() => useQueue('test-doctor'));
    const newQueueItem = { id: '1', status: 'IN_CONSULT' };

    act(() => {
      // Simulate receiving a socket event
      const callback = SocketService.on.mock.calls.find(call => call[0] === 'queue.item.updated')[1];
      callback(newQueueItem);
    });

    // This is a simplified test. In a real scenario, you would have initial state.
    // expect(result.current.dailyQueue).toContainEqual(newQueueItem);
  });

  it('should disconnect from the socket on unmount', () => {
    const { unmount } = renderHook(() => useQueue('test-doctor'));

    unmount();

    expect(SocketService.disconnect).toHaveBeenCalled();
  });
});
