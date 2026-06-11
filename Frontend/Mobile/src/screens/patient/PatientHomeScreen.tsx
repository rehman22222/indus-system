import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getAppointments } from '@/api/domain';
import type { Appointment } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { openVideoConsultation } from '@/services/video';
import { colors } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'PatientHome'>;

export function PatientHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setRefreshing(true);
      const data = await getAppointments({ patient_id: user.id, sort: '-date,-time', limit: '20' });
      setAppointments(data);
    } catch (error) {
      Alert.alert('Unable to load appointments', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Welcome</Text>
          <Text style={styles.title}>{user?.name || 'Patient'}</Text>
        </View>
        <Pressable onPress={signOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Sign Out</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => navigation.navigate('BookAppointment')} style={styles.primaryButton}>
        <Text style={styles.primaryText}>Book Appointment</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Recent appointments</Text>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={<Text style={styles.empty}>No appointments found.</Text>}
        renderItem={({ item }) => {
          const canJoinVideo =
            item.appointment_type === 'video' &&
            ['confirmed', 'waiting', 'in_consultation', 'scheduled'].includes(item.status);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.doctor?.name || 'Doctor'}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
              <Text style={styles.muted}>{item.doctor?.specialty || 'Consultation'}</Text>
              <Text style={styles.detail}>{item.appointment_date || item.date} at {item.appointment_time || item.time}</Text>
              <Text style={styles.token}>Token {item.token}</Text>
              {canJoinVideo && (
                <Pressable
                  onPress={async () => {
                    try {
                      await openVideoConsultation(item.id);
                    } catch (error) {
                      Alert.alert('Could not join video', error instanceof Error ? error.message : 'Please try again.');
                    }
                  }}
                  style={styles.joinButton}
                >
                  <Text style={styles.joinText}>Join Video Call</Text>
                </Pressable>
              )}
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
    marginTop: 4,
    color: colors.text,
    fontSize: 25,
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
    fontWeight: '800',
    color: colors.text,
  },
  primaryButton: {
    height: 52,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
    marginBottom: 20,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
    color: colors.text,
    fontWeight: '800',
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
    marginTop: 4,
  },
  detail: {
    color: colors.text,
    marginTop: 10,
    fontWeight: '700',
  },
  token: {
    color: colors.muted,
    marginTop: 8,
    fontWeight: '700',
  },
  joinButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
  },
  joinText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
