import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Temporarily disabled to clear cached RingCentral phone code
// TODO: Re-enable with versioning strategy after phone is working
/*
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('Service Worker registered:', registration);
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}
*/

// Unregister any existing service workers to clear cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log('Service Worker unregistered');
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
