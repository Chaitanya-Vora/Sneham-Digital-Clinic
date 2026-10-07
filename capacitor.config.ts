import type { CapacitorConfig } from '@capacitor/cli';
import fs from 'node:fs';
import path from 'node:path';

// Live updates (see src/core/liveUpdate.ts, docs/LIVE_UPDATES.md): each app
// only ever accepts web bundles signed with ITS OWN key. The public half is
// baked into the APK here; the private half lives only on the owner's Mac.
// No key for the surface being built means no live updates at all.
const surface = process.env.VITE_DEFAULT_SURFACE;
const keyFile = surface ? path.resolve(__dirname, 'ota', 'keys', `${surface}.pub.pem`) : '';
const otaPublicKey = keyFile && fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : undefined;

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
    ...(otaPublicKey
      ? {
          LiveUpdate: {
            // Updates are fetched by our own code (src/core/liveUpdate.ts), never automatically.
            autoUpdateStrategy: 'none',
            // If an update doesn't report "ready" within 10s of starting, the app
            // goes back to the built-in version and never tries that update again.
            readyTimeout: 10000,
            autoBlockRolledBackBundles: true,
            autoDeleteBundles: true,
            publicKey: otaPublicKey,
          },
        }
      : {}),
  },
  android: {
    backgroundColor: '#EFEDE4',
  },
};

export default config;
