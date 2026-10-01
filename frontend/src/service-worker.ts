/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

type SmartHoaPushPayload = {
  title?: string;
  body?: string;
  type?: string;
  target_path?: string;
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  let payload: SmartHoaPushPayload = {};

  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? '' };
  }

  const title = payload.title || 'SmartHOA';
  const options: NotificationOptions = {
    body: payload.body || 'You have a new SmartHOA update.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `smarthoa-${payload.type || 'update'}`,
    data: { targetPath: payload.target_path || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.targetPath || '/';
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingWindow = windows.find((client) => client.url === targetUrl);

    if (existingWindow && 'focus' in existingWindow) {
      return existingWindow.focus();
    }

    return self.clients.openWindow(targetUrl);
  })());
});
