import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface IndusLogoProps {
  /** Height of the H monogram in px. */
  size?: number;
  /** Show the "INDUS HOSPITAL & HEALTH NETWORK" wordmark next to the H. */
  showText?: boolean;
  /** Use white text (for placing on a coloured/dark background). */
  onDark?: boolean;
}

/**
 * INDUS Hospital & Health Network logo — the red "H" monogram plus the navy
 * wordmark. Drawn with views/text so it stays crisp at any size and matches the
 * brand colours (no bitmap asset required).
 */
export function IndusLogo({ size = 44, showText = true, onDark = false }: IndusLogoProps) {
  const m = size;
  const postW = Math.round(m * 0.26);
  const crossH = Math.round(m * 0.24);
  const textColor = onDark ? '#FFFFFF' : colors.navy;

  return (
    <View style={styles.row}>
      <View style={{ width: m, height: m, marginRight: showText ? 12 : 0 }}>
        <View style={[styles.post, { width: postW, height: m, left: 0, backgroundColor: colors.primaryDark }]} />
        <View style={[styles.post, { width: postW, height: m, right: 0, backgroundColor: colors.primary }]} />
        <View style={[styles.cross, { height: crossH, top: (m - crossH) / 2, backgroundColor: colors.primary }]} />
      </View>

      {showText && (
        <View>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: textColor, fontSize: m * 0.40 }]}>INDUS HOSPITAL</Text>
            <Text style={[styles.amp, { fontSize: m * 0.40 }]}> &</Text>
          </View>
          <View style={styles.line} />
          <Text style={[styles.sub, { color: textColor, fontSize: m * 0.30 }]}>HEALTH NETWORK</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  post: { position: 'absolute', borderRadius: 3 },
  cross: { position: 'absolute', left: 0, right: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  title: { fontWeight: '800', letterSpacing: 0.5 },
  amp: { fontWeight: '800', color: colors.primary },
  line: { height: 2, alignSelf: 'stretch', backgroundColor: colors.primary, marginVertical: 3 },
  sub: { fontWeight: '700', letterSpacing: 3 },
});

export default IndusLogo;
