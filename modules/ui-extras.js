/**
 * @file ui-extras.js
 * @description Elementos UI adicionales (indicador de tasa, etc)
 * @version 1.0.0
 */

const MarketUIExtras = (function() {
    let core = null;
    let currency = null;
    let render = null;

    function init() {
        core = window.MarketCore;
        currency = window.MarketCurrency;
        render = window.MarketRender;
        
        if (!currency) {
            console.warn('[UIExtras] Currency no disponible');
            return false;
        }
        
        console.log('[UIExtras] Inicializado');
        return true;
    }

    async function actualizarIndicadorTasa() {
        if (!currency) return;
        
        const tasa = await currency.obtenerTasa();
        const tasaSpan = document.getElementById('tasaBCV');
        
        if (tasaSpan) {
            if (tasa && tasa !== null) {
                tasaSpan.textContent = tasa.toFixed(2);
                tasaSpan.classList.remove('text-red-500');
                tasaSpan.classList.add('text-green-600');
            } else {
                tasaSpan.textContent = '---';
                tasaSpan.classList.add('text-red-500');
            }
        }
    }

    function setupTasaButton() {
        const refreshBtn = document.getElementById('refreshTasaBtn');
        if (!refreshBtn) return;
        
        refreshBtn.addEventListener('click', async () => {
            if (!currency) return;
            
            // Mostrar loading
            const tasaSpan = document.getElementById('tasaBCV');
            if (tasaSpan) {
                tasaSpan.textContent = '...';
            }
            refreshBtn.disabled = true;
            refreshBtn.textContent = '...';
            
            try {
                await currency.refrescarTasa();
                
                if (render && render.actualizarPreciosVES) {
                    await render.actualizarPreciosVES();
                }
                
                await actualizarIndicadorTasa();
                
            } catch (error) {
                console.error('[UIExtras] Error refrescando tasa:', error);
            } finally {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-3 h-3"></i>';
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    async function iniciar() {
        if (!init()) return;
        
        setupTasaButton();
        await actualizarIndicadorTasa();
        
        // Actualizar cada 30 minutos en segundo plano
        setInterval(async () => {
            if (currency) {
                await currency.refrescarTasa();
                if (render && render.actualizarPreciosVES) {
                    await render.actualizarPreciosVES();
                }
                await actualizarIndicadorTasa();
            }
        }, 30 * 60 * 1000);
    }

    return { iniciar, actualizarIndicadorTasa };
})();

window.MarketUIExtras = MarketUIExtras;
console.log('[UIExtras] Módulo cargado');