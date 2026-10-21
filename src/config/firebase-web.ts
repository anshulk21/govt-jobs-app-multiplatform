// Firebase settings for browser push (only used when FEATURES.webPush is true).
// Firebase console → Project settings → General → Your apps → Web app → SDK setup and configuration.
// These values are public by design (they identify the project; they are not secrets).
export const FIREBASE_WEB = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  messagingSenderId: '',
  appId: '',
  /** Project settings → Cloud Messaging → Web Push certificates → Key pair. */
  vapidKey: '',
};

/** Same Firebase JS SDK version as package.json; the service worker loads it from Google's CDN. */
export const FIREBASE_JS_VERSION = '12.19.0';
