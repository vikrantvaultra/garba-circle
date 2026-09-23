/*
 * Garba Circle service worker: message notifications, nothing else. It has
 * no fetch handler on purpose, so pages load exactly as they would without it.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Safari revokes push for sites that receive pushes without showing a
// notification, so there a notification is always shown.
const IS_WEBKIT = /AppleWebKit/.test(self.navigator.userAgent) && !/Chrome|Chromium|Android/.test(self.navigator.userAgent);

async function windows() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true });
}

self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  if (!data || data.type !== "message") return;

  event.waitUntil(
    (async () => {
      const open = await windows();
      const visible = open.filter((c) => c.visibilityState === "visible");
      const reading = visible.some((c) => new URL(c.url).pathname === data.url);

      // Someone reading this very chat already sees the message arrive.
      const show = !reading || IS_WEBKIT;

      // Open windows refresh at once instead of waiting for their next poll.
      for (const client of open) {
        client.postMessage({ type: "gc-message", matchId: data.matchId, messageId: data.messageId, shown: show });
      }
      if (!show) return;

      // Several messages from one person become one notification with a count.
      const earlier = await self.registration.getNotifications({ tag: data.tag });
      const count = (earlier[0]?.data?.count ?? 0) + 1;
      await self.registration.showNotification(count > 1 ? `${data.title} (${count})` : data.title, {
        body: data.body,
        tag: data.tag,
        renotify: true,
        icon: data.icon || "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        data: { url: data.url, matchId: data.matchId, count },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/matches";
  event.waitUntil(
    (async () => {
      const open = await windows();
      const client = open.find((c) => c.visibilityState === "visible") || open[0];
      if (client) {
        // The page moves itself with a client-side navigation: no reload.
        await client.focus();
        client.postMessage({ type: "gc-open", url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// The push service rotated this browser's address: register the new one.
self.addEventListener("pushsubscriptionchange", (event) => {
  const options = event.oldSubscription?.options;
  if (!options) return;
  event.waitUntil(
    self.registration.pushManager.subscribe(options).then((sub) =>
      fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      }),
    ),
  );
});
