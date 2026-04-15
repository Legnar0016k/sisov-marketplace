/**
 * @file currency.js
 * @description Conversión de moneda USD → VES con caché
 * @version 2.1.0
 */

const MarketCurrency = (function() {
    const CACHE_KEY = 'market_usd_rate';
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos
    const API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
    
    let tasaActual = null;
    let ultimaActualizacion = null;
    let promesaEnCurso = null;
    let core = null;

    function init() {
        core = window.MarketCore;
        console.log('[Currency] Módulo inicializado');
        return true;
    }

    // Actualización automática de la tasa cada 8 horas
    async function inicializarTasaAutomatica() {
        const currency = window.MarketCurrency;
        if (!currency) return;
        
        async function actualizarUI() {
            const tasa = await currency.obtenerTasa();
            if (tasa) {
                const tasaElement = document.getElementById('tasaBCV');
                if (tasaElement) {
                    tasaElement.textContent = tasa.toFixed(2);
                }
            }
        }
        
        await actualizarUI();
        
        // Actualizar cada 8 horas
        setInterval(async () => {
            console.log('[Market] Actualizando tasa BCV...');
            await currency.refrescarTasa();
            await actualizarUI();
        }, 8 * 60 * 60 * 1000);
    }

    // Inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarTasaAutomatica);
    } else {
        inicializarTasaAutomatica();
    }

    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializarTasaAutomatica);
    } else {
        inicializarTasaAutomatica();
    }

    function obtenerTasaDelCache(ignoreExpiration = false) {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            const isExpired = (Date.now() - data.timestamp) > CACHE_DURATION;
            
            if (isExpired && !ignoreExpiration) return null;
            
            return data;
        } catch (error) {
            console.warn('[Currency] Error leyendo caché:', error);
            return null;
        }
    }

    function guardarTasaEnCache(tasa) {
        try {
            const cacheData = {
                tasa: tasa,
                timestamp: Date.now()
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
            console.log('[Currency] Tasa guardada en caché');
            return true;
        } catch (error) {
            console.warn('[Currency] Error guardando caché:', error);
            return false;
        }
    }

    async function obtenerTasa(forceRefresh = false) {
        if (promesaEnCurso) {
            console.log('[Currency] Esperando petición en curso...');
            return await promesaEnCurso;
        }

        if (!forceRefresh) {
            const cached = obtenerTasaDelCache();
            if (cached && cached.tasa > 0) {
                tasaActual = cached.tasa;
                ultimaActualizacion = cached.timestamp;
                console.log(`[Currency] Tasa desde caché: 1 USD = ${tasaActual} VES`);
                return tasaActual;
            }
        }

        promesaEnCurso = (async () => {
            try {
                console.log('[Currency] Obteniendo tasa oficial del BCV...');
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                
                const response = await fetch(API_URL, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('[Currency] Respuesta API:', data);
                
                // 🔥 DETECCIÓN CORREGIDA para ve.dolarapi.com
                let tasa = null;
                
                if (typeof data === 'number') {
                    tasa = data;
                } else if (data && typeof data === 'object') {
                    // Para ve.dolarapi.com/v1/dolares/oficial (USA 'promedio')
                    if (data.promedio && data.promedio > 0) {
                        tasa = data.promedio;
                        console.log('[Currency] ✅ Usando campo "promedio":', tasa);
                    }
                    // Fallback: probar otros campos comunes
                    else if (data.precio && data.precio > 0) tasa = data.precio;
                    else if (data.price && data.price > 0) tasa = data.price;
                    else if (data.valor && data.valor > 0) tasa = data.valor;
                    else if (data.dolar && data.dolar > 0) tasa = data.dolar;
                    else if (data.usd && data.usd > 0) tasa = data.usd;
                    else if (data.rate && data.rate > 0) tasa = data.rate;
                    else if (data.bcv && data.bcv > 0) tasa = data.bcv;
                    else if (data.oficial && data.oficial > 0) tasa = data.oficial;
                    else if (data.venta && data.venta > 0) tasa = data.venta;
                    else if (data.compra && data.compra > 0) tasa = data.compra;
                    else if (Array.isArray(data) && data[0]?.promedio) tasa = data[0].promedio;
                    else if (Array.isArray(data) && data[0]?.precio) tasa = data[0].precio;
                    else if (Array.isArray(data) && data[0]?.price) tasa = data[0].price;
                }
                
                if (!tasa || tasa <= 0) {
                    console.warn('[Currency] No se encontró campo de precio válido en:', data);
                    throw new Error('Formato de respuesta no reconocido');
                }
                
                tasaActual = tasa;
                guardarTasaEnCache(tasaActual);
                console.log(`[Currency] ✅ Tasa actualizada: 1 USD = ${tasaActual} VES`);
                
                return tasaActual;
                
            } catch (error) {
                console.error('[Currency] Error obteniendo tasa:', error);
                
                const expiredCache = obtenerTasaDelCache(true);
                if (expiredCache && expiredCache.tasa > 0) {
                    console.warn('[Currency] Usando tasa expirada como fallback');
                    tasaActual = expiredCache.tasa;
                    return tasaActual;
                }
                
                if (tasaActual && tasaActual > 0) {
                    console.warn(`[Currency] Usando tasa en memoria: ${tasaActual}`);
                    return tasaActual;
                }
                
                console.warn('[Currency] No hay tasa disponible');
                return null;
                
            } finally {
                promesaEnCurso = null;
            }
        })();

        return await promesaEnCurso;
    }

    async function convertirUSDtoVES(usd, tasa = null) {
        const tasaUsar = tasa || await obtenerTasa();
        if (!tasaUsar) return null;
        return usd * tasaUsar;
    }

    function formatearVES(monto) {
        if (monto === null || monto === undefined || isNaN(monto)) {
            return 'Bs. 0,00';
        }
        
        try {
            return new Intl.NumberFormat('es-VE', {
                style: 'currency',
                currency: 'VES',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(monto);
        } catch (error) {
            return `Bs. ${monto.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
        }
    }

    function formatearUSD(monto) {
        if (monto === null || monto === undefined || isNaN(monto)) {
            return '$0.00';
        }
        
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2
            }).format(monto);
        } catch (error) {
            return `$${monto.toFixed(2)}`;
        }
    }

    async function getPreciosFormateados(usd) {
        const tasa = await obtenerTasa();
        
        if (!tasa) {
            return {
                usd: formatearUSD(usd),
                ves: null,
                tasa: null,
                usd_raw: usd,
                ves_raw: null
            };
        }
        
        const ves = usd * tasa;
        
        return {
            usd: formatearUSD(usd),
            ves: formatearVES(ves),
            tasa: tasa,
            usd_raw: usd,
            ves_raw: ves
        };
    }

    async function refrescarTasa() {
        console.log('[Currency] Refrescando tasa forzadamente...');
        return await obtenerTasa(true);
    }

    function hayTasa() {
        return tasaActual !== null && tasaActual > 0;
    }

    init();
    
    return {
        obtenerTasa,
        convertirUSDtoVES,
        formatearVES,
        formatearUSD,
        getPreciosFormateados,
        refrescarTasa,
        hayTasa
    };
})();

window.MarketCurrency = MarketCurrency;
console.log('[Currency] Módulo cargado');