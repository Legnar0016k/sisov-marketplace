/**
 * @file app-manager-market.js
 * @description AppManager para el Catálogo/Marketplace con sistema de caché
 * @version 3.0.0
 */

const AppManagerMarket = {
    version: "3.0.0",
    CACHE_KEY: 'market_catalog_cache',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutos

    MODULOS: [
        { nombre: 'MarketCore', archivo: 'modules/core.js' },
        { nombre: 'MarketCache', archivo: 'modules/cache.js' },
        { nombre: 'MarketCurrency', archivo: 'modules/currency.js' },
        { nombre: 'MarketRender', archivo: 'modules/render-grid.js' },
        { nombre: 'MarketFilters', archivo: 'modules/filters.js' },
        { nombre: 'MarketCategories', archivo: 'modules/categories.js' },
        { nombre: 'MarketWebSocket', archivo: 'modules/websocket.js' },
        { nombre: 'MarketUIExtras', archivo: 'modules/ui-extras.js' }  // NUEVO
    ],

    async inicializar() {
        console.log(`%c[Market] Iniciando v${this.version}...`, "color: #4f46e5; font-weight: bold;");
        
        try {
            if (typeof PocketBase === 'undefined') {
                throw new Error("PocketBase no está disponible");
            }

            // Cargar módulos en orden
            await this._cargarModulos();
            await this._sleep(50);

            // Verificar dependencias
            if (!window.MarketCore) throw new Error("MarketCore no se cargó");
            if (!window.MarketCache) throw new Error("MarketCache no se cargó");

            // Inicializar con timeout seguro
            await this._inicializarConTimeout();
            
            console.log("%c[Market] ✅ ¡Catálogo listo!", "color: #10b981; font-weight: bold;");
            
        } catch (error) {
            console.error("[Market] Error fatal:", error);
            this._mostrarError(error.message);
        }
    },

    async _inicializarConTimeout() {
        return Promise.race([
            this._inicializarSecuencial(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout de inicialización")), 10000)
            )
        ]);
    },

    async _inicializarSecuencial() {
    // 1. Esperar DOM ready
    await this._esperarDOM();
    
    // 2. Inicializar Core
    await window.MarketCore.inicializarCatalogo();
    console.log('[Market] ✅ Core inicializado');

    // 3. Cargar datos (con caché)
    const productos = await window.MarketCache.cargarConCache();
    if (productos && productos.length > 0) {
        window.MarketCore.state.productos = productos;
        window.MarketCore._actualizarCategorias();
    }

    // 4. Renderizar productos
    if (window.MarketRender?.renderizarProductos) {
        window.MarketRender.renderizarProductos(window.MarketCore.state.productos);
    }

    // 5. Renderizar categorías
    if (window.MarketCategories?.renderizar) {
        window.MarketCategories.renderizar();
    }

    // 6. Inicializar Currency (cargar tasa en segundo plano)
    if (window.MarketCurrency) {
        // No esperar a que termine, que cargue en background
        window.MarketCurrency.obtenerTasa().then(tasa => {
            if (tasa) {
                console.log(`[Market] ✅ Tasa BCV cargada: ${tasa}`);
                // Refrescar precios VES si ya están renderizados
                if (window.MarketRender?.actualizarPreciosVES) {
                    window.MarketRender.actualizarPreciosVES();
                }
            }
        }).catch(err => {
            console.warn('[Market] Error cargando tasa:', err);
        });
    }

    // 7. Configurar filtros
    if (window.MarketFilters?.inicializar) {
        window.MarketFilters.inicializar();
    }

    // 8. Inicializar UI Extras (indicador de tasa, botón refrescar)
    if (window.MarketUIExtras?.iniciar) {
        await window.MarketUIExtras.iniciar();
        console.log('[Market] ✅ UI Extras inicializado');
    }

    // 9. WebSocket en segundo plano
    if (window.MarketCore.state.productos.length > 0) {
        setTimeout(() => {
            if (window.MarketWebSocket?.suscribir) {
                window.MarketWebSocket.suscribir();
                console.log('[Market] ✅ WebSocket iniciado');
            }
        }, 3000);
    }
},

    async _esperarDOM() {
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            });
        }
        // Esperar elementos críticos
        await this._esperarElementosCriticos();
    },

    async _esperarElementosCriticos() {
        const elementosRequeridos = ['productGridMarket', 'loadingIndicator'];
        for (const id of elementosRequeridos) {
            await this._esperarElemento(id, 5000);
        }
    },

    _esperarElemento(id, timeout) {
        return new Promise((resolve, reject) => {
            const elemento = document.getElementById(id);
            if (elemento) return resolve(elemento);
            
            const observer = new MutationObserver((mutations, obs) => {
                const el = document.getElementById(id);
                if (el) {
                    obs.disconnect();
                    resolve(el);
                }
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Elemento ${id} no encontrado`));
            }, timeout);
        });
    },

    async _cargarModulos() {
        for (const modulo of this.MODULOS) {
            await this._cargarScript(modulo.archivo);
            console.log(`[Market] ✅ ${modulo.nombre}`);
            await this._sleep(10);
        }
    },

    _cargarScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Error cargando ${src}`));
            document.head.appendChild(script);
        });
    },

    _mostrarError(mensaje) {
        const grid = document.getElementById('productGridMarket');
        if (grid) {
            grid.classList.remove('hidden');
            grid.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i data-lucide="alert-circle" class="w-12 h-12 mx-auto mb-3 text-red-400"></i>
                    <p class="text-red-600 font-medium">Error: ${mensaje}</p>
                    <button onclick="location.reload()" class="mt-4 bg-primary text-white px-4 py-2 rounded-lg">Reintentar</button>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
        const loader = document.getElementById('loadingIndicator');
        if (loader) loader.classList.add('hidden');
    },

    _sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
};

// Inicialización segura
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AppManagerMarket.inicializar());
} else {
    AppManagerMarket.inicializar();
}

window.AppManagerMarket = AppManagerMarket;