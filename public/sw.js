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
        // Where tapping it goes: the app at this release, or the store for older alerts.
        data: { url: payload.url || "/", releaseKey: payload.releaseKey || null },
    };
    // A newer alert for the same release replaces the older one, and still buzzes.
    if (payload.tag) {
        options.tag = payload.tag;
        options.renotify = true;
    }

    const shown = [self.registration.showNotification(title, options)];
    // The app icon's badge: how many alerts this device hasn't seen in the app.
    if (typeof payload.unseenCount === "number" && self.navigator.setAppBadge) {
        shown.push(self.navigator.setAppBadge(payload.unseenCount).catch(() => {}));
    }
    event.waitUntil(Promise.all(shown));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const { url = "/", releaseKey = null } = event.notification.data || {};
    const target = new URL(url, self.location.origin);
    const isAppUrl = target.origin === self.location.origin;

    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then(async (windowClients) => {
                const appWindow = windowClients.find(
                    (client) => new URL(client.url).origin === self.location.origin && "focus" in client,
                );
                // The app is already open: bring it forward and tell it which release to show.
                if (isAppUrl && appWindow) {
                    const focused = await appWindow.focus();
                    if (releaseKey) focused.postMessage({ type: "open-release", key: releaseKey });
                    return focused;
                }
                if (self.clients.openWindow) {
                    return self.clients.openWindow(target.href);
                }
            }),
    );
});
