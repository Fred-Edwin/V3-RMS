/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// __FIREBASE_CONFIG_JSON__ is replaced at build time by next.config.mjs
firebase.initializeApp(__FIREBASE_CONFIG_JSON__);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title ?? 'Order Ready';
  const body = payload?.notification?.body ?? 'An order is ready.';

  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    data: payload?.data ?? {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((client) => client.url.includes('/app/orders'));
      if (existing) {
        return existing.focus();
      }
      return clients.openWindow('/app/orders');
    }),
  );
});
