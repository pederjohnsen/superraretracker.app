// Minimal service worker: exists only to hold the Push subscription and
// display notifications. No offline caching is implemented.

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { body: event.data ? event.data.text() : "" };
    }

    const title = payload.title || "Super Rare Tracker";
    const options = {
        body: payload.body,
        // The logo, shown large beside the alert on Android and desktop.
        icon: "/icon-192x192.png",
        // Android's small status-bar icon: it only uses the image's transparency,
        // so this is the lettering in white on transparent, not the coloured square.
        badge: "/badge-96x96.png",
        data: { url: payload.url || "/" },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url || "/";

    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((windowClients) => {
                for (const client of windowClients) {
                    if (client.url === url && "focus" in client) {
                        return client.focus();
                    }
                }
                if (self.clients.openWindow) {
                    return self.clients.openWindow(url);
                }
            }),
    );
});
