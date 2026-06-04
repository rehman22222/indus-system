import { describe, it, expect } from 'vitest';
import { predictNoShow, getNoShowRiskLabel } from './noShowPredictor';

describe('getNoShowRiskLabel', () => {
  it('uses the shared thresholds (medium = 0.35, high = 0.6)', () => {
    expect(getNoShowRiskLabel(null)).toBe('low');
    expect(getNoShowRiskLabel(0)).toBe('low');
    expect(getNoShowRiskLabel(0.34)).toBe('low');
    // 0.30 was previously 'medium' (threshold mismatch) — now 'low'.
    expect(getNoShowRiskLabel(0.3)).toBe('low');
    expect(getNoShowRiskLabel(0.35)).toBe('medium');
    expect(getNoShowRiskLabel(0.59)).toBe('medium');
    expect(getNoShowRiskLabel(0.6)).toBe('high');
  });
});

describe('predictNoShow', () => {
  const base = {
    appointment_type: 'physical' as const,
    appointment_time: '10:00',
    specialty: 'Cardiology',
  };

  it('does not flag a same-day booking as booked-in-advance', () => {
    const day = '2026-06-10';
    const { factors } = predictNoShow({
      ...base,
      appointment_date: day,
      booking_created_at: `${day}T14:00:00`, // same calendar day, afternoon
    });
    expect(factors.some((f) => f.includes('advance'))).toBe(false);
  });

  it('flags a booking made more than two weeks ahead', () => {
    const { factors } = predictNoShow({
      ...base,
      appointment_date: '2026-07-01',
      booking_created_at: '2026-06-01T09:00:00',
    });
    expect(factors).toContain('Booked more than 2 weeks in advance');
  });

  it('returns a label consistent with getNoShowRiskLabel for the same score', () => {
    // Cardiology(0.10) + physical(+0.05) + high-risk hour 08:00(+0.15) = 0.30,
    // on a Wednesday (no Mon/Fri penalty) booked 1 day ahead (no lead penalty).
    const p = predictNoShow({
      specialty: 'Cardiology',
      appointment_type: 'physical',
      appointment_time: '08:00',
      appointment_date: '2026-06-10',
      booking_created_at: '2026-06-09T10:00:00',
    });
    expect(p.score).toBeCloseTo(0.3, 2);
    expect(p.label).toBe('low');
    expect(p.label).toBe(getNoShowRiskLabel(p.score));
  });
});
