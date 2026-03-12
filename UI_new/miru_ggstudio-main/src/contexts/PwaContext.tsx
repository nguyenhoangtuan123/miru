import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BeforeInstallPromptEvent } from '../lib/pwa';
import { getNotificationPermission, requestNotificationPermission, syncPushSubscription } from '../lib/notifications';
import { getPushConfig, savePushSubscription } from '../services/backend';

type PwaContextValue = {
  canInstall: boolean;
  installApp: () => Promise<boolean>;
  notificationPermission: NotificationPermission;
  enableNotifications: () => Promise<NotificationPermission>;
};

const PwaContext = createContext<PwaContextValue | undefined>(undefined);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    getNotificationPermission()
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!installEvent) {
      return false;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallEvent(null);
      return true;
    }
    return false;
  }

  async function enableNotifications() {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    if (permission === 'granted' && localStorage.getItem('access_token')) {
      try {
        const config = await getPushConfig();
        if (config.enabled && config.public_key) {
          const subscription = await syncPushSubscription(config.public_key);
          if (subscription) {
            await savePushSubscription(subscription);
          }
        }
      } catch (error) {
        console.warn('Failed to sync push subscription', error);
      }
    }
    return permission;
  }

  useEffect(() => {
    if (notificationPermission !== 'granted' || !localStorage.getItem('access_token')) {
      return;
    }

    let active = true;

    const syncExistingSubscription = async () => {
      try {
        const config = await getPushConfig();
        if (!active || !config.enabled || !config.public_key) {
          return;
        }
        const subscription = await syncPushSubscription(config.public_key);
        if (!active || !subscription) {
          return;
        }
        await savePushSubscription(subscription);
      } catch (error) {
        console.warn('Failed to restore push subscription', error);
      }
    };

    void syncExistingSubscription();

    return () => {
      active = false;
    };
  }, [notificationPermission]);

  const value = useMemo(
    () => ({
      canInstall: Boolean(installEvent),
      installApp,
      notificationPermission,
      enableNotifications,
    }),
    [installEvent, notificationPermission]
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used inside PwaProvider');
  }
  return context;
}
