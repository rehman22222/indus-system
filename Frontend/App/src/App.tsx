import React from 'react';
import { AuthProvider } from './hooks/useAuth';
import AppNavigator from './navigation/AppNavigator';

/**
 * Main Application Root
 * Bypasses manual landing pages and uses the unified AppNavigator
 * to manage routing and role-based access.
 */
const App = () => {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
};

export default App;
