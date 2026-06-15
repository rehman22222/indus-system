import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getAppointments } from '@/api/domain';
import type { Appointment } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/LanguageContext';
import type { PatientTabScreenProps } from '@/navigation/PatientTabs';
import { navigationAction } from '@/navigation/navigationRef';
import { openVideoConsultation } from '@/services/video';
import { radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

type Props = PatientTabScreenProps<'Appointments'>;

const FILTERS = ['all', 'confirmed', 'waiting', 'completed', 'cancelled'] as const;
const CAN_JOIN = ['confirmed', 'waiting', 'in_consultation', 'scheduled'];

function statusKey(status: string) {
  return (status || '').toLowerCase().replace(/[-\s]/g, '_');
}

function statusTint(status: string, colors: ThemeColors) {
  const s = statusKey(status);
  if (s === 'completed') return { bg: colors.successSoft, fg: colors.success };
  if (s === 'in_consultation') return { bg: colors.navySoft, fg: colors.navy };
  if (s === 'cancelled' || s === 'no_show') return { bg: colors.surfaceAlt, fg: colors.muted };
  return { bg: colors.primarySoft, fg: colors.primary };
}

export function AppointmentsTabScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { t, isRtl } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const align = { textAlign: isRtl ? 'right' : 'left' } as const;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setAppointments(await getAppointments({ patient_id: user.id, sort: '-date,-time', limit: '100' }));
    } catch {
      // keep last good data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      const matchesStatus = filter === 'all' || statusKey(a.status) === filter;
      const matchesQuery = !q || (a.doctor?.name || '').toLowerCase().includes(q) || (a.doctor?.specialty || '').toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [appointments, filter, query]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.root}>
      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.subtle} />
        <TextInput
          style={[styles.searchInput, align]}
          placeholder={t('appts.search')}
          placeholderTextColor={colors.subtle}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {/* Filter chips */}
      <FlatList
        horizontal
        style={styles.filterList}
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(f) => f}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const active = filter === item;
          const label = item === 'all' ? t('appts.all') : t(`status.${item}`, item);
          return (
            <Pressable onPress={() => setFilter(item)} style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
            </Pressable>
          );
        }}
      />

      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[styles.listContent, filtered.length === 0 && styles.emptyListContent]}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); void load(); }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={32} color={colors.subtle} />
            <Text style={styles.emptyText}>{t('appts.none')}</Text>
            <Pressable style={styles.bookNow} onPress={() => navigation.dispatch(navigationAction('BookAppointment'))}>
              <Text style={styles.bookNowText}>{t('dash.bookNow')}</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const isVideo = item.appointment_type === 'video';
          const tint = statusTint(item.status, colors);
          const canJoin = isVideo && CAN_JOIN.includes(item.status);
          return (
            <Pressable style={styles.card} onPress={() => navigation.dispatch(navigationAction('AppointmentDetails', { appointmentId: item.id }))}>
              <View style={styles.cardRow}>
                <View style={[styles.cardIcon, { backgroundColor: isVideo ? colors.navySoft : colors.primarySoft }]}>
                  <Ionicons name={isVideo ? 'videocam-outline' : 'location-outline'} size={20} color={isVideo ? colors.navy : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docName, align]} numberOfLines={1}>{item.doctor?.name || 'Doctor'}</Text>
                  {!!item.doctor?.specialty && <Text style={[styles.docMeta, align]}>{item.doctor.specialty}</Text>}
                  <Text style={[styles.docMeta, align]}>{item.appointment_date || item.date}  ·  {item.appointment_time || item.time}</Text>
                </View>
                <View style={styles.cardRight}>
                  <View style={[styles.badge, { backgroundColor: tint.bg }]}>
                    <Text style={[styles.badgeText, { color: tint.fg }]}>{t(`status.${statusKey(item.status)}`, item.status)}</Text>
                  </View>
                  {item.visit_type === 'follow_up' && (
                    <View style={styles.visitChip}><Text style={styles.visitChipText}>{t('book.followUp')}</Text></View>
                  )}
                </View>
              </View>
              {canJoin && (
                <Pressable
                  style={styles.joinBtn}
                  onPress={async () => {
                    try { await openVideoConsultation(item.id); }
                    catch (e) { Alert.alert(t('book.joinError'), e instanceof Error ? e.message : t('common.tryAgain')); }
                  }}
                >
                  <Ionicons name="videocam" size={15} color="#fff" />
                  <Text style={styles.joinText}>{t('home.joinVideo')}</Text>
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, margin: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.md, height: 46, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },

  filterList: { flexGrow: 0, flexShrink: 0, maxHeight: 48 },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, alignItems: 'center' },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  filterTextActive: { color: '#fff' },

  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xl },
  emptyListContent: { flexGrow: 1 },
  card: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm, ...shadow.soft },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardIcon: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  docName: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  docMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 4, maxWidth: 112 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontWeight: '800', fontSize: 11 },
  visitChip: { borderRadius: radius.pill, backgroundColor: colors.navy, paddingHorizontal: 8, paddingVertical: 3 },
  visitChipText: { color: '#fff', fontWeight: '800', fontSize: 10 },

  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm, height: 40, borderRadius: radius.md, backgroundColor: colors.navy },
  joinText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  emptyCard: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, marginTop: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.soft },
  emptyText: { color: colors.muted, fontSize: 13 },
  bookNow: { marginTop: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  bookNowText: { color: '#fff', fontWeight: '800' },
});
