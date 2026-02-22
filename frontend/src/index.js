import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// We create the root once and render our App component.
// StrictMode is kept to help you find potential bugs during development,
// but the App.js code I gave you is designed to handle it without double-connecting.

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);