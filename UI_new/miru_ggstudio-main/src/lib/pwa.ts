export function registerMiruServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    if (import.meta.env.DEV) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });

      if ('caches' in window) {
        void caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key.startsWith('miru-shell')) {
              void caches.delete(key);
            }
          });
        });
      }

      return;
    }

    void navigator.serviceWorker.register('/sw.js');
  });
}

export type BeforeInstallPromptEvent = Event & {
  readonly platforms?: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
