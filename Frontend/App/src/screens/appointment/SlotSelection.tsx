import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useAvailableSlots } from '../../hooks/useSlots';
import { format, addDays, isSameDay } from 'date-fns';
import { colors, radius, spacing } from '../../lib/theme';

const SlotSelectionScreen = ({ route, navigation }) => {
  const { doctorId, doctorName, doctorSpecialty, patientId, userId } = route.params;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { slots, isLoading, fetchSlots } = useAvailableSlots();

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    fetchSlots(doctorId, dateStr);
  }, [doctorId, selectedDate, fetchSlots]);

  const onSelectSlot = (slot) => {
    navigation.navigate('Confirmation', { 
      doctorId, 
      doctorName,
      doctorSpecialty,
      appointmentDate: format(selectedDate, 'yyyy-MM-dd'),
      appointmentTime: slot.slot_time,
      patientId,
      userId
    });
  };

  const renderDateItem = (date: Date) => {
    const isSelected = isSameDay(date, selectedDate);
    return (
      <TouchableOpacity 
        key={date.toISOString()}
        style={[styles.dateItem, isSelected && styles.selectedDateItem]} 
        onPress={() => setSelectedDate(date)}
      >
        <Text style={[styles.dateDay, isSelected && styles.selectedDateText]}>{format(date, 'EEE')}</Text>
        <Text style={[styles.dateNum, isSelected && styles.selectedDateText]}>{format(date, 'dd')}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Date & Time</Text>
      
      <View style={styles.dateSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {dates.map(renderDateItem)}
        </ScrollView>
      </View>

      <Text style={styles.subTitle}>{format(selectedDate, 'MMMM dd, yyyy')}</Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching available slots...</Text>
        </View>
      ) : (
        <FlatList
          data={slots}
          numColumns={3}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.slotItem} onPress={() => onSelectSlot(item)}>
              <Text style={styles.slotText}>{item.slot_time}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No slots available for this date.</Text>}
          contentContainerStyle={styles.slotGrid}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: colors.foreground, textAlign: 'center' },
  subTitle: { fontSize: 16, fontWeight: '600', color: colors.mutedForeground, marginBottom: 16, textAlign: 'center' },
  dateSelector: { marginBottom: 24 },
  dateItem: { width: 60, height: 70, backgroundColor: colors.card, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center', marginRight: 10, elevation: 1 },
  selectedDateItem: { backgroundColor: colors.primary },
  dateDay: { fontSize: 12, color: colors.mutedForeground },
  dateNum: { fontSize: 18, fontWeight: 'bold', color: colors.foreground },
  selectedDateText: { color: colors.primaryForeground },
  slotGrid: { paddingBottom: 20 },
  slotItem: { flex: 1/3, margin: 5, backgroundColor: colors.card, paddingVertical: 15, borderRadius: radius.md, alignItems: 'center', elevation: 1, borderWidth: 1, borderColor: colors.border },
  slotText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  loadingText: { marginTop: spacing.md, color: colors.mutedForeground },
  empty: { textAlign: 'center', color: colors.mutedForeground, marginTop: 40 },
});

export default SlotSelectionScreen;
