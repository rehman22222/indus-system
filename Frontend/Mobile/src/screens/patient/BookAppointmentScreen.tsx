import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { createAppointment, getDepartments, getDoctors, getSlots } from '@/api/domain';
import type { Department, Doctor, Slot } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'BookAppointment'>;

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

export function BookAppointmentScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [date, setDate] = useState(todayIso());
  const [complaint, setComplaint] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appointmentType, setAppointmentType] = useState<'physical' | 'video'>('physical');

  const canSubmit = useMemo(() => user && doctor && slot && date && !submitting, [date, doctor, slot, submitting, user]);

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
    getDoctors({ department_id: department.id })
      .then(setDoctors)
      .catch((error) => Alert.alert('Unable to load doctors', error.message));
  }, [department]);

  useEffect(() => {
    if (!doctor) return;
    setSlot(null);
    getSlots({ doctor_id: doctor.id, date, available: true })
      .then(setSlots)
      .catch((error) => Alert.alert('Unable to load slots', error.message));
  }, [date, doctor]);

  async function submit() {
    if (!user || !doctor || !slot) return;
    try {
      setSubmitting(true);
      const appointment = await createAppointment({
        patient_id: user.id,
        doctor_id: doctor.id,
        department_id: department?.id || doctor.department_id,
        slot_id: slot.id,
        appointment_date: slot.date,
        appointment_time: slot.start_time,
        appointment_type: appointmentType,
        chief_complaint: complaint.trim() || undefined,
      });

      Alert.alert('Appointment confirmed', `Token: ${appointment?.token || 'Created'}`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Booking failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.label}>Department</Text>
      <FlatList
        data={departments}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setDepartment(item)}
            style={[styles.choice, department?.id === item.id && styles.choiceActive]}
          >
            <Text style={[styles.choiceText, department?.id === item.id && styles.choiceTextActive]}>{item.name}</Text>
          </Pressable>
        )}
      />

      <Text style={styles.label}>Doctor</Text>
      {doctors.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => setDoctor(item)}
          style={[styles.card, doctor?.id === item.id && styles.selectedCard]}
        >
          <Text style={styles.cardTitle}>{item.name || item.full_name}</Text>
          <Text style={styles.muted}>{item.specialty}</Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Date</Text>
      <TextInput onChangeText={setDate} placeholder="YYYY-MM-DD" style={styles.input} value={date} />

      <Text style={styles.label}>Consultation type</Text>
      <View style={styles.segment}>
        {(['physical', 'video'] as const).map((type) => (
          <Pressable
            key={type}
            onPress={() => setAppointmentType(type)}
            style={[styles.segmentButton, appointmentType === type && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, appointmentType === type && styles.segmentTextActive]}>{type}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Available slot</Text>
      {slots.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => setSlot(item)}
          style={[styles.slot, slot?.id === item.id && styles.selectedCard]}
        >
          <Text style={styles.cardTitle}>{item.start_time} - {item.end_time}</Text>
        </Pressable>
      ))}
      {doctor && slots.length === 0 ? <Text style={styles.empty}>No slots available for this date.</Text> : null}

      <Text style={styles.label}>Chief complaint</Text>
      <TextInput
        multiline
        onChangeText={setComplaint}
        placeholder="Briefly describe the issue"
        style={[styles.input, styles.textArea]}
        value={complaint}
      />

      <Pressable disabled={!canSubmit} onPress={submit} style={[styles.primaryButton, !canSubmit && styles.disabled]}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Confirm Appointment</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: 18,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  label: {
    marginTop: 16,
    marginBottom: 10,
    color: colors.text,
    fontWeight: '800',
  },
  choice: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceActive: {
    borderColor: colors.red,
    backgroundColor: '#FFF1F1',
  },
  choiceText: {
    color: colors.text,
    fontWeight: '700',
  },
  choiceTextActive: {
    color: colors.red,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  selectedCard: {
    borderColor: colors.red,
    backgroundColor: '#FFF7F7',
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  muted: {
    color: colors.muted,
    marginTop: 4,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
  },
  textArea: {
    minHeight: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    backgroundColor: '#ECEFF3',
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  segmentButtonActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: colors.red,
  },
  slot: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  empty: {
    color: colors.muted,
    marginBottom: 8,
  },
  primaryButton: {
    height: 52,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
    marginTop: 20,
    marginBottom: 28,
  },
  disabled: {
    opacity: 0.45,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '800',
  },
});
