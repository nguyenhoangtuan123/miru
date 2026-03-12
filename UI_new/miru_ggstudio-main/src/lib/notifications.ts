export type MiruNotificationOptions = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

const DEFAULT_ICON = '/icons/miru-icon-192.svg';

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.requestPermission();
}

export function shouldShowSystemNotification() {
  return (
    typeof document !== 'undefined' &&
    getNotificationPermission() === 'granted' &&
    (document.visibilityState !== 'visible' || !document.hasFocus())
  );
}

export async function showMiruNotification(options: MiruNotificationOptions) {
  if (getNotificationPermission() !== 'granted') {
    return false;
  }

  const notificationOptions = {
    body: options.body,
    tag: options.tag,
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    data: {
      url: options.url ?? '/',
    },
  };

  const registration = await navigator.serviceWorker.getRegistration();
  if (registration?.showNotification) {
    await registration.showNotification(options.title, notificationOptions);
    return true;
  }

  new Notification(options.title, notificationOptions);
  return true;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function supportsPushNotifications() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export async function syncPushSubscription(publicKey: string) {
  if (!supportsPushNotifications() || !publicKey) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing.toJSON();
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  return subscription.toJSON();
}
