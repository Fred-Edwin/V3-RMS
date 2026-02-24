/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD0yql92PxxhUrdXhWXM8RtqxcEzNB9lyM',
  projectId: 'v3-rms',
  messagingSenderId: '204805554525',
  appId: '1:204805554525:web:296a60399953a7fefb68b4',
});

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
