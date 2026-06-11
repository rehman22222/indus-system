import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'indus.mobile.session';

export async function saveSession(value: string) {
  await SecureStore.setItemAsync(SESSION_KEY, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

export async function readSession() {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
