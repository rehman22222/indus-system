import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { MongoDB } from '../integrations/mongodb/client';
import { useAuth } from '../hooks/useAuth';
import { useDoctorByUserId } from '../hooks/useDoctors';
import { useDoctorAppointments } from '../hooks/useAppointments';
import { useQueue } from '../hooks/useQueue';
import { SocketService } from '../services/core-api';
import { format } from 'date-fns';
import { colors, radius, spacing } from '../lib/theme';

const DoctorDashboard = ({ navigation }: { navigation: any }) => {
  const { user, signOut } = useAuth();
  const { doctor: activeDoctor, isLoading: doctorLoading } = useDoctorByUserId(user?.id);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { appointments, isLoading: apptsLoading } = useDoctorAppointments(activeDoctor?.id, todayStr);
  const { queue, callNext, updateStatus, isLoading: queueLoading } = useQueue(activeDoctor?.id, todayStr);

  const [activeTab, setActiveTab] = useState('home'); // home, schedule, history, profile

  const handleLogout = async () => {
    await signOut();
    navigation.replace('Login');
  };

  const handleStartConsultation = async (appt: any) => {
    if (appt.appointment_type === 'video' && !appt.consent_recorded) {
      Alert.alert(
        'Telemedicine Consent',
        `Per Sindh regulations, explicit consent is required for video consultation with ${appt.patient?.name || 'the patient'}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Record & Start', 
            onPress: async () => {
              await MongoDB.from('appointments').update({
                consent_recorded: true,
                consent_recorded_at: new Date().toISOString(),
              }).eq('id', appt.id);
              startConsult(appt);
            }
          }
        ]
      );
      return;
    }
    startConsult(appt);
  };

  const startConsult = async (appt: any) => {
    try {
      const res = await updateStatus(appt.id, 'in_consultation');
      if (res.success) {
        await MongoDB.from('encounters').insert({
          appointment_id: appt.id,
          doctor_id: activeDoctor?.id,
          patient_id: appt.patient_id,
          class: appt.appointment_type === 'video' ? 'VR' : 'AMB',
          started_at: new Date().toISOString(),
        });
        
        SocketService.emit('start.consult', {
          doctorId: activeDoctor?.id,
          patientId: appt.patient_id,
          appointmentId: appt.id,
        });
        
        Alert.alert('Success', `Consultation started with ${appt.patient?.name || 'Patient'}`);
      } else {
        Alert.alert('Error', res.error || 'Failed to start consultation');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderHome = () => {
    const stats = {
      pending: appointments.filter(a => a.status === 'confirmed').length,
      waiting: appointments.filter(a => a.status === 'waiting').length,
      completed: appointments.filter(a => a.status === 'completed').length,
    };

    return (
      <View style={styles.tabContent}>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.chart2 + '10' }]}>
            <Text style={[styles.statNum, { color: colors.chart2 }]}>{stats.pending}</Text>
            <Text style={styles.statLab}>Pending</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.chart4 + '10' }]}>
            <Text style={[styles.statNum, { color: colors.chart4 }]}>{stats.waiting}</Text>
            <Text style={styles.statLab}>Waiting</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.chart3 + '10' }]}>
            <Text style={[styles.statNum, { color: colors.chart3 }]}>{stats.completed}</Text>
            <Text style={styles.statLab}>Done</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Live Patient Queue</Text>
        <FlatList
          data={queue}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.queueItem}>
              <View style={styles.queueLeft}>
                <Text style={styles.patientName}>{(item as any).patient?.full_name || 'Patient'}</Text>
                <Text style={styles.tokenText}>Token: {(item as any).token}</Text>
              </View>
              <View style={styles.queueRight}>
                {item.status === 'waiting' ? (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleStartConsultation(item)}
                  >
                    <Text style={styles.actionButtonText}>Start</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.statusTag, { backgroundColor: item.status === 'in_consultation' ? colors.primary + '15' : colors.secondary }]}>
                    <Text style={[styles.statusTagText, { color: item.status === 'in_consultation' ? colors.primary : colors.mutedForeground }]}>
                      {item.status === 'in_consultation' ? 'Consulting' : item.status.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No patients in queue</Text>}
        />
      </View>
    );
  };

  const renderSchedule = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Today's Schedule</Text>
      <FlatList
        data={appointments}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.scheduleCard}>
            <Text style={styles.schedTime}>{item.appointment_time}</Text>
            <View style={styles.schedInfo}>
              <Text style={styles.schedPatient}>{(item as any).patient?.full_name}</Text>
              <Text style={styles.schedType}>{item.appointment_type === 'video' ? '📹 Video' : '📍 In-Person'}</Text>
            </View>
            <Text style={[styles.schedStatus, { color: item.status === 'completed' ? colors.chart3 : colors.chart2 }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        )}
      />
    </View>
  );

  const renderProfile = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.profileBox}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{activeDoctor?.name?.charAt(0)}</Text>
        </View>
        <Text style={styles.profName}>{activeDoctor?.name}</Text>
        <Text style={styles.profSpec}>{activeDoctor?.specialty}</Text>
      </View>

      <View style={styles.profDetails}>
        <Text style={styles.profLabel}>License No</Text>
        <Text style={styles.profValue}>{(activeDoctor as any)?.license_no || 'N/A'}</Text>
        <Text style={[styles.profLabel, { marginTop: 12 }]}>Department</Text>
        <Text style={styles.profValue}>{(activeDoctor as any)?.department?.name || 'General'}</Text>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout}>
        <Text style={styles.signOutBtnText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (doctorLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Dr. Portal</Text>
      </View>

      <View style={styles.content}>
        {activeTab === 'home' && renderHome()}
        {activeTab === 'schedule' && renderSchedule()}
        {activeTab === 'profile' && renderProfile()}
      </View>

      <View style={styles.tabBar}>
        {[
          { id: 'home', label: 'Queue', icon: '⚡' },
          { id: 'schedule', label: 'Schedule', icon: '📅' },
          { id: 'profile', label: 'Profile', icon: '👤' },
        ].map(t => (
          <TouchableOpacity 
            key={t.id} 
            style={styles.tabItem} 
            onPress={() => setActiveTab(t.id)}
          >
            <Text style={[styles.tabIcon, activeTab === t.id && { color: colors.primary }]}>{t.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === t.id && { color: colors.primary, fontWeight: 'bold' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  headerText: { fontSize: 18, fontWeight: 'bold', color: colors.foreground },
  content: { flex: 1 },
  tabContent: { flex: 1, padding: spacing.lg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },
  statBox: { flex: 1, marginHorizontal: 4, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: 'bold' },
  statLab: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.foreground, marginBottom: spacing.lg },
  queueItem: { flexDirection: 'row', backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md, alignItems: 'center', elevation: 1 },
  queueLeft: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: 'bold', color: colors.foreground },
  tokenText: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  queueRight: {},
  actionButton: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: radius.sm },
  actionButtonText: { color: colors.primaryForeground, fontWeight: 'bold', fontSize: 14 },
  statusTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  statusTagText: { fontSize: 10, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: colors.mutedForeground, marginTop: 40 },
  scheduleCard: { flexDirection: 'row', backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm, alignItems: 'center' },
  schedTime: { width: 60, fontSize: 14, fontWeight: 'bold', color: colors.primary },
  schedInfo: { flex: 1 },
  schedPatient: { fontSize: 15, fontWeight: '500', color: colors.foreground },
  schedType: { fontSize: 11, color: colors.mutedForeground },
  schedStatus: { fontSize: 10, fontWeight: 'bold' },
  profileBox: { alignItems: 'center', paddingVertical: 30 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  avatarLargeText: { fontSize: 32, fontWeight: 'bold', color: colors.primary },
  profName: { fontSize: 22, fontWeight: 'bold', color: colors.foreground },
  profSpec: { fontSize: 14, color: colors.mutedForeground },
  profDetails: { backgroundColor: colors.card, padding: 20, borderRadius: radius.lg, marginBottom: spacing.xl },
  profLabel: { fontSize: 11, color: colors.mutedForeground, textTransform: 'uppercase' },
  profValue: { fontSize: 16, color: colors.foreground, fontWeight: '500' },
  signOutBtn: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.destructive, alignItems: 'center' },
  signOutBtnText: { color: colors.destructive, fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: 20, paddingTop: 10 },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 22, color: colors.mutedForeground },
  tabLabel: { fontSize: 10, color: colors.mutedForeground, marginTop: 4 },
});

export default DoctorDashboard;
