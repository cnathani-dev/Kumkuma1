import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("index.tsx: Module loaded successfully.");

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("index.tsx: FATAL: Could not find root element to mount to. The page will be blank.");
    throw new Error("Could not find root element to mount to");
  }
  console.log("index.tsx: Found root element:", rootElement);

  const root = ReactDOM.createRoot(rootElement);
  console.log("index.tsx: React root created. Rendering App component...");
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("index.tsx: App component render command issued.");
} catch (error) {
  console.error("index.tsx: An error occurred during the initial React render setup:", error);
}
