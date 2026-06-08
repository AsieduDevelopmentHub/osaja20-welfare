/* OSAJA'20 Admin service worker — offline fallback */

const CACHE_VERSION = "osaja-admin-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.json",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/brand/batch-logo.jpg",
];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#061d47" />
  <title>Offline — OSAJA'20 Admin</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#061d47;color:#fff;padding:1.5rem;text-align:center}
    h1{font-size:1.5rem;margin-bottom:.5rem}
    p{color:#cbd5e1;max-width:24rem;line-height:1.5}
    button{margin-top:1.5rem;background:#c9a227;color:#061d47;border:none;border-radius:.75rem;padding:.75rem 1.25rem;font-size:1rem;font-weight:600;cursor:pointer}
  </style>
</head>
<body>
  <main>
    <h1>You're offline</h1>
    <p>Reconnect to manage members, welfare claims, and announcements.</p>
    <button type="button" onclick="location.reload()">Try again</button>
  </main>
</body>
</html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function precacheStatic() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
  if (!(await cache.match("/offline.html"))) {
    await cache.put("/offline.html", offlineResponse());
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheStatic().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("osaja-admin-") && k !== STATIC_CACHE && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => precacheStatic())
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/_next/static/") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".woff2")
  );
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ success: false, message: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match("/offline.html")) || offlineResponse();
  }
}

async function offlinePage() {
  return (await caches.match("/offline.html")) || offlineResponse();
}

async function networkFirstShell(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlinePage();
  }
}
