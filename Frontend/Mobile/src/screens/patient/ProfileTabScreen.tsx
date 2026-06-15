import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getMyProfile, type PatientProfile } from '@/api/domain';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/LanguageContext';
import { initials, radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

function ageFromDob(dob?: string): string {
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1;
  return String(years);
}

function titleCase(value?: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function ProfileTabScreen() {
  const { user, signOut } = useAuth();
  const { t, isRtl } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const align = { textAlign: isRtl ? 'right' : 'left' } as const;
  const [profile, setProfile] = useState<PatientProfile | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setProfile((await getMyProfile(user.id)) || null);
    } catch {
      // fall back to the auth user fields below
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const name = profile?.full_name || profile?.name || user?.name || 'Patient';
  const patientId = profile?.indus_id || profile?.patient_id || '';
  const age = ageFromDob(profile?.date_of_birth);
  const gender = titleCase(profile?.gender);
  const ageGender = [age, gender].filter(Boolean).join(' · ') || t('profile.notProvided');

  const rows = [
    { icon: 'call-outline' as const, label: t('profile.phone'), value: profile?.phone || t('profile.notProvided') },
    { icon: 'mail-outline' as const, label: t('profile.email'), value: profile?.email || user?.email || t('profile.notProvided') },
    { icon: 'person-outline' as const, label: t('profile.ageGender'), value: ageGender },
    ...(profile?.blood_group ? [{ icon: 'water-outline' as const, label: t('profile.bloodGroup'), value: profile.blood_group }] : []),
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.idRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(name)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, align]} numberOfLines={1}>{name}</Text>
            {!!patientId && <Text style={[styles.pid, align]}>{patientId}</Text>}
          </View>
        </View>

        <View style={styles.rows}>
          {rows.map((r) => (
            <View key={r.label} style={styles.infoRow}>
              <Ionicons name={r.icon} size={18} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, align]}>{r.label}</Text>
                <Text style={[styles.infoValue, align]} numberOfLines={1}>{r.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Pressable style={styles.signOut} onPress={signOut}>
        <Ionicons name="log-out-outline" size={18} color={colors.primary} />
        <Text style={styles.signOutText}>{t('home.signOut')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800' },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow.soft },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 20 },
  name: { color: colors.ink, fontWeight: '800', fontSize: 18 },
  pid: { color: colors.muted, fontSize: 13, marginTop: 2 },

  rows: { marginTop: spacing.lg, gap: spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  infoLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  infoValue: { color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 2 },

  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  signOutText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
});
