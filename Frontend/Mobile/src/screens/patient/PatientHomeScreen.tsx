import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getAppointments } from '@/api/domain';
import type { Appointment } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { IndusLogo } from '@/components/IndusLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/i18n/LanguageContext';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { openVideoConsultation } from '@/services/video';
import { colors, initials, radius, shadow, spacing } from '@/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'PatientHome'>;

function statusColors(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'completed') return { bg: colors.successSoft, fg: colors.success };
  if (s === 'in_consultation' || s === 'in-progress') return { bg: colors.navySoft, fg: colors.navy };
  if (s === 'cancelled' || s === 'no_show' || s === 'no-show') return { bg: '#F1F3F5', fg: colors.muted };
  return { bg: colors.primarySoft, fg: colors.primary };
}

function normalizeStatusKey(status: string) {
  return (status || '').toLowerCase().replace(/[-\s]/g, '_');
}

export function PatientHomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { t, isRtl } = useI18n();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const align = { textAlign: isRtl ? 'right' : 'left' } as const;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setRefreshing(true);
      const data = await getAppointments({ patient_id: user.id, sort: '-date,-time', limit: '20' });
      setAppointments(data);
    } catch (error) {
      Alert.alert(t('home.loadError'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setRefreshing(false);
    }
  }, [user, t]);

  // Refetch every time Home regains focus (e.g. after booking), so a newly
  // booked appointment shows up immediately.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <IndusLogo size={20} onDark />
          <LanguageToggle onDark />
        </View>
        <View style={styles.heroRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(user?.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>{t('home.welcome')}</Text>
            <Text style={styles.heroName} numberOfLines={1}>{user?.name || 'Patient'}</Text>
          </View>
          <Pressable onPress={signOut} style={styles.signOut} hitSlop={8}>
            <Text style={styles.signOutText}>{t('home.signOut')}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => navigation.navigate('BookAppointment')}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <View style={styles.ctaIcon}>
          <Text style={styles.ctaIconText}>+</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ctaTitle, align]}>{t('home.bookTitle')}</Text>
          <Text style={[styles.ctaSub, align]}>{t('home.bookSub')}</Text>
        </View>
        <Text style={styles.ctaChevron}>{isRtl ? '‹' : '›'}</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, align]}>{t('home.yourAppointments')}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t('home.emptyTitle')}</Text>
            <Text style={styles.emptySub}>{t('home.emptySub')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = statusColors(item.status);
          const isVideo = item.appointment_type === 'video';
          const canJoinVideo =
            isVideo && ['confirmed', 'waiting', 'in_consultation', 'scheduled'].includes(item.status);
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  <View style={[styles.typeChip, isVideo ? styles.typeVideo : styles.typePhysical]}>
                    <Text style={[styles.typeChipText, { color: isVideo ? colors.navy : colors.primary }]}>
                      {isVideo ? t('common.video') : t('common.inPerson')}
                    </Text>
                  </View>
                  {item.visit_type === 'follow_up' && (
                    <View style={styles.visitChip}>
                      <Text style={styles.visitChipText}>{t('book.followUp')}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                  <Text style={[styles.statusText, { color: st.fg }]}>
                    {t(`status.${normalizeStatusKey(item.status)}`, item.status)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.cardTitle, align]}>{item.doctor?.name || 'Doctor'}</Text>
              <Text style={[styles.cardMuted, align]}>{item.doctor?.specialty || ''}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  {item.appointment_date || item.date}  ·  {item.appointment_time || item.time}
                </Text>
                <Text style={styles.token}>#{item.token}</Text>
              </View>

              {canJoinVideo && (
                <Pressable
                  onPress={async () => {
                    try {
                      await openVideoConsultation(item.id);
                    } catch (error) {
                      Alert.alert(t('book.joinError'), error instanceof Error ? error.message : t('common.tryAgain'));
                    }
                  }}
                  style={({ pressed }) => [styles.joinButton, pressed && styles.joinButtonPressed]}
                >
                  <Text style={styles.joinText}>{t('home.joinVideo')}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => navigation.navigate('AppointmentDetails', { appointmentId: item.id })}
                style={({ pressed }) => [styles.detailsButton, pressed && styles.detailsButtonPressed]}
              >
                <Text style={styles.detailsText}>{t('home.viewDetails')}</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },

  hero: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, ...shadow.brand },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 12 },
  heroName: { color: '#fff', fontWeight: '800', fontSize: 22, marginTop: 2 },
  signOut: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.16)' },
  signOutText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  ctaPressed: { backgroundColor: colors.surfaceAlt },
  ctaIcon: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  ctaIconText: { color: colors.primary, fontSize: 26, fontWeight: '800', marginTop: -2 },
  ctaTitle: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  ctaSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  ctaChevron: { color: colors.subtle, fontSize: 26, fontWeight: '700' },

  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm, fontSize: 17, fontWeight: '800', color: colors.ink },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm, ...shadow.soft },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeChip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  visitChip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.navy },
  visitChipText: { fontWeight: '800', fontSize: 11, color: '#fff' },
  typeVideo: { backgroundColor: colors.navySoft },
  typePhysical: { backgroundColor: colors.primarySoft },
  typeChipText: { fontWeight: '800', fontSize: 11 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontWeight: '800', fontSize: 11 },

  cardTitle: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  cardMuted: { color: colors.muted, marginTop: 2, fontSize: 13 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  metaText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  token: { color: colors.subtle, fontWeight: '700', fontSize: 12 },

  joinButton: { marginTop: spacing.md, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, ...shadow.brand },
  joinButtonPressed: { backgroundColor: colors.primaryDark },
  joinText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  detailsButton: { marginTop: spacing.sm, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  detailsButtonPressed: { backgroundColor: colors.surfaceAlt },
  detailsText: { color: colors.navy, fontWeight: '800', fontSize: 13 },

  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginTop: spacing.sm, ...shadow.soft },
  emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  emptySub: { color: colors.muted, marginTop: 6, textAlign: 'center' },
});
