import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sneham.clinic',
  appName: 'Sneham Digital Clinic',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['meet.jit.si', '*.jit.si'],
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 800,
      launchFadeOutDuration: 300,
      backgroundColor: '#EFEDE4',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#EFEDE4',
    },
    Haptics: {},
  },
  android: {
    backgroundColor: '#EFEDE4',
  },
};

export default config;
