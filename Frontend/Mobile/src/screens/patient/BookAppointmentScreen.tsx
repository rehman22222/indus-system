import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { createAppointment, getDepartments, getDoctors, getSlots } from '@/api/domain';
import { uploadDocument, type DocKind } from '@/api/documents';
import type { Department, Doctor, Slot } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/LanguageContext';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { colors, initials, radius, shadow, spacing } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BookAppointment'>;

type Attachment = { uri: string; name: string; base64: string; mime: string; size: number; kind: DocKind };

const MAX_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 6 * 1024 * 1024;

function fallbackMime(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

export function BookAppointmentScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { t, isRtl } = useI18n();
  const align = { textAlign: isRtl ? 'right' : 'left' } as const;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [date, setDate] = useState(todayIso());
  const [complaint, setComplaint] = useState('');
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appointmentType, setAppointmentType] = useState<'physical' | 'video'>('physical');
  const [visitType, setVisitType] = useState<'new' | 'follow_up'>('new');
  const [historySummary, setHistorySummary] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const addAttachment = useCallback(async (kind: DocKind) => {
    try {
      if (attachments.length >= MAX_ATTACHMENTS) {
        Alert.alert(t('book.limitTitle'), t('book.limitBody'));
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        Alert.alert(t('book.tooLargeTitle'), t('book.tooLargeBody'));
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const size = asset.size || Math.round(base64.length * 0.75);
      if (size > MAX_FILE_BYTES) {
        Alert.alert(t('book.tooLargeTitle'), t('book.tooLargeBody'));
        return;
      }
      setAttachments((prev) => [
        ...prev,
        {
          uri: asset.uri,
          name: asset.name || `${kind}-${prev.length + 1}`,
          base64,
          mime: asset.mimeType || fallbackMime(asset.name || ''),
          size,
          kind,
        },
      ]);
    } catch (error) {
      Alert.alert(t('book.failed'), error instanceof Error ? error.message : t('common.tryAgain'));
    }
  }, [attachments.length, t]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const canSubmit = useMemo(
    () => Boolean(user && doctor && slot && date && !submitting),
    [date, doctor, slot, submitting, user],
  );

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      setDepartments(await getDepartments());
    } catch (error) {
      Alert.alert('Unable to load departments', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (!department) return;
    setDoctor(null);
    setSlot(null);
    setSlots([]);
    getDoctors({ department_id: department.id })
      .then(setDoctors)
      .catch((error) => Alert.alert('Unable to load doctors', error.message));
  }, [department]);

  useEffect(() => {
    if (!doctor) return;
    setSlot(null);
    setSlotsLoading(true);
    getSlots({ doctor_id: doctor.id, date, available: true })
      .then(setSlots)
      .catch((error) => Alert.alert('Unable to load slots', error.message))
      .finally(() => setSlotsLoading(false));
  }, [date, doctor]);

  async function submit() {
    if (!user || !doctor || !slot) return;
    try {
      setSubmitting(true);
      const enteredComplaint = complaint.trim();
      const normalizedComplaint = !enteredComplaint || /^(n\/?a|none|no)$/i.test(enteredComplaint)
        ? visitType === 'follow_up'
          ? 'Follow-up consultation'
          : 'General consultation - first visit'
        : enteredComplaint;
      const appointment = await createAppointment({
        patient_id: user.id,
        doctor_id: doctor.id,
        department_id: department?.id || doctor.department_id,
        slot_id: slot.id,
        appointment_date: slot.date,
        appointment_time: slot.start_time,
        appointment_type: appointmentType,
        visit_type: visitType,
        chief_complaint: normalizedComplaint,
        history_summary: historySummary.trim() || undefined,
      });
      if (!appointment?.id) throw new Error('Appointment was created without an ID. Please refresh and try again.');

      // Upload attached reports / prescriptions, linked to the new appointment so
      // the doctor portal shows them live. Failures here don't void the booking.
      let uploadFailures = 0;
      for (const att of attachments) {
        try {
          await uploadDocument({
            patientId: user.id,
            appointmentId: appointment?.id,
            kind: att.kind,
            title: att.kind === 'prescription' ? t('common.prescription') : t('common.report'),
            originalName: att.name,
            mime: att.mime,
            dataBase64: att.base64,
            size: att.size,
          });
        } catch {
          uploadFailures += 1;
        }
      }

      const body = `${t('book.confirmedBody')} ${appointment?.token || ''}`.trim();
      const note = uploadFailures > 0 ? `\n${t('book.uploadPartial')}` : '';
      Alert.alert(t('book.confirmedTitle'), body + note, [
        { text: t('common.done'), onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert(t('book.failed'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Department */}
      <Text style={[styles.label, align]}>{t('book.department')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {departments.map((item) => {
          const active = department?.id === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setDepartment(item)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Doctor */}
      {department && (
        <>
          <Text style={[styles.label, align]}>{t('book.doctor')}</Text>
          {doctors.length === 0 ? (
            <Text style={styles.empty}>{t('book.noDoctors')}</Text>
          ) : (
            doctors.map((item) => {
              const active = doctor?.id === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setDoctor(item)}
                  style={[styles.docCard, active && styles.selected]}
                >
                  <View style={[styles.docAvatar, active && styles.docAvatarActive]}>
                    <Text style={[styles.docAvatarText, active && { color: colors.primary }]}>
                      {initials(item.name || item.full_name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>{item.name || item.full_name}</Text>
                    <Text style={styles.muted}>{item.specialty}</Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
              );
            })
          )}
        </>
      )}

      {/* Date */}
      {doctor && (
        <>
          <Text style={[styles.label, align]}>{t('book.date')}</Text>
          <TextInput
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.subtle}
            style={styles.input}
            value={date}
          />

          {/* Visit type — New vs Follow-up */}
          <Text style={[styles.label, align]}>{t('book.visitType')}</Text>
          <View style={styles.segment}>
            {(['new', 'follow_up'] as const).map((type) => {
              const active = visitType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setVisitType(type)}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {type === 'new' ? t('book.initialConsultation') : t('book.followUpConsultation')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Consultation type */}
          <Text style={[styles.label, align]}>{t('book.consultType')}</Text>
          <View style={styles.segment}>
            {(['physical', 'video'] as const).map((type) => {
              const active = appointmentType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setAppointmentType(type)}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {type === 'physical' ? t('common.inPerson') : t('common.video')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Slots */}
          <Text style={[styles.label, align]}>{t('book.availableSlot')}</Text>
          {slotsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start', marginVertical: 6 }} />
          ) : slots.length === 0 ? (
            <Text style={styles.empty}>{t('book.noSlots')}</Text>
          ) : (
            <View style={styles.slotGrid}>
              {slots.map((item) => {
                const active = slot?.id === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setSlot(item)}
                    style={[styles.slotChip, active && styles.slotChipActive]}
                  >
                    <Text style={[styles.slotText, active && styles.slotTextActive]}>
                      {item.start_time.slice(0, 5)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Chief complaint */}
          <Text style={[styles.label, align]}>{t('book.complaint')}</Text>
          <Text style={[styles.attachHint, align]}>{t('book.complaintHint')}</Text>
          <TextInput
            multiline
            onChangeText={setComplaint}
            placeholder={t('book.complaintPlaceholder')}
            placeholderTextColor={colors.subtle}
            style={[styles.input, styles.textArea]}
            value={complaint}
          />

          <Text style={[styles.label, align]}>
            {t('book.history')}
          </Text>
          <Text style={[styles.attachHint, align]}>{t('book.historyHint')}</Text>
          <TextInput
            multiline
            onChangeText={setHistorySummary}
            placeholder={visitType === 'follow_up' ? t('book.followUpHistoryPlaceholder') : t('book.historyPlaceholder')}
            placeholderTextColor={colors.subtle}
            style={[styles.input, styles.textArea]}
            value={historySummary}
          />

          {/* Reports & past prescriptions */}
          <Text style={[styles.label, align]}>{t('book.attachments')}</Text>
          <Text style={[styles.attachHint, align]}>{t('book.attachHint')}</Text>
          <View style={styles.attachRow}>
            <Pressable onPress={() => addAttachment('report')} style={styles.attachButton}>
              <Text style={styles.attachButtonText}>📄 {t('book.attachReport')}</Text>
            </Pressable>
            <Pressable onPress={() => addAttachment('prescription')} style={styles.attachButton}>
              <Text style={styles.attachButtonText}>💊 {t('book.attachRx')}</Text>
            </Pressable>
          </View>
          {attachments.map((att, index) => (
            <View key={`${att.uri}-${index}`} style={styles.attachItem}>
              <Text style={styles.attachKind}>
                {att.kind === 'prescription' ? t('common.prescription') : t('common.report')}
              </Text>
              <Text style={styles.attachName} numberOfLines={1}>
                {att.name}
              </Text>
              <Pressable hitSlop={8} onPress={() => removeAttachment(index)}>
                <Text style={styles.attachRemove}>✕</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        style={({ pressed }) => [styles.primaryButton, !canSubmit && styles.disabled, pressed && canSubmit && styles.primaryPressed]}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('book.confirm')}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  label: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.ink,
    fontWeight: '800',
    fontSize: 14,
  },

  chipRow: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.md },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.text, fontWeight: '700' },
  chipTextActive: { color: colors.primary },

  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    ...shadow.soft,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  docAvatar: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  docAvatarActive: { backgroundColor: colors.surface },
  docAvatarText: { color: colors.muted, fontWeight: '800', fontSize: 15 },
  docName: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  muted: { color: colors.muted, marginTop: 2, fontSize: 13 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  textArea: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },

  segment: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
    backgroundColor: '#E9ECF1',
  },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radius.sm },
  segmentButtonActive: { backgroundColor: colors.surface, ...shadow.soft },
  segmentText: { color: colors.muted, fontWeight: '800' },
  segmentTextActive: { color: colors.primary },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 74,
    alignItems: 'center',
  },
  slotChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  slotText: { color: colors.text, fontWeight: '800' },
  slotTextActive: { color: '#fff' },

  empty: { color: colors.muted, marginBottom: 4 },

  attachHint: { color: colors.muted, fontSize: 12, marginTop: -2, marginBottom: spacing.sm },
  attachRow: { flexDirection: 'row', gap: spacing.sm },
  attachButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  attachButtonText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  attachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  attachKind: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  attachName: { flex: 1, color: colors.text, fontSize: 12 },
  attachRemove: { color: colors.muted, fontWeight: '800', fontSize: 16, paddingHorizontal: 4 },

  primaryButton: {
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginTop: spacing.xl,
    ...shadow.brand,
  },
  primaryPressed: { backgroundColor: colors.primaryDark },
  disabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.2 },
});
