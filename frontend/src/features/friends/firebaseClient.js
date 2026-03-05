import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: (process.env.REACT_APP_FIREBASE_API_KEY || '').trim(),
  authDomain: (process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (process.env.REACT_APP_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (process.env.REACT_APP_FIREBASE_APP_ID || '').trim(),
  measurementId: (process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || '').trim()
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
