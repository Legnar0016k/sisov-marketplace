// ==============================================
// SISOV MARKETPLACE - LÓGICA COMPLETA
// ==============================================

// --- CONFIGURACIÓN ---
const API_URL = 'https://sisov-marketplace-api.up.railway.app'; // ✅ TU API EN RAILWAY

// --- ESTADO DE LA APLICACIÓN ---
const state = {
    productos: [],
    categoriasUnicas: [],
    carrito: [],
    filtros: {
        texto: '',
        categoria: 'todas',
        precioMax: 500
    }
};

// --- ELEMENTOS DEL DOM ---
const elements = {
    productGrid: document.getElementById('productGridMarket'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    noProductsMessage: document.getElementById('noProductsMessage'),
    searchInput: document.getElementById('searchInput'),
    categoryFilter: document.getElementById('categoryFilter'),
    priceRange: document.getElementById('priceRange'),
    priceRangeValue: document.getElementById('priceRangeValue'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn'),
    categoriesGrid: document.getElementById('categoriesGrid'),
    cartSlider: document.getElementById('cartSlider'),
    cartOverlay: document.getElementById('cartOverlay'),
    cartToggleBtn: document.getElementById('cartToggleBtn'),
    closeCartBtn: document.getElementById('closeCartBtn'),
    cartItemsContainer: document.getElementById('cartItemsContainer'),
    cartTotal: document.getElementById('cartTotal'),
    cartCountHeader: document.getElementById('cartCountHeader'),
    checkoutBtn: document.getElementById('checkoutBtn')
};

// ==============================================
// FUNCIONES PRINCIPALES
// ==============================================

// 1. Cargar productos desde la API
async function cargarProductos() {
    elements.loadingIndicator.classList.remove('hidden');
    elements.productGrid.classList.add('hidden');
    
    try {
        console.log('🔄 Cargando productos desde API...');
        
        const response = await fetch(`${API_URL}/api/products`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // La API devuelve { products: [...], categories: [...] }
        state.productos = data.products || [];
        state.categoriasUnicas = data.categories || ['General'];
        
        console.log(`✅ ${state.productos.length} productos cargados`);
        
        // Actualizar UI
        renderizarCategorias();
        renderizarFiltros();
        renderizarProductos(state.productos);
        
    } catch (error) {
        console.error('❌ Error cargando productos:', error);
        
        elements.productGrid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i data-lucide="alert-circle" class="w-16 h-16 mx-auto text-red-400 mb-4"></i>
                <p class="text-red-600 text-lg font-bold">Error al cargar productos</p>
                <p class="text-slate-400 mt-2">${error.message}</p>
                <button onclick="location.reload()" 
                        class="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                    Reintentar
                </button>
            </div>
        `;
        elements.productGrid.classList.remove('hidden');
    } finally {
        elements.loadingIndicator.classList.add('hidden');
    }
}

// 2. Renderizar chips de categorías destacadas
function renderizarCategorias() {
    const categoriasDestacadas = state.categoriasUnicas.slice(0, 6);
    
    elements.categoriesGrid.innerHTML = categoriasDestacadas.map(cat => `
        <div onclick="filtrarPorCategoria('${cat}')" 
             class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 text-center hover:shadow-md transition-shadow cursor-pointer group">
            <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/20 transition-colors">
                <i data-lucide="tag" class="w-6 h-6 text-primary"></i>
            </div>
            <span class="text-sm font-medium text-slate-700">${cat}</span>
        </div>
    `).join('');
    
    lucide.createIcons(elements.categoriesGrid);
}

// 3. Renderizar opciones del filtro de categoría
function renderizarFiltros() {
    const options = state.categoriasUnicas.map(cat => 
        `<option value="${cat}" ${state.filtros.categoria === cat ? 'selected' : ''}>${cat}</option>`
    ).join('');
    
    elements.categoryFilter.innerHTML = `<option value="todas">Todas las categorías</option>${options}`;
}

// 4. Aplicar filtros y renderizar productos
function aplicarFiltrosYRenderizar() {
    const productosFiltrados = state.productos.filter(producto => {
        const nombre = (producto.name_p || '').toLowerCase();
        const categoria = (producto.category || 'General');
        const precio = producto.price_usd || 0;
        const textoBusqueda = state.filtros.texto.toLowerCase();
        
        // Filtro de búsqueda por nombre
        if (textoBusqueda && !nombre.includes(textoBusqueda)) return false;
        
        // Filtro de categoría
        if (state.filtros.categoria !== 'todas' && categoria !== state.filtros.categoria) return false;
        
        // Filtro de precio máximo
        if (precio > state.filtros.precioMax) return false;
        
        return true;
    });

    renderizarProductos(productosFiltrados);
    elements.priceRangeValue.textContent = `$${state.filtros.precioMax}`;
}

// 5. Renderizar grid de productos
function renderizarProductos(productos) {
    elements.productGrid.classList.remove('hidden');
    
    if (productos.length === 0) {
        elements.noProductsMessage.classList.remove('hidden');
        elements.productGrid.innerHTML = '';
        return;
    }
    
    elements.noProductsMessage.classList.add('hidden');
    
    elements.productGrid.innerHTML = productos.map(producto => {
        const enCarrito = state.carrito.some(item => item.id === producto.id);
        return `
        <div class="product-card bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col">
            <div class="aspect-square bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                <i data-lucide="package" class="w-12 h-12 text-slate-300"></i>
            </div>
            <h3 class="font-semibold text-slate-800 mb-1 line-clamp-2" title="${escapeHtml(producto.name_p)}">${escapeHtml(producto.name_p)}</h3>
            <p class="text-xs text-slate-500 mb-2">${escapeHtml(producto.category || 'General')}</p>
            <div class="flex items-center justify-between mt-auto">
                <span class="text-xl font-bold text-primary">$${(producto.price_usd || 0).toFixed(2)}</span>
                <button onclick="agregarAlCarrito('${producto.id}', '${escapeHtml(producto.name_p)}', ${producto.price_usd || 0})" 
                        class="bg-primary hover:bg-primary-dark text-white p-2 rounded-lg transition-colors ${enCarrito ? 'opacity-50 cursor-not-allowed' : ''}"
                        ${enCarrito ? 'disabled' : ''}>
                    <i data-lucide="shopping-cart" class="w-5 h-5"></i>
                </button>
            </div>
        </div>
    `}).join('');
    
    lucide.createIcons(elements.productGrid);
}

// ==============================================
// FUNCIONES DEL CARRITO
// ==============================================

// Agregar al carrito
window.agregarAlCarrito = function(id, nombre, precio) {
    if (state.carrito.some(item => item.id === id)) {
        mostrarNotificacion('Este producto ya está en el carrito', 'warning');
        return;
    }
    
    state.carrito.push({
        id: id,
        nombre: nombre,
        precio: precio,
        cantidad: 1
    });
    
    actualizarUIcarrito();
    abrirCarrito();
    mostrarNotificacion('Producto agregado al carrito', 'success');
};

// Actualizar UI del carrito
function actualizarUIcarrito() {
    // Actualizar contador del header
    elements.cartCountHeader.textContent = state.carrito.length;
    
    // Actualizar items en el slider
    if (state.carrito.length === 0) {
        elements.cartItemsContainer.innerHTML = `
            <div class="text-center text-slate-400 py-8">
                <i data-lucide="shopping-bag" class="w-12 h-12 mx-auto mb-3 opacity-30"></i>
                <p>Tu carrito está vacío</p>
            </div>
        `;
        elements.cartTotal.textContent = '$0.00';
        elements.checkoutBtn.disabled = true;
    } else {
        let total = 0;
        let itemsHtml = '';
        
        state.carrito.forEach((item, index) => {
            total += item.precio * item.cantidad;
            itemsHtml += `
                <div class="flex items-start justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div>
                        <h4 class="font-semibold text-slate-800 text-sm">${escapeHtml(item.nombre)}</h4>
                        <p class="text-xs text-slate-500">$${item.precio.toFixed(2)} x ${item.cantidad}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-sm text-primary">$${(item.precio * item.cantidad).toFixed(2)}</span>
                        <button onclick="eliminarDelCarrito(${index})" 
                                class="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                                title="Eliminar">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        elements.cartItemsContainer.innerHTML = itemsHtml;
        elements.cartTotal.textContent = `$${total.toFixed(2)}`;
        elements.checkoutBtn.disabled = false;
    }
    
    lucide.createIcons(elements.cartItemsContainer);
}

// Eliminar del carrito
window.eliminarDelCarrito = function(index) {
    const producto = state.carrito[index];
    state.carrito.splice(index, 1);
    actualizarUIcarrito();
    mostrarNotificacion(`${producto.nombre} eliminado del carrito`, 'info');
};

// Abrir carrito
function abrirCarrito() {
    elements.cartSlider.style.right = '0';
    elements.cartOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// Cerrar carrito
function cerrarCarrito() {
    elements.cartSlider.style.right = '-100%';
    elements.cartOverlay.classList.add('hidden');
    document.body.style.overflow = '';
}

// Checkout (simulado)
elements.checkoutBtn.addEventListener('click', () => {
    if (state.carrito.length === 0) return;
    
    const total = state.carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    
    mostrarNotificacion(`Compra simulada por $${total.toFixed(2)}`, 'success');
    
    setTimeout(() => {
        state.carrito = [];
        actualizarUIcarrito();
        cerrarCarrito();
    }, 1500);
});

// ==============================================
// FUNCIONES AUXILIARES
// ==============================================

// Mostrar notificaciones tipo toast
function mostrarNotificacion(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg text-white font-semibold shadow-lg transform transition-all duration-300 translate-y-0 opacity-100`;
    
    const colores = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        warning: 'bg-amber-500',
        info: 'bg-blue-500'
    };
    
    toast.classList.add(colores[tipo] || colores.info);
    toast.textContent = mensaje;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Filtrar por categoría (desde los chips)
window.filtrarPorCategoria = function(categoria) {
    state.filtros.categoria = categoria;
    elements.categoryFilter.value = categoria;
    aplicarFiltrosYRenderizar();
};

// ==============================================
// EVENT LISTENERS
// ==============================================

// Búsqueda en tiempo real
elements.searchInput.addEventListener('input', (e) => {
    state.filtros.texto = e.target.value;
    aplicarFiltrosYRenderizar();
});

// Filtro por categoría
elements.categoryFilter.addEventListener('change', (e) => {
    state.filtros.categoria = e.target.value;
    aplicarFiltrosYRenderizar();
});

// Filtro por precio
elements.priceRange.addEventListener('input', (e) => {
    state.filtros.precioMax = parseInt(e.target.value);
    aplicarFiltrosYRenderizar();
});

// Limpiar filtros
elements.clearFiltersBtn.addEventListener('click', () => {
    state.filtros = { texto: '', categoria: 'todas', precioMax: 500 };
    elements.searchInput.value = '';
    elements.categoryFilter.value = 'todas';
    elements.priceRange.value = 500;
    aplicarFiltrosYRenderizar();
    mostrarNotificacion('Filtros limpiados', 'info');
});

// Abrir/cerrar carrito
elements.cartToggleBtn.addEventListener('click', abrirCarrito);
elements.closeCartBtn.addEventListener('click', cerrarCarrito);
elements.cartOverlay.addEventListener('click', cerrarCarrito);

// ==============================================
// INICIALIZACIÓN
// ==============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando SISOV Marketplace...');
    cargarProductos();
    lucide.createIcons();
});