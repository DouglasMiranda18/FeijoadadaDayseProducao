import {
    BADGE_LABELS,
    CATEGORY_LABELS,
    STORE_LOCATION,
    addCartItem,
    badgeLabel,
    buildWhatsAppMessage,
    cartSubtotal,
    categoryLabel,
    changeCartQuantity,
    deliveryFeeFromDistance,
    deliveryFeeFromNeighborhood,
    formatCep,
    formatPhone,
    getStoreStatus,
    haversineKm,
    isValidHttpUrl,
    money,
    normalizeText,
    paymentFee,
    reconcileCart,
    sortProducts
} from './core.mjs?v=2.3.0';
import { initCustomerExperience } from './customer.mjs?v=2.3.0';

const WHATSAPP_NUMBER = '5581987484019';
const CART_STORAGE_KEY = 'feijoada-dayse-cart-v2';

const dom = {
    headerStatus: document.querySelector('#headerStatus'),
    headerStatusText: document.querySelector('#headerStatusText'),
    storeCallout: document.querySelector('#storeCallout'),
    storeStatusLabel: document.querySelector('#storeStatusLabel'),
    storeStatusDetail: document.querySelector('#storeStatusDetail'),
    closedNotice: document.querySelector('#closedNotice'),
    closedNoticeTitle: document.querySelector('#closedNoticeTitle'),
    closedNoticeText: document.querySelector('#closedNoticeText'),
    highlightsSection: document.querySelector('#destaques'),
    highlightsNavLink: document.querySelector('#highlightsNavLink'),
    highlightRail: document.querySelector('#highlightRail'),
    categoryNav: document.querySelector('#categoryNav'),
    menuFeedback: document.querySelector('#menuFeedback'),
    productGrid: document.querySelector('#productGrid'),
    heroFoodImage: document.querySelector('#heroFoodImage'),
    heroPhotoKicker: document.querySelector('#heroPhotoKicker'),
    heroPhotoTitle: document.querySelector('#heroPhotoTitle'),
    productDialog: document.querySelector('#productDialog'),
    closeProductDialog: document.querySelector('#closeProductDialog'),
    productDialogImage: document.querySelector('#productDialogImage'),
    productDialogFallback: document.querySelector('#productDialogFallback'),
    productDialogCategory: document.querySelector('#productDialogCategory'),
    productDialogTitle: document.querySelector('#productDialogTitle'),
    productDialogDescription: document.querySelector('#productDialogDescription'),
    productDialogPrice: document.querySelector('#productDialogPrice'),
    productDialogAvailability: document.querySelector('#productDialogAvailability'),
    productDialogNote: document.querySelector('#productDialogNote'),
    productQtyMinus: document.querySelector('#productQtyMinus'),
    productQtyPlus: document.querySelector('#productQtyPlus'),
    productQty: document.querySelector('#productQty'),
    confirmAddProduct: document.querySelector('#confirmAddProduct'),
    cartDrawer: document.querySelector('#cartDrawer'),
    closeCartBtn: document.querySelector('#closeCartBtn'),
    cartItems: document.querySelector('#cartItems'),
    orderForm: document.querySelector('#orderForm'),
    clearCartBtn: document.querySelector('#clearCartBtn'),
    submitOrderBtn: document.querySelector('#submitOrderBtn'),
    subtotal: document.querySelector('#subtotal'),
    deliveryFee: document.querySelector('#deliveryFee'),
    deliveryDistance: document.querySelector('#deliveryDistance'),
    paymentFeeRow: document.querySelector('#paymentFeeRow'),
    paymentFee: document.querySelector('#paymentFee'),
    cartTotal: document.querySelector('#cartTotal'),
    customerName: document.querySelector('#customerName'),
    customerPhone: document.querySelector('#customerPhone'),
    customerCep: document.querySelector('#customerCep'),
    customerStreet: document.querySelector('#customerStreet'),
    customerNumber: document.querySelector('#customerNumber'),
    customerNeighborhood: document.querySelector('#customerNeighborhood'),
    customerCity: document.querySelector('#customerCity'),
    searchCepBtn: document.querySelector('#searchCepBtn'),
    addressStatus: document.querySelector('#addressStatus'),
    paymentMethod: document.querySelector('#paymentMethod'),
    changeField: document.querySelector('#changeField'),
    changeAmount: document.querySelector('#changeAmount'),
    cardFeeNote: document.querySelector('#cardFeeNote'),
    orderNotes: document.querySelector('#orderNotes'),
    checkoutMessage: document.querySelector('#checkoutMessage'),
    confirmDialog: document.querySelector('#confirmDialog'),
    confirmTitle: document.querySelector('#confirmTitle'),
    confirmText: document.querySelector('#confirmText'),
    cancelConfirmBtn: document.querySelector('#cancelConfirmBtn'),
    acceptConfirmBtn: document.querySelector('#acceptConfirmBtn'),
    orderHandoffDialog: document.querySelector('#orderHandoffDialog'),
    orderHandoffTitle: document.querySelector('#orderHandoffTitle'),
    orderHandoffText: document.querySelector('#orderHandoffText'),
    closeOrderHandoff: document.querySelector('#closeOrderHandoff'),
    whatsAppOrderLink: document.querySelector('#whatsAppOrderLink'),
    confirmOrderSentBtn: document.querySelector('#confirmOrderSentBtn'),
    handoffTrackOrderBtn: document.querySelector('#handoffTrackOrderBtn'),
    afterOrderGame: document.querySelector('#afterOrderGame'),
    gameDialog: document.querySelector('#gameDialog'),
    closeGameBtn: document.querySelector('#closeGameBtn'),
    toast: document.querySelector('#toast'),
    toastMessage: document.querySelector('#toastMessage'),
    adminSection: document.querySelector('#admin'),
    openAdminBtn: document.querySelector('#openAdminBtn'),
    closeAdminBtn: document.querySelector('#closeAdminBtn'),
    adminLoginView: document.querySelector('#adminLoginView'),
    adminWorkspace: document.querySelector('#adminWorkspace'),
    loginForm: document.querySelector('#loginForm'),
    adminEmail: document.querySelector('#adminEmail'),
    adminPassword: document.querySelector('#adminPassword'),
    loginBtn: document.querySelector('#loginBtn'),
    loginMessage: document.querySelector('#loginMessage'),
    adminUser: document.querySelector('#adminUser'),
    logoutBtn: document.querySelector('#logoutBtn'),
    storeModeButtons: [...document.querySelectorAll('[data-store-mode]')],
    storeModeHint: document.querySelector('#storeModeHint'),
    productForm: document.querySelector('#productForm'),
    productId: document.querySelector('#productId'),
    productName: document.querySelector('#productName'),
    productCategory: document.querySelector('#productCategory'),
    productPrice: document.querySelector('#productPrice'),
    productImage: document.querySelector('#productImage'),
    productDescription: document.querySelector('#productDescription'),
    productBadge: document.querySelector('#productBadge'),
    productAvailability: document.querySelector('#productAvailability'),
    productFormTitle: document.querySelector('#productFormTitle'),
    productFormMessage: document.querySelector('#productFormMessage'),
    saveProductBtn: document.querySelector('#saveProductBtn'),
    cancelProductEdit: document.querySelector('#cancelProductEdit'),
    productTableBody: document.querySelector('#productTableBody'),
    adminProductCount: document.querySelector('#adminProductCount'),
    currentYear: document.querySelector('#currentYear')
};

const state = {
    products: [],
    category: 'all',
    cart: loadCart(),
    catalogReady: false,
    storeMode: 'auto',
    operationalSettings: {},
    store: getStoreStatus(new Date(), false),
    selectedProduct: null,
    selectedQuantity: 1,
    deliveryQuote: null,
    quoteController: null,
    quoteTimer: null,
    toastTimer: null,
    confirmAction: null,
    firebase: null,
    unsubscribeProducts: null,
    unsubscribeSettings: null,
    unsubscribeAuth: null,
    game: null,
    gamePromise: null,
    lastWhatsAppUrl: '',
    trackedOrderId: '',
    phase2: null,
    adminSearch: '',
    previousFocus: new Map()
};

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function showToast(message, type = 'success') {
    clearTimeout(state.toastTimer);
    dom.toastMessage.textContent = message;
    dom.toast.classList.toggle('is-error', type === 'error');
    dom.toast.querySelector('.toast__mark').textContent = type === 'error' ? '!' : '✓';
    dom.toast.hidden = false;
    state.toastTimer = setTimeout(() => { dom.toast.hidden = true; }, 3600);
}

function setFormMessage(element, message = '', type = 'error') {
    element.textContent = message;
    element.classList.toggle('is-success', type === 'success');
    element.hidden = !message;
}

function focusableElements(container) {
    return [...container.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hidden && element.offsetParent !== null);
}

function openOverlay(overlay, preferredFocus) {
    state.previousFocus.set(overlay, document.activeElement);
    overlay.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => {
        (preferredFocus || focusableElements(overlay)[0] || overlay.querySelector('[role="dialog"]'))?.focus();
    });
}

function closeOverlay(overlay) {
    overlay.hidden = true;
    if (![...document.querySelectorAll('.overlay')].some((element) => !element.hidden)) {
        document.body.classList.remove('modal-open');
    }
    const previous = state.previousFocus.get(overlay);
    state.previousFocus.delete(overlay);
    previous?.focus?.();
}

function topOverlay() {
    return [...document.querySelectorAll('.overlay')].filter((element) => !element.hidden).at(-1) || null;
}

function installDialogBehavior() {
    document.addEventListener('keydown', (event) => {
        const overlay = topOverlay();
        if (!overlay) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            if (overlay === dom.gameDialog) closeGame();
            else if (overlay === dom.confirmDialog) cancelConfirmation();
            else closeOverlay(overlay);
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = focusableElements(overlay);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    document.querySelectorAll('.overlay').forEach((overlay) => {
        overlay.addEventListener('click', (event) => {
            if (event.target !== overlay) return;
            if (overlay === dom.confirmDialog) return;
            if (overlay === dom.gameDialog) closeGame();
            else closeOverlay(overlay);
        });
    });
}

function loadCart() {
    try {
        const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.flatMap((item) => {
            const price = Number(item.price);
            const quantity = Math.min(99, Math.max(1, Math.trunc(Number(item.quantity) || 1)));
            if (!item.id || !item.name || !Number.isFinite(price) || price <= 0) return [];
            return [{
                id: String(item.id),
                name: String(item.name),
                price,
                quantity,
                image: isValidHttpUrl(item.image) ? String(item.image || '') : '',
                category: String(item.category || ''),
                description: String(item.description || ''),
                availability: item.availability !== false,
                badge: BADGE_LABELS[item.badge] ? item.badge : ''
            }];
        });
    } catch {
        return [];
    }
}

function saveCart() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
    } catch {
        showToast('A sacola funciona nesta página, mas não pôde ser salva para depois.', 'error');
    }
}

function updateCartCounts() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('[data-cart-count]').forEach((element) => { element.textContent = String(count); });
    document.querySelectorAll('[data-open-cart]').forEach((button) => {
        button.setAttribute('aria-label', `Abrir sacola, ${count} ${count === 1 ? 'item' : 'itens'}`);
    });
}

function appendImage(container, { src, alt, className = '', loading = 'lazy', fallbackClass = 'image-fallback' }) {
    if (!src) {
        const fallback = createElement('div', fallbackClass);
        fallback.innerHTML = '<span aria-hidden="true">♨</span><small>Foto chegando</small>';
        container.append(fallback);
        return fallback;
    }
    const image = createElement('img', className);
    image.src = src;
    image.alt = alt;
    image.loading = loading;
    image.decoding = 'async';
    image.addEventListener('error', () => {
        const fallback = createElement('div', fallbackClass);
        fallback.innerHTML = '<span aria-hidden="true">♨</span><small>Foto indisponível</small>';
        image.replaceWith(fallback);
    }, { once: true });
    container.append(image);
    return image;
}

function showMenuFeedback(message, kind = 'loading', action) {
    dom.menuFeedback.replaceChildren();
    dom.menuFeedback.className = `menu-feedback${kind === 'error' ? ' is-error' : ''}${kind === 'empty' ? ' is-empty' : ''}`;
    if (kind === 'loading') dom.menuFeedback.append(createElement('span', 'spinner'));
    dom.menuFeedback.append(createElement('span', '', message));
    if (action) {
        const retry = createElement('button', 'button button--quiet', action.label);
        retry.type = 'button';
        retry.addEventListener('click', action.callback);
        dom.menuFeedback.append(retry);
    }
    dom.menuFeedback.hidden = false;
}

function renderCategories() {
    const categories = [...new Set(state.products.map((product) => product.category))]
        .sort((a, b) => {
            const order = Object.keys(CATEGORY_LABELS);
            const indexA = order.indexOf(a);
            const indexB = order.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b, 'pt-BR');
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

    if (state.category !== 'all' && !categories.includes(state.category)) state.category = 'all';
    dom.categoryNav.replaceChildren();
    [['all', 'Todos'], ...categories.map((category) => [category, categoryLabel(category)])].forEach(([value, label]) => {
        const button = createElement('button', 'category-tab', label);
        button.type = 'button';
        button.role = 'tab';
        button.dataset.category = value;
        button.setAttribute('aria-selected', String(state.category === value));
        button.setAttribute('aria-controls', 'productGrid');
        button.addEventListener('click', () => {
            state.category = value;
            renderCategories();
            renderProducts();
        });
        dom.categoryNav.append(button);
    });
}

function canOrderProduct(product) {
    return product.availability && state.store.open;
}

function createBadge(product) {
    const label = badgeLabel(product.badge);
    return label ? createElement('span', 'product-badge', label) : null;
}

function createProductCard(product) {
    const article = createElement('article', `product-card${product.availability ? '' : ' is-unavailable'}`);
    const media = createElement('div', 'product-card__media');
    appendImage(media, { src: product.image, alt: product.name });
    const favorite = createElement('button', 'favorite-toggle', '♡');
    favorite.type = 'button';
    favorite.dataset.favoriteProduct = product.id;
    favorite.dataset.productName = product.name;
    favorite.setAttribute('aria-pressed', 'false');
    favorite.setAttribute('aria-label', `Adicionar ${product.name} aos favoritos`);
    favorite.addEventListener('click', () => state.phase2?.toggleFavorite(product.id));
    media.append(favorite);
    const badge = createBadge(product);
    if (badge) media.append(badge);
    if (!product.availability) media.append(createElement('span', 'availability-tag', 'Indisponível hoje'));

    const body = createElement('div', 'product-card__body');
    const meta = createElement('div', 'product-card__meta');
    meta.append(createElement('small', '', categoryLabel(product.category)), createElement('strong', '', money(product.price)));
    const title = createElement('h3', '', product.name);
    const description = createElement('p', 'product-card__description', product.description || 'Consulte a cozinha para saber mais sobre este item.');
    const actions = createElement('div', 'product-card__actions');
    const details = createElement('button', 'text-button', 'Ver detalhes');
    details.type = 'button';
    details.addEventListener('click', () => openProduct(product));
    const add = createElement('button', 'quick-add', '+');
    add.type = 'button';
    add.disabled = !canOrderProduct(product);
    add.setAttribute('aria-label', canOrderProduct(product) ? `Adicionar ${product.name} à sacola` : `${product.name} não pode ser adicionado agora`);
    add.addEventListener('click', () => addToCart(product, 1));
    actions.append(details, add);
    body.append(meta, title, description, actions);
    article.append(media, body);
    return article;
}

function renderProducts() {
    dom.productGrid.replaceChildren();
    dom.productGrid.setAttribute('aria-busy', 'false');
    const products = sortProducts(state.products, state.category);
    if (!products.length) {
        showMenuFeedback(
            state.products.length ? 'Ainda não há itens nesta categoria.' : 'O cardápio está sem produtos cadastrados.',
            'empty'
        );
        return;
    }
    dom.menuFeedback.hidden = true;
    products.forEach((product) => dom.productGrid.append(createProductCard(product)));
    state.phase2?.syncFavoriteButtons();
}

function renderHighlights() {
    const highlights = state.products.filter((product) => product.badge && product.availability);
    const hasHighlights = highlights.length > 0;
    dom.highlightsSection.hidden = !hasHighlights;
    dom.highlightsNavLink.hidden = !hasHighlights;
    dom.highlightRail.replaceChildren();
    if (!hasHighlights) return;

    highlights.forEach((product) => {
        const card = createElement('article', 'highlight-card');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Ver ${product.name}`);
        appendImage(card, { src: product.image, alt: '', fallbackClass: 'image-fallback' });
        const copy = createElement('div', 'highlight-card__copy');
        copy.append(createBadge(product), createElement('h3', '', product.name));
        copy.append(createElement('p', '', `${money(product.price)} · ${categoryLabel(product.category)}`));
        card.append(copy);
        const open = () => openProduct(product);
        card.addEventListener('click', open);
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                open();
            }
        });
        dom.highlightRail.append(card);
    });
}

function updateHeroImage() {
    const featured = state.products.find((product) => product.badge && product.image)
        || state.products
            .filter((product) => product.image && product.name.toLowerCase().includes('feijoada'))
            .sort((a, b) => a.name.length - b.name.length)[0]
        || state.products.find((product) => product.image);
    if (!featured) return;
    const fallbackSrc = 'imagens/Feijoada.jpeg';
    dom.heroFoodImage.addEventListener('error', () => {
        if (!dom.heroFoodImage.src.endsWith('/imagens/Feijoada.jpeg')) {
            dom.heroFoodImage.src = fallbackSrc;
            dom.heroFoodImage.alt = 'Barraca da Feijoada da Dayse em Piedade';
            dom.heroPhotoKicker.textContent = 'Desde 2019';
            dom.heroPhotoTitle.textContent = 'Da nossa cozinha em Piedade';
        }
    }, { once: true });
    dom.heroFoodImage.src = featured.image;
    dom.heroFoodImage.alt = `${featured.name}, do cardápio da Feijoada da Dayse`;
    dom.heroFoodImage.fetchPriority = 'high';
    dom.heroPhotoKicker.textContent = badgeLabel(featured.badge) || 'Da cozinha';
    dom.heroPhotoTitle.textContent = featured.name;
}

function renderCatalog() {
    renderCategories();
    renderProducts();
    renderHighlights();
    renderAdminTable();
    updateHeroImage();
}

function updateStoreStatus({ rerender = true } = {}) {
    state.store = getStoreStatus(new Date(), state.storeMode);
    const statusClass = state.store.open ? 'is-open' : 'is-closed';
    dom.headerStatus.classList.remove('is-open', 'is-closed');
    dom.storeCallout.classList.remove('is-open', 'is-closed');
    dom.headerStatus.classList.add(statusClass);
    dom.storeCallout.classList.add(statusClass);
    dom.headerStatusText.textContent = state.store.label;
    dom.storeStatusLabel.textContent = state.store.label;
    dom.storeStatusDetail.textContent = state.store.detail;
    dom.closedNotice.hidden = state.store.open;
    if (!state.store.open) {
        dom.closedNoticeTitle.textContent = state.store.reason === 'manual' ? 'Os pedidos foram pausados por agora.' : 'A cozinha está fechada agora.';
        dom.closedNoticeText.textContent = state.store.detail;
    }
    dom.submitOrderBtn.disabled = !state.store.open || !state.cart.length;
    if (!state.store.open) dom.submitOrderBtn.textContent = 'Pedidos fechados agora';
    else dom.submitOrderBtn.textContent = 'Enviar pedido para a cozinha';
    if (rerender && state.catalogReady) renderProducts();
}

function syncStoreModeControl() {
    const hints = {
        auto: 'Segue o horário configurado.',
        open: 'Pedidos liberados mesmo fora do horário.',
        closed: 'Pedidos pausados até você trocar o modo.'
    };
    dom.storeModeButtons.forEach((button) => {
        const active = button.dataset.storeMode === state.storeMode;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('is-active', active);
    });
    dom.storeModeHint.textContent = hints[state.storeMode] || hints.auto;
}

function openProduct(product) {
    state.selectedProduct = product;
    state.selectedQuantity = 1;
    dom.productQty.textContent = '1';
    dom.productDialogCategory.textContent = categoryLabel(product.category);
    dom.productDialogTitle.textContent = product.name;
    dom.productDialogDescription.textContent = product.description || 'A cozinha pode informar mais detalhes pelo WhatsApp.';
    dom.productDialogPrice.textContent = money(product.price);
    dom.productDialogImage.hidden = !product.image;
    dom.productDialogFallback.hidden = Boolean(product.image);
    if (product.image) {
        dom.productDialogImage.src = product.image;
        dom.productDialogImage.alt = product.name;
    } else {
        dom.productDialogImage.removeAttribute('src');
        dom.productDialogImage.alt = '';
    }
    const canOrder = canOrderProduct(product);
    dom.productDialogAvailability.textContent = !product.availability ? 'Indisponível hoje' : state.store.open ? 'Disponível' : 'Cozinha fechada';
    dom.productDialogAvailability.classList.toggle('is-unavailable', !canOrder);
    dom.confirmAddProduct.disabled = !canOrder;
    dom.productQtyMinus.disabled = !canOrder;
    dom.productQtyPlus.disabled = !canOrder;
    dom.productDialogNote.textContent = canOrder ? '' : !product.availability ? 'Este item foi pausado pela cozinha.' : state.store.detail;
    openOverlay(dom.productDialog, dom.closeProductDialog);
}

function addToCart(product, quantity = 1) {
    if (!product.availability) {
        showToast('Este item está indisponível hoje.', 'error');
        return false;
    }
    if (!state.store.open) {
        showToast(`A cozinha está fechada. ${state.store.detail}`, 'error');
        return false;
    }
    state.cart = addCartItem(state.cart, product, quantity);
    saveCart();
    updateCartCounts();
    renderCart();
    document.querySelectorAll('[data-open-cart]').forEach((button) => {
        button.classList.remove('is-bumping');
        requestAnimationFrame(() => button.classList.add('is-bumping'));
    });
    showToast(`${product.name} entrou na sacola.`);
    return true;
}

function removeCartItem(id) {
    state.cart = state.cart.filter((item) => item.id !== id);
    saveCart();
    updateCartCounts();
    renderCart();
}

function updateCartQuantity(id, change) {
    state.cart = changeCartQuantity(state.cart, id, change);
    saveCart();
    updateCartCounts();
    renderCart();
}

function createCartItem(item) {
    const row = createElement('article', 'cart-item');
    appendImage(row, { src: item.image, alt: '', fallbackClass: 'cart-photo-fallback' });
    const copy = createElement('div', 'cart-item__copy');
    copy.append(createElement('strong', '', item.name), createElement('small', '', `${money(item.price)} cada`));
    const quantity = createElement('div', 'cart-quantity');
    const minus = createElement('button', '', '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', `Diminuir ${item.name}`);
    minus.addEventListener('click', () => updateCartQuantity(item.id, -1));
    const output = createElement('output', '', String(item.quantity));
    output.setAttribute('aria-label', `Quantidade: ${item.quantity}`);
    const plus = createElement('button', '', '+');
    plus.type = 'button';
    plus.setAttribute('aria-label', `Aumentar ${item.name}`);
    plus.addEventListener('click', () => updateCartQuantity(item.id, 1));
    quantity.append(minus, output, plus);
    copy.append(quantity);

    const end = createElement('div', 'cart-item__end');
    end.append(createElement('strong', '', money(item.price * item.quantity)));
    const remove = createElement('button', 'remove-item', 'Remover');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remover ${item.name} da sacola`);
    remove.addEventListener('click', () => removeCartItem(item.id));
    end.append(remove);
    row.append(copy, end);
    return row;
}

function totals() {
    const subtotal = cartSubtotal(state.cart);
    const deliveryFee = state.deliveryQuote?.status === 'ready' ? state.deliveryQuote.fee : 0;
    const cardFee = paymentFee(dom.paymentMethod.value);
    return { subtotal, deliveryFee, paymentFee: cardFee, total: subtotal + deliveryFee + cardFee };
}

function renderTotals() {
    const values = totals();
    dom.subtotal.textContent = money(values.subtotal);
    dom.paymentFee.textContent = money(values.paymentFee);
    dom.paymentFeeRow.hidden = values.paymentFee === 0;
    dom.cartTotal.textContent = money(values.total);

    if (!state.cart.length) {
        dom.deliveryFee.textContent = '—';
        dom.deliveryDistance.textContent = '';
    } else if (state.deliveryQuote?.status === 'pending') {
        dom.deliveryFee.textContent = 'Calculando...';
        dom.deliveryDistance.textContent = '';
    } else if (state.deliveryQuote?.status === 'ready') {
        dom.deliveryFee.textContent = money(state.deliveryQuote.fee);
        dom.deliveryDistance.textContent = state.deliveryQuote.distance === null
            ? '(por bairro)'
            : `(${state.deliveryQuote.distance.toFixed(1)} km)`;
    } else if (state.deliveryQuote?.status === 'error') {
        dom.deliveryFee.textContent = 'A confirmar';
        dom.deliveryDistance.textContent = '';
    } else {
        dom.deliveryFee.textContent = 'Informe o endereço';
        dom.deliveryDistance.textContent = '';
    }
    dom.submitOrderBtn.disabled = !state.cart.length || !state.store.open;
}

function renderCart() {
    dom.cartItems.replaceChildren();
    const empty = state.cart.length === 0;
    dom.orderForm.hidden = empty;
    dom.clearCartBtn.hidden = empty;
    if (empty) {
        const container = createElement('div', 'empty-cart');
        container.innerHTML = '<span aria-hidden="true">♨</span><strong>Sacola vazia</strong><p>Escolha um prato no cardápio e ele aparece aqui.</p>';
        dom.cartItems.append(container);
    } else {
        state.cart.forEach((item) => dom.cartItems.append(createCartItem(item)));
    }
    updateStoreStatus({ rerender: false });
    renderTotals();
}

function openCart() {
    renderCart();
    openOverlay(dom.cartDrawer, dom.closeCartBtn);
}

function askConfirmation({ title, text, confirmLabel = 'Confirmar', action }) {
    state.confirmAction = action;
    dom.confirmTitle.textContent = title;
    dom.confirmText.textContent = text;
    dom.acceptConfirmBtn.textContent = confirmLabel;
    dom.acceptConfirmBtn.disabled = false;
    openOverlay(dom.confirmDialog, dom.cancelConfirmBtn);
}

function cancelConfirmation() {
    state.confirmAction = null;
    closeOverlay(dom.confirmDialog);
}

function clearCart({ resetForm = false } = {}) {
    state.cart = [];
    state.deliveryQuote = null;
    saveCart();
    updateCartCounts();
    if (resetForm) dom.orderForm.reset();
    renderCart();
}

function fullAddress() {
    const street = dom.customerStreet.value.trim();
    const number = dom.customerNumber.value.trim();
    const neighborhood = dom.customerNeighborhood.value.trim();
    const city = dom.customerCity.value.trim();
    const cep = dom.customerCep.value.trim();
    if (!street || !number || !neighborhood || !city) return '';
    return `${street}, ${number} - ${neighborhood}, ${city}${cep ? `, CEP ${cep}` : ''}`;
}

async function fetchCep(cep) {
    try {
        const viaCep = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache: 'no-store' });
        if (viaCep.ok) {
            const data = await viaCep.json();
            if (!data.erro) return data;
        }
    } catch {
        // O segundo provedor mantém a busca funcional se o ViaCEP estiver fora do ar.
    }
    const fallback = await fetch(`https://cep.awesomeapi.com.br/json/${cep}`, { cache: 'no-store' });
    if (!fallback.ok) throw new Error('CEP não encontrado');
    const data = await fallback.json();
    return {
        logradouro: data.address || data.street || '',
        bairro: data.district || data.neighborhood || '',
        localidade: data.city || '',
        uf: data.state || ''
    };
}

async function searchCep() {
    const cep = dom.customerCep.value.replace(/\D/g, '');
    if (cep.length !== 8) {
        dom.customerCep.setAttribute('aria-invalid', 'true');
        setAddressStatus('Digite os 8 números do CEP.', 'error');
        return;
    }
    dom.customerCep.removeAttribute('aria-invalid');
    dom.searchCepBtn.disabled = true;
    dom.searchCepBtn.textContent = 'Buscando...';
    setAddressStatus('Procurando o endereço...');
    try {
        const data = await fetchCep(cep);
        dom.customerStreet.value = data.logradouro || '';
        dom.customerNeighborhood.value = data.bairro || '';
        dom.customerCity.value = [data.localidade, data.uf].filter(Boolean).join(' / ');
        setAddressStatus('Endereço encontrado. Confira e informe o número.', 'success');
        dom.customerNumber.focus();
        scheduleDeliveryQuote(0);
    } catch (error) {
        console.error('Falha ao buscar CEP:', error);
        setAddressStatus('Não encontramos esse CEP. Você pode preencher o endereço manualmente.', 'error');
        dom.customerStreet.focus();
    } finally {
        dom.searchCepBtn.disabled = false;
        dom.searchCepBtn.textContent = 'Buscar CEP';
    }
}

function setAddressStatus(message, type = '') {
    dom.addressStatus.textContent = message;
    dom.addressStatus.className = `address-status${type ? ` is-${type}` : ''}`;
}

function scheduleDeliveryQuote(delay = 550) {
    clearTimeout(state.quoteTimer);
    state.deliveryQuote = null;
    renderTotals();
    state.quoteTimer = setTimeout(calculateDeliveryQuote, delay);
}

async function calculateDeliveryQuote() {
    const address = fullAddress();
    if (!address) return;
    state.quoteController?.abort();
    state.quoteController = new AbortController();
    state.deliveryQuote = { status: 'pending', fee: 0, distance: null };
    renderTotals();
    setAddressStatus('Calculando a entrega...');

    const query = `${address}, Brasil`;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
        const response = await fetch(url, {
            signal: state.quoteController.signal,
            headers: { 'Accept-Language': 'pt-BR' }
        });
        if (!response.ok) throw new Error('Falha na geocodificação');
        const data = await response.json();
        if (!Array.isArray(data) || !data.length) throw new Error('Endereço não localizado');
        const point = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
        const distance = haversineKm(STORE_LOCATION, point);
        const fee = deliveryFeeFromDistance(distance);
        if (fee === null) throw new Error('Distância inválida');
        state.deliveryQuote = { status: 'ready', fee, distance, source: 'distance' };
        setAddressStatus(`Entrega calculada para ${distance.toFixed(1)} km.`, 'success');
    } catch (error) {
        if (error.name === 'AbortError') return;
        const neighborhoodFee = deliveryFeeFromNeighborhood(dom.customerNeighborhood.value);
        if (neighborhoodFee !== null) {
            state.deliveryQuote = { status: 'ready', fee: neighborhoodFee, distance: null, source: 'neighborhood' };
            setAddressStatus('Entrega calculada pela tabela do bairro.', 'success');
        } else {
            console.error('Falha ao calcular entrega:', error);
            state.deliveryQuote = { status: 'error', fee: 0, distance: null };
            setAddressStatus('Não foi possível calcular a entrega. Revise o endereço ou fale com a cozinha.', 'error');
        }
    } finally {
        renderTotals();
    }
}

function validateCheckout() {
    setFormMessage(dom.checkoutMessage);
    if (!state.store.open) return `A cozinha está fechada. ${state.store.detail}`;
    if (!state.cart.length) return 'Sua sacola está vazia.';
    const unavailable = state.cart.find((item) => {
        const current = state.products.find((product) => product.id === item.id);
        return !current || !current.availability;
    });
    if (unavailable) return `${unavailable.name} não está mais disponível. Remova o item para continuar.`;
    if (!dom.orderForm.checkValidity()) {
        dom.orderForm.reportValidity();
        return 'Confira os campos obrigatórios do pedido.';
    }
    const phoneDigits = dom.customerPhone.value.replace(/\D/g, '');
    if (phoneDigits.length < 10) return 'Digite um telefone com DDD.';
    if (!fullAddress()) return 'Complete o endereço de entrega.';
    if (state.deliveryQuote?.status !== 'ready') return 'Aguarde o cálculo da entrega ou revise o endereço.';
    const values = totals();
    const change = Number(dom.changeAmount.value || 0);
    if (dom.paymentMethod.value === 'Dinheiro' && change > 0 && change < values.total) {
        return `O valor do troco precisa ser pelo menos ${money(values.total)}.`;
    }
    return '';
}

function resetOrderHandoff() {
    dom.orderHandoffTitle.textContent = state.trackedOrderId ? 'Seu pedido chegou à cozinha.' : 'Não foi possível registrar o pedido.';
    dom.orderHandoffText.textContent = state.trackedOrderId
        ? 'Aguarde a confirmação do restaurante e acompanhe cada etapa por aqui.'
        : 'Tente novamente. Se o sistema continuar indisponível, use o WhatsApp como contingência.';
    dom.whatsAppOrderLink.hidden = false;
    dom.confirmOrderSentBtn.hidden = !state.trackedOrderId;
    dom.handoffTrackOrderBtn.hidden = !state.trackedOrderId;
    dom.afterOrderGame.hidden = true;
}

async function submitOrder(event) {
    event.preventDefault();
    const error = validateCheckout();
    if (error) {
        setFormMessage(dom.checkoutMessage, error);
        showToast(error, 'error');
        return;
    }

    const orderData = {
        customer: {
            name: dom.customerName.value.trim(),
            phone: dom.customerPhone.value.trim(),
            address: fullAddress()
        },
        cart: state.cart,
        totals: totals(),
        paymentMethod: dom.paymentMethod.value,
        changeAmount: dom.changeAmount.value,
        notes: dom.orderNotes.value.trim(),
        fulfillment: 'delivery',
        delivery: {
            cep: dom.customerCep.value.trim(), street: dom.customerStreet.value.trim(), number: dom.customerNumber.value.trim(),
            neighborhood: dom.customerNeighborhood.value.trim(), city: dom.customerCity.value.trim(), quote: state.deliveryQuote
        }
    };
    state.trackedOrderId = '';
    dom.submitOrderBtn.disabled = true;
    dom.submitOrderBtn.textContent = 'Enviando para a cozinha…';
    try {
        const tracked = await state.phase2.createTrackedOrder({
            items: state.cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
            customer: orderData.customer,
            delivery: orderData.delivery,
            paymentMethod: orderData.paymentMethod,
            changeAmount: Number(orderData.changeAmount || 0),
            notes: orderData.notes
        });
        state.trackedOrderId = tracked?.orderId || '';
        if (!state.trackedOrderId) throw new Error('O servidor não retornou o pedido criado.');
        orderData.orderId = `FD-${state.trackedOrderId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()}`;
    } catch (trackingError) {
        console.error('Pedido não pôde ser registrado:', trackingError);
        showToast('O pedido não foi enviado. Tente novamente ou use o WhatsApp.', 'error');
    } finally {
        dom.submitOrderBtn.textContent = 'Enviar pedido para a cozinha';
        renderTotals();
    }
    const message = buildWhatsAppMessage(orderData);
    state.lastWhatsAppUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    dom.whatsAppOrderLink.href = state.lastWhatsAppUrl;
    resetOrderHandoff();
    closeOverlay(dom.cartDrawer);
    openOverlay(dom.orderHandoffDialog, state.trackedOrderId ? dom.handoffTrackOrderBtn : dom.whatsAppOrderLink);
}

async function openGame() {
    if (!dom.orderHandoffDialog.hidden) closeOverlay(dom.orderHandoffDialog);
    openOverlay(dom.gameDialog, dom.closeGameBtn);
    if (!state.gamePromise) {
        state.gamePromise = import('./game.mjs?v=2.2.0').then(({ createGame }) => createGame({
            canvas: document.querySelector('#gameCanvas'),
            scoreElement: document.querySelector('#gameScore'),
            bestElement: document.querySelector('#gameBest'),
            startCard: document.querySelector('#gameStartCard'),
            stateTitle: document.querySelector('#gameStateTitle'),
            stateText: document.querySelector('#gameStateText'),
            startButton: document.querySelector('#startGameBtn'),
            pauseButton: document.querySelector('#pauseGameBtn'),
            announcement: document.querySelector('#gameAnnouncement'),
            controlButtons: document.querySelectorAll('[data-direction]'),
            soundButton: document.querySelector('#gameSoundBtn'),
            comboElement: document.querySelector('#gameCombo'),
            powerElement: document.querySelector('#gamePower'),
            onStart: () => state.phase2?.beginGameSession(),
            onGameOver: (stats) => state.phase2?.finishGame(stats)
        })).then((game) => {
            state.game = game;
            return game;
        }).catch((error) => {
            state.gamePromise = null;
            console.error('Falha ao iniciar jogo:', error);
            closeOverlay(dom.gameDialog);
            showToast('O jogo não carregou. Tente novamente.', 'error');
        });
    }
    const game = await state.gamePromise;
    game?.setActive(true);
}

function closeGame() {
    state.game?.setActive(false);
    closeOverlay(dom.gameDialog);
}

function openAdmin() {
    dom.adminSection.hidden = false;
    dom.adminSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => (dom.adminWorkspace.hidden ? dom.adminEmail : dom.storeModeButtons.find((button) => button.getAttribute('aria-pressed') === 'true')).focus(), 300);
}

function closeAdmin() {
    dom.adminSection.hidden = true;
    document.querySelector('#contato').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setAdminAuthView(context = {}) {
    context ||= {};
    const { user = null, isAdmin = false } = context;
    dom.adminLoginView.hidden = isAdmin;
    dom.adminWorkspace.hidden = !isAdmin;
    dom.adminUser.textContent = isAdmin ? user?.email || '' : '';
    if (user && !isAdmin) setFormMessage(dom.loginMessage, 'Esta é uma conta de cliente. Use uma conta com permissão administrativa.');
    else if (!user) setFormMessage(dom.loginMessage);
    if (!isAdmin) resetProductForm();
}

function resetProductForm() {
    dom.productForm.reset();
    dom.productId.value = '';
    dom.productAvailability.checked = true;
    dom.productFormTitle.textContent = 'Adicionar produto';
    dom.saveProductBtn.textContent = 'Salvar produto';
    dom.cancelProductEdit.hidden = true;
    setFormMessage(dom.productFormMessage);
}

function editProduct(product) {
    dom.productId.value = product.id;
    dom.productName.value = product.name;
    dom.productCategory.value = product.category;
    dom.productPrice.value = String(product.price);
    dom.productImage.value = product.image;
    dom.productDescription.value = product.description;
    dom.productBadge.value = product.badge;
    dom.productAvailability.checked = product.availability;
    dom.productFormTitle.textContent = `Editar ${product.name}`;
    dom.saveProductBtn.textContent = 'Salvar alterações';
    dom.cancelProductEdit.hidden = false;
    setFormMessage(dom.productFormMessage);
    dom.productForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    dom.productName.focus({ preventScroll: true });
}

function renderAdminTable() {
    dom.productTableBody.replaceChildren();
    dom.adminProductCount.textContent = `${state.products.length} ${state.products.length === 1 ? 'item' : 'itens'}`;
    if (!state.products.length) {
        const row = createElement('tr');
        const cell = createElement('td', '', 'Nenhum produto cadastrado.');
        cell.colSpan = 5;
        row.append(cell);
        dom.productTableBody.append(row);
        return;
    }

    const query = normalizeText(state.adminSearch);
    sortProducts(state.products).filter((product) => !query || normalizeText(`${product.name} ${product.category}`).includes(query)).forEach((product) => {
        const row = createElement('tr');
        const productCell = createElement('td');
        const productWrap = createElement('div', 'table-product');
        appendImage(productWrap, { src: product.image, alt: '', fallbackClass: 'table-photo-fallback' });
        productWrap.append(createElement('strong', '', product.name));
        productCell.append(productWrap);
        const categoryCell = createElement('td', '', categoryLabel(product.category));
        const priceCell = createElement('td', '', money(product.price));
        const statusCell = createElement('td');
        const statusButton = createElement('button', 'availability-toggle', product.availability ? 'Disponível' : 'Pausado');
        statusButton.type = 'button';
        statusButton.dataset.productId = product.id;
        statusButton.dataset.action = 'availability';
        statusButton.setAttribute('aria-pressed', String(product.availability));
        statusCell.append(statusButton);
        const actionsCell = createElement('td');
        const actions = createElement('div', 'table-actions');
        const edit = createElement('button', 'table-action', 'Editar');
        edit.type = 'button';
        edit.dataset.productId = product.id;
        edit.dataset.action = 'edit';
        const remove = createElement('button', 'table-action table-action--delete', 'Excluir');
        remove.type = 'button';
        remove.dataset.productId = product.id;
        remove.dataset.action = 'delete';
        actions.append(edit, remove);
        actionsCell.append(actions);
        row.append(productCell, categoryCell, priceCell, statusCell, actionsCell);
        dom.productTableBody.append(row);
    });
}

async function submitLogin(event) {
    event.preventDefault();
    setFormMessage(dom.loginMessage);
    if (!dom.loginForm.checkValidity()) {
        dom.loginForm.reportValidity();
        return;
    }
    dom.loginBtn.disabled = true;
    dom.loginBtn.textContent = 'Entrando...';
    try {
        await state.firebase.signIn(dom.adminEmail.value.trim(), dom.adminPassword.value);
        dom.adminPassword.value = '';
        showToast('Painel liberado.');
    } catch (error) {
        setFormMessage(dom.loginMessage, state.firebase.firebaseErrorMessage(error, 'entrar'));
    } finally {
        dom.loginBtn.disabled = false;
        dom.loginBtn.textContent = 'Entrar';
    }
}

async function submitProduct(event) {
    event.preventDefault();
    setFormMessage(dom.productFormMessage);
    if (!dom.productForm.checkValidity()) {
        dom.productForm.reportValidity();
        setFormMessage(dom.productFormMessage, 'Confira os campos obrigatórios.');
        return;
    }
    const image = dom.productImage.value.trim();
    if (!isValidHttpUrl(image)) {
        dom.productImage.setAttribute('aria-invalid', 'true');
        setFormMessage(dom.productFormMessage, 'Use uma URL de imagem começando com http:// ou https://.');
        return;
    }
    dom.productImage.removeAttribute('aria-invalid');
    const product = {
        name: dom.productName.value.trim(),
        category: dom.productCategory.value,
        price: Number(dom.productPrice.value),
        image,
        description: dom.productDescription.value.trim(),
        badge: dom.productBadge.value,
        availability: dom.productAvailability.checked
    };
    dom.saveProductBtn.disabled = true;
    dom.saveProductBtn.textContent = 'Salvando...';
    try {
        const editing = Boolean(dom.productId.value);
        await state.firebase.saveProduct(dom.productId.value, product);
        resetProductForm();
        showToast(editing ? 'Produto atualizado.' : 'Produto adicionado.');
    } catch (error) {
        setFormMessage(dom.productFormMessage, state.firebase.firebaseErrorMessage(error, 'salvar o produto'));
    } finally {
        dom.saveProductBtn.disabled = false;
        if (dom.productId.value) dom.saveProductBtn.textContent = 'Salvar alterações';
    }
}

async function handleAdminTableClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const product = state.products.find((item) => item.id === button.dataset.productId);
    if (!product) return;

    if (button.dataset.action === 'edit') {
        editProduct(product);
        return;
    }

    if (button.dataset.action === 'availability') {
        button.disabled = true;
        try {
            await state.firebase.setProductAvailability(product.id, !product.availability);
            showToast(product.availability ? 'Produto pausado.' : 'Produto disponibilizado.');
        } catch (error) {
            showToast(state.firebase.firebaseErrorMessage(error, 'alterar a disponibilidade'), 'error');
            button.disabled = false;
        }
        return;
    }

    if (button.dataset.action === 'delete') {
        askConfirmation({
            title: `Excluir ${product.name}?`,
            text: 'O produto será removido do cardápio. Esta ação não pode ser desfeita.',
            confirmLabel: 'Excluir produto',
            action: async () => {
                await state.firebase.deleteProduct(product.id);
                if (dom.productId.value === product.id) resetProductForm();
                showToast('Produto excluído.');
            }
        });
    }
}

async function initializeFirebase() {
    showMenuFeedback('Buscando o cardápio da cozinha...');
    dom.productGrid.setAttribute('aria-busy', 'true');
    try {
        state.firebase = await import('./firebase.mjs?v=2.2.0');
        state.unsubscribeProducts?.();
        state.unsubscribeSettings?.();
        state.unsubscribeProducts = state.firebase.subscribeProducts((products) => {
            state.products = products;
            state.catalogReady = true;
            state.cart = reconcileCart(state.cart, products);
            saveCart();
            updateCartCounts();
            renderCatalog();
            renderCart();
        }, (error) => {
            console.error('Falha ao carregar cardápio:', error);
            state.catalogReady = false;
            showMenuFeedback(state.firebase.firebaseErrorMessage(error, 'carregar o cardápio'), 'error', {
                label: 'Tentar novamente',
                callback: initializeFirebase
            });
        });
        state.unsubscribeSettings = state.firebase.subscribeSettings((settings) => {
            state.operationalSettings = settings || {};
            state.storeMode = ['auto', 'open', 'closed'].includes(settings?.storeMode)
                ? settings.storeMode
                : settings?.isClosed === true ? 'closed' : 'auto';
            syncStoreModeControl();
            updateStoreStatus();
            state.phase2?.applySettings(settings);
        }, (error) => {
            console.error('Falha ao carregar status da loja:', error);
            state.storeMode = 'auto';
            updateStoreStatus();
        });
        if (!state.phase2) {
            state.phase2 = initCustomerExperience({
                firebase: state.firebase,
                openOverlay, closeOverlay, openGame, openCart, askConfirmation, showToast,
                getProducts: () => state.products,
                replaceCart: (cart) => { state.cart = cart; saveCart(); updateCartCounts(); renderCart(); },
                addProduct: (product) => addToCart(product, 1),
                prefillCustomer: (profile, address) => {
                    if (profile?.displayName && !dom.customerName.value) dom.customerName.value = profile.displayName;
                    if (profile?.phone && !dom.customerPhone.value) dom.customerPhone.value = profile.phone;
                    if (address && !dom.customerStreet.value) {
                        dom.customerCep.value = address.cep || ''; dom.customerStreet.value = address.street || ''; dom.customerNumber.value = address.number || '';
                        dom.customerNeighborhood.value = address.neighborhood || ''; dom.customerCity.value = address.city || ''; scheduleDeliveryQuote(0);
                    }
                },
                onAuthContext: setAdminAuthView,
                filterAdminProducts: (query) => { state.adminSearch = query; renderAdminTable(); },
                handleError: (error) => { console.error(error); showToast(state.firebase.firebaseErrorMessage(error, 'carregar os dados'), 'error'); }
            });
            state.phase2.applySettings(state.operationalSettings);
        }
    } catch (error) {
        console.error('Falha ao iniciar Firebase:', error);
        state.catalogReady = false;
        showMenuFeedback('Não foi possível conectar ao cardápio. Confira sua internet e tente novamente.', 'error', {
            label: 'Tentar novamente',
            callback: initializeFirebase
        });
        setAdminAuthView(null);
    }
}

function installEvents() {
    installDialogBehavior();
    document.querySelectorAll('[data-open-cart]').forEach((button) => button.addEventListener('click', openCart));
    document.querySelectorAll('[data-open-game]').forEach((button) => button.addEventListener('click', openGame));
    dom.closeProductDialog.addEventListener('click', () => closeOverlay(dom.productDialog));
    dom.closeCartBtn.addEventListener('click', () => closeOverlay(dom.cartDrawer));
    dom.closeOrderHandoff.addEventListener('click', () => closeOverlay(dom.orderHandoffDialog));
    dom.closeGameBtn.addEventListener('click', closeGame);
    dom.productDialogImage.addEventListener('error', () => {
        dom.productDialogImage.hidden = true;
        dom.productDialogFallback.hidden = false;
    });
    dom.productQtyMinus.addEventListener('click', () => {
        state.selectedQuantity = Math.max(1, state.selectedQuantity - 1);
        dom.productQty.textContent = String(state.selectedQuantity);
    });
    dom.productQtyPlus.addEventListener('click', () => {
        state.selectedQuantity = Math.min(20, state.selectedQuantity + 1);
        dom.productQty.textContent = String(state.selectedQuantity);
    });
    dom.confirmAddProduct.addEventListener('click', () => {
        if (state.selectedProduct && addToCart(state.selectedProduct, state.selectedQuantity)) {
            closeOverlay(dom.productDialog);
        }
    });

    dom.clearCartBtn.addEventListener('click', () => askConfirmation({
        title: 'Esvaziar a sacola?',
        text: 'Todos os itens escolhidos serão removidos.',
        confirmLabel: 'Esvaziar sacola',
        action: () => {
            clearCart();
            showToast('Sacola esvaziada.');
        }
    }));
    dom.cancelConfirmBtn.addEventListener('click', cancelConfirmation);
    dom.acceptConfirmBtn.addEventListener('click', async () => {
        if (!state.confirmAction) return;
        const action = state.confirmAction;
        dom.acceptConfirmBtn.disabled = true;
        dom.acceptConfirmBtn.textContent = 'Aguarde...';
        try {
            await action();
            cancelConfirmation();
        } catch (error) {
            showToast(state.firebase?.firebaseErrorMessage(error, 'concluir a ação') || 'Não foi possível concluir a ação.', 'error');
            dom.acceptConfirmBtn.disabled = false;
            dom.acceptConfirmBtn.textContent = 'Tentar novamente';
        }
    });

    dom.customerCep.addEventListener('input', () => {
        dom.customerCep.value = formatCep(dom.customerCep.value);
        if (dom.customerCep.value.replace(/\D/g, '').length === 8) dom.customerCep.removeAttribute('aria-invalid');
        scheduleDeliveryQuote();
    });
    dom.customerPhone.addEventListener('input', () => { dom.customerPhone.value = formatPhone(dom.customerPhone.value); });
    dom.searchCepBtn.addEventListener('click', searchCep);
    [dom.customerStreet, dom.customerNumber, dom.customerNeighborhood, dom.customerCity]
        .forEach((input) => input.addEventListener('input', () => scheduleDeliveryQuote()));
    dom.paymentMethod.addEventListener('change', () => {
        const cash = dom.paymentMethod.value === 'Dinheiro';
        const card = dom.paymentMethod.value.startsWith('Cartão');
        dom.changeField.hidden = !cash;
        dom.changeAmount.required = false;
        dom.cardFeeNote.hidden = !card;
        renderTotals();
    });
    dom.orderForm.addEventListener('submit', submitOrder);
    dom.confirmOrderSentBtn.addEventListener('click', () => {
        clearCart({ resetForm: true });
        dom.orderHandoffTitle.textContent = 'Pedido recebido.';
        dom.orderHandoffText.textContent = 'A sacola foi limpa. Você pode acompanhar o pedido pela sua conta.';
        dom.confirmOrderSentBtn.hidden = true;
        dom.afterOrderGame.hidden = false;
        showToast('Sacola limpa. Bom apetite!');
    });
    dom.handoffTrackOrderBtn.addEventListener('click', () => {
        if (!state.trackedOrderId) return;
        closeOverlay(dom.orderHandoffDialog);
        state.phase2?.openTracking(state.trackedOrderId);
    });

    dom.openAdminBtn.addEventListener('click', openAdmin);
    dom.closeAdminBtn.addEventListener('click', closeAdmin);
    dom.loginForm.addEventListener('submit', submitLogin);
    dom.logoutBtn.addEventListener('click', async () => {
        try {
            await state.firebase.signOut();
            showToast('Sessão encerrada.');
        } catch (error) {
            showToast(state.firebase.firebaseErrorMessage(error, 'sair'), 'error');
        }
    });
    dom.productForm.addEventListener('submit', submitProduct);
    dom.cancelProductEdit.addEventListener('click', resetProductForm);
    dom.productTableBody.addEventListener('click', handleAdminTableClick);
    dom.storeModeButtons.forEach((button) => button.addEventListener('click', async () => {
        const previousMode = state.storeMode;
        const nextMode = button.dataset.storeMode;
        if (nextMode === previousMode) return;
        state.storeMode = nextMode;
        syncStoreModeControl();
        updateStoreStatus();
        dom.storeModeButtons.forEach((item) => { item.disabled = true; });
        try {
            await state.firebase.setStoreMode(nextMode);
            const messages = { auto: 'Funcionamento automático ativado.', open: 'Restaurante aberto manualmente.', closed: 'Pedidos pausados manualmente.' };
            showToast(messages[nextMode]);
        } catch (error) {
            state.storeMode = previousMode;
            syncStoreModeControl();
            updateStoreStatus();
            showToast(state.firebase.firebaseErrorMessage(error, 'alterar o funcionamento'), 'error');
        } finally {
            dom.storeModeButtons.forEach((item) => { item.disabled = false; });
        }
    }));

    window.addEventListener('online', () => {
        showToast('Conexão restabelecida.');
        if (!state.catalogReady) initializeFirebase();
    });
    window.addEventListener('offline', () => showToast('Você está offline. O cardápio pode ficar desatualizado.', 'error'));
}

function init() {
    dom.currentYear.textContent = String(new Date().getFullYear());
    installEvents();
    updateCartCounts();
    renderCart();
    updateStoreStatus({ rerender: false });
    setInterval(() => updateStoreStatus(), 60_000);
    initializeFirebase();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        navigator.serviceWorker.register('./firebase-messaging-sw.js').catch((error) => console.warn('Service Worker indisponível:', error));
    }
}

init();
