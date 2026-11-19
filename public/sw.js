// Service Worker for SK Tocok Transparency Program Web Push Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "SK Tocok Free Student Printing";
    const options = {
      body: data.body || "Your print ticket status has been updated.",
      icon: data.icon || "/sk-logo.jpg",
      badge: data.badge || "/favicon.ico",
      tag: data.tag || "sk-printing-status",
      renotify: true,
      data: {
        url: data.url || "/printing?tab=track",
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Error displaying push notification:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/printing?tab=track";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open on the printing page, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes("/printing") && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
