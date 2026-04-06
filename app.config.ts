import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Who Owes What',
  slug: 'who-owes-what',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#f3efe4',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.codex.whooweswhat',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#f3efe4',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    output: 'single',
  },
  plugins: ['expo-router'],
  extra: {
    golfCourseApiKey:
      process.env.GOLF_COURSE_API_KEY ??
      process.env.EXPO_PUBLIC_GOLF_COURSE_API_KEY ??
      '',
  },
};

export default config;
