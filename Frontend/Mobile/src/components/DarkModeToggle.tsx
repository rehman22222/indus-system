import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme/ThemeContext';

/**
 * Compact light/dark switch. `onDark` styles it for placement on the navy
 * portal header; default styling suits light surfaces.
 */
export function DarkModeToggle({ onDark = false }: { onDark?: boolean }) {
  const { isDark, toggle } = useTheme();
  const tint = onDark ? '#FFFFFF' : '#1B365D';

  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      style={[styles.btn, onDark ? styles.btnDark : styles.btnLight]}
    >
      <Ionicons name={isDark ? 'sunny' : 'moon'} size={15} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnDark: { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.10)' },
  btnLight: { backgroundColor: 'rgba(27,54,93,0.08)', borderColor: 'rgba(27,54,93,0.10)' },
});
