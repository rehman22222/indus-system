import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { getPrescriptions } from '@/api/domain';
import type { Doctor, Prescription } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/LanguageContext';
import { radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

function doctorName(rx: Prescription): string {
  return typeof rx.doctor_id === 'object' ? (rx.doctor_id as Doctor).name : 'Doctor';
}

function fmtDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toDateString();
}

export function HistoryTabScreen() {
  const { user } = useAuth();
  const { t, isRtl } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const align = { textAlign: isRtl ? 'right' : 'left' } as const;

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Prescription | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setPrescriptions(await getPrescriptions({ patientId: user.id }));
    } catch {
      // keep last good data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={prescriptions}
        keyExtractor={(rx) => rx.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); void load(); }}
        ListHeaderComponent={<Text style={[styles.title, align]}>{t('history.title')}</Text>}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={32} color={colors.subtle} />
            <Text style={styles.emptyText}>{t('history.none')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelected(item)}>
            <View style={styles.iconWrap}>
              <Ionicons name="medical-outline" size={18} color={colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.diag, align]} numberOfLines={1}>{item.diagnosis || t('history.diagnosis')}</Text>
              <Text style={[styles.meta, align]}>{doctorName(item)}  ·  {fmtDate(item.created_at)}</Text>
            </View>
            <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.subtle} />
          </Pressable>
        )}
      />

      {/* Detail modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t('history.detail')}</Text>
              <Pressable hitSlop={10} onPress={() => setSelected(null)}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            {selected && (
              <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>{t('details.diagnosis')}</Text>
                  <Text style={styles.blockValue}>{selected.diagnosis || '—'}</Text>
                </View>
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>{t('details.doctor')}</Text>
                  <Text style={styles.blockValue}>{doctorName(selected)}</Text>
                </View>
                <View style={styles.block}>
                  <Text style={styles.blockLabel}>{t('details.date')}</Text>
                  <Text style={styles.blockValue}>{fmtDate(selected.created_at)}</Text>
                </View>
                {selected.medications?.length > 0 && (
                  <View style={styles.block}>
                    <Text style={styles.blockLabel}>{t('details.medicines')}</Text>
                    {selected.medications.map((m, i) => (
                      <View key={`${m.name}-${i}`} style={styles.medRow}>
                        <View style={styles.medNum}><Text style={styles.medNumText}>{i + 1}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.medName}>{m.name}</Text>
                          <Text style={styles.medMeta}>{[m.dosage, m.frequency, m.duration].filter(Boolean).join('  |  ') || t('details.followInstr')}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                {!!selected.instructions && (
                  <View style={styles.block}>
                    <Text style={styles.blockLabel}>{t('details.instructions')}</Text>
                    <Text style={styles.blockValue}>{selected.instructions}</Text>
                  </View>
                )}
                {!!selected.follow_up_date && (
                  <View style={styles.followUp}>
                    <Text style={styles.followUpText}>{t('details.followUp')}: {fmtDate(selected.follow_up_date)}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  listContent: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: spacing.md },

  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.sm, ...shadow.soft },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.navySoft, alignItems: 'center', justifyContent: 'center' },
  diag: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },

  emptyCard: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, marginTop: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.soft },
  emptyText: { color: colors.muted, fontSize: 13 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,30,51,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '85%' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },

  block: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  blockLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  blockValue: { color: colors.text, fontSize: 14, marginTop: 4, lineHeight: 20 },

  medRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'flex-start' },
  medNum: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  medNumText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  medName: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  medMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },

  followUp: { backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md },
  followUpText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
});
