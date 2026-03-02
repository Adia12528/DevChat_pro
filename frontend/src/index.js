import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SettingsProvider } from './context/settingsContext';

// Import all CSS files directly
import './styles/variables.css';
import './styles/base.css';
// CORRECT CSS IMPORTS
import './styles/index.css';
import './styles/components/calls.css';
import './styles/components/chat.css';
import './styles/components/modals.css';
import './styles/components/panels.css';
import './styles/components/streaming.css';  // This combines with your streamStyles.css
import './styles/responsive.css';

// Service worker for PWA
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>
);

// Register service worker only in production
if (process.env.NODE_ENV === 'production') {
  serviceWorkerRegistration.register({
    onSuccess: () => console.log('✅ App is ready for offline use'),
    onUpdate: (registration) => {
      console.log('🔄 New version available. Applying update...');
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    }
  });
} else {
  // Unregister service worker in development for hot reloading
  serviceWorkerRegistration.unregister();
  console.log('🔥 Development mode: Hot Module Replacement enabled');
}

// Optional: Log when the app is fully loaded
window.addEventListener('load', () => {
  console.log('✅ App fully loaded');
  
  // Check if service worker is supported
  if ('serviceWorker' in navigator) {
    console.log('📱 PWA supported - Service Worker available');
  } else {
    console.log('📱 PWA not supported - Service Worker unavailable');
  }
});

// Handle any unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection:', event.reason);
});

// Handle any runtime errors
window.addEventListener('error', (event) => {
  console.error('❌ Runtime error:', event.error);
});