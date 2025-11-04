import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Service Worker registration - safe to fail in private browsing mode
if ('serviceWorker' in navigator) {
  try {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        // Service Worker might fail in private browsing, which is okay
        console.warn('Service Worker registration failed (this is normal in private browsing):', error);
      });
  } catch (error) {
    console.warn('Service Worker not available:', error);
  }
}

// Always render the app, even if service worker fails
createRoot(document.getElementById("root")!).render(<App />);
