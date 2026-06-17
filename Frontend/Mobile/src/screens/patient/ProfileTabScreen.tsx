import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getMyProfile, type PatientProfile } from '@/api/domain';
import { listDocuments, openDocument, type MedicalDocument } from '@/api/documents';
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

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function humanSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProfileTabScreen() {
  const { user, signOut } = useAuth();
  const { t, isRtl } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const align = { textAlign: isRtl ? 'right' : 'left' } as const;
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setDocsLoading(true);
    try {
      const [prof, docs] = await Promise.all([
        getMyProfile(user.id).catch(() => null),
        listDocuments(user.id).catch(() => [] as MedicalDocument[]),
      ]);
      setProfile(prof || null);
      setDocuments(docs);
    } finally {
      setDocsLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleOpen = useCallback(async (doc: MedicalDocument) => {
    setOpeningId(doc.id);
    try {
      await openDocument(doc.id);
    } catch (e) {
      Alert.alert('Cannot open', e instanceof Error ? e.message : 'Try again');
    } finally {
      setOpeningId(null);
    }
  }, []);

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

  const reports = documents.filter((d) => d.kind === 'report');
  const prescriptions = documents.filter((d) => d.kind === 'prescription');
  const others = documents.filter((d) => d.kind !== 'report' && d.kind !== 'prescription');

  function DocItem({ doc }: { doc: MedicalDocument }) {
    const isOpening = openingId === doc.id;
    const kindColor = doc.kind === 'prescription' ? colors.navy : colors.primary;
    const kindBg = doc.kind === 'prescription' ? colors.navySoft : colors.primarySoft;
    return (
      <Pressable
        style={({ pressed }) => [styles.docItem, pressed && { opacity: 0.75 }]}
        onPress={() => handleOpen(doc)}
      >
        <View style={[styles.docKindBadge, { backgroundColor: kindBg }]}>
          <Ionicons
            name={doc.kind === 'prescription' ? 'medkit-outline' : 'document-text-outline'}
            size={16}
            color={kindColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle} numberOfLines={1}>{doc.title || doc.original_name || 'Document'}</Text>
          <Text style={styles.docMeta}>
            {[formatDate(doc.created_at), humanSize(doc.size)].filter(Boolean).join('  ·  ')}
          </Text>
        </View>
        {isOpening
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Ionicons name="open-outline" size={16} color={colors.muted} />
        }
      </Pressable>
    );
  }

  function DocSection({ title, docs }: { title: string; docs: MedicalDocument[] }) {
    if (docs.length === 0) return null;
    return (
      <>
        <Text style={[styles.docSectionLabel, align]}>{title}</Text>
        {docs.map((doc) => <DocItem key={doc.id} doc={doc} />)}
      </>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Profile card */}
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

      {/* My Documents */}
      <View style={styles.docsSection}>
        <View style={styles.docsSectionHead}>
          <Text style={styles.docsSectionTitle}>My Documents</Text>
          {docsLoading && <ActivityIndicator size="small" color={colors.primary} />}
          {!docsLoading && documents.length > 0 && (
            <Text style={styles.docsCount}>{documents.length} file{documents.length !== 1 ? 's' : ''}</Text>
          )}
        </View>

        {!docsLoading && documents.length === 0 ? (
          <View style={styles.docsEmpty}>
            <Ionicons name="folder-open-outline" size={30} color={colors.subtle} />
            <Text style={styles.docsEmptyText}>No documents yet</Text>
            <Text style={styles.docsEmptyHint}>Reports and prescriptions you upload during booking will appear here.</Text>
          </View>
        ) : (
          <>
            <DocSection title="Reports" docs={reports} />
            <DocSection title="Prescriptions" docs={prescriptions} />
            <DocSection title="Other" docs={others} />
          </>
        )}
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

  docsSection: { marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadow.soft },
  docsSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  docsSectionTitle: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  docsCount: { color: colors.muted, fontWeight: '700', fontSize: 12 },

  docsEmpty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  docsEmptyText: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  docsEmptyHint: { color: colors.subtle, fontSize: 12, textAlign: 'center' },

  docSectionLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: 6 },

  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.sm,
  },
  docKindBadge: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  docTitle: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  docMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },

  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  signOutText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
});
