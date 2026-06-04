import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { usePatientByUserId } from '../hooks/usePatients';
import { useAppointments } from '../hooks/useAppointments';
import { usePatientPrescriptions } from '../hooks/usePrescriptions';
import { useDoctors } from '../hooks/useDoctors';
import { format } from 'date-fns';
import { colors, radius, spacing } from '../lib/theme';

const PatientDashboard = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const { patient, isLoading: patientLoading } = usePatientByUserId(user?.id);
  const { appointments, loading: appointmentsLoading, fetchAppointments } = useAppointments(patient?.id);
  const { prescriptions, isLoading: prescriptionsLoading } = usePatientPrescriptions(patient?.id);
  const { doctors } = useDoctors();

  const [activeTab, setActiveTab] = useState('home'); // home, appointments, history, profile

  useEffect(() => {
    if (patient?.id) {
      fetchAppointments();
    }
  }, [patient?.id, fetchAppointments]);

  const handleLogout = async () => {
    await signOut();
    navigation.replace('Login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return colors.chart2;
      case 'waiting': return colors.chart4;
      case 'in_consultation': return colors.primary;
      case 'completed': return colors.chart3;
      case 'cancelled': return colors.destructive;
      default: return colors.mutedForeground;
    }
  };

  const renderHome = () => {
    const upcoming = appointments.filter(a => ['confirmed', 'waiting', 'in_consultation'].includes(a.status));
    
    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.welcomeBanner}>
          <Text style={styles.welcomeTitle}>Welcome, {patient?.name?.split(' ')[0] || 'Patient'}!</Text>
          <Text style={styles.welcomeSub}>Manage your health journey</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{upcoming.length}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 0 }]}>
            <Text style={styles.statValue}>{appointments.filter(a => a.status === 'completed').length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{prescriptions.length}</Text>
            <Text style={styles.statLabel}>Prescriptions</Text>
          </View>
          <View style={[styles.statCard, { borderLeftWidth: 0 }]}>
            <Text style={styles.statValue}>{doctors.length}</Text>
            <Text style={styles.statLabel}>Doctors</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
        {upcoming.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No upcoming appointments</Text>
            <TouchableOpacity 
              style={styles.bookButton}
              onPress={() => navigation.navigate('SpecialtySelection', { userId: user?.id, patientId: patient?.id })}
            >
              <Text style={styles.bookButtonText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          upcoming.slice(0, 3).map((apt) => (
            <View key={apt.id} style={styles.appointmentCard}>
              <View style={styles.apptHeader}>
                <Text style={styles.docName}>{(apt as any).doctor?.full_name || 'Doctor'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(apt.status) + '15' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(apt.status) }]}>{apt.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.apptTime}>{format(new Date(apt.appointment_date), 'MMM dd, yyyy')} at {apt.appointment_time}</Text>
              <Text style={styles.apptType}>{apt.appointment_type === 'video' ? '📹 Video Consultation' : '📍 In-Person Visit'}</Text>
            </View>
          ))
        )}

        <TouchableOpacity 
          style={styles.mainBookButton}
          onPress={() => navigation.navigate('SpecialtySelection', { userId: user?.id, patientId: patient?.id })}
        >
          <Text style={styles.mainBookButtonText}>+ Book New Appointment</Text>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  const renderAppointments = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>My Appointments</Text>
      <FlatList
        data={appointments}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.appointmentCard}>
            <View style={styles.apptHeader}>
              <Text style={styles.docName}>{(item as any).doctor?.full_name || 'Doctor'}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.apptTime}>{format(new Date(item.appointment_date), 'MMM dd, yyyy')} at {item.appointment_time}</Text>
            <Text style={styles.apptType}>{item.appointment_type === 'video' ? '📹 Video' : '📍 In-Person'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No appointments found</Text>}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );

  const renderHistory = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Prescription History</Text>
      <FlatList
        data={prescriptions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.prescriptionCard}>
            <Text style={styles.diagnosisText}>{item.diagnosis}</Text>
            <Text style={styles.prescMeta}>Dr. {item.doctor?.name} • {format(new Date(item.created_at), 'MMM dd, yyyy')}</Text>
            {item.instructions && <Text style={styles.instructionsText}>{item.instructions}</Text>}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No prescriptions found</Text>}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );

  const renderProfile = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{patient?.name?.charAt(0) || 'P'}</Text>
        </View>
        <Text style={styles.profileName}>{patient?.name}</Text>
        <Text style={styles.profileId}>{patient?.patient_id}</Text>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{patient?.phone}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{patient?.email || user?.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Age & Gender</Text>
          <Text style={styles.infoValue}>{patient?.age || 'N/A'} • {patient?.gender || 'N/A'}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  if (patientLoading || (appointmentsLoading && appointments.length === 0)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Indus Patient Portal</Text>
      </View>

      <View style={styles.content}>
        {activeTab === 'home' && renderHome()}
        {activeTab === 'appointments' && renderAppointments()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'profile' && renderProfile()}
      </View>

      <View style={styles.tabBar}>
        {[
          { id: 'home', label: 'Home', icon: '🏠' },
          { id: 'appointments', label: 'Appts', icon: '📅' },
          { id: 'history', label: 'History', icon: '📜' },
          { id: 'profile', label: 'Profile', icon: '👤' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabIcon, activeTab === tab.id && styles.activeTabIcon]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.activeTabLabel]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.foreground },
  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.mutedForeground },
  tabContent: { flex: 1, padding: spacing.lg },
  welcomeBanner: { padding: 20, backgroundColor: colors.primary, borderRadius: radius.lg, marginBottom: spacing.xl },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: colors.primaryForeground },
  welcomeSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, marginBottom: spacing.xl },
  statCard: { width: '50%', padding: spacing.lg, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.secondary, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: colors.foreground },
  statLabel: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.foreground, marginBottom: spacing.md },
  appointmentCard: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.primary, elevation: 1 },
  apptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  docName: { fontSize: 16, fontWeight: 'bold', color: colors.foreground },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  apptTime: { fontSize: 14, color: colors.mutedForeground },
  apptType: { fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  emptyCard: { padding: 30, backgroundColor: colors.card, borderRadius: radius.lg, alignItems: 'center', marginBottom: spacing.xl },
  emptyText: { color: colors.mutedForeground, fontSize: 14, textAlign: 'center' },
  bookButton: { marginTop: spacing.md, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.accent, borderRadius: radius.sm },
  bookButtonText: { color: colors.primary, fontWeight: 'bold' },
  mainBookButton: { backgroundColor: colors.primary, padding: spacing.lg, borderRadius: radius.lg, alignItems: 'center', marginTop: spacing.sm },
  mainBookButtonText: { color: colors.primaryForeground, fontSize: 16, fontWeight: 'bold' },
  prescriptionCard: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.md, elevation: 1 },
  diagnosisText: { fontSize: 16, fontWeight: 'bold', color: colors.foreground, marginBottom: 4 },
  prescMeta: { fontSize: 12, color: colors.mutedForeground, marginBottom: 8 },
  instructionsText: { fontSize: 13, color: colors.secondaryForeground, backgroundColor: colors.secondary, padding: 8, borderRadius: radius.sm },
  profileHeader: { alignItems: 'center', paddingVertical: 30 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: colors.primary },
  profileName: { fontSize: 22, fontWeight: 'bold', color: colors.foreground },
  profileId: { fontSize: 14, color: colors.mutedForeground },
  infoSection: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.xl },
  infoRow: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.secondary },
  infoLabel: { fontSize: 12, color: colors.mutedForeground, marginBottom: 2 },
  infoValue: { fontSize: 16, color: colors.foreground, fontWeight: '500' },
  logoutButton: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.destructive, alignItems: 'center' },
  logoutButtonText: { color: colors.destructive, fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: 20, paddingTop: 10 },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 20, color: colors.mutedForeground },
  tabLabel: { fontSize: 10, color: colors.mutedForeground, marginTop: 4 },
  activeTabIcon: { color: colors.primary },
  activeTabLabel: { color: colors.primary, fontWeight: 'bold' },
});

export default PatientDashboard;
