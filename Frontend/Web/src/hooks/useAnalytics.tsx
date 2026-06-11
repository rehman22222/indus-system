import { useState, useEffect } from 'react';
import {
    MongoDB,
    isMongoConfigured,
} from '@/integrations/mongodb/client';
import { getCached, setCached, CACHE_TTL } from '@/lib/queryCache';
import { analyticsService } from '@/lib/analyticsService';

export interface DashboardStats {
    totalAppointments: number;
    completedAppointments: number;
    noShowCount: number;
    noShowRate: number;
    utilizationRate: number;
    specialtyBreakdown: { specialty: string; count: number }[];
    hourlyDistribution: { hour: string; count: number }[];
    isLive: boolean;
}

// Analytics API Response Types (rule-based, not ML)
export interface AnalyticsData {
    ensemble: {
        no_show_rate: number;
        high_risk_count: number;
        average_score: number;
    };
    forecast: {
        dates: string[];
        predicted_volume: number[];
    };
    risks: Array<{
        appointment_id: string;
        patient_name: string;
        no_show_score: number;
        risk_label: 'LOW' | 'MEDIUM' | 'HIGH';
        appointment_date: string;
        appointment_time: string;
    }>;
}

type RiskLabel = AnalyticsData['risks'][number]['risk_label'];

function todayISO() {
    return toLocalISODate(new Date());
}

function toLocalISODate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDaysISO(baseDate: Date, days: number) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + days);
    return toLocalISODate(date);
}

function clampScore(value: unknown) {
    const score = Number(value);
    if (!Number.isFinite(score)) return 0;
    return Math.min(1, Math.max(0, score));
}

function getRiskLabel(score: number): RiskLabel {
    if (score >= 0.60) return 'HIGH';
    if (score >= 0.35) return 'MEDIUM';
    return 'LOW';
}

function normalizeRiskLabel(value: unknown, score: number): RiskLabel {
    const label = String(value || '').toUpperCase();
    if (label === 'HIGH' || label === 'MEDIUM' || label === 'LOW') return label;
    return getRiskLabel(score);
}

function getAppointmentDate(appointment: any) {
    return appointment.appointment_date || appointment.date || todayISO();
}

function getAppointmentTime(appointment: any) {
    return appointment.appointment_time || appointment.time || '09:00';
}

function getAppointmentScore(appointment: any) {
    return clampScore(appointment.no_show_score ?? appointment.no_show_risk_score);
}

function getPatientName(appointment: any) {
    return (
        appointment.patient?.full_name ||
        appointment.patient?.name ||
        appointment.patients?.full_name ||
        appointment.patients?.name ||
        appointment.patient_name ||
        'Patient'
    );
}

function isNoShow(status: unknown) {
    const value = String(status || '').toLowerCase();
    return value === 'no_show' || value === 'no-show' || value === 'missed';
}

function buildMongoAnalytics(appointments: any[]): AnalyticsData {
    const today = new Date();
    const forecastDates = Array.from({ length: 7 }, (_, index) => addDaysISO(today, index));
    const countsByDate = appointments.reduce<Record<string, number>>((acc, appointment) => {
        const date = getAppointmentDate(appointment);
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {});

    const scores = appointments.map(getAppointmentScore);
    const averageScore = scores.length
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;
    const noShowCount = appointments.filter((appointment) => isNoShow(appointment.status)).length;
    const datedAppointments = appointments.filter((appointment) => getAppointmentDate(appointment));
    const baselineVolume = Math.max(1, Math.round(appointments.length / Math.max(1, new Set(datedAppointments.map(getAppointmentDate)).size)));

    const risks = [...appointments]
        .map((appointment) => {
            const score = getAppointmentScore(appointment);
            return {
                appointment_id: String(appointment.id || appointment._id || appointment.token || `${getAppointmentDate(appointment)}-${getAppointmentTime(appointment)}`),
                patient_name: getPatientName(appointment),
                no_show_score: score,
                risk_label: getRiskLabel(score),
                appointment_date: getAppointmentDate(appointment),
                appointment_time: getAppointmentTime(appointment),
            };
        })
        .filter((risk) => risk.no_show_score > 0)
        .sort((a, b) => b.no_show_score - a.no_show_score)
        .slice(0, 10);

    return {
        ensemble: {
            no_show_rate: appointments.length ? Math.round((noShowCount / appointments.length) * 100) : 0,
            high_risk_count: risks.filter((risk) => risk.risk_label === 'HIGH').length,
            average_score: averageScore,
        },
        forecast: {
            dates: forecastDates,
            predicted_volume: forecastDates.map((date) => countsByDate[date] || baselineVolume),
        },
        risks,
    };
}

async function getMongoAnalyticsFallback(): Promise<AnalyticsData> {
    if (!isMongoConfigured) {
        throw new Error('MongoDB not configured');
    }

    const { data: appointments, error } = await MongoDB
        .from('appointments')
        .select(`
            id, token, appointment_date, appointment_time, date, time, status,
            no_show_score, no_show_risk_score,
            patient:patients(id, full_name, name)
        `)
        .order('appointment_date', { ascending: true })
        .limit(500);

    if (error) throw error;
    return buildMongoAnalytics(Array.isArray(appointments) ? appointments : []);
}

async function getPythonAnalyticsData(): Promise<AnalyticsData | null> {
    const [volumeForecast, patientRisks, statsSummary] = await Promise.all([
        analyticsService.getVolumeForecast(7),
        analyticsService.getPatientRisks(10, 'HIGH'),
        analyticsService.getStatsSummary(),
    ]);

    if (
        !volumeForecast ||
        !Array.isArray(volumeForecast.dates) ||
        !Array.isArray(volumeForecast.predicted_volume) ||
        volumeForecast.dates.length === 0 ||
        !patientRisks ||
        !statsSummary
    ) {
        return null;
    }

    const riskScores = patientRisks.map((risk) => clampScore(risk.risk_score));
    const averageScore = riskScores.length
        ? riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length
        : 0;

    return {
        ensemble: {
            no_show_rate: statsSummary.today?.no_show_rate ?? statsSummary.no_show_rate ?? 0,
            high_risk_count: patientRisks.filter((risk) => normalizeRiskLabel(risk.risk_level, risk.risk_score) === 'HIGH').length,
            average_score: statsSummary.average_risk_score ?? averageScore,
        },
        forecast: {
            dates: volumeForecast.dates,
            predicted_volume: volumeForecast.predicted_volume,
        },
        risks: patientRisks.map((risk) => {
            const score = clampScore(risk.risk_score);
            const patientId = String(risk.patient_id || risk.appointment_id || 'unknown');

            return {
                appointment_id: String(risk.appointment_id || patientId),
                patient_name: risk.patient_name || `Patient ${patientId.slice(0, 8)}`,
                no_show_score: score,
                risk_label: normalizeRiskLabel(risk.risk_level, score),
                appointment_date: risk.appointment_date || todayISO(),
                appointment_time: risk.appointment_time || '09:00',
            };
        }),
    };
}

async function getAnalyticsData(setIsPythonAPIAvailable: (available: boolean) => void): Promise<AnalyticsData> {
    const apiAvailable = await analyticsService.healthCheck();
    setIsPythonAPIAvailable(apiAvailable);

    if (apiAvailable) {
        try {
            const pythonData = await getPythonAnalyticsData();
            if (pythonData) return pythonData;
        } catch (err) {
            console.warn('Python Analytics API error:', err);
        }
    }

    return getMongoAnalyticsFallback();
}

export function useAnalytics(date?: string) {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const targetDate = date || new Date().toISOString().split('T')[0];

    useEffect(() => {
        async function fetchStats() {
            // Check cache first
            const cacheKey = `stats:${targetDate}`;
            const cached = getCached<DashboardStats>(cacheKey);
            if (cached) {
                setStats(cached);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            if (!isMongoConfigured) {
                setError('MongoDB not configured');
                setLoading(false);
                return;
            }

            try {
                const { data: appointments, error: queryError } = await MongoDB
                    .from('appointments')
                    .select(`
                        id, status, appointment_time, appointment_type,
                        doctors(specialty, daily_physical_quota, daily_video_quota)
                    `)
                    .eq('appointment_date', targetDate);

                if (queryError) throw queryError;

                const total = appointments?.length || 0;
                const completed = appointments?.filter((a: any) => a.status === 'completed').length || 0;
                const noShows = appointments?.filter((a: any) => a.status === 'no_show').length || 0;

                const specialtyMap: Record<string, number> = {};
                const hourMap: Record<string, number> = {};

                appointments?.forEach((a: any) => {
                    const specialty = a.doctors?.specialty || 'Unknown';
                    specialtyMap[specialty] = (specialtyMap[specialty] || 0) + 1;

                    const hour = a.appointment_time?.split(':')[0] || '00';
                    const label = `${hour}:00`;
                    hourMap[label] = (hourMap[label] || 0) + 1;
                });

                const liveStats = {
                    totalAppointments: total,
                    completedAppointments: completed,
                    noShowCount: noShows,
                    noShowRate: total > 0 ? Math.round((noShows / total) * 100) : 0,
                    utilizationRate: total > 0 ? Math.round((completed / total) * 100) : 0,
                    specialtyBreakdown: Object.entries(specialtyMap).map(([specialty, count]) => ({ specialty, count })),
                    hourlyDistribution: Object.entries(hourMap)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([hour, count]) => ({ hour, count })),
                    isLive: true,
                };
                setStats(liveStats);
                setCached(cacheKey, liveStats, CACHE_TTL.DAILY_STATS);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch stats');
                setStats(null);
                setLoading(false);
            }
        }

        fetchStats();
    }, [targetDate]);

    return { stats, loading, error };
}

// Hook for Analytics API (integrates with Python ML backend)
export function useMLAnalytics() {
    const [mlData, setMLData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPythonAPIAvailable, setIsPythonAPIAvailable] = useState(false);

    useEffect(() => {
        async function fetchMLData() {
            setLoading(true);
            setError(null);

            try {
                const data = await getAnalyticsData(setIsPythonAPIAvailable);
                setMLData(data);
                setError(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch ML analytics');
                setMLData(null);
            } finally {
                setLoading(false);
            }
        }

        fetchMLData();
    }, []);

    const refetch = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await getAnalyticsData(setIsPythonAPIAvailable);
            setMLData(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch ML analytics');
            setMLData(null);
        } finally {
            setLoading(false);
        }
    };

    return { mlData, loading, error, refetch, isPythonAPIAvailable };
}

// Hook for refreshing ML predictions on demand (future work)
export function useRefreshMLPrediction() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshPrediction = async (appointmentId: string) => {
        setLoading(true);
        setError(null);

        // This is a stub — actual ML model refresh is future work
        await new Promise(resolve => setTimeout(resolve, 500));

        setLoading(false);
        return { success: true, data: null };
    };

    return { refreshPrediction, loading, error };
    }

