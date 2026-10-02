import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.southwynd.smarthoa',
  appName: 'SmartHOA',
  webDir: 'dist',
  // The local Android emulator reaches the PHP development server through
  // 10.0.2.2. Loading the bundled app over HTTP prevents WebView from
  // blocking that local HTTP request as mixed content.
  server: {
    androidScheme: 'http'
  },
  plugins: {
    PushNotifications: {
      // Android needs this to display an incoming FCM notification while the
      // SmartHOA app is currently open, not only after it is backgrounded.
      presentationOptions: ['sound', 'alert', 'banner', 'list']
    }
  }
};

export default config;
