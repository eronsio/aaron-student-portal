// Service worker for practice reminders (Web Push) ONLY.
// It has no fetch handler and caches nothing, so it can never serve a stale page or script: the portal loads exactly as it did before.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let d = {};
    try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
    event.waitUntil(self.registration.showNotification(d.title || 'Aaron Learning', {
        body: d.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: d.tag || 'practice',
        data: { url: d.url || '/?open=practice' }
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil((async () => {
        const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of open) {
            try { await c.focus(); if ('navigate' in c) await c.navigate(url); return; } catch (e) { /* try the next window, or open a new one */ }
        }
        await self.clients.openWindow(url);
    })());
});
