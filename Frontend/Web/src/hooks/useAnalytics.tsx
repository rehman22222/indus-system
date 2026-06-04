import { useState, useEffect } from 'react';
import {
    supabase,
    isSupabaseConfigured,
} from '@/integrations/supabase/client';
import { env } from '@/lib/env';
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

            if (!isSupabaseConfigured) {
                setError('Supabase not configured');
                setLoading(false);
                return;
            }

            try {
                const { data: appointments, error: queryError } = await supabase
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

            // Check if Python Analytics API is available
            const apiAvailable = await analyticsService.healthCheck();
            setIsPythonAPIAvailable(apiAvailable);

            if (apiAvailable) {
                // Try to fetch from Python Analytics API
                try {
                    const [volumeForecast, patientRisks, statsSummary] = await Promise.all([
                        analyticsService.getVolumeForecast(7), // 7-day forecast
                        analyticsService.getPatientRisks(10, 'HIGH'), // Top 10 high-risk
                        analyticsService.getStatsSummary(),
                    ]);

                    if (volumeForecast && patientRisks && statsSummary) {
                        // Transform Python API response to match our interface
                        const transformedData: AnalyticsData = {
                            ensemble: {
                                no_show_rate: statsSummary.no_show_rate || 0,
                                high_risk_count: patientRisks.length,
                                average_score: statsSummary.average_risk_score || 0,
                            },
                            forecast: {
                                dates: volumeForecast.dates,
                                predicted_volume: volumeForecast.predicted_volume,
                            },
                            risks: patientRisks.map((risk) => ({
                                appointment_id: risk.appointment_id || risk.patient_id,
                                patient_name: `Patient ${risk.patient_id.slice(0, 8)}`,
                                no_show_score: risk.risk_score,
                                risk_label: risk.risk_level,
                                appointment_date: new Date().toISOString().split('T')[0],
                                appointment_time: '09:00',
                            })),
                        };

                        setMLData(transformedData);
                        setLoading(false);
                        return;
                    }
                } catch (err) {
                    console.warn('Python Analytics API error:', err);
                }
            }

            if (!isSupabaseConfigured) {
                setError('Supabase not configured');
                setLoading(false);
                return;
            }

            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setError('No active session');
                    setLoading(false);
                    return;
                }

                const response = await fetch(`${env.API_URL}/api-v1-analytics`, {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch analytics from API');
                }

                const data: AnalyticsData = await response.json();
                setMLData(data);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch ML analytics');
                setLoading(false);
            }
        }

        fetchMLData();
    }, []);

    const refetch = async () => {
        setLoading(true);
        setError(null);

        // Check Python API first
        const apiAvailable = await analyticsService.healthCheck();
        setIsPythonAPIAvailable(apiAvailable);

        if (apiAvailable) {
            try {
                const [volumeForecast, patientRisks, statsSummary] = await Promise.all([
                    analyticsService.getVolumeForecast(7),
                    analyticsService.getPatientRisks(10, 'HIGH'),
                    analyticsService.getStatsSummary(),
                ]);

                if (volumeForecast && patientRisks && statsSummary) {
                    const transformedData: AnalyticsData = {
                        ensemble: {
                            no_show_rate: statsSummary.no_show_rate || 0,
                            high_risk_count: patientRisks.length,
                            average_score: statsSummary.average_risk_score || 0,
                        },
                        forecast: {
                            dates: volumeForecast.dates,
                            predicted_volume: volumeForecast.predicted_volume,
                        },
                        risks: patientRisks.map((risk) => ({
                            appointment_id: risk.appointment_id || risk.patient_id,
                            patient_name: `Patient ${risk.patient_id.slice(0, 8)}`,
                            no_show_score: risk.risk_score,
                            risk_label: risk.risk_level,
                            appointment_date: new Date().toISOString().split('T')[0],
                            appointment_time: '09:00',
                        })),
                    };

                    setMLData(transformedData);
                    setLoading(false);
                    return;
                }
            } catch (err) {
                console.warn('Python Analytics API error on refetch:', err);
            }
        }

        if (!isSupabaseConfigured) {
            setError('Supabase not configured');
            setLoading(false);
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setError('No active session');
                setLoading(false);
                return;
            }

            const response = await fetch(`${env.API_URL}/api-v1-analytics`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch analytics from API');
            }

            const data: AnalyticsData = await response.json();
            setMLData(data);
            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch ML analytics');
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

