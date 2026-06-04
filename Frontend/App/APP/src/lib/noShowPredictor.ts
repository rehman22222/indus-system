// Rule-based predictive scoring model for no-show risk
// Based on academic literature: specialty type, booking lead time, time of day, day of week

export interface AppointmentFeatures {
    specialty: string;
    appointment_type: 'physical' | 'video';
    appointment_date: string;
    appointment_time: string;
    booking_created_at: string;
    patient_previous_noshows?: number;
    patient_total_appointments?: number;
}

export interface NoShowPrediction {
    score: number;
    label: 'low' | 'medium' | 'high';
    factors: string[];
}

// Risk weights derived from healthcare scheduling literature
const SPECIALTY_RISK: Record<string, number> = {
    'Dermatology': 0.25,
    'Orthopedics': 0.20,
    'ENT': 0.18,
    'General Medicine': 0.15,
    'Cardiology': 0.10,
    'Neurology': 0.10,
    'Pediatrics': 0.08,
    'Gynecology': 0.08,
};

const HIGH_RISK_HOURS = [7, 8, 17, 18, 19]; // Early morning and evening
const HIGH_RISK_DAYS = [1, 5]; // Monday and Friday (day of week 0-6)

// Single source of truth for risk-band cut-offs so predictNoShow() and
// getNoShowRiskLabel() never disagree on the same score.
const HIGH_RISK_THRESHOLD = 0.6;
const MEDIUM_RISK_THRESHOLD = 0.35;

export function predictNoShow(features: AppointmentFeatures): NoShowPrediction {
    let score = 0.0;
    const factors: string[] = [];

    // Factor 1: Specialty risk (0 - 0.25)
    const specialtyRisk = SPECIALTY_RISK[features.specialty] ?? 0.15;
    score += specialtyRisk;
    if (specialtyRisk >= 0.20) factors.push(`${features.specialty} has elevated no-show rate`);

    // Factor 2: Booking lead time (0 - 0.20)
    // Parse appointment_date (YYYY-MM-DD) as a LOCAL calendar date. Using
    // new Date('YYYY-MM-DD') parses as UTC midnight, which drifts against the
    // local booking timestamp and can make same-day bookings come out negative.
    const [apptY, apptM, apptD] = features.appointment_date.split('-').map(Number);
    const appointmentDate = new Date(apptY, (apptM || 1) - 1, apptD || 1);
    const bookingRaw = new Date(features.booking_created_at);
    const bookingDay = new Date(bookingRaw.getFullYear(), bookingRaw.getMonth(), bookingRaw.getDate());
    const leadDays = Math.round((appointmentDate.getTime() - bookingDay.getTime()) / (1000 * 60 * 60 * 24));
    if (leadDays > 14) {
        score += 0.20;
        factors.push('Booked more than 2 weeks in advance');
    } else if (leadDays > 7) {
        score += 0.12;
        factors.push('Booked more than 1 week in advance');
    } else if (leadDays > 3) {
        score += 0.06;
    }

    // Factor 3: Time of day (0 - 0.15)
    const hour = parseInt(features.appointment_time.split(':')[0], 10);
    if (HIGH_RISK_HOURS.includes(hour)) {
        score += 0.15;
        factors.push('High-risk appointment time slot');
    }

    // Factor 4: Day of week (0 - 0.12) — reuse the local-parsed appointmentDate.
    const dayOfWeek = appointmentDate.getDay();
    if (HIGH_RISK_DAYS.includes(dayOfWeek)) {
        score += 0.12;
        factors.push('Monday/Friday has higher no-show tendency');
    }

    // Factor 5: Video vs physical (video = lower risk)
    if (features.appointment_type === 'physical') {
        score += 0.05;
    } else {
        score -= 0.05;
        factors.push('Video consultation reduces no-show likelihood');
    }

    // Factor 6: Patient history (0 - 0.20)
    if (features.patient_previous_noshows && features.patient_total_appointments) {
        const noshowRate = features.patient_previous_noshows / features.patient_total_appointments;
        if (noshowRate > 0.3) {
            score += 0.20;
            factors.push('Patient has history of missed appointments');
        } else if (noshowRate > 0.1) {
            score += 0.10;
            factors.push('Patient has occasional missed appointments');
        }
    }

    // Clamp between 0 and 1
    score = Math.min(Math.max(score, 0.0), 1.0);
    score = Math.round(score * 100) / 100;

    const label: 'low' | 'medium' | 'high' =
        score >= HIGH_RISK_THRESHOLD ? 'high' : score >= MEDIUM_RISK_THRESHOLD ? 'medium' : 'low';

    return { score, label, factors };
}

/**
 * Compute risk label from numeric score
 * Used to derive label client-side instead of storing in DB
 */
export function getNoShowRiskLabel(score: number | undefined | null): 'low' | 'medium' | 'high' {
    if (score === undefined || score === null) return 'low';
    if (score >= HIGH_RISK_THRESHOLD) return 'high';
    if (score >= MEDIUM_RISK_THRESHOLD) return 'medium';
    return 'low';
}
