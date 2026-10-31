// Le Cercle de la Jungle — mode hors ligne
// Changer VERSION à chaque mise à jour du site pour que les téléphones récupèrent la nouvelle version.
const VERSION = "v2";
const APP = "cercle-app-" + VERSION;
const EXTERNE = "cercle-externe-" + VERSION;

const FICHIERS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-512.png",
  "./apple-touch-icon.png"
];

// Polices et lecteur de tableaux Excel : mis en cache dès l'installation si le réseau répond
const EXTERNES = [
  "https://fonts.googleapis.com/css2?family=Rye&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const app = await caches.open(APP);
    await app.addAll(FICHIERS);
    const ext = await caches.open(EXTERNE);
    await Promise.all(EXTERNES.map(url => ext.add(new Request(url, { mode: "cors" })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== APP && key !== EXTERNE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pages de l'appli : le réseau d'abord (pour les mises à jour), le cache si hors ligne
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(APP).then(c => c.put("./index.html", copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Fichiers de l'appli : le cache d'abord
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }

  // Polices Google et bibliothèque : le cache d'abord, puis mise en cache au passage
  if (/fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(url.hostname)) {
    event.respondWith(
      caches.open(EXTERNE).then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok || res.type === "opaque") cache.put(req, res.clone());
          return res;
        } catch (e) {
          return hit || Response.error();
        }
      })
    );
  }
});
