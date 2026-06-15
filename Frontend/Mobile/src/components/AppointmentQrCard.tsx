import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { Appointment } from '@/api/types';
import { env } from '@/config/env';
import { radius, shadow, spacing } from '@/theme/colors';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';

type Props = {
  appointment: Appointment;
  title: string;
  description: string;
};

export function buildAppointmentCheckInUrl(appointment: Appointment) {
  const token = encodeURIComponent(appointment.token || '');
  const patientId = encodeURIComponent(appointment.patient_id || '');
  return `${env.webBaseUrl}/check-in?token=${token}&pid=${patientId}`;
}

export function AppointmentQrCard({ appointment, title, description }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const value = buildAppointmentCheckInUrl(appointment);

  if (!appointment.token) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.qrFrame} accessibilityLabel={`Appointment QR code for token ${appointment.token}`}>
        <QRCode
          value={value}
          size={190}
          color="#0F1E33"
          backgroundColor="#FFFFFF"
          ecl="H"
          quietZone={10}
        />
      </View>
      <Text style={styles.tokenLabel}>APPOINTMENT TOKEN</Text>
      <Text selectable style={styles.token}>#{appointment.token}</Text>
      <Text style={styles.validity}>Generated from your live appointment record</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    ...shadow.soft,
  },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, textAlign: 'center' },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.divider,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  tokenLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: spacing.md },
  token: { color: colors.primary, fontSize: 24, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  validity: { color: colors.subtle, fontSize: 10, marginTop: spacing.sm, textAlign: 'center' },
});
