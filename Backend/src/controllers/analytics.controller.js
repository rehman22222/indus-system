import axios from 'axios';
import { AppError } from '../middleware/errorHandler.js';

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || 'http://localhost:8000';

/**
 * Forward request to Python Analytics service
 */
const callAnalyticsService = async (endpoint, method = 'GET', data = null) => {
    try {
        const config = {
            method,
            url: `${ANALYTICS_API_URL}${endpoint}`,
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
    const result = await callAnalyticsService('/predict/noshow', 'POST', req.body);
    res.status(200).json(result);
};

/**
 * Get disease prediction
 */
export const getDiseasePrediction = async (req, res) => {
    const result = await callAnalyticsService('/predict/disease', 'POST', req.body);
    res.status(200).json(result);
};

/**
 * Get patient volume forecast
 */
export const getPatientVolumeForecast = async (req, res) => {
    const { days = 30 } = req.query;
    const result = await callAnalyticsService(`/forecast/volume?days=${days}`, 'GET');
    res.status(200).json(result);
};

/**
 * Get SHAP explanation for risk score
 */
export const getRiskExplanation = async (req, res) => {
    const result = await callAnalyticsService('/explain/risk', 'POST', req.body);
    res.status(200).json(result);
};

/**
 * Get live statistics
 */
export const getLiveStats = async (req, res) => {
    const result = await callAnalyticsService('/stats/live', 'GET');
    res.status(200).json(result);
};

/**
 * Trigger model retraining
 */
export const triggerRetraining = async (req, res) => {
    const result = await callAnalyticsService('/train/models', 'POST', req.body);
    res.status(200).json(result);
};
