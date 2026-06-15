import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getAppointmentById, getPrescriptions } from '@/api/domain';
import type { Appointment, Prescription } from '@/api/types';
import { AppointmentQrCard } from '@/components/AppointmentQrCard';
import { useI18n } from '@/i18n/LanguageContext';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AppointmentDetails'>;

function doctorFrom(appointment?: Appointment, prescription?: Prescription) {
  if (appointment?.doctor) return appointment.doctor;
  return prescription && typeof prescription.doctor_id === 'object' ? prescription.doctor_id : undefined;
}

function statusKey(status?: string) {
  return (status || '').toLowerCase().replace(/[-\s]/g, '_');
}

export function AppointmentDetailsScreen({ route }: Props) {
  const { t, isRtl } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const align = { textAlign: isRtl ? 'right' : 'left' } as const;
  const [appointment, setAppointment] = useState<Appointment>();
  const [prescription, setPrescription] = useState<Prescription>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      const [appointmentData, prescriptions] = await Promise.all([
        getAppointmentById(route.params.appointmentId),
        getPrescriptions({ appointmentId: route.params.appointmentId }),
      ]);
      setAppointment(appointmentData);
      setPrescription(prescriptions[0]);
    } catch (error) {
      Alert.alert(t('details.loadError'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [route.params.appointmentId, t]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const doctor = doctorFrom(appointment, prescription);
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load(true); }} tintColor={colors.primary} />}
    >
      <View style={styles.headingBand}>
        <Text style={[styles.eyebrow, align]}>{t('details.eyebrow').toUpperCase()}</Text>
        <Text style={[styles.doctor, align]}>{doctor?.name || t('details.doctor')}</Text>
        <Text style={[styles.specialty, align]}>{doctor?.specialty || ''}</Text>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryItem}><Text style={[styles.label, align]}>{t('details.date')}</Text><Text style={[styles.value, align]}>{appointment?.appointment_date || appointment?.date || '-'}</Text></View>
        <View style={styles.summaryItem}><Text style={[styles.label, align]}>{t('details.time')}</Text><Text style={[styles.value, align]}>{appointment?.appointment_time || appointment?.time || '-'}</Text></View>
        <View style={styles.summaryItem}><Text style={[styles.label, align]}>{t('details.token')}</Text><Text style={[styles.value, align]}>{appointment?.token ? `#${appointment.token}` : '-'}</Text></View>
        <View style={styles.summaryItem}><Text style={[styles.label, align]}>{t('details.status')}</Text><Text style={[styles.value, styles.status, align]}>{appointment?.status ? t(`status.${statusKey(appointment.status)}`, appointment.status.replace(/_/g, ' ')) : '-'}</Text></View>
      </View>

      {!!appointment && (
        <AppointmentQrCard
          appointment={appointment}
          title={t('details.qrTitle')}
          description={appointment.appointment_type === 'physical' ? t('details.qrCheckIn') : t('details.qrReference')}
        />
      )}

      {!!appointment?.chief_complaint && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, align]}>{t('details.reason')}</Text>
          <Text style={[styles.body, align]}>{appointment.chief_complaint}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, align]}>{t('details.prescription')}</Text>
        {!prescription ? (
          <View style={styles.pending}>
            <Text style={[styles.pendingTitle, align]}>{t('details.noRxTitle')}</Text>
            <Text style={[styles.pendingText, align]}>{t('details.noRxText')}</Text>
          </View>
        ) : (
          <>
            {!!prescription.diagnosis && <View style={styles.detailBlock}><Text style={[styles.label, align]}>{t('details.diagnosis')}</Text><Text style={[styles.body, align]}>{prescription.diagnosis}</Text></View>}
            <View style={styles.detailBlock}>
              <Text style={[styles.label, align]}>{t('details.medicines')}</Text>
              {prescription.medications.map((medicine, index) => (
                <View key={`${medicine.name}-${index}`} style={styles.medicineRow}>
                  <View style={styles.medicineNumber}><Text style={styles.medicineNumberText}>{index + 1}</Text></View>
                  <View style={styles.medicineContent}>
                    <Text style={[styles.medicineName, align]}>{medicine.name}</Text>
                    <Text style={[styles.medicineMeta, align]}>{[medicine.dosage, medicine.frequency, medicine.duration].filter(Boolean).join('  |  ') || t('details.followInstr')}</Text>
                  </View>
                </View>
              ))}
            </View>
            {!!prescription.instructions && <View style={styles.detailBlock}><Text style={[styles.label, align]}>{t('details.instructions')}</Text><Text style={[styles.body, align]}>{prescription.instructions}</Text></View>}
            {!!prescription.notes && <View style={styles.detailBlock}><Text style={[styles.label, align]}>{t('details.notes')}</Text><Text style={[styles.body, align]}>{prescription.notes}</Text></View>}
            {!!prescription.follow_up_date && <View style={styles.followUp}><Text style={styles.followUpLabel}>{t('details.followUp')}</Text><Text style={styles.followUpDate}>{prescription.follow_up_date}</Text></View>}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  headingBand: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  eyebrow: { color: '#BFCBE0', fontSize: 11, fontWeight: '800' },
  doctor: { color: '#fff', fontSize: 23, fontWeight: '800', marginTop: spacing.sm },
  specialty: { color: '#D8E0EC', fontSize: 14, marginTop: 4 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.surface, borderRadius: radius.lg, marginTop: spacing.md, padding: spacing.md, ...shadow.soft },
  summaryItem: { width: '50%', paddingVertical: spacing.sm },
  label: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  value: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 5, textTransform: 'capitalize' },
  status: { color: colors.primary },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, marginTop: spacing.md, padding: spacing.md, ...shadow.soft },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  body: { color: colors.text, fontSize: 14, lineHeight: 22, marginTop: spacing.sm },
  pending: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  pendingTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  pendingText: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  detailBlock: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: spacing.md, paddingTop: spacing.md },
  medicineRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'flex-start' },
  medicineNumber: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  medicineNumberText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  medicineContent: { flex: 1 },
  medicineName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  medicineMeta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  followUp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.navySoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  followUpLabel: { color: colors.navy, fontWeight: '800', fontSize: 13 },
  followUpDate: { color: colors.navy, fontWeight: '800', fontSize: 14 },
});
