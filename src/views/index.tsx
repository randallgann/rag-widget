import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Import CSS - webpack will handle it
import '../../public/css/main.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  // Temporarily commenting out StrictMode to diagnose rendering issues
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);