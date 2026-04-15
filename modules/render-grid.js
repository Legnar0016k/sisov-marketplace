/**
 * @file render-grid.js
 * @description Renderizado de productos con virtualización y caché de DOM
 * @version 2.0.0
 */

const MarketRender = (function() {
    let core = null;
    let tarjetasCache = new Map();
    let renderTimeout = null;

    function init() {
        core = window.MarketCore;
        if (!core) {
            console.error('[Render] MarketCore no disponible');
            return false;
        }
        console.log('[Render] Inicializado');
        return true;
    }

    function generarHtmlTarjeta(producto) {
    const badge = core.getStockBadge(producto.stock);
    
    // CORRECCIÓN: Manejar los tres tipos de badge
    let badgeClass = 'stock-badge-available';
    if (badge.type === 'low') {
        badgeClass = 'stock-badge-low';
    } else if (badge.type === 'out') {
        badgeClass = 'stock-badge-out';
    }
    
    const precioUSD = producto.price || 0;
    
    const imageHtml = producto.imageUrl && producto.imageUrl.trim() !== ''
        ? `<img src="${core.escapeHtml(producto.imageUrl)}" alt="${core.escapeHtml(producto.name)}" loading="lazy" class="w-full h-full object-cover rounded-xl transition-transform duration-300 group-hover:scale-105">`
        : `<div class="w-full h-full bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center"><i data-lucide="package" class="w-8 h-8 text-indigo-300"></i></div>`;
    
    // Si el producto está agotado, añadir marca de agua
    const isOutOfStock = badge.type === 'out';
    const waterMark = isOutOfStock ? `
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-xl flex items-center justify-center z-20">
            <div class="transform -rotate-12 bg-red-600/90 text-white px-4 py-2 rounded-lg font-bold text-lg shadow-lg border border-red-300">
                AGOTADO
            </div>
        </div>
    ` : '';
    
    return `
    <div class="product-card bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-all relative" data-product-id="${producto.id}" data-price-usd="${precioUSD}">
        <div class="relative bg-slate-50 p-3">
            <div class="aspect-square rounded-lg overflow-hidden bg-white ${isOutOfStock ? 'opacity-50' : ''}">${imageHtml}</div>
            <div class="absolute top-4 right-4">
                <span class="${badgeClass} text-[10px] px-2 py-0.5 product-badge">
                    <i data-lucide="${badge.icon}" class="w-2.5 h-2.5"></i> ${badge.text}
                </span>
            </div>
            ${waterMark}
        </div>
        <div class="p-3 pt-0">
            <h3 class="font-semibold text-slate-800 text-sm line-clamp-2">${core.escapeHtml(producto.name)}</h3>
            <div class="mb-2 mt-1">
                <span class="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">${core.escapeHtml(producto.category)}</span>
            </div>
            <div class="mt-2">
                <div class="product-price-ves mb-1">
                    <i data-lucide="loader-2" class="w-3 h-3 inline animate-spin mr-1"></i>
                    <span class="text-sm text-slate-400">Cargando...</span>
                </div>
                <div class="flex items-center gap-1">
                    <span class="text-xs text-slate-400">USD</span>
                    <span class="text-sm font-medium text-slate-500 product-price-usd">${core.formatearPrecio(precioUSD)}</span>
                    <span class="text-[10px] text-slate-300 ml-1">referencial</span>
                </div>
            </div>
            <div class="mt-2 pt-1.5 border-t border-slate-100 text-[9px] text-slate-400 text-center">📋 Referencia visual</div>
        </div>
    </div>`;
}

    /**
 * Actualiza los precios en bolívares de todas las tarjetas de producto
 * @version 2.0.0
 */
async function actualizarPreciosVES() {
    const elements = core.elements();
    
    if (!elements.productGrid) {
        console.warn('[Render] productGrid no disponible para actualizar precios VES');
        return;
    }
    
    const tarjetas = document.querySelectorAll('.product-card');
    if (tarjetas.length === 0) {
        console.log('[Render] No hay tarjetas para actualizar precios VES');
        return;
    }
    
    let espera = 0;
    while (!window.MarketCurrency && espera < 30) {
        await new Promise(r => setTimeout(r, 100));
        espera++;
    }
    
    const currency = window.MarketCurrency;
    if (!currency) {
        console.warn('[Render] MarketCurrency no disponible después de esperar');
        tarjetas.forEach(card => {
            const vesElement = card.querySelector('.product-price-ves');
            if (vesElement) {
                vesElement.innerHTML = `
                    <i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>
                    <span class="text-sm text-slate-500">Módulo no disponible</span>
                `;
            }
        });
        if (window.lucide) lucide.createIcons();
        return;
    }
    
    try {
        const tasaPromise = currency.obtenerTasa();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout obteniendo tasa')), 5000)
        );
        
        const tasa = await Promise.race([tasaPromise, timeoutPromise]);
        
        if (!tasa || tasa === null) {
            console.warn('[Render] Tasa no disponible');
            tarjetas.forEach(card => {
                const vesElement = card.querySelector('.product-price-ves');
                if (vesElement) {
                    vesElement.innerHTML = `
                        <i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>
                        <span class="text-sm text-slate-500">Tasa no disponible</span>
                    `;
                }
            });
            if (window.lucide) lucide.createIcons();
            return;
        }
        
        if (tasa <= 0) {
            console.warn(`[Render] Tasa inválida: ${tasa}`);
            tarjetas.forEach(card => {
                const vesElement = card.querySelector('.product-price-ves');
                if (vesElement) {
                    vesElement.innerHTML = `
                        <i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>
                        <span class="text-sm text-slate-500">Tasa inválida</span>
                    `;
                }
            });
            if (window.lucide) lucide.createIcons();
            return;
        }
        
        let actualizados = 0;
        
        tarjetas.forEach(card => {
            const precioUSD = parseFloat(card.dataset.priceUsd);
            const vesElement = card.querySelector('.product-price-ves');
            
            if (!isNaN(precioUSD) && precioUSD > 0 && vesElement) {
                const precioVES = precioUSD * tasa;
                // 🔥 NUEVO: VES como principal (grande y destacado)
                vesElement.innerHTML = `
                    <i data-lucide="bolt" class="w-3.5 h-3.5 inline text-primary mr-1"></i>
                    <span class="text-xl font-black text-primary">${currency.formatearVES(precioVES)}</span>
                `;
                actualizados++;
            } else if (vesElement && (!precioUSD || isNaN(precioUSD))) {
                vesElement.innerHTML = `
                    <i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>
                    <span class="text-sm text-slate-500">Sin precio</span>
                `;
            }
        });
        
        if (window.lucide) lucide.createIcons();
        console.log(`[Render] Precios VES actualizados: ${actualizados} productos (tasa: ${tasa.toFixed(2)})`);
        
    } catch (error) {
        console.error('[Render] Error crítico actualizando precios VES:', error);
        
        tarjetas.forEach(card => {
            const vesElement = card.querySelector('.product-price-ves');
            if (vesElement) {
                vesElement.innerHTML = `
                    <i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>
                    <span class="text-sm text-slate-500">Error de conexión</span>
                `;
            }
        });
        if (window.lucide) lucide.createIcons();
    }
}

    function renderizarProductos(productos) {
        // Limpiar timeout previo para debounce
        if (renderTimeout) clearTimeout(renderTimeout);
        
        renderTimeout = setTimeout(() => {
            _renderizarProductos(productos);
        }, 10);
    }

    function _renderizarProductos(productos) {
    const elements = core.elements();
    
    if (!elements.productGrid) {
        console.error('[Render] productGrid no disponible');
        return;
    }
    
    if (elements.loadingIndicator) {
        elements.loadingIndicator.classList.add('hidden');
    }
    
    elements.productGrid.classList.remove('hidden');
    
    if (!productos || productos.length === 0) {
        elements.productGrid.innerHTML = '';
        if (elements.noProductsMessage) {
            elements.noProductsMessage.classList.remove('hidden');
        }
        if (elements.resultsCount) {
            elements.resultsCount.textContent = '0 productos';
        }
        return;
    }
    
    if (elements.noProductsMessage) {
        elements.noProductsMessage.classList.add('hidden');
    }
    
    tarjetasCache.clear();
    
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = productos.map(p => generarHtmlTarjeta(p)).join('');
    
    while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
    }
    
    elements.productGrid.innerHTML = '';
    elements.productGrid.appendChild(fragment);
    
    document.querySelectorAll('.product-card').forEach(card => {
        const id = card.dataset.productId;
        if (id) tarjetasCache.set(id, card);
    });
    
    if (window.lucide) {
        lucide.createIcons(elements.productGrid);
    }
    
    if (elements.resultsCount) {
        elements.resultsCount.textContent = `${productos.length} producto${productos.length !== 1 ? 's' : ''}`;
    }
    
    // 🔥 NUEVO: Actualizar precios en bolívares
    actualizarPreciosVES();
}

    function actualizarTarjetaUnica(producto) {
        const tarjeta = tarjetasCache.get(producto.id);
        if (!tarjeta || !tarjeta.isConnected) {
            tarjetasCache.delete(producto.id);
            return false;
        }
        
        const badge = core.getStockBadge(producto.stock);
        const badgeClass = badge.type === 'low' ? 'stock-badge-low' : 'stock-badge-available';
        const badgeEl = tarjeta.querySelector('.product-badge');
        
        if (badgeEl) {
            badgeEl.className = `${badgeClass} text-[10px] px-2 py-0.5 product-badge`;
            badgeEl.innerHTML = `<i data-lucide="${badge.icon}" class="w-2.5 h-2.5"></i> ${badge.text}`;
        }
        
        const priceEl = tarjeta.querySelector('.product-price');
        if (priceEl) {
            priceEl.textContent = core.formatearPrecio(producto.price);
        }
        
        if (window.lucide) {
            lucide.createIcons(tarjeta);
        }
        
        return true;
    }

    init();
    return { renderizarProductos, actualizarTarjetaUnica, generarHtmlTarjeta,  actualizarPreciosVES };
})();

window.MarketRender = MarketRender;
console.log('[Render] Módulo cargado');