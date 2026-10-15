const CACHE = 'em-pauta-offline-v1';
const OFFLINE = ['/offline.html', '/offline.css', '/icons/icon-192.png'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('em-pauta-offline-') && key !== CACHE).map((key) => caches.delete(key))
  )));
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (OFFLINE.includes(url.pathname) && !url.search) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(url.pathname)) || fetch(event.request)));
    return;
  }
  // Não interceptar APIs, administração nem recursos privados.
  if (event.request.mode !== 'navigate' || !['/', '/index.html', '/install.html'].includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match('/offline.html')) || Response.error();
  }));
});
