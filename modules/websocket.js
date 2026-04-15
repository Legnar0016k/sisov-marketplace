/**
 * @file websocket.js
 * @description Actualizaciones en tiempo real con reconexión
 * @version 1.1.0
 */

const MarketWebSocket = (function() {
    let core = null;
    let render = null;
    let cache = null;
    let subscriptionActive = false;
    let reconectarTimeout = null;

    function init() {
        core = window.MarketCore;
        render = window.MarketRender;
        cache = window.MarketCache;
        
        if (!core) console.warn('[WebSocket] Core no disponible');
        if (!render) console.warn('[WebSocket] Render no disponible');
        
        console.log('[WebSocket] Inicializado');
    }

    async function suscribir() {
        if (subscriptionActive) return;
        
        const pb = core?.pb();
        if (!pb) {
            console.warn('[WebSocket] PocketBase no disponible');
            return;
        }
        
        try {
            await pb.collection('products').subscribe('*', (e) => {
                console.log(`[WebSocket] Evento: ${e.action}`);
                
                switch (e.action) {
                    case 'update':
                        manejarActualizacion(e.record);
                        break;
                    case 'create':
                        manejarCreacion(e.record);
                        break;
                    case 'delete':
                        manejarEliminacion(e.record.id);
                        break;
                }
            });
            
            subscriptionActive = true;
            console.log('[WebSocket] ✅ Suscripción activa');
            
        } catch (error) {
            console.warn('[WebSocket] Error:', error);
            programarReconexion();
        }
    }

    function manejarActualizacion(record) {
        const producto = {
            id: record.id,
            name: record.name_p,
            price: record.price_usd,
            category: record.category,
            stock: record.stock,
            imageUrl: record.imagen_url
        };
        
        const idx = core.state.productos.findIndex(p => p.id === producto.id);
        if (idx !== -1) {
            core.state.productos[idx] = { ...core.state.productos[idx], ...producto };
            render?.actualizarTarjetaUnica(producto);
            cache?.actualizarCache(producto);
        }
        
        // Refrescar filtros si es necesario
        if (window.MarketFilters) {
            window.MarketFilters.aplicarFiltros();
        }
    }

    function manejarCreacion(record) {
        const producto = {
            id: record.id,
            name: record.name_p,
            price: record.price_usd,
            category: record.category,
            stock: record.stock,
            imageUrl: record.imagen_url
        };
        
        core.state.productos.unshift(producto);
        core._actualizarCategorias();
        cache?.agregarACache(producto);
        
        if (window.MarketFilters) {
            window.MarketFilters.aplicarFiltros();
        }
    }

    function manejarEliminacion(id) {
        core.state.productos = core.state.productos.filter(p => p.id !== id);
        core._actualizarCategorias();
        cache?.eliminarDeCache(id);
        
        if (window.MarketFilters) {
            window.MarketFilters.aplicarFiltros();
        }
    }

    function programarReconexion() {
        if (reconectarTimeout) clearTimeout(reconectarTimeout);
        reconectarTimeout = setTimeout(() => {
            console.log('[WebSocket] Intentando reconectar...');
            subscriptionActive = false;
            suscribir();
        }, 30000);
    }

    async function desuscribir() {
        if (!subscriptionActive) return;
        
        if (reconectarTimeout) {
            clearTimeout(reconectarTimeout);
            reconectarTimeout = null;
        }
        
        const pb = core?.pb();
        if (pb) {
            await pb.collection('products').unsubscribe();
            subscriptionActive = false;
            console.log('[WebSocket] Suscripción cerrada');
        }
    }

    function isActive() {
        return subscriptionActive;
    }

    init();
    return { suscribir, desuscribir, isActive };
})();

window.MarketWebSocket = MarketWebSocket;
console.log('[WebSocket] Módulo cargado');