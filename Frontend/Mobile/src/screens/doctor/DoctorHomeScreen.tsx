import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { getAppointments, getCurrentDoctor, getPrescriptions } from '@/api/domain';
import type { Appointment, Doctor, Prescription } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { IndusLogo } from '@/components/IndusLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/i18n/LanguageContext';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { navigationAction } from '@/navigation/navigationRef';
import { joinDoctorQueue, leaveDoctorQueue, onQueueEvent } from '@/services/realtime';
import { initials, radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DoctorHome'>;
type Tab = 'dashboard' | 'schedule' | 'history' | 'profile';

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function shiftDay(iso: string, delta: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function prettyDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function statusTone(status: string, colors: ThemeColors) {
  if (status === 'completed') return { bg: colors.successSoft, fg: colors.success };
  if (status === 'in_consultation') return { bg: colors.navySoft, fg: colors.navy };
  if (status === 'cancelled' || status === 'no_show') return { bg: colors.surfaceAlt, fg: colors.muted };
  if (status === 'waiting' || status === 'called') return { bg: colors.warningSoft, fg: colors.warning };
  return { bg: colors.primarySoft, fg: colors.primary };
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DoctorHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const today = useMemo(todayIso, []);
  const [selectedDate, setSelectedDate] = useState(today);

  const load = useCallback(async () => {
    if (!user?.email) return;
    try {
      setRefreshing(true);
      const currentDoctor = await getCurrentDoctor(user.email);
      if (!currentDoctor) throw new Error('Your doctor profile is not linked. Ask an administrator to verify the account.');
      setDoctor(currentDoctor);
      const [appointmentRows, prescriptionRows] = await Promise.all([
        getAppointments({ date: selectedDate, sort: 'time', limit: '100' }),
        getPrescriptions(),
      ]);
      setAppointments(appointmentRows);
      setPrescriptions(prescriptionRows);
    } catch (error) {
      Alert.alert('Unable to load doctor portal', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [user?.email, selectedDate]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useFocusEffect(useCallback(() => {
    if (!doctor?.id) return undefined;
    joinDoctorQueue(doctor.id);
    const events = ['queue.updated', 'patient.checked_in', 'patient.called', 'consultation.started', 'consultation.completed', 'appointment.cancelled'];
    const unsubscribe = events.map((event) => onQueueEvent(event, load));
    return () => {
      unsubscribe.forEach((off) => off());
      leaveDoctorQueue(doctor.id);
    };
  }, [doctor?.id, load]));

  const dayAppointments = appointments
    .filter((item) => (item.appointment_date || item.date) === selectedDate)
    .sort((a, b) => String(a.appointment_time || a.time).localeCompare(String(b.appointment_time || b.time)));
  const activeDay = dayAppointments.filter((item) => !['cancelled', 'no_show'].includes(item.status));
  const completedDay = activeDay.filter((item) => item.status === 'completed').length;
  const waitingDay = activeDay.filter((item) => ['confirmed', 'waiting', 'called', 'scheduled'].includes(item.status)).length;

  const dateNav = (
    <DateNav
      label={selectedDate === today ? 'Today' : prettyDay(selectedDate)}
      subLabel={selectedDate === today ? prettyDay(selectedDate) : undefined}
      isToday={selectedDate === today}
      onPrev={() => setSelectedDate((d) => shiftDay(d, -1))}
      onNext={() => setSelectedDate((d) => shiftDay(d, 1))}
      onToday={() => setSelectedDate(today)}
    />
  );

  const content = activeTab === 'dashboard' ? (
    <Dashboard
      dateNav={dateNav}
      appointments={dayAppointments}
      completed={completedDay}
      waiting={waitingDay}
      onOpen={(appointmentId) => navigation.dispatch(navigationAction('DoctorAppointment', { appointmentId }))}
    />
  ) : activeTab === 'schedule' ? (
    <Schedule doctor={doctor} appointments={dayAppointments} />
  ) : activeTab === 'history' ? (
    <PrescriptionHistory prescriptions={prescriptions} />
  ) : (
    <Profile doctor={doctor} userEmail={user?.email} onSignOut={signOut} />
  );

  const tabItems: { id: Tab; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
    { id: 'dashboard', label: t('doctor.tab.home'), icon: 'view-dashboard-outline' },
    { id: 'schedule', label: t('doctor.tab.schedule'), icon: 'calendar-clock-outline' },
    { id: 'history', label: t('doctor.tab.history'), icon: 'prescription' },
    { id: 'profile', label: t('doctor.tab.profile'), icon: 'account-circle-outline' },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="light" backgroundColor={colors.navy} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          compact && styles.scrollContentCompact,
          { paddingBottom: 92 + insets.bottom },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <View style={[styles.hero, compact && styles.heroCompact]}>
          <View style={styles.brandRow}>
            <IndusLogo size={19} onDark />
            <View style={styles.headerControls}>
              <LanguageToggle onDark />
              <DarkModeToggle onDark />
            </View>
          </View>
          <View style={styles.doctorRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(doctor?.name || user?.name)}</Text></View>
            <View style={styles.doctorIdentity}>
              <Text style={styles.portalLabel}>{t('doctor.portal')}</Text>
              <Text style={styles.welcome}>{t('doctor.welcome')}</Text>
              <Text style={styles.doctorName} numberOfLines={1}>{doctor?.name || user?.name || 'Doctor'}</Text>
              <Text style={styles.specialty} numberOfLines={1}>{doctor?.specialty || 'Loading profile...'}</Text>
            </View>
          </View>
        </View>
        {content}
      </ScrollView>

      <View style={[styles.tabBar, compact && styles.tabBarCompact, { bottom: Math.max(insets.bottom, spacing.sm) }]}>
        {tabItems.map((item) => (
          <Pressable key={item.id} onPress={() => setActiveTab(item.id)} style={styles.tabButton}>
            <View style={[styles.tabIcon, activeTab === item.id && styles.tabIconActive]}>
              <MaterialCommunityIcons name={item.icon} size={20} color={activeTab === item.id ? colors.primary : colors.muted} />
            </View>
            <Text style={[styles.tabText, activeTab === item.id && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function DateNav({ label, subLabel, isToday, onPrev, onNext, onToday }: { label: string; subLabel?: string; isToday: boolean; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.dateNav}>
      <Pressable onPress={onPrev} style={styles.dateArrow} hitSlop={8}>
        <MaterialCommunityIcons name="chevron-left" size={24} color={colors.navy} />
      </Pressable>
      <View style={styles.dateCenter}>
        <Text style={styles.dateLabel}>{label}</Text>
        {!!subLabel && <Text style={styles.dateSub}>{subLabel}</Text>}
      </View>
      {isToday ? (
        <Pressable onPress={onNext} style={styles.dateArrow} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.navy} />
        </Pressable>
      ) : (
        <View style={styles.dateRight}>
          <Pressable onPress={onToday} style={styles.todayChip}><Text style={styles.todayChipText}>Today</Text></Pressable>
          <Pressable onPress={onNext} style={styles.dateArrow} hitSlop={8}>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.navy} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Dashboard({ dateNav, appointments, completed, waiting, onOpen }: { dateNav: React.ReactNode; appointments: Appointment[]; completed: number; waiting: number; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      {dateNav}
      <Text style={styles.sectionTitle}>{t('doctor.overview')}</Text>
      <View style={styles.statsRow}>
        <Stat value={appointments.length} label={t('doctor.appointments')} tone="navy" />
        <Stat value={waiting} label={t('status.waiting')} tone="warning" />
        <Stat value={completed} label={t('status.completed')} tone="success" />
      </View>
      <Text style={styles.sectionTitle}>{t('doctor.queue')}</Text>
      {appointments.length === 0 ? <Empty text={t('doctor.noPatients')} /> : appointments.map((appointment) => (
        <AppointmentCard key={appointment.id} appointment={appointment} onPress={() => onOpen(appointment.id)} />
      ))}
    </View>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'navy' | 'warning' | 'success' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const palette = tone === 'success' ? { bg: colors.successSoft, fg: colors.success } : tone === 'warning' ? { bg: colors.warningSoft, fg: colors.warning } : { bg: colors.navySoft, fg: colors.navy };
  return <View style={[styles.stat, { backgroundColor: palette.bg }]}><Text style={[styles.statValue, { color: palette.fg }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function AppointmentCard({ appointment, onPress }: { appointment: Appointment; onPress: () => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = statusTone(appointment.status, colors);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTop}>
        <View style={[styles.patientAvatar, { backgroundColor: appointment.appointment_type === 'video' ? colors.navySoft : colors.primarySoft }]}>
          <Text style={{ color: appointment.appointment_type === 'video' ? colors.navy : colors.primary, fontWeight: '800' }}>{initials(appointment.patient?.name)}</Text>
        </View>
        <View style={styles.cardIdentity}>
          <Text style={styles.cardTitle} numberOfLines={1}>{appointment.patient?.name || appointment.patient?.full_name || 'Patient'}</Text>
          <Text style={styles.cardSub}>{t('doctor.token')} #{appointment.token}  |  {appointment.appointment_time || appointment.time}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}><Text style={[styles.statusText, { color: tone.fg }]}>{t(`status.${appointment.status}`, titleCase(appointment.status))}</Text></View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.typeText}>{appointment.appointment_type === 'video' ? t('doctor.videoVisit') : t('doctor.inPersonVisit')}{appointment.visit_type === 'follow_up' ? `  |  ${t('book.followUp')}` : ''}</Text>
        <Text style={styles.openText}>{t('doctor.open')}</Text>
      </View>
    </Pressable>
  );
}

function Schedule({ doctor, appointments }: { doctor: Doctor | null; appointments: Appointment[] }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const physical = appointments.filter((item) => item.appointment_type === 'physical' && !['cancelled', 'no_show'].includes(item.status)).length;
  const video = appointments.filter((item) => item.appointment_type === 'video' && !['cancelled', 'no_show'].includes(item.status)).length;
  const physicalQuota = doctor?.daily_physical_quota || doctor?.max_patients_per_day || 0;
  const videoQuota = doctor?.daily_video_quota || 0;
  const schedule = doctor?.schedule || doctor?.available_hours || {};
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('doctor.capacity')}</Text>
      <Capacity label={t('common.inPerson')} used={physical} total={physicalQuota} color={colors.primary} />
      <Capacity label={t('common.video')} used={video} total={videoQuota} color={colors.navy} />
      <Text style={styles.sectionTitle}>{t('doctor.weeklySchedule')}</Text>
      {Object.keys(schedule).length === 0 ? <Empty text={t('doctor.noSchedule')} /> : Object.entries(schedule).map(([day, time]) => (
        <View key={day} style={[styles.scheduleRow, day.toLowerCase() === todayName && styles.scheduleToday]}>
          <View><Text style={styles.scheduleDay}>{titleCase(day)}</Text><Text style={styles.scheduleTime}>{time.start} - {time.end}</Text></View>
          <Text style={[styles.activeLabel, day.toLowerCase() === todayName && { color: colors.primary }]}>{day.toLowerCase() === todayName ? t('doctor.today') : t('doctor.active')}</Text>
        </View>
      ))}
    </View>
  );
}

function Capacity({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const percentage = total ? Math.min(used / total, 1) * 100 : 0;
  return <View style={styles.capacityCard}><View style={styles.capacityTop}><Text style={styles.capacityLabel}>{label}</Text><Text style={styles.capacityValue}>{used}/{total} ({Math.max(total - used, 0)} {t('doctor.left')})</Text></View><View style={styles.track}><View style={[styles.progress, { width: `${percentage}%`, backgroundColor: color }]} /></View></View>;
}

function PrescriptionHistory({ prescriptions }: { prescriptions: Prescription[] }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('doctor.rxHistory')}</Text>
      <Text style={styles.sectionSub}>{t('doctor.rxSubtitle')}</Text>
      {prescriptions.length === 0 ? <Empty text={t('doctor.noRx')} /> : prescriptions.map((item) => {
        const patient = typeof item.patient_id === 'string' ? null : item.patient_id;
        return <View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{item.diagnosis || t('common.prescription')}</Text><Text style={styles.cardSub}>{patient?.name || patient?.email || t('doctor.patient')}  |  {item.created_at?.slice(0, 10) || ''}</Text><View style={styles.medicationWrap}>{item.medications.map((medication, index) => <View key={`${medication.name}-${index}`} style={styles.medicationChip}><Text style={styles.medicationText}>{medication.name} {medication.dosage}</Text></View>)}</View>{item.instructions ? <Text style={styles.instructions}>{item.instructions}</Text> : null}</View>;
      })}
    </View>
  );
}

function Profile({ doctor, userEmail, onSignOut }: { doctor: Doctor | null; userEmail?: string; onSignOut: () => Promise<void> }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('doctor.profileTitle')}</Text>
      <View style={styles.profileCard}>
        <View style={styles.profileHead}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{initials(doctor?.name)}</Text></View><View><Text style={styles.profileName}>{doctor?.name}</Text><Text style={styles.cardSub}>{doctor?.specialty}</Text></View></View>
        <ProfileRow label={t('doctor.department')} value={doctor?.department?.name || t('doctor.notAssigned')} />
        <ProfileRow label={t('doctor.qualification')} value={doctor?.qualification || t('doctor.notRecorded')} />
        <ProfileRow label={t('doctor.license')} value={doctor?.license_number || doctor?.license_no || t('doctor.notRecorded')} />
        <ProfileRow label={t('doctor.experience')} value={doctor?.experience_years !== undefined ? `${doctor.experience_years} ${t('doctors.years')}` : t('doctor.notRecorded')} />
        <ProfileRow label={t('profile.email')} value={doctor?.email || userEmail || t('doctor.notRecorded')} />
        <ProfileRow label={t('profile.phone')} value={doctor?.phone || t('doctor.notRecorded')} />
      </View>
      <Pressable onPress={onSignOut} style={styles.signOutButton}><Text style={styles.signOutText}>{t('home.signOut')}</Text></Pressable>
    </View>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.profileRow}><Text style={styles.profileLabel}>{label}</Text><Text style={styles.profileValue}>{value}</Text></View>;
}

function Empty({ text }: { text: string }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{text}</Text><Text style={styles.emptySub}>{t('doctor.pullRefresh')}</Text></View>;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.md, paddingBottom: 110 },
  scrollContentCompact: { paddingHorizontal: spacing.sm },
  hero: { backgroundColor: colors.navy, borderRadius: radius.xl, padding: spacing.lg, ...shadow.card },
  heroCompact: { borderRadius: radius.lg, padding: spacing.md },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerControls: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 3, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.08)' },
  portalLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginBottom: 4 },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 19, fontWeight: '800' },
  doctorIdentity: { flex: 1 },
  welcome: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700' },
  doctorName: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 2 },
  specialty: { color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 3 },
  section: { paddingTop: spacing.lg },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 6, marginBottom: spacing.md, ...shadow.soft },
  dateArrow: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateLabel: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  dateSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  dateRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  todayChip: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  todayChipText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  sectionSub: { color: colors.muted, marginTop: -4, marginBottom: spacing.md, fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  stat: { flex: 1, minHeight: 92, borderRadius: radius.md, padding: spacing.md, justifyContent: 'center' },
  statValue: { fontSize: 25, fontWeight: '800' },
  statLabel: { color: colors.text, fontSize: 11, fontWeight: '700', marginTop: 5 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.soft },
  cardPressed: { backgroundColor: colors.surfaceAlt },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  patientAvatar: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardIdentity: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  cardSub: { color: colors.muted, fontSize: 12, marginTop: 3 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5, maxWidth: 100 },
  statusText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  typeText: { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  openText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  capacityCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.soft },
  capacityTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  capacityLabel: { color: colors.text, fontWeight: '700' },
  capacityValue: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  track: { height: 7, borderRadius: radius.pill, backgroundColor: colors.divider, marginTop: spacing.sm, overflow: 'hidden' },
  progress: { height: '100%', borderRadius: radius.pill },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  scheduleToday: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  scheduleDay: { color: colors.ink, fontWeight: '800' },
  scheduleTime: { color: colors.muted, marginTop: 4, fontSize: 12 },
  activeLabel: { color: colors.success, fontSize: 12, fontWeight: '800' },
  medicationWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  medicationChip: { backgroundColor: colors.navySoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  medicationText: { color: colors.navy, fontSize: 11, fontWeight: '700' },
  instructions: { color: colors.text, lineHeight: 19, fontSize: 12, marginTop: spacing.sm },
  profileCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...shadow.soft },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  profileAvatar: { width: 58, height: 58, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: colors.primary, fontSize: 19, fontWeight: '800' },
  profileName: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.divider },
  profileLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  profileValue: { color: colors.text, fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },
  signOutButton: { marginTop: spacing.md, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  signOutText: { color: colors.primary, fontWeight: '800' },
  empty: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  emptyTitle: { color: colors.ink, fontWeight: '800', textAlign: 'center' },
  emptySub: { color: colors.muted, marginTop: 6, fontSize: 12, textAlign: 'center' },
  tabBar: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, minHeight: 70, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.xs, ...shadow.card },
  tabBarCompact: { left: spacing.sm, right: spacing.sm, minHeight: 66 },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 58 },
  tabIcon: { minWidth: 28, height: 26, paddingHorizontal: 5, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: colors.primarySoft },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  tabTextActive: { color: colors.primary },
});
