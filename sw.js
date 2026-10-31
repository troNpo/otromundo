const CACHE_NAME = 'otromundo-v3.1';
// Archivos estáticos clave a precachar para uso offline
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app-planner.js',
    './geocoder.js',
    './manifest.json',
    './styles/osm.json',
    './styles/ignraster.json',
    './styles/opentopomaps.json',
    './styles/esri.json',
    './ui-icons/brujula.PNG',
    './ui-icons/cen-map.svg',
    './ui-icons/fi-rr-search.svg',
    './ui-icons/fi-rr-measuring-tape.svg',
    './ui-icons/fi-rr-map.svg',
    './ui-icons/fi-rr-location-crosshairs.svg',
    './ui-icons/fi-rr-square-plus.svg',
    './ui-icons/fi-rr-square-minus.svg',
    './ui-icons/fi-rr-user-roadmap.svg',
    './ui-icons/fi-rr-menu-burger.svg',
    './ui-icons/fi-rr-trash.svg',
    './ui-icons/fi-rr-grow-graphs-box.svg',
    './ui-icons/fi-rr-list-check.svg',
    './ui-icons/fi-rr-zoom-in.svg',
    './ui-icons/fi-rr-zoom-out.svg',
    './ui-icons/fi-rr-land-layer-location.svg',
    './ui-icons/fi-rr-hand-paper.svg',
    './ui-icons/icon-192.png',
    './ui-icons/icon-512.png'
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
    // Ignorar peticiones no GET (como búsquedas en vivo de Nominatim o BRouter)
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
