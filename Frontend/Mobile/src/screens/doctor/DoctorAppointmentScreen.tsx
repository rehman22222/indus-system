import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createPrescription, getAppointmentById, getAppointments, getCurrentDoctor, getPrescriptions, updateAppointment } from '@/api/domain';
import { listDocuments, openDocument, type MedicalDocument } from '@/api/documents';
import type { Appointment, Doctor, Medication, Prescription } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { initials, radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'DoctorAppointment'>;
type DetailTab = 'visit' | 'history' | 'documents' | 'prescription';

const tabs: { id: DetailTab; label: string }[] = [
  { id: 'visit', label: 'Visit' },
  { id: 'history', label: 'History' },
  { id: 'documents', label: 'Documents' },
  { id: 'prescription', label: 'Prescription' },
];

function readable(value?: string) {
  return value ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not recorded';
}

function stringifyMedicalHistory(value: unknown) {
  if (!value) return 'No medical history recorded.';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && item !== null && item !== '')
      .map(([key, item]) => `${readable(key)}: ${String(item)}`)
      .join('\n') || 'No medical history recorded.';
  }
  return String(value);
}

export function DoctorAppointmentScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('visit');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [instructions, setInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [medications, setMedications] = useState<Medication[]>([{ name: '', dosage: '', frequency: '', duration: '' }]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const visit = await getAppointmentById(route.params.appointmentId);
      if (!visit) throw new Error('Appointment not found.');
      setAppointment(visit);
      setNotes(visit.notes || '');
      setDiagnosis(visit.diagnosis || '');
      const currentDoctor = user?.email ? await getCurrentDoctor(user.email) : null;
      setDoctor(currentDoctor || null);
      const patientId = visit.patient_id;
      const [visitHistory, prescriptionRows, documentRows] = await Promise.all([
        getAppointments({ patient_id: patientId, sort: '-date,-time', limit: '50' }),
        getPrescriptions({ patientId }),
        listDocuments(patientId),
      ]);
      setHistory(visitHistory);
      setPrescriptions(prescriptionRows);
      setDocuments(documentRows);
    } catch (error) {
      Alert.alert('Unable to load appointment', error instanceof Error ? error.message : 'Please try again.', [
        { text: 'Back', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [navigation, route.params.appointmentId, user?.email]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveClinicalNotes() {
    if (!appointment) return;
    try {
      setSaving(true);
      const updated = await updateAppointment(appointment.id, { notes: notes.trim(), diagnosis: diagnosis.trim() });
      if (updated) setAppointment(updated);
      Alert.alert('Saved', 'Clinical notes are available on mobile and web.');
    } catch (error) {
      Alert.alert('Could not save notes', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: string) {
    if (!appointment) return;
    try {
      setSaving(true);
      const updates: Record<string, string | boolean> = { status };
      if (status === 'in_consultation') updates.consultation_start_time = new Date().toISOString();
      if (status === 'completed') updates.consultation_end_time = new Date().toISOString();
      const updated = await updateAppointment(appointment.id, updates);
      if (updated) setAppointment(updated);
    } catch (error) {
      Alert.alert('Could not update appointment', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function startConsultation() {
    if (!appointment) return;
    if (appointment.appointment_type === 'video' && !appointment.consent_recorded) {
      Alert.alert(
        'Record telemedicine consent',
        'Confirm that the patient has given verbal or written consent and understands this remote consultation.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Record and start',
            onPress: async () => {
              try {
                setSaving(true);
                const updated = await updateAppointment(appointment.id, {
                  consent_recorded: true,
                  consent_recorded_at: new Date().toISOString(),
                  status: 'in_consultation',
                  consultation_start_time: new Date().toISOString(),
                });
                if (updated) setAppointment(updated);
              } catch (error) {
                Alert.alert('Could not start consultation', error instanceof Error ? error.message : 'Please try again.');
              } finally {
                setSaving(false);
              }
            },
          },
        ],
      );
      return;
    }
    changeStatus('in_consultation');
  }

  function launchVideo() {
    if (!appointment) return;
    // Join the native Agora call (this also rings the patient). The old flow
    // opened the web room URL, which on a deployed backend points at the
    // configured web base (localhost by default) and fails on the phone.
    navigation.navigate('VideoCall', { appointmentId: appointment.id });
  }

  function updateMedication(index: number, field: keyof Medication, value: string) {
    setMedications((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  async function savePrescription() {
    if (!appointment || !doctor) return;
    const cleanMedications = medications.map((item) => ({
      name: item.name.trim(),
      dosage: item.dosage?.trim(),
      frequency: item.frequency?.trim(),
      duration: item.duration?.trim(),
    })).filter((item) => item.name);
    if (!diagnosis.trim()) {
      Alert.alert('Diagnosis required', 'Enter a diagnosis before saving the prescription.');
      return;
    }
    if (cleanMedications.length === 0) {
      Alert.alert('Medication required', 'Add at least one medication.');
      return;
    }
    try {
      setSaving(true);
      await createPrescription({
        appointment_id: appointment.id,
        doctor_id: doctor.id,
        patient_id: appointment.patient_id,
        diagnosis: diagnosis.trim(),
        medications: cleanMedications,
        instructions: instructions.trim(),
        notes: notes.trim(),
        follow_up_date: followUpDate.trim() || undefined,
      });
      await updateAppointment(appointment.id, { diagnosis: diagnosis.trim(), notes: notes.trim() });
      setInstructions('');
      setFollowUpDate('');
      setMedications([{ name: '', dosage: '', frequency: '', duration: '' }]);
      Alert.alert('Prescription saved', 'It is now visible in the patient app and both doctor portals.');
      await load();
    } catch (error) {
      Alert.alert('Could not save prescription', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !appointment) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.loadingText}>Loading clinical workspace...</Text></View>;
  }
  if (!appointment) return null;

  const patient = appointment.patient;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <StatusBar style="dark" backgroundColor={colors.surface} />
      <ScrollView
        contentContainerStyle={[styles.content, compact && styles.contentCompact, { paddingBottom: spacing.xl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.primary]} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.patientHeader, compact && styles.patientHeaderCompact]}>
          <View style={styles.patientAvatar}><Text style={styles.patientAvatarText}>{initials(patient?.name)}</Text></View>
          <View style={styles.patientIdentity}>
            <Text style={styles.patientName}>{patient?.name || patient?.full_name || 'Patient'}</Text>
            <Text style={styles.patientMeta}>{patient?.patient_id || `#${appointment.token}`}  |  {patient?.phone || 'No phone'}</Text>
            <View style={styles.headerBadges}>
              <Badge text={readable(appointment.status)} tone="primary" />
              <Badge text={appointment.appointment_type === 'video' ? 'Video' : 'In person'} tone="navy" />
              <Badge text={appointment.visit_type === 'follow_up' ? 'Follow-up' : 'New patient'} tone="neutral" />
            </View>
          </View>
        </View>

        <View style={[styles.quickActions, compact && styles.quickActionsCompact]}>
          {appointment.appointment_type === 'video' && <Action label="Open video" primary onPress={launchVideo} disabled={saving} />}
          {['scheduled', 'confirmed'].includes(appointment.status) && <Action label="Mark waiting" onPress={() => changeStatus('waiting')} disabled={saving} />}
          {appointment.status === 'waiting' && <Action label="Call patient" onPress={() => changeStatus('called')} disabled={saving} />}
          {!['in_consultation', 'completed', 'cancelled', 'no_show'].includes(appointment.status) && <Action label="Start visit" primary onPress={startConsultation} disabled={saving} />}
          {appointment.status === 'in_consultation' && <Action label="Complete" primary onPress={() => changeStatus('completed')} disabled={saving} />}
        </View>

        <View style={styles.tabs}>
          {tabs.map((tab) => <Pressable key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tab, activeTab === tab.id && styles.tabActive]}><Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]} numberOfLines={1}>{tab.label}</Text></Pressable>)}
        </View>

        {activeTab === 'visit' && (
          <View>
            <Section title="Appointment">
              <InfoRow label="Date and time" value={`${appointment.appointment_date || appointment.date} at ${appointment.appointment_time || appointment.time}`} />
              <InfoRow label="Chief complaint" value={appointment.chief_complaint || 'Not provided'} />
              <InfoRow label="Booking history" value={appointment.history_summary || 'Not provided'} />
            </Section>
            <Section title="Patient profile">
              <InfoRow label="Email" value={patient?.email || 'Not recorded'} />
              <InfoRow label="Gender" value={patient?.sex || patient?.gender || 'Not recorded'} />
              <InfoRow label="Date of birth" value={patient?.dob || patient?.date_of_birth || 'Not recorded'} />
              <InfoRow label="Blood group" value={patient?.blood_group || 'Not recorded'} />
              <InfoRow label="Allergies" value={patient?.allergies?.join(', ') || 'None recorded'} />
              <InfoRow label="Medical history" value={stringifyMedicalHistory(patient?.medical_history)} />
            </Section>
            <Section title="Clinical record">
              <Label text="Diagnosis" />
              <TextInput value={diagnosis} onChangeText={setDiagnosis} placeholder="Clinical diagnosis" placeholderTextColor={colors.subtle} style={styles.input} />
              <Label text="Consultation notes" />
              <TextInput value={notes} onChangeText={setNotes} placeholder="Examination, findings and plan" placeholderTextColor={colors.subtle} style={[styles.input, styles.textArea]} multiline textAlignVertical="top" />
              <Action label={saving ? 'Saving...' : 'Save clinical record'} primary onPress={saveClinicalNotes} disabled={saving} />
            </Section>
          </View>
        )}

        {activeTab === 'history' && (
          <View>
            <Section title="Past visits">
              {history.length === 0 ? <Empty text="No visit history available." /> : history.map((visit) => <View key={visit.id} style={styles.historyItem}><View style={styles.historyTop}><Text style={styles.historyDate}>{visit.appointment_date || visit.date}</Text><Badge text={readable(visit.status)} tone="neutral" /></View><Text style={styles.historyMeta}>{visit.appointment_type === 'video' ? 'Video' : 'In person'}  |  {visit.appointment_time || visit.time}</Text>{visit.chief_complaint ? <Text style={styles.historyText}>{visit.chief_complaint}</Text> : null}{visit.notes ? <Text style={styles.historyNotes}>Doctor notes: {visit.notes}</Text> : null}</View>)}
            </Section>
            <Section title="Previous prescriptions">
              {prescriptions.length === 0 ? <Empty text="No prescriptions found." /> : prescriptions.map((item) => <PrescriptionCard key={item.id} prescription={item} />)}
            </Section>
          </View>
        )}

        {activeTab === 'documents' && (
          <Section title="Reports and previous prescriptions">
            <Text style={styles.helper}>Files uploaded by the patient during booking or from their account.</Text>
            {documents.length === 0 ? <Empty text="No patient documents uploaded." /> : documents.map((document) => (
              <Pressable key={document.id} onPress={async () => { try { await openDocument(document.id); } catch (error) { Alert.alert('Could not open document', error instanceof Error ? error.message : 'Please try again.'); } }} style={({ pressed }) => [styles.documentRow, pressed && styles.pressed]}>
                <View style={styles.documentIcon}>
                  <MaterialCommunityIcons name={document.kind === 'prescription' ? 'prescription' : 'file-document-outline'} size={22} color={colors.primary} />
                </View>
                <View style={styles.documentInfo}><Text style={styles.documentName} numberOfLines={2}>{document.original_name || document.title}</Text><Text style={styles.documentMeta}>{readable(document.kind)}  |  {document.created_at?.slice(0, 10) || ''}</Text></View>
                <Text style={styles.openDocument}>Open</Text>
              </Pressable>
            ))}
          </Section>
        )}

        {activeTab === 'prescription' && (
          <Section title="Write prescription">
            <Label text="Diagnosis" />
            <TextInput value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnosis" placeholderTextColor={colors.subtle} style={styles.input} />
            {medications.map((medication, index) => (
              <View key={index} style={styles.medicationEditor}>
                <View style={styles.medicationHead}><Text style={styles.medicationTitle}>Medication {index + 1}</Text>{medications.length > 1 && <Pressable onPress={() => setMedications((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Text style={styles.removeText}>Remove</Text></Pressable>}</View>
                <TextInput value={medication.name} onChangeText={(value) => updateMedication(index, 'name', value)} placeholder="Medicine name" placeholderTextColor={colors.subtle} style={styles.input} />
                <View style={[styles.twoColumns, compact && styles.twoColumnsCompact]}>
                  <TextInput value={medication.dosage} onChangeText={(value) => updateMedication(index, 'dosage', value)} placeholder="Dosage" placeholderTextColor={colors.subtle} style={[styles.input, styles.halfInput]} />
                  <TextInput value={medication.frequency} onChangeText={(value) => updateMedication(index, 'frequency', value)} placeholder="Frequency" placeholderTextColor={colors.subtle} style={[styles.input, styles.halfInput]} />
                </View>
                <TextInput value={medication.duration} onChangeText={(value) => updateMedication(index, 'duration', value)} placeholder="Duration, e.g. 5 days" placeholderTextColor={colors.subtle} style={styles.input} />
              </View>
            ))}
            <Pressable onPress={() => setMedications((items) => [...items, { name: '', dosage: '', frequency: '', duration: '' }])} style={styles.addMedication}><Text style={styles.addMedicationText}>+ Add medication</Text></Pressable>
            <Label text="Instructions" />
            <TextInput value={instructions} onChangeText={setInstructions} placeholder="How and when to take medicines" placeholderTextColor={colors.subtle} style={[styles.input, styles.textAreaSmall]} multiline textAlignVertical="top" />
            <Label text="Follow-up date (YYYY-MM-DD)" />
            <TextInput value={followUpDate} onChangeText={setFollowUpDate} placeholder="2026-06-30" placeholderTextColor={colors.subtle} style={styles.input} />
            <Action label={saving ? 'Saving prescription...' : 'Save and send to patient'} primary onPress={savePrescription} disabled={saving} />
          </Section>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Label({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={styles.label}>{text}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function Badge({ text, tone }: { text: string; tone: 'primary' | 'navy' | 'neutral' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const palette = tone === 'primary' ? { bg: colors.primarySoft, fg: colors.primary } : tone === 'navy' ? { bg: colors.navySoft, fg: colors.navy } : { bg: colors.surfaceAlt, fg: colors.muted };
  return <View style={[styles.badge, { backgroundColor: palette.bg }]}><Text style={[styles.badgeText, { color: palette.fg }]}>{text}</Text></View>;
}

function Action({ label, onPress, primary = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, primary ? styles.actionPrimary : styles.actionSecondary, pressed && styles.pressed, disabled && { opacity: 0.6 }]}><Text style={primary ? styles.actionPrimaryText : styles.actionSecondaryText}>{label}</Text></Pressable>;
}

function PrescriptionCard({ prescription }: { prescription: Prescription }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.prescriptionCard}><View style={styles.historyTop}><Text style={styles.historyDate}>{prescription.diagnosis || 'Prescription'}</Text><Text style={styles.documentMeta}>{prescription.created_at?.slice(0, 10)}</Text></View>{prescription.medications.map((medication, index) => <Text key={`${medication.name}-${index}`} style={styles.rxLine}>- {medication.name} {medication.dosage} {medication.frequency} {medication.duration}</Text>)}{prescription.instructions ? <Text style={styles.historyNotes}>{prescription.instructions}</Text> : null}</View>;
}

function Empty({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  contentCompact: { paddingHorizontal: spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { color: colors.muted, marginTop: spacing.md, fontWeight: '700' },
  patientHeader: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.navy, borderRadius: radius.xl, padding: spacing.lg, ...shadow.card },
  patientHeaderCompact: { gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
  patientAvatar: { width: 58, height: 58, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  patientAvatarText: { color: '#fff', fontSize: 19, fontWeight: '800' },
  patientIdentity: { flex: 1 },
  patientName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  patientMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 },
  headerBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: spacing.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  quickActionsCompact: { gap: spacing.xs },
  action: { minHeight: 46, minWidth: 128, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, flexGrow: 1, flexBasis: '46%' },
  actionPrimary: { backgroundColor: colors.primary, ...shadow.brand },
  actionSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  actionSecondaryText: { color: colors.text, fontWeight: '800', fontSize: 13 },
  pressed: { opacity: 0.75 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, marginTop: spacing.lg, ...shadow.soft },
  tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: 3 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  tabTextActive: { color: '#fff' },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, ...shadow.soft },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: spacing.md },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: spacing.md },
  infoRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  infoValue: { color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', marginBottom: spacing.xs, marginTop: spacing.xs },
  input: { minHeight: 49, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, color: colors.text, paddingHorizontal: spacing.md, marginBottom: spacing.md, fontSize: 14 },
  textArea: { minHeight: 120, paddingTop: spacing.md },
  textAreaSmall: { minHeight: 90, paddingTop: spacing.md },
  historyItem: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  historyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  historyDate: { color: colors.ink, fontWeight: '800', flex: 1 },
  historyMeta: { color: colors.muted, fontSize: 12, marginTop: 5 },
  historyText: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  historyNotes: { color: colors.navy, fontSize: 12, lineHeight: 18, marginTop: spacing.sm, fontWeight: '600' },
  prescriptionCard: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  rxLine: { color: colors.text, fontSize: 12, lineHeight: 19, marginTop: 5 },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  documentIcon: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  documentInfo: { flex: 1 },
  documentName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  documentMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  openDocument: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  medicationEditor: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  medicationHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  medicationTitle: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  removeText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  twoColumns: { flexDirection: 'row', gap: spacing.sm },
  twoColumnsCompact: { flexDirection: 'column', gap: 0 },
  halfInput: { flex: 1 },
  addMedication: { height: 44, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  addMedicationText: { color: colors.primary, fontWeight: '800' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
  emptyText: { color: colors.muted, textAlign: 'center', fontWeight: '700' },
});
