/**
 * @file sw.js
 * @description Service Worker Profesional para SISOV Market
 * @version 3.0.0
 * 
 * Características:
 * - Activación inmediata con skipWaiting()
 * - Actualización automática al detectar cambios
 * - Notificación al usuario de nuevas versiones
 * - Estrategias de caché optimizadas
 * - Manejo offline con página personalizada
 * - Comunicación bidireccional con el cliente
 * - Limpieza automática de cachés antiguos
 */

const APP_VERSION = 'v3.0.0';
const CACHE_NAME = `sisov-market-${APP_VERSION}`;
const RUNTIME_CACHE = `sisov-market-runtime-${APP_VERSION}`;
const OFFLINE_URL = '/offline.html';

// ======================================================
// RECURSOS A PRECACHEAR
// ======================================================
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/marketplace.html',
    '/offline.html',
    '/styles.css',
    '/manifest.json',
    '/app-manager-market.js',
    '/modules/cache.js',
    '/modules/core.js',
    '/modules/currency.js',
    '/modules/render-grid.js',
    '/modules/filters.js',
    '/modules/categories.js',
    '/modules/ui-extras.js',
    '/modules/websocket.js'
];

// URLs que NO deben ser cacheadas bajo ninguna circunstancia
const NO_CACHE_URLS = [
    'railway.app',
    'dolarapi.com',
    've.dolarapi.com',
    'sisov-pro-react-production.up.railway.app',
    'cdn.tailwindcss.com',
    'unpkg.com',
    'jsdelivr.net',
    'google-analytics.com',
    'googletagmanager.com'
];

// ======================================================
// INSTALACIÓN
// ======================================================
self.addEventListener('install', (event) => {
    console.log(`[SW] 📦 Instalando versión ${APP_VERSION}...`);
    
    // Activar inmediatamente sin esperar a que el cliente recargue
    self.skipWaiting();
    
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                console.log('[SW] 📥 Precachead recursos...');
                
                // Usar Promise.allSettled para que un fallo no detenga todo
                const results = await Promise.allSettled(
                    PRECACHE_URLS.map(async (url) => {
                        try {
                            const response = await fetch(url);
                            if (response.ok) {
                                await cache.put(url, response);
                                console.log(`[SW] ✅ Cacheado: ${url}`);
                            } else {
                                console.warn(`[SW] ⚠️ Respuesta no ok: ${url} (${response.status})`);
                            }
                        } catch (err) {
                            console.warn(`[SW] ⚠️ No se pudo cachear: ${url}`, err.message);
                        }
                    })
                );
                
                const succeeded = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;
                console.log(`[SW] 📊 Precaché completado: ${succeeded} ok, ${failed} fallos`);
                
            } catch (error) {
                console.error('[SW] ❌ Error crítico en instalación:', error);
            }
        })()
    );
});

// ======================================================
// ACTIVACIÓN - LIMPIEZA Y NOTIFICACIÓN
// ======================================================
self.addEventListener('activate', (event) => {
    console.log(`[SW] 🔄 Activando versión ${APP_VERSION}...`);
    
    event.waitUntil(
        (async () => {
            // 1. Limpiar cachés antiguos
            const cacheKeys = await caches.keys();
            const cachesToDelete = cacheKeys.filter(key => 
                key !== CACHE_NAME && key !== RUNTIME_CACHE
            );
            
            await Promise.all(
                cachesToDelete.map(async (key) => {
                    console.log(`[SW] 🗑️ Eliminando caché antiguo: ${key}`);
                    await caches.delete(key);
                })
            );
            
            // 2. Notificar a todos los clientes que hay una nueva versión
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_UPDATED',
                    version: APP_VERSION,
                    timestamp: Date.now()
                });
            });
            
            console.log(`[SW] 📢 Notificada actualización a ${clients.length} cliente(s)`);
            
            // 3. Tomar control de todos los clientes
            await self.clients.claim();
            console.log('[SW] ✅ Control de clientes adquirido');
        })()
    );
});

// ======================================================
// FETCH - ESTRATEGIAS DE CACHÉ
// ======================================================
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Solo manejar peticiones GET
    if (request.method !== 'GET') return;
    
    // ======================================================
    // 1. EXCEPCIONES - NUNCA CACHEAR
    // ======================================================
    if (NO_CACHE_URLS.some(pattern => url.href.includes(pattern))) {
        // Pasar directamente a la red sin intervención
        return;
    }
    
    // ======================================================
    // 2. NAVEGACIÓN HTML - NETWORK FIRST CON FALLBACK OFFLINE
    // ======================================================
    if (request.mode === 'navigate' || 
        request.headers.get('accept')?.includes('text/html')) {
        
        event.respondWith(
            (async () => {
                try {
                    // Intentar obtener de la red primero
                    const networkResponse = await fetch(request);
                    
                    if (networkResponse && networkResponse.ok) {
                        // Guardar en caché para futuros offline
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    }
                    throw new Error('Respuesta no ok');
                    
                } catch (error) {
                    console.log(`[SW] 🌐 Offline, sirviendo página offline para: ${url.pathname}`);
                    
                    // Buscar en caché o mostrar página offline
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) return cachedResponse;
                    
                    const offlineResponse = await caches.match(OFFLINE_URL);
                    return offlineResponse || new Response(
                        '<!DOCTYPE html><html><head><title>Offline</title><meta charset="UTF-8"></head><body><h1>📱 SISOV Market</h1><p>Sin conexión a Internet</p><button onclick="location.reload()">Reintentar</button></body></html>',
                        { headers: { 'Content-Type': 'text/html' } }
                    );
                }
            })()
        );
        return;
    }
    
    // ======================================================
    // 3. JS Y CSS - STALE-WHILE-REVALIDATE
    // ======================================================
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(request);
                
                // Actualizar en segundo plano
                const fetchPromise = fetch(request).then(async (networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        await cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => null);
                
                // Devolver caché inmediatamente si existe
                if (cachedResponse) {
                    fetchPromise.catch(() => {}); // No esperar
                    return cachedResponse;
                }
                
                // Si no hay caché, esperar la red
                return await fetchPromise;
            })()
        );
        return;
    }
    
    // ======================================================
    // 4. IMÁGENES - CACHE FIRST
    // ======================================================
    if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|avif)$/i)) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(RUNTIME_CACHE);
                const cachedResponse = await cache.match(request);
                
                if (cachedResponse) return cachedResponse;
                
                try {
                    const networkResponse = await fetch(request);
                    if (networkResponse && networkResponse.ok) {
                        await cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    // SVG por defecto cuando falla la imagen
                    return new Response(
                        `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="1.5">
                            <rect x="4" y="4" width="16" height="16" rx="2"/>
                            <circle cx="8.5" cy="9.5" r="1.5" fill="#818cf8"/>
                            <path d="M21 15l-5-4-3 3-4-4-5 5"/>
                        </svg>`,
                        { headers: { 'Content-Type': 'image/svg+xml' } }
                    );
                }
            })()
        );
        return;
    }
    
    // ======================================================
    // 5. RESTO - NETWORK FIRST
    // ======================================================
    event.respondWith(
        (async () => {
            try {
                const networkResponse = await fetch(request);
                if (networkResponse && networkResponse.ok) {
                    const cache = await caches.open(RUNTIME_CACHE);
                    cache.put(request, networkResponse.clone());
                    return networkResponse;
                }
                throw new Error('Network response not ok');
            } catch (error) {
                const cachedResponse = await caches.match(request);
                if (cachedResponse) return cachedResponse;
                
                return new Response('Recurso no disponible', { status: 404 });
            }
        })()
    );
});

// ======================================================
// MANEJO DE MENSAJES DESDE EL CLIENTE
// ======================================================
self.addEventListener('message', (event) => {
    const { type, data } = event.data || {};
    
    switch (type) {
        case 'SKIP_WAITING':
            console.log('[SW] ⏩ skipWaiting solicitado');
            self.skipWaiting();
            break;
            
        case 'CHECK_VERSION':
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({
                    version: APP_VERSION,
                    cacheName: CACHE_NAME,
                    timestamp: Date.now()
                });
            }
            break;
            
        case 'FORCE_UPDATE':
            console.log('[SW] 🔄 Forzando actualización...');
            self.registration.update();
            break;
            
        case 'CLEAR_CACHE':
            console.log('[SW] 🧹 Limpiando cachés...');
            event.waitUntil(
                (async () => {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(key => caches.delete(key)));
                    console.log('[SW] ✅ Todos los cachés limpiados');
                })()
            );
            break;
            
        default:
            console.debug('[SW] Mensaje recibido:', type);
    }
});

// ======================================================
// SINCRONIZACIÓN EN SEGUNDO PLANO
// ======================================================
self.addEventListener('sync', (event) => {
    console.log('[SW] 📡 Evento sync:', event.tag);
    
    if (event.tag === 'sync-products') {
        event.waitUntil(
            (async () => {
                console.log('[SW] 🔄 Sincronizando productos pendientes...');
                // Aquí se puede implementar sincronización de datos pendientes
                // cuando el dispositivo recupere conexión
            })()
        );
    }
});

// ======================================================
// PUSH NOTIFICATIONS
// ======================================================
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        
        const options = {
            body: data.body || 'Hay novedades en SISOV Market',
            icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%234f46e5"/%3E%3Ctext x="50" y="67" font-size="50" text-anchor="middle" fill="white" font-family="Arial"%3ES%3C/text%3E%3C/svg%3E',
            badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%234f46e5"/%3E%3Ctext x="50" y="67" font-size="50" text-anchor="middle" fill="white" font-family="Arial"%3ES%3C/text%3E%3C/svg%3E',
            vibrate: [200, 100, 200],
            data: { url: data.url || '/' },
            actions: [
                { action: 'open', title: '📱 Abrir' },
                { action: 'later', title: '⏰ Más tarde' }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'SISOV Market', options)
        );
    } catch (error) {
        console.warn('[SW] Error mostrando notificación:', error);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then(clients => {
                if (clients.length > 0) {
                    clients[0].focus();
                    clients[0].postMessage({ type: 'NOTIFICATION_CLICKED' });
                } else {
                    self.clients.openWindow('/');
                }
            })
        );
    }
});

console.log(`[SW] ✅ Service Worker ${APP_VERSION} inicializado correctamente`);