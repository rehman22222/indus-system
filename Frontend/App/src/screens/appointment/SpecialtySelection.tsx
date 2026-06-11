import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useDepartments } from '../../hooks/useDepartments';
import type { Department } from '../../hooks/useDepartments';
import { colors, radius, spacing } from '../../lib/theme';

type SpecialtySelectionProps = {
  route?: { params?: { patientId?: string; userId?: string } };
  navigation?: any;
};

const SpecialtySelectionScreen = ({ route, navigation }: SpecialtySelectionProps) => {
  // Carry the patient identity through the whole booking flow; without this the
  // downstream screens receive patientId=undefined and booking fails.
  const { patientId, userId } = route?.params || {};
  const { departments, isLoading, error } = useDepartments();

  const onSelectSpecialty = (dept: Department) => {
    navigation.navigate('DoctorSelection', {
      specialtyId: dept.id,
      specialtyName: dept.name,
      patientId,
      userId,
    });
  };

  const renderItem = ({ item }: { item: Department }) => (
    <TouchableOpacity style={styles.item} onPress={() => onSelectSpecialty(item)}>
      <View style={styles.itemContent}>
        <View style={[styles.iconContainer, { backgroundColor: (item.color || colors.primary) + '15' }]}>
          <Text style={[styles.iconText, { color: item.color || colors.primary }]}>{item.name.charAt(0)}</Text>
        </View>
        <View>
          <Text style={styles.itemText}>{item.name}</Text>
          <Text style={styles.itemDesc}>{item.description || 'Specialized care'}</Text>
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
      <Text style={styles.title}>Select a Specialty</Text>
      <FlatList
        data={departments}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No specialties found.</Text>}
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
  iconContainer: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  iconText: { fontWeight: 'bold' },
  itemText: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  itemDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.mutedForeground, marginTop: 40 },
});

export default SpecialtySelectionScreen;
