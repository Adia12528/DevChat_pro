import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// We create the root once and render our App component.
// StrictMode is kept to help you find potential bugs during development,
// but the App.js code I gave you is designed to handle it without double-connecting.

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker only in production for instant dev updates
if (process.env.NODE_ENV === 'production') {
  serviceWorkerRegistration.register({
    onSuccess: () => console.log('✅ App is ready for offline use'),
    onUpdate: (registration) => {
      console.log('🔄 New version available. Please refresh.');
      if (window.confirm('New version available! Reload to update?')) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }
  });
} else {
  // Unregister service worker in development for hot reloading
  serviceWorkerRegistration.unregister();
  console.log('🔥 Development mode: Hot Module Replacement enabled');
}