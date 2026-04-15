/**
 * SISOV Market - Service Worker
 * @version 1.0.0
 */

const CACHE_NAME = 'sisov-market-v1';
const OFFLINE_URL = '/offline.html';

// Recursos a cachear (solo los que existen)
const STATIC_RESOURCES = [
  '/',
  '/marketplace.html',
  '/app-manager-market.js',
  '/styles.css',
  '/modules/cache.js',
  '/modules/core.js',
  '/modules/currency.js',
  '/modules/render-grid.js',
  '/modules/filters.js',
  '/modules/categories.js',
  '/modules/websocket.js',
  '/modules/ui-extras.js'
];

// URLs de APIs externas (no se cachean, pero se manejan)
const EXTERNAL_APIS = [
  'https://ve.dolarapi.com',
  'https://sisov-pro-react-production.up.railway.app'
];

// Instalación - cachear recursos estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Cachear recursos estáticos (los que existen)
      const cachePromises = STATIC_RESOURCES.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            console.log(`[SW] Cached: ${url}`);
          }
        } catch (error) {
          console.log(`[SW] No se pudo cachear: ${url}`);
        }
      });
      
      await Promise.all(cachePromises);
      
      // Cachear página offline
      try {
        const offlineResponse = await fetch(OFFLINE_URL);
        if (offlineResponse.ok) {
          await cache.put(OFFLINE_URL, offlineResponse);
        }
      } catch (error) {
        // Si no existe offline.html, crear una versión por defecto
        const defaultOffline = new Response(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SISOV Market - Offline</title>
            <style>
              body { font-family: system-ui; text-align: center; padding: 2rem; background: #f1f5f9; }
              .container { max-width: 400px; margin: 0 auto; background: white; border-radius: 1rem; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              h1 { color: #4f46e5; }
              button { background: #4f46e5; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; margin-top: 1rem; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>📱 SISOV Market</h1>
              <p>No tienes conexión a Internet</p>
              <p>Los productos que viste antes están disponibles en tu caché.</p>
              <button onclick="location.reload()">Reintentar</button>
            </div>
          </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
        
        await cache.put(OFFLINE_URL, defaultOffline);
      }
      
      await self.skipWaiting();
    })()
  );
});

// Activación - limpiar cachés viejos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');
  
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[SW] Eliminando caché viejo: ${key}`);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Estrategia: Network First con fallback a caché (para APIs)
// Cache First con fallback a network (para recursos estáticos)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // API de PocketBase - Network First
  if (url.hostname.includes('railway.app')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // API de tasa de cambio - Network First
  if (url.hostname.includes('dolarapi.com')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // Recursos estáticos - Cache First
  if (STATIC_RESOURCES.some(res => event.request.url.includes(res))) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  // Imágenes - Cache First con fallback a SVG por defecto
  if (event.request.destination === 'image') {
    event.respondWith(imageStrategy(event.request));
    return;
  }
  
  // HTML - Network First con fallback a offline
  if (event.request.destination === 'document') {
    event.respondWith(networkFirstWithOffline(event.request));
    return;
  }
  
  // Por defecto: Network First
  event.respondWith(networkFirst(event.request));
});

// Estrategia: Cache First
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    console.log(`[SW] Cache hit: ${request.url}`);
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log(`[SW] Error fetching: ${request.url}`);
    return new Response('Recurso no disponible', { status: 404 });
  }
}

// Estrategia: Network First
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      return response;
    }
    
    throw new Error('Response not ok');
  } catch (error) {
    console.log(`[SW] Network failed, trying cache: ${request.url}`);
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    return new Response('No hay conexión', { status: 503 });
  }
}

// Estrategia: Network First con página offline
async function networkFirstWithOffline(request) {
  try {
    const response = await fetch(request);
    if (response.ok) return response;
    throw new Error('Response not ok');
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(OFFLINE_URL);
    if (cached) return cached;
    
    return new Response(`
      <!DOCTYPE html>
      <html><body><h1>Offline</h1><p>No hay conexión</p></body></html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
}

// Estrategia para imágenes: Cache First + SVG por defecto
async function imageStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      return response;
    }
    throw new Error('Image not found');
  } catch (error) {
    // SVG por defecto (ícono de paquete)
    const defaultSvg = new Response(`
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 4h16v16H4z"/>
        <path d="M9 4v16"/>
        <path d="M15 4v16"/>
        <path d="M4 9h16"/>
        <path d="M4 15h16"/>
      </svg>
    `, { headers: { 'Content-Type': 'image/svg+xml' } });
    
    return defaultSvg;
  }
}

// Sincronización en segundo plano (para cuando vuelva internet)
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-products') {
    event.waitUntil(syncProducts());
  }
});

async function syncProducts() {
  console.log('[SW] Sincronizando productos...');
  // Aquí se puede implementar sincronización de datos pendientes
}

// Notificaciones push (opcional)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'Nuevos productos disponibles',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'SISOV Market', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});