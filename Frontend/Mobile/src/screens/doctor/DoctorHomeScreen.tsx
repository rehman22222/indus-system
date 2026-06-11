import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { getDoctors, getQueue, updateAppointmentStatus } from '@/api/domain';
import type { QueueEntry } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { joinDoctorQueue, leaveDoctorQueue, onQueueEvent } from '@/services/realtime';
import { colors } from '@/theme/colors';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

export function DoctorHomeScreen() {
  const { user, signOut } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const date = useMemo(todayIso, []);

  useEffect(() => {
    if (!user) return;
    getDoctors({ search: user.name || user.email })
      .then((items) => {
        const own = items.find((item) => item.name === user.name || item.full_name === user.name) || items[0];
        setDoctorId(own?.id || null);
      })
      .catch(() => setDoctorId(null));
  }, [user]);

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      setRefreshing(true);
      setQueue(await getQueue({ doctor_id: doctorId, date }));
    } catch (error) {
      Alert.alert('Unable to load queue', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [date, doctorId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!doctorId) return undefined;

    joinDoctorQueue(doctorId);
    const events = [
      'queue.updated',
      'patient.checked_in',
      'patient.called',
      'consultation.started',
      'consultation.completed',
      'appointment.cancelled',
    ];
    const unsubscribe = events.map((event) => onQueueEvent(event, () => load()));

    return () => {
      unsubscribe.forEach((item) => item());
      leaveDoctorQueue(doctorId);
    };
  }, [doctorId, load]);

  async function setStatus(entry: QueueEntry, status: string) {
    const appointment = typeof entry.appointment_id === 'string' ? null : entry.appointment_id;
    if (!appointment?.id) return;
    try {
      await updateAppointmentStatus(appointment.id, status);
      await load();
    } catch (error) {
      Alert.alert('Unable to update status', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Doctor Queue</Text>
          <Text style={styles.title}>{user?.name || 'Doctor'}</Text>
        </View>
        <Pressable onPress={signOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Sign Out</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{queue.length}</Text>
          <Text style={styles.statLabel}>Patients</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{queue.filter((item) => item.status === 'completed').length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>No queue entries for today.</Text>}
        renderItem={({ item }) => {
          const appointment = typeof item.appointment_id === 'string' ? null : item.appointment_id;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{appointment?.patient?.name || appointment?.patient?.full_name || 'Patient'}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
              <Text style={styles.muted}>Token {appointment?.token || '-'}</Text>
              <Text style={styles.detail}>{appointment?.appointment_time || appointment?.time || ''}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => setStatus(item, 'called')} style={styles.actionButton}>
                  <Text style={styles.actionText}>Call</Text>
                </Pressable>
                <Pressable onPress={() => setStatus(item, 'in_consultation')} style={styles.actionButton}>
                  <Text style={styles.actionText}>Start</Text>
                </Pressable>
                <Pressable onPress={() => setStatus(item, 'completed')} style={[styles.actionButton, styles.doneButton]}>
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 18,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    color: colors.muted,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.surface,
  },
  secondaryText: {
    color: colors.text,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 24,
    color: colors.text,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    marginTop: 4,
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 30,
  },
  card: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  status: {
    color: colors.red,
    fontWeight: '800',
  },
  muted: {
    color: colors.muted,
    marginTop: 6,
  },
  detail: {
    color: colors.text,
    marginTop: 8,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F3F6',
  },
  actionText: {
    color: colors.text,
    fontWeight: '800',
  },
  doneButton: {
    backgroundColor: colors.red,
  },
  doneText: {
    color: '#fff',
    fontWeight: '800',
  },
});
