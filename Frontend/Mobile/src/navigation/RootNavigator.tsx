import React from 'react';
import { NavigationContainer, type NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/LanguageContext';
import { useTheme } from '@/theme/ThemeContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { DoctorAppointmentScreen } from '@/screens/doctor/DoctorAppointmentScreen';
import { DoctorHomeScreen } from '@/screens/doctor/DoctorHomeScreen';
import { AppointmentDetailsScreen } from '@/screens/patient/AppointmentDetailsScreen';
import { BookAppointmentScreen } from '@/screens/patient/BookAppointmentScreen';
import { PatientTabs, type PatientTabParamList } from '@/navigation/PatientTabs';
import { VideoCallScreen } from '@/screens/shared/VideoCallScreen';
import { RoleUnsupportedScreen } from '@/screens/shared/RoleUnsupportedScreen';
import { LoadingScreen } from '@/screens/shared/LoadingScreen';
import { navigationRef } from '@/navigation/navigationRef';

export type RootStackParamList = {
  Login: undefined;
  PatientTabs: NavigatorScreenParams<PatientTabParamList>;
  BookAppointment: { doctorId?: string } | undefined;
  AppointmentDetails: { appointmentId: string };
  VideoCall: { appointmentId: string };
  DoctorHome: undefined;
  DoctorAppointment: { appointmentId: string };
  UnsupportedRole: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, isBooting } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();

  if (isBooting) return <LoadingScreen />;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.navy,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : user.role === 'patient' ? (
          <>
            <Stack.Screen name="PatientTabs" component={PatientTabs} options={{ headerShown: false }} />
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ title: t('nav.book') }} />
            <Stack.Screen name="AppointmentDetails" component={AppointmentDetailsScreen} options={{ title: t('nav.details') }} />
            <Stack.Screen name="VideoCall" component={VideoCallScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          </>
        ) : user.role === 'doctor' ? (
          <>
            <Stack.Screen name="DoctorHome" component={DoctorHomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="DoctorAppointment" component={DoctorAppointmentScreen} options={{ title: 'Clinical Workspace' }} />
            <Stack.Screen name="VideoCall" component={VideoCallScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          </>
        ) : (
          <Stack.Screen name="UnsupportedRole" component={RoleUnsupportedScreen} options={{ title: 'Indus Hospital' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
