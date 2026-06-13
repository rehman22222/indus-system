import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/auth/AuthContext';
import { IncomingCallProvider } from '@/components/IncomingCallProvider';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <IncomingCallProvider>
            <RootNavigator />
            <StatusBar style="dark" />
          </IncomingCallProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
