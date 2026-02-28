import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import all CSS files directly
import './styles/variables.css';
import './styles/base.css';
import './styles/components/chat.css';
import './styles/components/calls.css';
import './styles/components/streaming.css';
import './styles/components/modals.css';
import './styles/components/panels.css';
import './styles/responsive.css';

import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (process.env.NODE_ENV === 'production') {
  serviceWorkerRegistration.register({
    onSuccess: () => console.log('✅ App is ready for offline use'),
    onUpdate: (registration) => {
      console.log('🔄 New version available. Applying update...');
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    }
  });
} else {
  serviceWorkerRegistration.unregister();
  console.log('🔥 Development mode: Hot Module Replacement enabled');
}