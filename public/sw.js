const CACHE_NAME = "zentravo-pos-shell-v2";

// ONLY public static assets and the dedicated POS terminal shell
const PUBLIC_SHELL_URLS = [
  "/dashboard/pos",
  "/favicon.ico",
  "/manifest.json",
];

// Offline fallback HTML strictly for non-POS private dashboard routes
const OFFLINE_PRIVATE_ROUTE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Offline | Zentravo BMS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090d16;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1.5rem;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #131c2e;
      border: 1px solid #1e293b;
      border-radius: 1.25rem;
      padding: 2.25rem 2rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      background: rgba(245, 158, 11, 0.1);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.25);
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.35rem;
      font-weight: 800;
      margin: 0 0 0.75rem 0;
      color: #ffffff;
      letter-spacing: -0.025em;
    }
    p {
      font-size: 0.875rem;
      color: #94a3b8;
      line-height: 1.6;
      margin: 0 0 1.75rem 0;
    }
    .btn {
      display: inline-block;
      width: 100%;
      box-sizing: border-box;
      background: #6366f1;
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.875rem;
      padding: 0.75rem 1.5rem;
      border-radius: 0.75rem;
      transition: background 0.15s ease;
    }
    .btn:hover {
      background: #4f46e5;
    }
    .security-note {
      margin-top: 1.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.75rem;
      color: #64748b;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🔒 Protected Private Route</div>
    <h1>Internet Connection Required</h1>
    <p>This management view contains sensitive business financial records and cannot be served from offline cache on shared devices.</p>
    <a href="/dashboard/pos" class="btn">Open Offline POS Terminal</a>
    <div class="security-note">
      To continue creating sales during network outages, use the offline POS terminal.
    </div>
  </div>
</body>
</html>`;

// Install: pre-cache application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PUBLIC_SHELL_URLS).catch((err) => {
          console.warn("[SW] Shell assets precache warning:", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up outdated caches safely without touching IndexedDB
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch routing strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER cache authenticated financial API requests or auth routes in SW HTTP cache.
  // IndexedDB is the authoritative offline store for transactional data.
  if (url.pathname.startsWith("/api/")) {
    return; // allow browser network request as normal
  }

  // 2. Navigation requests:
  if (event.request.mode === "navigate") {
    const isPosShell =
      url.pathname === "/dashboard/pos" || url.pathname === "/dashboard/pos/";

    if (isPosShell) {
      // ONLY the POS Terminal gets Network-First with Cache Fallback
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            if (response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(async () => {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            const shell = await caches.match("/dashboard/pos");
            if (shell) return shell;
            return new Response(OFFLINE_PRIVATE_ROUTE_HTML, {
              headers: { "Content-Type": "text/html" },
            });
          })
      );
      return;
    }

    // ALL OTHER DASHBOARD & PRIVATE ROUTES:
    // Strictly Network-Only. NEVER save private HTML (e.g. accounting, settings, sales) to cache!
    // If offline, return a privacy-safe fallback message instead of leaking previous user data.
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(OFFLINE_PRIVATE_ROUTE_HTML, {
          status: 503,
          headers: { "Content-Type": "text/html" },
        });
      })
    );
    return;
  }

  // 3. Static assets (_next/static, images, fonts, icons): Stale-While-Revalidate
  // Only public bundles and static resources are cached
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2|webp)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// Listen for client messages (e.g. on logout or business switch)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_PRIVATE_CACHES") {
    // Purge any dynamic cache items, keeping only clean shell
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const requests = await cache.keys();
        for (const req of requests) {
          const reqUrl = new URL(req.url);
          // Only preserve static public assets and fresh POS shell
          if (
            !reqUrl.pathname.startsWith("/_next/static/") &&
            !PUBLIC_SHELL_URLS.includes(reqUrl.pathname)
          ) {
            await cache.delete(req);
          }
        }
      })
    );
  }
});
