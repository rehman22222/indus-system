import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;

export const env = {
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    extra.apiBaseUrl ||
    'http://localhost:5000',
  appName:
    process.env.EXPO_PUBLIC_APP_NAME ||
    'Indus Hospital',
};
