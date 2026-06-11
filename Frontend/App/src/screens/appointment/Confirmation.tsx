import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useCreateAppointment } from '../../hooks/useAppointments';
import { format } from 'date-fns';
import { colors, radius, spacing } from '../../lib/theme';
import { CheckCircle2, Stethoscope, Calendar as CalendarIcon, Clock, MapPin, Video, FileText } from 'lucide-react';

type ConfirmationProps = {
  route?: {
    params: {
      doctorId: string;
      doctorName: string;
      doctorSpecialty: string;
      appointmentDate: string;
      appointmentTime: string;
      patientId: string;
      userId?: string;
    };
  };
  navigation?: any;
};

const ConfirmationScreen = ({ route, navigation }: ConfirmationProps) => {
  const { 
    doctorId = '', 
    doctorName = '', 
    doctorSpecialty = '', 
    appointmentDate = new Date().toISOString(), 
    appointmentTime = '', 
    patientId = '',
    userId 
  } = route?.params || {};

  const [appointmentType, setAppointmentType] = useState<'physical' | 'video'>('physical');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const { createAppointment, isLoading } = useCreateAppointment();
  const [isSuccess, setIsSuccess] = useState(false);
  const [token, setToken] = useState('');

  const handleConfirm = async () => {
    if (!patientId) {
      Alert.alert('Error', 'Patient profile is missing. Please sign in again.');
      return;
    }

    try {
      const { data, error } = await createAppointment({
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        appointment_type: appointmentType,
        chief_complaint: chiefComplaint || undefined,
        doctor_specialty: doctorSpecialty,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to book appointment');
        return;
      }

      if (data?.token) {
        setToken(data.token);
        setIsSuccess(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  if (isSuccess) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCard}>
          <CheckCircle2 size={80} color={colors.chart3} />
          <Text style={styles.successTitle}>Booking Confirmed!</Text>
          <Text style={styles.successSubtitle}>Your appointment has been successfully scheduled.</Text>
          
          <View style={styles.tokenBox}>
            <Text style={styles.tokenLabel}>Your Token Number</Text>
            <Text style={styles.tokenValue}>{token}</Text>
          </View>

          <TouchableOpacity 
            style={styles.doneButton}
            onPress={() => navigation.navigate('PatientDashboard')}
          >
            <Text style={styles.doneButtonText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Confirm Appointment</Text>
      
      <View style={styles.summaryCard}>
        <View style={styles.docRow}>
          <View style={styles.iconCircle}>
            <Stethoscope size={24} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.docName}>{doctorName}</Text>
            <Text style={styles.docSpec}>{doctorSpecialty}</Text>
          </View>
        </View>

        <View style={styles.detailsList}>
          <View style={styles.detailItem}>
            <CalendarIcon size={20} color={colors.mutedForeground} />
            <Text style={styles.detailText}>{format(new Date(appointmentDate), 'EEEE, MMMM dd, yyyy')}</Text>
          </View>
          <View style={styles.detailItem}>
            <Clock size={20} color={colors.mutedForeground} />
            <Text style={styles.detailText}>{appointmentTime}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Consultation Type</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity 
            style={[styles.typeButton, appointmentType === 'physical' && styles.typeButtonActive]}
            onPress={() => setAppointmentType('physical')}
          >
            <MapPin size={20} color={appointmentType === 'physical' ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.typeButtonText, appointmentType === 'physical' && styles.typeButtonTextActive]}>In-Person</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeButton, appointmentType === 'video' && styles.typeButtonActive]}
            onPress={() => setAppointmentType('video')}
          >
            <Video size={20} color={appointmentType === 'video' ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.typeButtonText, appointmentType === 'video' && styles.typeButtonTextActive]}>Video</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.confirmButton}
        onPress={handleConfirm}
        disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Confirm Booking</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: colors.foreground, textAlign: 'center' },
  summaryCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, marginBottom: 24, elevation: 2 },
  docRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  docName: { fontSize: 18, fontWeight: 'bold', color: colors.foreground },
  docSpec: { fontSize: 14, color: colors.mutedForeground },
  detailsList: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 15 },
  detailItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  detailText: { marginLeft: 10, fontSize: 15, color: colors.foreground },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  typeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeButtonText: { marginLeft: 8, fontWeight: '600', color: colors.mutedForeground },
  typeButtonTextActive: { color: colors.primaryForeground },
  confirmButton: { height: 58, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 4 },
  confirmButtonText: { color: colors.primaryForeground, fontSize: 17, fontWeight: 'bold' },
  successContainer: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.xxl },
  successCard: { backgroundColor: colors.card, borderRadius: radius.xxl, padding: 32, alignItems: 'center', elevation: 4 },
  successTitle: { fontSize: 24, fontWeight: 'bold', color: colors.chart3, marginTop: 20 },
  successSubtitle: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  tokenBox: { backgroundColor: colors.chart3 + '10', padding: 20, borderRadius: radius.lg, width: '100%', alignItems: 'center', marginTop: 24, borderWidth: 1, borderColor: colors.chart3 + '20' },
  tokenLabel: { fontSize: 12, color: colors.chart3, fontWeight: '600', textTransform: 'uppercase' },
  tokenValue: { fontSize: 36, fontWeight: 'bold', color: colors.chart3, marginTop: 4, letterSpacing: 2 },
  doneButton: { height: 54, backgroundColor: colors.foreground, borderRadius: radius.md, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default ConfirmationScreen;
