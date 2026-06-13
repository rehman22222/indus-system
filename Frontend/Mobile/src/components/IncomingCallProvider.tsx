import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/LanguageContext';
import { connectRealtime } from '@/services/realtime';
import { declineVideoCall, openRoomUrl } from '@/services/video';
import { colors, radius, shadow, spacing } from '@/theme/colors';

type IncomingCall = {
  appointmentId: string;
  roomUrl: string;
  doctorName: string;
  token?: string;
  time?: string;
};

const RING_PATTERN = [0, 700, 500, 700, 500, 700];

/**
 * App-wide listener for an incoming video consultation. When the doctor starts
 * the call the backend emits `call:incoming` to this patient's socket; we ring
 * (vibrate) and show a full-screen Accept / Decline prompt. Accept opens the
 * private browser consultation; Decline sends an optional reason back to the doctor.
 */
export function IncomingCallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [call, setCall] = useState<IncomingCall | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!user) return undefined;

    const socket = connectRealtime();
    const onIncoming = (payload: IncomingCall) => {
      if (!payload?.appointmentId) return;
      setReason('');
      setShowReason(false);
      setCall(payload);
      Vibration.vibrate(RING_PATTERN, true);
    };

    socket.on('call:incoming', onIncoming);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('call:incoming', onIncoming);
      Vibration.cancel();
    };
  }, [user]);

  const close = () => {
    Vibration.cancel();
    setCall(null);
    setShowReason(false);
    setReason('');
  };

  const accept = async () => {
    const current = call;
    close();
    if (current?.roomUrl) {
      try {
        await openRoomUrl(current.roomUrl);
      } catch {
        /* ignore — patient can still join from their appointments */
      }
    }
  };

  const sendDecline = async () => {
    const current = call;
    const why = reason;
    close();
    if (current) {
      declineVideoCall(current.appointmentId, why).catch(() => {});
    }
  };

  return (
    <>
      {children}
      <Modal visible={!!call} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.badge}>
              <Text style={styles.badgeIcon}>📹</Text>
            </View>
            <Text style={styles.title}>{t('call.incoming')}</Text>
            <Text style={styles.doctor}>{call?.doctorName}</Text>
            <Text style={styles.sub}>{t('call.subtitle')}</Text>

            {!showReason ? (
              <View style={styles.actions}>
                <Pressable style={[styles.btn, styles.accept]} onPress={accept}>
                  <Text style={styles.acceptText}>{t('call.accept')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.decline]}
                  onPress={() => {
                    Vibration.cancel();
                    setShowReason(true);
                  }}
                >
                  <Text style={styles.declineText}>{t('call.decline')}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                <Text style={styles.reasonLabel}>{t('call.reasonTitle')}</Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder={t('call.reasonPlaceholder')}
                  placeholderTextColor={colors.subtle}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />
                <Pressable style={[styles.btn, styles.accept]} onPress={sendDecline}>
                  <Text style={styles.acceptText}>{t('call.send')}</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.ghost]} onPress={() => setShowReason(false)}>
                  <Text style={styles.ghostText}>{t('call.cancel')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,18,32,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadow.card,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badgeIcon: { fontSize: 38 },
  title: { fontSize: 14, fontWeight: '800', color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  doctor: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 6, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.muted, marginTop: 6, marginBottom: spacing.lg, textAlign: 'center' },
  actions: { width: '100%', gap: spacing.sm },
  btn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  accept: { backgroundColor: colors.success, ...shadow.soft },
  acceptText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  decline: { backgroundColor: colors.primarySoft },
  declineText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  ghost: { backgroundColor: colors.surfaceAlt },
  ghostText: { color: colors.muted, fontWeight: '700', fontSize: 15 },
  reasonLabel: { alignSelf: 'flex-start', color: colors.text, fontWeight: '700', marginBottom: 6 },
  reasonInput: {
    minHeight: 84,
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    color: colors.text,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
});

export default IncomingCallProvider;
