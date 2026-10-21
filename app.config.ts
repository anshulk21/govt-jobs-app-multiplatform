// Expo reads app.json first, then this file. Firebase (push notifications) is switched on
// automatically once you add the files from your Firebase project to the repo root:
//   google-services.json       (Android)
//   GoogleService-Info.plist   (iOS)
// Until then the app builds and runs without remote push (local reminders still work).
import fs from 'node:fs';
import path from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { MONETIZATION } from './src/config/monetization.ts';

const ANDROID_FILE = './google-services.json';
const IOS_FILE = './GoogleService-Info.plist';
const exists = (f: string) => fs.existsSync(path.join(__dirname, f));

export default ({ config }: ConfigContext): ExpoConfig => {
  const android = exists(ANDROID_FILE);
  const ios = exists(IOS_FILE);
  const firebase: ExpoConfig['plugins'] =
    android || ios
      ? [
          '@react-native-firebase/app',
          '@react-native-firebase/messaging',
          // React Native Firebase v27 uses Swift Package Manager on iOS, which needs dynamic frameworks.
          ['expo-build-properties', { ios: { useFrameworks: 'dynamic' } }],
        ]
      : [];
  // Ads (AdMob) are built in once you add your AdMob app IDs in src/config/monetization.ts.
  const { androidAppId, iosAppId } = MONETIZATION.ads.admob;
  const ads: ExpoConfig['plugins'] =
    MONETIZATION.ads.enabled && (androidAppId || iosAppId)
      ? [
          [
            'react-native-google-mobile-ads',
            {
              androidAppId,
              iosAppId,
              delayAppMeasurementInit: true,
              userTrackingUsageDescription: 'This lets us show ads that are more relevant to you. The app works the same either way.',
            },
          ],
        ]
      : [];
  return {
    ...(config as ExpoConfig),
    android: { ...config.android, ...(android ? { googleServicesFile: ANDROID_FILE } : {}) },
    ios: { ...config.ios, ...(ios ? { googleServicesFile: IOS_FILE } : {}) },
    plugins: [...(config.plugins ?? []), ...firebase, ...ads],
  };
};
