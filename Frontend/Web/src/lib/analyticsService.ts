/**
 * Analytics Service - Connects to Python Analytics API
 * 
 * This service provides methods to interact with the Python FastAPI analytics backend
 * for ML predictions, forecasting, and risk analysis.
 */

const ANALYTICS_API_URL = import.meta.env.VITE_ML_API_URL || import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:8000';
// Must match the analytics service's ANALYTICS_API_KEY when that guard is
// enabled; left unset for local/demo where the API is open.
const ANALYTICS_API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY || '';

export interface VolumeForecast {
    dates: string[];
    predicted_volume: number[];
    confidence_intervals?: {
        lower: number[];
        upper: number[];
    };
}

export interface PatientRisk {
    patient_id: string;
    risk_score: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    risk_factors: string[];
    appointment_id?: string;
}

export interface DiseasePattern {
    specialty: string;
    disease: string;
    predicted_cases: number;
    confidence: number;
}

export interface EnsemblePrediction {
    volume_forecast: VolumeForecast;
    high_risk_patients: PatientRisk[];
    disease_patterns: DiseasePattern[];
    model_accuracy: {
        volume_model: number;
        risk_model: number;
        disease_model: number;
    };
}

export interface LiveStats {
    total_appointments_today: number;
    completed_today: number;
    waiting_count: number;
    no_show_count: number;
    average_wait_time: number;
    busiest_hour: string;
}

export interface ShapExplanation {
    patient_id: string;
    risk_score: number;
    top_factors: Array<{
        feature: string;
        impact: number;
        value: string;
    }>;
}

class AnalyticsService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = ANALYTICS_API_URL;
    }

    // Shared request headers — attaches the analytics API key when configured
    // (the server returns 401 if ANALYTICS_API_KEY is set and this is missing).
    private headers(): Record<string, string> {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (ANALYTICS_API_KEY) h['X-API-Key'] = ANALYTICS_API_KEY;
        return h;
    }

    // Session-scoped cache of the health verdict. The Analytics FastAPI
    // backend is optional and usually not running in the demo, so once
    // we've confirmed it's down we stop hammering /health on every
    // analytics mount (which produced a repeated ERR_CONNECTION_REFUSED
    // browser log). A successful probe is also cached.
    private healthVerdict: boolean | null = null;
    private healthProbe: Promise<boolean> | null = null;

    /**
     * Check if the Analytics API is available. Probes at most once per
     * session; concurrent callers share the in-flight probe.
     */
    async healthCheck(): Promise<boolean> {
        if (this.healthVerdict !== null) return this.healthVerdict;
        if (this.healthProbe) return this.healthProbe;

        this.healthProbe = (async () => {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 2000);
                const response = await fetch(`${this.baseUrl}/health`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                });
                clearTimeout(timer);
                this.healthVerdict = response.ok;
            } catch {
                // Backend not running — expected in the demo. Degrade to
                // rule-based mock analytics silently.
                this.healthVerdict = false;
            } finally {
                this.healthProbe = null;
            }
            return this.healthVerdict ?? false;
        })();

        return this.healthProbe;
    }

    /**
     * Get volume forecast for next N periods
     */
    async getVolumeForecast(periods: number = 12, specialty?: string): Promise<VolumeForecast | null> {
        try {
            const params = new URLSearchParams({ periods: periods.toString() });
            if (specialty) params.append('specialty', specialty);

            const response = await fetch(`${this.baseUrl}/api/forecast/volume?${params}`, {
                method: 'GET',
                headers: this.headers(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success ? result.data : null;
        } catch (error) {
            console.error('Error fetching volume forecast:', error);
            return null;
        }
    }

    /**
     * Get patient risk predictions
     */
    async getPatientRisks(limit: number = 100, riskLevel?: string): Promise<PatientRisk[] | null> {
        try {
            const params = new URLSearchParams({ limit: limit.toString() });
            if (riskLevel) params.append('risk_level', riskLevel);

            const response = await fetch(`${this.baseUrl}/api/predict/risks?${params}`, {
                method: 'GET',
                headers: this.headers(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success ? result.data : null;
        } catch (error) {
            console.error('Error fetching patient risks:', error);
            return null;
        }
    }

    /**
     * Get disease pattern predictions
     */
    async getDiseasePatterns(targetDate?: string): Promise<DiseasePattern[] | null> {
        try {
            const params = new URLSearchParams();
            if (targetDate) params.append('target_date', targetDate);

            const response = await fetch(`${this.baseUrl}/api/predict/diseases?${params}`, {
                method: 'GET',
                headers: this.headers(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success ? result.data : null;
        } catch (error) {
            console.error('Error fetching disease patterns:', error);
            return null;
        }
    }

    /**
     * Get ensemble prediction (combines all models)
     */
    async getEnsemblePrediction(forecastMonths: number = 12): Promise<EnsemblePrediction | null> {
        try {
            const params = new URLSearchParams({ forecast_months: forecastMonths.toString() });

            const response = await fetch(`${this.baseUrl}/api/predict/ensemble?${params}`, {
                method: 'GET',
                headers: this.headers(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success ? result.data : null;
        } catch (error) {
            console.error('Error fetching ensemble prediction:', error);
            return null;
        }
    }

    /**
     * Get SHAP explanation for a patient's risk score
     */
    async getShapExplanation(patientId: string): Promise<ShapExplanation | null> {
        try {
            const response = await fetch(`${this.baseUrl}/api/explain/${patientId}`, {
                method: 'GET',
                headers: this.headers(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success ? result.data : null;
        } catch (error) {
            console.error('Error fetching SHAP explanation:', error);
            return null;
        }
    }

    /**
     * Get live statistics
     */
    async getLiveStats(): Promise<LiveStats | null> {
        try {
            const response = await fetch(`${this.baseUrl}/api/stats/live`, {
                method: 'GET',
                headers: this.headers(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success ? result.data : null;
        } catch (error) {
            console.error('Error fetching live stats:', error);
            return null;
        }
    }

    /**
     * Get summary statistics
     */
    async getStatsSummary(): Promise<any | null> {
        try {
            const response = await fetch(`${this.baseUrl}/api/stats/summary`, {
                method: 'GET',
                headers: this.headers(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success ? result.data : null;
        } catch (error) {
            console.error('Error fetching stats summary:', error);
            return null;
        }
    }

    /**
     * Trigger model retraining (admin only)
     */
    async triggerTraining(): Promise<{ success: boolean; message: string; data?: any }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/train`, {
                method: 'POST',
                headers: this.headers(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Error triggering training:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Training failed',
            };
        }
    }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
