jest.mock('@/integrations/mongodb/client', () => ({ MongoDB: {} }));

import { generateOfflineToken } from '../src/lib/tokenGenerator';
import { getNoShowRiskLabel, predictNoShow } from '../src/lib/noShowPredictor';

describe('appointment core logic', () => {
  test('generates a readable appointment token', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const token = generateOfflineToken('doctor-Sara', '2026-06-15');

    expect(token).toMatch(/^S-0615-\d{3}$/);
    jest.restoreAllMocks();
  });

  test('keeps risk labels aligned with prediction thresholds', () => {
    expect(getNoShowRiskLabel(0.2)).toBe('low');
    expect(getNoShowRiskLabel(0.35)).toBe('medium');
    expect(getNoShowRiskLabel(0.6)).toBe('high');
  });

  test('scores a high-risk physical appointment above a routine video visit', () => {
    const highRisk = predictNoShow({
      specialty: 'Dermatology',
      appointment_type: 'physical',
      appointment_date: '2026-06-29',
      appointment_time: '08:00',
      booking_created_at: '2026-06-12T10:00:00.000Z',
      patient_previous_noshows: 3,
      patient_total_appointments: 5,
    });
    const lowerRisk = predictNoShow({
      specialty: 'Pediatrics',
      appointment_type: 'video',
      appointment_date: '2026-06-13',
      appointment_time: '11:00',
      booking_created_at: '2026-06-12T10:00:00.000Z',
    });

    expect(highRisk.score).toBeGreaterThan(lowerRisk.score);
    expect(highRisk.label).toBe('high');
  });
});
