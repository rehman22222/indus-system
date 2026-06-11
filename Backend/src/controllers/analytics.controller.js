import axios from 'axios';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { cacheKey, getOrSetCache, invalidateCache } from '../services/cache.service.js';

const ANALYTICS_API_URL = env.ANALYTICS_API_URL;

/**
 * Forward request to Python Analytics service
 */
const callAnalyticsService = async (endpoint, method = 'GET', data = null) => {
    try {
        const config = {
            method,
            url: `${ANALYTICS_API_URL}${endpoint}`,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`Analytics service error (${endpoint}):`, error.response?.data || error.message);
        throw new AppError('Analytics service unavailable', 503);
    }
};

/**
 * Get no-show risk prediction
 */
export const getNoShowPrediction = async (req, res) => {
    const limit = req.body.limit || req.query.limit || 50;
    const riskLevel = req.body.risk_level || req.query.risk_level;
    const params = new URLSearchParams({ limit: String(limit) });
    if (riskLevel) params.set('risk_level', String(riskLevel));

    const key = cacheKey('analytics:risks', Object.fromEntries(params));
    const result = await getOrSetCache(key, 60, () => callAnalyticsService(`/api/predict/risks?${params}`, 'GET'));
    res.status(200).json(result);
};

/**
 * Get disease prediction
 */
export const getDiseasePrediction = async (req, res) => {
    const params = new URLSearchParams();
    if (req.body.target_date || req.query.target_date) {
        params.set('target_date', String(req.body.target_date || req.query.target_date));
    }

    const suffix = params.toString() ? `?${params}` : '';
    const key = cacheKey('analytics:diseases', Object.fromEntries(params));
    const result = await getOrSetCache(key, 300, () => callAnalyticsService(`/api/predict/diseases${suffix}`, 'GET'));
    res.status(200).json(result);
};

/**
 * Get patient volume forecast
 */
export const getPatientVolumeForecast = async (req, res) => {
    const periods = req.query.periods || req.query.days || 7;
    const params = new URLSearchParams({ periods: String(periods) });
    if (req.query.specialty) params.set('specialty', String(req.query.specialty));

    const key = cacheKey('analytics:volume', Object.fromEntries(params));
    const result = await getOrSetCache(key, 300, () => callAnalyticsService(`/api/forecast/volume?${params}`, 'GET'));
    res.status(200).json(result);
};

/**
 * Get SHAP explanation for risk score
 */
export const getRiskExplanation = async (req, res) => {
    const patientId = req.body.patient_id || req.query.patient_id;
    if (!patientId) throw new AppError('patient_id is required', 400);

    const key = cacheKey('analytics:explain', { patientId });
    const result = await getOrSetCache(key, 300, () => callAnalyticsService(`/api/explain/${encodeURIComponent(patientId)}`, 'GET'));
    res.status(200).json(result);
};

/**
 * Get live statistics
 */
export const getLiveStats = async (req, res) => {
    const result = await getOrSetCache('analytics:live-stats', 20, () => callAnalyticsService('/api/stats/live', 'GET'));
    res.status(200).json(result);
};

/**
 * Trigger model retraining
 */
export const triggerRetraining = async (req, res) => {
    const result = await callAnalyticsService('/api/train', 'POST', req.body);
    await invalidateCache(['analytics:*', 'dashboard:*']);
    res.status(200).json(result);
};
