import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useDoctors } from '../../hooks/useDoctors';
import type { DoctorWithName } from '../../hooks/useDoctors';
import { colors, radius, spacing } from '../../lib/theme';

type DoctorSelectionProps = {
  route?: {
    params: {
      specialtyId?: string;
      specialtyName?: string;
      patientId?: string;
      userId?: string;
    };
  };
  navigation?: any;
};

const DoctorSelectionScreen = ({ route, navigation }: DoctorSelectionProps) => {
  const { specialtyId, specialtyName, patientId, userId } = route?.params || {};
  const { doctors, isLoading } = useDoctors();

  const filteredDoctors = specialtyId
    ? doctors.filter(
        d =>
          (d as any).department_id === specialtyId ||
          (specialtyName && d.specialty === specialtyName),
      )
    : doctors;

  const onSelectDoctor = (doctor: DoctorWithName) => {
    navigation.navigate('SlotSelection', { 
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      patientId,
      userId
    });
  };

  const renderItem = ({ item }: { item: DoctorWithName }) => (
    <TouchableOpacity style={styles.item} onPress={() => onSelectDoctor(item)}>
      <View style={styles.itemContent}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View>
          <Text style={styles.itemText}>{item.name}</Text>
          <Text style={styles.itemDesc}>{item.specialty}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Doctors in {specialtyName || 'All specialties'}</Text>
      <FlatList
        data={filteredDoctors}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No doctors found for this specialty.</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: colors.foreground },
  item: { backgroundColor: colors.card, padding: spacing.lg, marginBottom: spacing.md, borderRadius: radius.lg, elevation: 1 },
  itemContent: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarText: { color: colors.primary, fontWeight: 'bold' },
  itemText: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  itemDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.mutedForeground, marginTop: 40 },
});

export default DoctorSelectionScreen;
