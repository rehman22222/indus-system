import React from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useI18n } from '@/i18n/LanguageContext';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoCall'>;
type NativeScreen = React.ComponentType<Props>;

function NativeBuildRequired({ navigation }: Props) {
  const { t } = useI18n();

  return (
    <View style={styles.root}>
      <Ionicons name="videocam-off-outline" size={54} color="#F2616D" />
      <Text style={styles.title}>{t('call.failed')}</Text>
      <Text style={styles.message}>{t('call.nativeBuild')}</Text>
      <Pressable onPress={() => navigation.goBack()} style={styles.button}>
        <Text style={styles.buttonText}>{t('common.done')}</Text>
      </Pressable>
    </View>
  );
}

export function VideoCallScreen(props: Props) {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return <NativeBuildRequired {...props} />;
  }

  try {
    // Keep the native SDK out of Expo Go's startup path. It is available after
    // rebuilding the development/production app with react-native-agora linked.
    const { NativeVideoCallScreen } = require('./NativeVideoCallScreen') as {
      NativeVideoCallScreen: NativeScreen;
    };
    return <NativeVideoCallScreen {...props} />;
  } catch {
    return <NativeBuildRequired {...props} />;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B1220',
    padding: 28,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 18,
  },
  message: {
    color: '#9AA8BD',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  button: {
    minWidth: 140,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BE1E2D',
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
