import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getDoctors } from '@/api/domain';
import type { Doctor } from '@/api/types';
import { useI18n } from '@/i18n/LanguageContext';
import type { PatientTabScreenProps } from '@/navigation/PatientTabs';
import { navigationAction } from '@/navigation/navigationRef';
import { initials, radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

type Props = PatientTabScreenProps<'Doctors'>;

const avatarTones = (c: ThemeColors) => [
  { bg: c.primarySoft, fg: c.primary },
  { bg: c.navySoft, fg: c.navy },
  { bg: c.successSoft, fg: c.success },
  { bg: c.warningSoft, fg: c.warning },
];

export function DoctorsTabScreen({ navigation }: Props) {
  const { t, isRtl } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tones = useMemo(() => avatarTones(colors), [colors]);
  const align = { textAlign: isRtl ? 'right' : 'left' } as const;
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedDoctorId, setExpandedDoctorId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDoctors(await getDoctors());
    } catch {
      // keep last good data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(
      (d) => (d.name || '').toLowerCase().includes(q)
        || (d.specialty || '').toLowerCase().includes(q)
        || (d.department?.name || '').toLowerCase().includes(q),
    );
  }, [doctors, query]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.subtle} />
        <TextInput
          style={[styles.searchInput, align]}
          placeholder={t('doctors.search')}
          placeholderTextColor={colors.subtle}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); void load(); }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="medkit-outline" size={32} color={colors.subtle} />
            <Text style={styles.emptyText}>{t('doctors.none')}</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const tone = tones[index % tones.length];
          const name = item.name || item.full_name || 'Doctor';
          const expanded = expandedDoctorId === item.id;
          const availableDays = item.available_days?.map((day) => day.slice(0, 3)).join(', ');
          return (
            <View style={styles.card}>
              <View style={[styles.accent, { backgroundColor: tone.fg }]} />
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.avatarText, { color: tone.fg }]}>{initials(name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, align]} numberOfLines={1}>{name}</Text>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  </View>
                  <Text style={[styles.specialty, align]} numberOfLines={1}>{item.specialty}</Text>
                  {!!item.department?.name && (
                    <View style={styles.deptChip}><Text style={styles.deptChipText}>{item.department.name}</Text></View>
                  )}
                </View>
                {item.rating ? (
                  <View style={styles.rating}>
                    <Ionicons name="star" size={12} color={colors.warning} />
                    <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.statGrid}>
                <ProfileStat
                  icon="ribbon-outline"
                  label={t('doctors.experience', 'Experience')}
                  value={item.experience_years !== undefined ? `${item.experience_years} ${t('doctors.years')}` : t('profile.notProvided')}
                />
                <ProfileStat
                  icon="cash-outline"
                  label={t('doctors.fee', 'Consultation')}
                  value={item.consultation_fee !== undefined ? `Rs. ${item.consultation_fee}` : t('profile.notProvided')}
                />
              </View>

              {!!item.qualification && (
                <View style={styles.qualificationRow}>
                  <Ionicons name="school-outline" size={15} color={colors.navy} />
                  <Text style={[styles.qualification, align]} numberOfLines={2}>{item.qualification}</Text>
                </View>
              )}

              {expanded && (
                <View style={styles.profileDetails}>
                  {!!item.bio && <Text style={[styles.bio, align]}>{item.bio}</Text>}
                  <View style={styles.detailGrid}>
                    {!!item.languages?.length && (
                      <Detail icon="language-outline" label={t('doctors.speaks')} value={item.languages.map(capitalize).join(', ')} />
                    )}
                    {!!availableDays && (
                      <Detail icon="calendar-outline" label={t('doctors.available', 'Available')} value={availableDays} />
                    )}
                    {!!(item.license_number || item.license_no) && (
                      <Detail icon="shield-checkmark-outline" label={t('doctors.license', 'License')} value={item.license_number || item.license_no || ''} />
                    )}
                    {item.average_consultation_time !== undefined && (
                      <Detail icon="time-outline" label={t('doctors.duration', 'Visit time')} value={`${item.average_consultation_time} min`} />
                    )}
                  </View>
                </View>
              )}

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [styles.profileBtn, pressed && styles.profileBtnPressed]}
                  onPress={() => setExpandedDoctorId(expanded ? null : item.id)}
                >
                  <Ionicons name={expanded ? 'chevron-up' : 'person-outline'} size={16} color={colors.navy} />
                  <Text style={styles.profileBtnText}>{expanded ? t('doctors.less', 'Less') : t('doctors.viewProfile', 'View profile')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.bookBtn, pressed && styles.bookBtnPressed]}
                  onPress={() => navigation.dispatch(navigationAction('BookAppointment', { doctorId: item.id }))}
                >
                  <Ionicons name="calendar" size={15} color="#fff" />
                  <Text style={styles.bookText}>{t('doctors.book')}</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ProfileStat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
        <Ionicons name={icon} size={16} color={colors.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 1 }} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function Detail({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: '48%', flexDirection: 'row', gap: 8 }}>
      <Ionicons name={icon} size={15} color={colors.primary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, margin: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.md, height: 46, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },

  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  card: { position: 'relative', overflow: 'hidden', padding: spacing.md, paddingTop: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.soft },
  accent: { position: 'absolute', left: 0, right: 0, top: 0, height: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  specialty: { color: colors.primary, fontWeight: '700', fontSize: 13, marginTop: 1 },
  deptChip: { alignSelf: 'flex-start', marginTop: 5, borderRadius: radius.pill, backgroundColor: colors.navySoft, paddingHorizontal: 10, paddingVertical: 3 },
  deptChipText: { color: colors.navy, fontWeight: '800', fontSize: 11 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.warningSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText: { color: colors.warning, fontWeight: '800', fontSize: 12 },

  statGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.background },
  qualificationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: spacing.md },
  qualification: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  profileDetails: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  bio: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: spacing.md },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  profileBtn: { flex: 0.9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  profileBtnPressed: { backgroundColor: colors.surfaceAlt },
  profileBtnText: { color: colors.navy, fontWeight: '800', fontSize: 12 },
  bookBtn: { flex: 1.35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, ...shadow.brand },
  bookBtnPressed: { backgroundColor: colors.primaryDark },
  bookText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  emptyCard: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.soft },
  emptyText: { color: colors.muted, fontSize: 13 },
});
