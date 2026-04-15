/**
 * @file categories.js
 * @description Renderizado de categorías destacadas
 * @version 1.1.0
 */

const MarketCategories = (function() {
    let core = null;

    function init() {
        core = window.MarketCore;
        if (!core) console.error('[Categories] MarketCore no disponible');
        console.log('[Categories] Inicializado');
    }

    function renderizar() {
        const elements = core.elements();
        const grid = elements.categoriesGrid;
        
        if (!grid) return;
        
        const categorias = core.state.categoriasUnicas.slice(0, 6);
        
        if (categorias.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-slate-400 py-4">
                <i data-lucide="folder" class="w-8 h-8 mx-auto mb-2"></i>
                <p class="text-sm">Categorías disponibles pronto</p>
            </div>`;
        } else {
            grid.innerHTML = categorias.map(cat => `
                <div onclick="window.filtrarPorCategoria('${core.escapeHtml(cat)}')" 
                     class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-center hover:shadow-md cursor-pointer group transition-all">
                    <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/20 transition-colors">
                        <i data-lucide="tag" class="w-6 h-6 text-primary"></i>
                    </div>
                    <span class="text-sm font-medium text-slate-700">${core.escapeHtml(cat)}</span>
                </div>
            `).join('');
        }
        
        if (window.lucide) lucide.createIcons(grid);
    }

    function refrescar() {
        renderizar();
    }

    init();
    return { renderizar, refrescar };
})();

window.MarketCategories = MarketCategories;
console.log('[Categories] Módulo cargado');