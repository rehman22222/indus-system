import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n/LanguageContext';
import type { Lang } from '@/i18n/translations';
import { radius } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

const segments: { key: Lang; label: string }[] = [
  { key: 'en', label: 'EN' },
  { key: 'ur', label: 'اردو' },
];

export function LanguageToggle({ onDark = false }: { onDark?: boolean }) {
  const { lang, setLang } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, onDark && styles.wrapDark]}>
      {segments.map((seg) => {
        const active = lang === seg.key;
        return (
          <Pressable
            key={seg.key}
            onPress={() => setLang(seg.key)}
            style={[styles.seg, active && (onDark ? styles.segActiveDark : styles.segActive)]}
          >
            <Text
              style={[
                styles.text,
                onDark && styles.textDark,
                active && (onDark ? styles.textActiveDark : styles.textActive),
              ]}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      padding: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    wrapDark: {
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderColor: 'rgba(255,255,255,0.10)',
    },
    seg: { minWidth: 34, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderRadius: radius.pill },
    segActive: { backgroundColor: colors.primary },
    segActiveDark: { backgroundColor: '#ffffff' },
    text: { fontWeight: '800', fontSize: 10, color: colors.muted },
    textDark: { color: 'rgba(255,255,255,0.85)' },
    textActive: { color: '#ffffff' },
    textActiveDark: { color: colors.navy },
  });

export default LanguageToggle;
