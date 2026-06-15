import React from 'react';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator, type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PortalHeader } from '@/components/PortalHeader';
import { useI18n } from '@/i18n/LanguageContext';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { HomeTabScreen } from '@/screens/patient/HomeTabScreen';
import { AppointmentsTabScreen } from '@/screens/patient/AppointmentsTabScreen';
import { DoctorsTabScreen } from '@/screens/patient/DoctorsTabScreen';
import { HistoryTabScreen } from '@/screens/patient/HistoryTabScreen';
import { ProfileTabScreen } from '@/screens/patient/ProfileTabScreen';
import { useTheme } from '@/theme/ThemeContext';

export type PatientTabParamList = {
  Home: undefined;
  Appointments: undefined;
  Doctors: undefined;
  History: undefined;
  Profile: undefined;
};

// Tab screens can also reach the parent stack (e.g. AppointmentDetails, BookAppointment).
export type PatientTabScreenProps<T extends keyof PatientTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<PatientTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

const Tab = createBottomTabNavigator<PatientTabParamList>();

const ICONS: Record<keyof PatientTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Appointments: 'calendar',
  Doctors: 'people',
  History: 'document-text',
  Profile: 'person',
};

export function PatientTabs() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const titles: Record<keyof PatientTabParamList, string> = {
    Home: t('tab.home'),
    Appointments: t('tab.appointments'),
    Doctors: t('tab.doctors'),
    History: t('tab.history'),
    Profile: t('tab.profile'),
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => (
          <PortalHeader
            variant={route.name === 'Home' ? 'full' : 'compact'}
            title={titles[route.name]}
          />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarLabel: ({ color }) => (
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color, fontSize: 10, fontWeight: '700', maxWidth: 72 }}>
            {titles[route.name]}
          </Text>
        ),
        tabBarIcon: ({ color, size, focused }) => {
          const base = ICONS[route.name];
          const name = (focused ? base : (`${base}-outline` as keyof typeof Ionicons.glyphMap));
          return <Ionicons name={name} size={Math.min(size, 23)} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeTabScreen} />
      <Tab.Screen name="Appointments" component={AppointmentsTabScreen} />
      <Tab.Screen name="Doctors" component={DoctorsTabScreen} />
      <Tab.Screen name="History" component={HistoryTabScreen} />
      <Tab.Screen name="Profile" component={ProfileTabScreen} />
    </Tab.Navigator>
  );
}
