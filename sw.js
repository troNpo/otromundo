const CACHE_NAME = 'otromundo-v1';
// Archivos estáticos clave a precachar para uso offline
const ASSETS_TO_CACHE = [
'./',
'./index.html',
'./script.js',
'./nominatim-client.js',
'./manifest.json',
'./styles/osm.json',
'./styles/satelite.json'
];
// Instalación e inserción de recursos en la caché
self.addEventListener('install', (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => {
console.log('[Service Worker] Precachando archivos estáticos...');
return cache.addAll(ASSETS_TO_CACHE);
})
);
self.skipWaiting();
});
// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
event.waitUntil(
caches.keys().then((cacheNames) => {
return Promise.all(
cacheNames.map((cache) => {
if (cache !== CACHE_NAME) {
console.log('[Service Worker] Limpiando caché antigua:', cache);
return caches.delete(cache);
}
})
);
})
);
self.clients.claim();
});
// Estrategia de respuesta: Cache First con fallback a Red (Network)
self.addEventListener('fetch', (event) => {
// Ignorar peticiones no GET (como búsquedas en vivo)
if (event.request.method !== 'GET') return;
event.respondWith(
caches.match(event.request).then((cachedResponse) => {
if (cachedResponse) {
return cachedResponse;
}
return fetch(event.request).then((networkResponse) => {
if (
networkResponse &&
networkResponse.status === 200 &&
event.request.url.startsWith(self.location.origin)
) {
const responseToCache = networkResponse.clone();
caches.open(CACHE_NAME).then((cache) => {
cache.put(event.request, responseToCache);
});
}
return networkResponse;
});
})
);
});