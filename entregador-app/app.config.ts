import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidGoogleMapsApiKey = process.env.ANDROID_GOOGLE_MAPS_API_KEY?.trim();
  if (process.env.EAS_BUILD_PLATFORM === 'android' && !androidGoogleMapsApiKey) {
    throw new Error('Configure ANDROID_GOOGLE_MAPS_API_KEY no ambiente EAS antes de gerar o APK.');
  }
  return {
    ...config,
    name: config.name!,
    slug: config.slug!,
    plugins: [
      ...(config.plugins || []),
      ['react-native-maps', androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}],
    ],
    extra: {
      ...config.extra,
      androidMapsConfigured: Boolean(androidGoogleMapsApiKey),
    },
  };
};
