import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n/LanguageContext';
import type { Lang } from '@/i18n/translations';
import { colors, radius } from '@/theme/colors';

const segments: { key: Lang; label: string }[] = [
  { key: 'en', label: 'EN' },
  { key: 'ur', label: 'اردو' },
];

export function LanguageToggle({ onDark = false }: { onDark?: boolean }) {
  const { lang, setLang } = useI18n();

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

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wrapDark: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'transparent',
  },
  seg: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  segActive: { backgroundColor: colors.primary },
  segActiveDark: { backgroundColor: '#ffffff' },
  text: { fontWeight: '800', fontSize: 13, color: colors.muted },
  textDark: { color: 'rgba(255,255,255,0.85)' },
  textActive: { color: '#ffffff' },
  textActiveDark: { color: colors.navy },
});

export default LanguageToggle;
