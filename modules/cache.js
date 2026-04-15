/**
 * @file cache.js
 * @description Sistema de caché para productos
 * @version 1.0.0
 */

const MarketCache = (function() {
    const CACHE_KEY = 'sisov_market_cache';
    const CACHE_DURATION = 60 * 60 * 1000; // 1 hora
    
    let core = null;

    function init() {
        core = window.MarketCore;
        if (!core) {
            console.error('[Cache] MarketCore no disponible');
            return false;
        }
        console.log('[Cache] Inicializado');
        return true;
    }

    function guardarCache(productos) {
        try {
            const cacheData = {
                productos: productos,
                timestamp: Date.now(),
                version: '1.0'
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            console.log(`[Cache] Guardados ${productos.length} productos en caché`);
            return true;
        } catch (error) {
            console.warn('[Cache] Error guardando caché:', error);
            return false;
        }
    }

    function obtenerCache() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            const isExpired = (Date.now() - data.timestamp) > CACHE_DURATION;
            
            if (isExpired) {
                console.log('[Cache] Caché expirado');
                return null;
            }
            
            console.log(`[Cache] Caché válido con ${data.productos.length} productos`);
            return data.productos;
        } catch (error) {
            console.warn('[Cache] Error leyendo caché:', error);
            return null;
        }
    }

    function limpiarCache() {
        localStorage.removeItem(CACHE_KEY);
        console.log('[Cache] Caché limpiado');
    }

    async function cargarConCache(forceRefresh = false) {
        if (!core) init();
        
        // Intentar obtener del caché primero
        if (!forceRefresh) {
            const cached = obtenerCache();
            if (cached && cached.length > 0) {
                return cached;
            }
        }
        
        // Si no hay caché o expiró, cargar desde el servidor
        try {
            const productos = await core.cargarProductos(forceRefresh);
            if (productos && productos.length > 0) {
                guardarCache(productos);
            }
            return productos;
        } catch (error) {
            console.error('[Cache] Error cargando productos:', error);
            // Intentar devolver caché aunque esté expirado
            const expiredCache = obtenerCache();
            if (expiredCache) {
                console.log('[Cache] Usando caché expirado como fallback');
                return expiredCache;
            }
            return [];
        }
    }

    function actualizarCache(producto) {
        const cached = obtenerCache();
        if (!cached) return;
        
        const index = cached.findIndex(p => p.id === producto.id);
        if (index !== -1) {
            cached[index] = { ...cached[index], ...producto };
            guardarCache(cached);
        }
    }

    function agregarACache(producto) {
        const cached = obtenerCache();
        if (!cached) {
            guardarCache([producto]);
            return;
        }
        
        cached.unshift(producto);
        guardarCache(cached);
    }

    function eliminarDeCache(productoId) {
        const cached = obtenerCache();
        if (!cached) return;
        
        const filtered = cached.filter(p => p.id !== productoId);
        guardarCache(filtered);
    }

    init();
    
    return {
        cargarConCache,
        guardarCache,
        obtenerCache,
        limpiarCache,
        actualizarCache,
        agregarACache,
        eliminarDeCache
    };
})();

window.MarketCache = MarketCache;
console.log('[Cache] Módulo cargado');