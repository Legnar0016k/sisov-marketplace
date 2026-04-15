/**
 * @file filters.js
 * @description Sistema de filtros con debounce
 * @version 2.0.0
 */

const MarketFilters = (function() {
    let core = null;
    let render = null;
    let debounceTimeout = null;
    let listenersInicializados = false;

    function init() {
        core = window.MarketCore;
        render = window.MarketRender;
        
        if (!core || !render) {
            console.error('[Filters] Dependencias no disponibles');
            return false;
        }
        
        console.log('[Filters] Inicializado');
        return true;
    }

    function inicializar() {
        if (!init()) return;
        setupEventListeners();
        aplicarFiltros();
    }

    function aplicarFiltros() {
        const elements = core.elements();
        const { productos, filtros } = core.state;
        
        if (!productos || productos.length === 0) {
            if (render) render.renderizarProductos([]);
            return;
        }
        
        const filtrados = productos.filter(p => {
            const matchTexto = !filtros.texto || 
                p.name.toLowerCase().includes(filtros.texto.toLowerCase());
            const matchCategoria = filtros.categoria === 'todas' || 
                p.category === filtros.categoria;
            const matchPrecio = p.price <= filtros.precioMax;
            return matchTexto && matchCategoria && matchPrecio;
        });
        
        if (render) {
            render.renderizarProductos(filtrados);
        }
        
        // Actualizar visual del precio
        const priceVal = elements.priceRangeValue;
        if (priceVal) priceVal.textContent = `$${filtros.precioMax}`;
    }

    function aplicarFiltrosDebounced() {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            aplicarFiltros();
        }, 300);
    }

    function limpiarFiltros() {
        core.state.filtros = { texto: '', categoria: 'todas', precioMax: 1000 };
        
        const elements = core.elements();
        if (elements.searchInput) elements.searchInput.value = '';
        if (elements.categoryFilter) elements.categoryFilter.value = 'todas';
        if (elements.priceRange) elements.priceRange.value = 1000;
        if (elements.priceRangeValue) elements.priceRangeValue.textContent = '$1000';
        
        aplicarFiltros();
    }

    function filtrarPorCategoria(categoria) {
        core.state.filtros.categoria = categoria;
        const elements = core.elements();
        if (elements.categoryFilter) elements.categoryFilter.value = categoria;
        aplicarFiltros();
        
        const productosSection = document.getElementById('productos');
        if (productosSection) {
            productosSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function setupEventListeners() {
        if (listenersInicializados) return;
        
        const elements = core.elements();
        
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                core.state.filtros.texto = e.target.value;
                aplicarFiltrosDebounced();
            });
        }
        
        if (elements.categoryFilter) {
            elements.categoryFilter.addEventListener('change', (e) => {
                core.state.filtros.categoria = e.target.value;
                aplicarFiltros();
            });
        }
        
        if (elements.priceRange) {
            elements.priceRange.addEventListener('input', (e) => {
                core.state.filtros.precioMax = parseInt(e.target.value);
                aplicarFiltros();
            });
        }
        
        if (elements.clearFiltersBtn) {
            elements.clearFiltersBtn.addEventListener('click', () => limpiarFiltros());
        }
        
        listenersInicializados = true;
    }

    // Inicialización automática
    init();
    
    return { 
        inicializar,
        aplicarFiltros, 
        limpiarFiltros, 
        filtrarPorCategoria 
    };
})();

window.MarketFilters = MarketFilters;
window.filtrarPorCategoria = (c) => MarketFilters.filtrarPorCategoria(c);
window.limpiarFiltrosManual = () => MarketFilters.limpiarFiltros();
console.log('[Filters] Módulo cargado');