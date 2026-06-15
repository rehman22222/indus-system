import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/RootNavigator';

// Lets non-screen code (e.g. the app-wide IncomingCallProvider) drive navigation.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigationAction<Name extends string, Params = undefined>(name: Name, params?: Params) {
  return {
    type: 'NAVIGATE' as const,
    payload: { name, params },
  };
}

export function navigate<Name extends keyof RootStackParamList>(
  name: Name,
  params: RootStackParamList[Name],
) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(navigationAction(name, params));
  }
}
