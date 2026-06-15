import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getAppointments, getDoctors, getPrescriptions } from '@/api/domain';
import type { Appointment } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/LanguageContext';
import type { PatientTabScreenProps } from '@/navigation/PatientTabs';
import { navigationAction } from '@/navigation/navigationRef';
import { radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

type Props = PatientTabScreenProps<'Home'>;

const UPCOMING = ['confirmed', 'waiting', 'scheduled', 'in_consultation'];

function statusKey(status: string) {
  return (status || '').toLowerCase().replace(/[-\s]/g, '_');
}

export function HomeTabScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { t, isRtl } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const align = { textAlign: isRtl ? 'right' : 'left' } as const;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [rxCount, setRxCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [appts, rx, docs] = await Promise.all([
        getAppointments({ patient_id: user.id, sort: '-date,-time', limit: '50' }),
        getPrescriptions({ patientId: user.id }),
        getDoctors(),
      ]);
      setAppointments(appts);
      setRxCount(rx.length);
      setDocCount(docs.length);
    } catch {
      // keep last good data; pull-to-refresh can retry
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const firstName = (user?.name || 'Patient').split(' ')[0];
  const upcoming = appointments.filter((a) => UPCOMING.includes(a.status));
  const completed = appointments.filter((a) => a.status === 'completed');

  const stats = [
    { icon: 'time-outline' as const, label: t('stat.upcoming'), value: upcoming.length, tint: colors.primarySoft, color: colors.primary },
    { icon: 'checkmark-circle-outline' as const, label: t('stat.completed'), value: completed.length, tint: colors.successSoft, color: colors.success },
    { icon: 'document-text-outline' as const, label: t('stat.prescriptions'), value: rxCount, tint: colors.navySoft, color: colors.navy },
    { icon: 'medkit-outline' as const, label: t('stat.doctors'), value: docCount, tint: '#FFF1E6', color: '#C2410C' },
  ];

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />}
    >
      {/* Greeting */}
      <Text style={[styles.greeting, align]}>{t('dash.welcome')}, {firstName}!</Text>
      <Text style={[styles.greetingSub, align]}>{t('dash.subtitle')}</Text>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        <Pressable style={styles.quickCard} onPress={() => navigation.dispatch(navigationAction('BookAppointment'))}>
          <View style={[styles.quickIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </View>
          <Text style={styles.quickText}>{t('home.bookTitle')}</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={() => navigation.dispatch(navigationAction('Appointments'))}>
          <View style={[styles.quickIcon, { backgroundColor: colors.navySoft }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.navy} />
          </View>
          <Text style={styles.quickText}>{t('dash.myAppointments')}</Text>
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statGrid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: s.tint }]}>
              <Ionicons name={s.icon} size={18} color={s.color} />
            </View>
            <View>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Upcoming */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, align]}>{t('dash.upcoming')}</Text>
        <Pressable onPress={() => navigation.dispatch(navigationAction('Appointments'))}>
          <Text style={styles.viewAll}>{t('dash.viewAll')}</Text>
        </Pressable>
      </View>

      {upcoming.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={32} color={colors.subtle} />
          <Text style={styles.emptyText}>{t('dash.noUpcoming')}</Text>
          <Pressable style={styles.bookNow} onPress={() => navigation.dispatch(navigationAction('BookAppointment'))}>
            <Text style={styles.bookNowText}>{t('dash.bookNow')}</Text>
          </Pressable>
        </View>
      ) : (
        upcoming.slice(0, 3).map((apt) => {
          const isVideo = apt.appointment_type === 'video';
          return (
            <Pressable
              key={apt.id}
              style={styles.apptRow}
              onPress={() => navigation.dispatch(navigationAction('AppointmentDetails', { appointmentId: apt.id }))}
            >
              <View style={[styles.apptIcon, { backgroundColor: isVideo ? colors.navySoft : colors.primarySoft }]}>
                <Ionicons name={isVideo ? 'videocam-outline' : 'location-outline'} size={18} color={isVideo ? colors.navy : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.apptName, align]} numberOfLines={1}>{apt.doctor?.name || 'Doctor'}</Text>
                <Text style={[styles.apptMeta, align]}>{apt.appointment_date || apt.date}  ·  {apt.appointment_time || apt.time}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t(`status.${statusKey(apt.status)}`, apt.status)}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },

  greeting: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  greetingSub: { color: colors.muted, marginTop: 2, fontSize: 13 },

  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quickCard: { flex: 1, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  quickIcon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  quickText: { color: colors.ink, fontWeight: '700', fontSize: 13 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  statCard: { width: '47.5%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow.soft },
  statIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  statValue: { color: colors.ink, fontSize: 18, fontWeight: '800' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  viewAll: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  emptyCard: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.soft },
  emptyText: { color: colors.muted, fontSize: 13 },
  bookNow: { marginTop: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  bookNowText: { color: '#fff', fontWeight: '800' },

  apptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm, ...shadow.soft },
  apptIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  apptName: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  apptMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  badge: { borderRadius: radius.pill, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.primary, fontWeight: '800', fontSize: 11 },
});
