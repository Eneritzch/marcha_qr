const CACHE_NAME = 'marcha-unemi-v11';
const STATIC_ASSETS = [
    '/login/',
    '/dashboard/',
    '/static/js/dashboard.js?v=2.1',
    '/static/js/dashboard-charts.js?v=1.8',
    '/static/js/dashboard-scanner.js?v=1.8',
    '/static/img/icono.svg',
    '/static/img/icono.webp',
    '/static/img/icono-orange.png',
    '/static/img/pwa-icon.png',
    '/static/img/TIGRILLO_LOAD_3.gif',
    '/static/img/unemi.webp',
    '/static/img/hero1.webp',
    '/static/img/hero2.webp',
    '/static/js/academic_data.js',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/lucide@0.474.0/dist/umd/lucide.min.js',
    'https://cdn.jsdelivr.net/npm/axios@1.7.9/dist/axios.min.js',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11.15.10/dist/sweetalert2.all.min.js',
    'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/apexcharts@4.3.0/dist/apexcharts.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap'
];

// Install Event - Cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests and API calls
    if (event.request.method !== 'GET' || event.request.url.includes('/api/v1/')) {
        return;
    }

    // Special handling for fonts and external CDN (Cache First)
    const isExternal = event.request.url.includes('fonts.googleapis.com') ||
        event.request.url.includes('fonts.gstatic.com');

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse && isExternal) return cachedResponse;

            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Return cached response if network fails
                return cachedResponse;
            });

            return cachedResponse || fetchPromise;
        })
    );
});
