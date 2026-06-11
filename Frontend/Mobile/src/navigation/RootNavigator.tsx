import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { Department, Doctor, Slot } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { BookAppointmentScreen } from '@/screens/patient/BookAppointmentScreen';
import { PatientHomeScreen } from '@/screens/patient/PatientHomeScreen';
import { RoleUnsupportedScreen } from '@/screens/shared/RoleUnsupportedScreen';
import { LoadingScreen } from '@/screens/shared/LoadingScreen';

export type RootStackParamList = {
  Login: undefined;
  PatientHome: undefined;
  BookAppointment: {
    department?: Department;
    doctor?: Doctor;
    slot?: Slot;
  } | undefined;
  UnsupportedRole: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, isBooting } = useAuth();

  if (isBooting) return <LoadingScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerTitleAlign: 'center',
          headerShadowVisible: false,
        }}
      >
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : user.role === 'patient' ? (
          <>
            <Stack.Screen name="PatientHome" component={PatientHomeScreen} options={{ title: 'Patient App' }} />
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ title: 'Book Appointment' }} />
          </>
        ) : (
          <Stack.Screen name="UnsupportedRole" component={RoleUnsupportedScreen} options={{ title: 'Indus Hospital' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
