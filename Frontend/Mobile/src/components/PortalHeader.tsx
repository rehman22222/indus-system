import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { IndusLogo } from '@/components/IndusLogo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/i18n/LanguageContext';
import { initials, radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

type Props = {
  variant?: 'full' | 'compact';
  title?: string;
};

/**
 * Shared navy INDUS-branded header so the patient app reads as the same
 * organisation/system as the doctor portal (logo + portal label + welcome).
 */
export function PortalHeader({ variant = 'compact', title }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={[styles.hero, variant === 'compact' && styles.heroCompact]}>
        <View style={styles.brandRow}>
          <IndusLogo size={18} onDark />
          <View style={styles.controlCluster}>
            <LanguageToggle onDark />
            <DarkModeToggle onDark />
          </View>
        </View>

        {variant === 'compact' ? (
          <Text style={styles.compactTitle} numberOfLines={1}>{title}</Text>
        ) : (
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user?.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.portalLabel}>{t('portal.patient')}</Text>
              <Text style={styles.welcome}>{t('dash.welcome')}</Text>
              <Text style={styles.name} numberOfLines={1}>{user?.name || 'Patient'}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    hero: { backgroundColor: colors.navy, borderRadius: radius.xl, padding: spacing.lg, ...shadow.card },
    heroCompact: { borderRadius: radius.lg, paddingVertical: spacing.md },

    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    portalLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
    compactTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: spacing.md },
    controlCluster: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 3, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.08)' },

    identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
    avatar: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    welcome: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700' },
    name: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  });
