import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// TEMPORARILY DISABLED for testing - Service Worker was caching old code
// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker
//     .register('/sw.js')
//     .then((registration) => {
//       console.log('Service Worker registered:', registration);
//     })
//     .catch((error) => {
//       console.error('Service Worker registration failed:', error);
//     });
// }

// Unregister any existing service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('Service Worker unregistered');
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
