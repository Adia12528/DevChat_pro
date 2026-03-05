import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const defaultFirebaseConfig = {
  apiKey: 'AIzaSyAK42fw9slYh0-uiBeGAxp8apHlASbCkDY',
  authDomain: 'devchat-pro.firebaseapp.com',
  projectId: 'devchat-pro',
  storageBucket: 'devchat-pro.firebasestorage.app',
  messagingSenderId: '945015911168',
  appId: '1:945015911168:web:e1adfc31782f29dec679e5',
  measurementId: 'G-9XGLT70MY4'
};

const runtimeFirebaseConfig =
  typeof window !== 'undefined'
    ? (window.__DEVCHAT_FIREBASE_CONFIG__ || window.FIREBASE_CONFIG || null)
    : null;

const pickValue = (...values) =>
  values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() || '';

const firebaseConfig = {
  apiKey: pickValue(runtimeFirebaseConfig?.apiKey, process.env.REACT_APP_FIREBASE_API_KEY, defaultFirebaseConfig.apiKey),
  authDomain: pickValue(runtimeFirebaseConfig?.authDomain, process.env.REACT_APP_FIREBASE_AUTH_DOMAIN, defaultFirebaseConfig.authDomain),
  projectId: pickValue(runtimeFirebaseConfig?.projectId, process.env.REACT_APP_FIREBASE_PROJECT_ID, defaultFirebaseConfig.projectId),
  storageBucket: pickValue(runtimeFirebaseConfig?.storageBucket, process.env.REACT_APP_FIREBASE_STORAGE_BUCKET, defaultFirebaseConfig.storageBucket),
  messagingSenderId: pickValue(runtimeFirebaseConfig?.messagingSenderId, process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID, defaultFirebaseConfig.messagingSenderId),
  appId: pickValue(runtimeFirebaseConfig?.appId, process.env.REACT_APP_FIREBASE_APP_ID, defaultFirebaseConfig.appId),
  measurementId: pickValue(runtimeFirebaseConfig?.measurementId, process.env.REACT_APP_FIREBASE_MEASUREMENT_ID, defaultFirebaseConfig.measurementId)
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

if (!isFirebaseConfigured && process.env.NODE_ENV !== 'production') {
  const missing = [];
  if (!firebaseConfig.apiKey) missing.push('REACT_APP_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) missing.push('REACT_APP_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) missing.push('REACT_APP_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.appId) missing.push('REACT_APP_FIREBASE_APP_ID');
  console.warn(`[Friends] Firebase config missing keys: ${missing.join(', ')}`);
}

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

export const friendsAuth = app ? getAuth(app) : null;

export let friendsAnalytics = null;

if (app && typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        friendsAnalytics = getAnalytics(app);
      }
    })
    .catch(() => {
      // Analytics is optional for friends feature; ignore unsupported environments.
    });
}
