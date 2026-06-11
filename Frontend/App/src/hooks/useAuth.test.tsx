
import { renderHook, act } from '@testing-library/react-hooks';
import { AuthProvider, useAuth } from './useAuth';
import { MongoDB } from '@/integrations/mongodb/client';
import { vi } from 'vitest';
import { Session, User } from '@/integrations/mongodb/client';

// Mock the entire MongoDB client to prevent real API calls
vi.mock('@/integrations/mongodb/client', () => ({
  MongoDB: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
    })),
  },
}));

describe('useAuth Hook', () => {
  // Use fake timers to control setTimeout in the hook
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  let onAuthStateChangeCallback: (event: string, session: Session | null) => void = () => {};

  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    vi.clearAllMocks();

    // Mock getSession to return no initial session, simulating a fresh load
    (MongoDB.auth.getSession as vi.Mock).mockResolvedValue({ data: { session: null } });

    // Mock onAuthStateChange to capture the callback passed from the hook
    (MongoDB.auth.onAuthStateChange as vi.Mock).mockImplementation((_event, callback) => {
      onAuthStateChangeCallback = callback;
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      };
    });
  });

  it('should correctly identify and verify a signed-in doctor', async () => {
    // Arrange: Define mock user, session, and roles for a doctor
    const mockUser = { id: 'doc-123', email: 'doctor@example.com' } as User;
    const mockSession = { user: mockUser } as Session;
    // Mock the database call to return the doctor role from public.users
    ((MongoDB.from as vi.Mock)('users').select().eq().maybeSingle as vi.Mock).mockResolvedValue({ data: { role: 'DOCTOR' }, error: null });

    // Act: Render the hook
    const { result, waitFor } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.isLoading).toBe(true); // Initial state should be loading

    // Simulate the SIGNED_IN event
    act(() => {
      onAuthStateChangeCallback('SIGNED_IN', mockSession);
    });

    // Fast-forward timers to trigger the role fetch inside the hook's setTimeout
    await act(async () => {
      vi.runAllTimers();
    });
    
    // Assert: Wait for the state to update and verify the RBAC logic
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user?.email).toBe('doctor@example.com');
    expect(result.current.roles).toEqual(['DOCTOR']);
    expect(result.current.hasRole('DOCTOR')).toBe(true);
    expect(result.current.hasRole('PATIENT')).toBe(false);
    expect(result.current.isStaff()).toBe(true);
  });

  it('should correctly identify and verify a signed-in patient', async () => {
    // Arrange: Define mock user, session, and roles for a patient
    const mockUser = { id: 'patient-456', email: 'patient@example.com' } as User;
    const mockSession = { user: mockUser } as Session;
    // Mock the database call to return the patient role from public.users
    ((MongoDB.from as vi.Mock)('users').select().eq().maybeSingle as vi.Mock).mockResolvedValue({ data: { role: 'PATIENT' }, error: null });

    // Act
    const { result, waitFor } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      onAuthStateChangeCallback('SIGNED_IN', mockSession);
    });

    await act(async () => {
      vi.runAllTimers();
    });
    
    // Assert: Wait for the state to update and verify the RBAC logic
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user?.email).toBe('patient@example.com');
    expect(result.current.roles).toEqual(['PATIENT']);
    expect(result.current.hasRole('PATIENT')).toBe(true);
    expect(result.current.hasRole('DOCTOR')).toBe(false);
    expect(result.current.isStaff()).toBe(false);
  });
});
