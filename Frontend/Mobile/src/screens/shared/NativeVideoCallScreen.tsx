import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  type IRtcEngine,
  type IRtcEngineEventHandler,
  RtcSurfaceView,
} from 'react-native-agora';

import { createVideoRoom } from '@/services/video';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useI18n } from '@/i18n/LanguageContext';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoCall'>;
type Phase = 'connecting' | 'waiting' | 'connected' | 'error';

async function ensurePermissions() {
  if (Platform.OS !== 'android') return true;
  const res = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return (
    res[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted' &&
    res[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted'
  );
}

export function NativeVideoCallScreen({ route, navigation }: Props) {
  const { appointmentId } = route.params;
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const engineRef = useRef<IRtcEngine | null>(null);
  const handlerRef = useRef<IRtcEngineEventHandler | null>(null);
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState<string>('');
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const leave = useCallback(() => {
    const engine = engineRef.current;
    if (engine) {
      try {
        engine.leaveChannel();
        if (handlerRef.current) engine.unregisterEventHandler(handlerRef.current);
        engine.release();
      } catch {
        // engine already gone
      }
    }
    engineRef.current = null;
    handlerRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const granted = await ensurePermissions();
        if (!granted) throw new Error(t('call.permError'));

        const room = await createVideoRoom(appointmentId);
        if (room.provider !== 'agora' || !room.appId || !room.channel) {
          throw new Error(t('call.notAgora'));
        }
        if (cancelled) return;

        let engine: IRtcEngine;
        try {
          engine = createAgoraRtcEngine();
        } catch {
          throw new Error(t('call.nativeBuild'));
        }
        engineRef.current = engine;
        engine.initialize({ appId: room.appId });

        const handler: IRtcEngineEventHandler = {
          onJoinChannelSuccess: () => !cancelled && setPhase((p) => (p === 'connected' ? p : 'waiting')),
          onUserJoined: (_conn, uid) => {
            if (cancelled) return;
            setRemoteUid(uid);
            setPhase('connected');
          },
          onUserOffline: (_conn, uid) => {
            if (cancelled) return;
            setRemoteUid((cur) => (cur === uid ? null : cur));
            setPhase('waiting');
          },
          onTokenPrivilegeWillExpire: async () => {
            try {
              const fresh = await createVideoRoom(appointmentId);
              if (fresh.token) engineRef.current?.renewToken(fresh.token);
            } catch {
              // token refresh failed; call may drop at expiry
            }
          },
          onError: (_code, msg) => {
            if (!cancelled) {
              setError(msg || t('call.failed'));
              setPhase('error');
            }
          },
        };
        handlerRef.current = handler;
        engine.registerEventHandler(handler);

        engine.enableVideo();
        engine.startPreview();
        engine.joinChannel(room.token || '', room.channel, room.uid ?? 0, {
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: true,
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('call.failed'));
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      leave();
    };
  }, [appointmentId, leave, t]);

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    engineRef.current?.muteLocalAudioStream(!next);
  };
  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    engineRef.current?.muteLocalVideoStream(!next);
  };
  const endCall = () => {
    leave();
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      {/* Remote (full screen) */}
      {phase === 'connected' && remoteUid != null ? (
        <RtcSurfaceView canvas={{ uid: remoteUid }} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.center}>
          {phase === 'error' ? (
            <>
              <Ionicons name="alert-circle-outline" size={40} color="#F2616D" />
              <Text style={styles.statusTitle}>{t('call.failed')}</Text>
              <Text style={styles.statusSub}>{error}</Text>
            </>
          ) : (
            <>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.statusTitle}>
                {phase === 'connecting' ? t('call.connecting') : t('call.waitingDoctor')}
              </Text>
            </>
          )}
        </View>
      )}

      {/* Local preview (PiP) */}
      {phase !== 'error' && camOn && (
        <View style={[styles.pip, { top: insets.top + 12 }]}>
          <RtcSurfaceView canvas={{ uid: 0 }} style={StyleSheet.absoluteFill} zOrderMediaOverlay />
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable onPress={toggleMic} style={[styles.ctrl, !micOn && styles.ctrlOff]}>
          <Ionicons name={micOn ? 'mic' : 'mic-off'} size={24} color="#fff" />
        </Pressable>
        <Pressable onPress={endCall} style={[styles.ctrl, styles.endCall]}>
          <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </Pressable>
        <Pressable onPress={toggleCam} style={[styles.ctrl, !camOn && styles.ctrlOff]}>
          <Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1220' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  statusTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  statusSub: { color: '#9AA8BD', fontSize: 13, textAlign: 'center' },
  pip: {
    position: 'absolute',
    right: 14,
    width: 108,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 22,
    paddingTop: 16,
  },
  ctrl: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  ctrlOff: { backgroundColor: 'rgba(242,97,109,0.35)' },
  endCall: { backgroundColor: '#BE1E2D' },
});
