/**
 * @file core.js
 * @description Núcleo del catálogo - estado y configuración
 * @version 2.0.0
 */

const MarketCore = (function() {
    const PB_URL = 'https://sisov-pro-react-production.up.railway.app';
    let pb = null;
    let elementosRegistrados = false;
    
    const state = {
        productos: [],
        categoriasUnicas: [],
        filtros: { texto: '', categoria: 'todas', precioMax: 1000 },
        inicializado: false,
        cargando: false
    };

    const elements = {};

    // Mapeo de IDs de DOM a nombres internos
    const ELEMENT_MAP = {
        productGridMarket: 'productGrid',
        loadingIndicator: 'loadingIndicator',
        noProductsMessage: 'noProductsMessage',
        searchInput: 'searchInput',
        categoryFilter: 'categoryFilter',
        priceRange: 'priceRange',
        priceRangeValue: 'priceRangeValue',
        clearFiltersBtn: 'clearFiltersBtn',
        categoriesGrid: 'categoriesGrid',
        resultsCount: 'resultsCount'
    };

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function getStockBadge(stock) {
    if (stock <= 0) return { type: 'out', text: 'Agotado', icon: 'x-circle' };
    if (stock <= 5) return { type: 'low', text: 'Pocas unidades', icon: 'alert-circle' };
    return { type: 'available', text: 'Disponible', icon: 'check-circle' };
    }

    function formatearPrecio(precio) {
        return `$${Number(precio).toFixed(2)}`;
    }

    function initPocketBase() {
        if (pb) return pb;
        pb = new PocketBase(PB_URL);
        pb.autoCancellation(false);
        return pb;
    }

    async function registrarElementos() {
        if (elementosRegistrados && elements.productGrid) return true;
        
        const promises = Object.entries(ELEMENT_MAP).map(async ([domId, internalName]) => {
            const element = await esperarElemento(domId, 5000);
            if (element) {
                elements[internalName] = element;
            }
            return element;
        });
        
        const results = await Promise.all(promises);
        const todosExisten = results.every(el => el !== null);
        
        if (todosExisten) {
            elementosRegistrados = true;
            console.log('[Core] Elementos DOM registrados');
        } else {
            console.warn('[Core] Algunos elementos no se encontraron');
        }
        
        return todosExisten;
    }

    function esperarElemento(id, timeout = 5000) {
        return new Promise((resolve) => {
            const existing = document.getElementById(id);
            if (existing) {
                resolve(existing);
                return;
            }
            
            const observer = new MutationObserver(() => {
                const element = document.getElementById(id);
                if (element) {
                    observer.disconnect();
                    resolve(element);
                }
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
            
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

    function actualizarSelectCategorias() {
        if (!elements.categoryFilter) return;
        
        let options = '<option value="todas">📂 Todas las categorías</option>';
        state.categoriasUnicas.forEach(cat => {
            options += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
        });
        elements.categoryFilter.innerHTML = options;
    }

    function _actualizarCategorias() {
        const categoriasSet = new Set();
        state.productos.forEach(p => {
            if (p.category && p.category !== 'General') {
                categoriasSet.add(p.category);
            }
        });
        state.categoriasUnicas = Array.from(categoriasSet).sort();
        actualizarSelectCategorias();
        
        // Notificar a Categories module
        if (window.MarketCategories?.refrescar) {
            window.MarketCategories.refrescar();
        }
    }

    async function cargarProductos(forceRefresh = false) {
        if (state.cargando) return state.productos;
        
        state.cargando = true;
        
        try {
            // Mostrar loading
            if (elements.loadingIndicator) {
                elements.loadingIndicator.classList.remove('hidden');
            }
            if (elements.productGrid) {
                elements.productGrid.classList.add('hidden');
            }
            
            const pbInstance = initPocketBase();
            
            const records = await pbInstance.collection('products').getFullList({
                sort: '-created',
                filter: 'stock >= 0',
                requestKey: forceRefresh ? `refresh_${Date.now()}` : undefined
            });
            
            if (!records || records.length === 0) {
                state.productos = [];
                state.categoriasUnicas = [];
                return [];
            }
            
            state.productos = records.map(p => ({
                id: p.id,
                name: p.name_p || 'Producto sin nombre',
                price: p.price_usd || 0,
                category: p.category || 'General',
                stock: p.stock || 0,
                imageUrl: p.imagen_url || null,
                lastUpdated: new Date().toISOString()
            }));
            
            _actualizarCategorias();
            
            return state.productos;
            
        } catch (error) {
            console.error('[Core] Error cargando productos:', error);
            throw error;
        } finally {
            state.cargando = false;
            if (elements.loadingIndicator) {
                elements.loadingIndicator.classList.add('hidden');
            }
        }
    }

    async function inicializarCatalogo() {
        if (state.inicializado) return;
        
        // Registrar elementos del DOM
        const elementosOK = await registrarElementos();
        
        if (!elementosOK) {
            console.warn('[Core] No todos los elementos están disponibles, continuando de todas formas');
        }
        
        initPocketBase();
        state.inicializado = true;
        
        console.log('[Core] Catálogo inicializado');
    }

    function getElements() {
        return elements;
    }

    function actualizarState(nuevoState) {
        Object.assign(state, nuevoState);
    }

    return {
        state,
        elements: getElements,
        pb: initPocketBase,
        escapeHtml,
        getStockBadge,
        formatearPrecio,
        cargarProductos,
        inicializarCatalogo,
        actualizarSelectCategorias,
        _actualizarCategorias,
        actualizarState,
        registrarElementos
    };
})();

window.MarketCore = MarketCore;
console.log('[Core] Módulo cargado');