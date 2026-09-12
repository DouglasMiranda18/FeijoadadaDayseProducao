import {
    friendlyOrderId,
    financialSummary,
    loyaltyLevel,
    orderBeverages,
    orderFlow,
    publicName,
    rankEntries,
    reorderFromHistory,
    statusLabel,
    unreadCount,
    validNextStatuses
} from './account-core.mjs?v=2.7.2';
import { formatPhone, haversineKm, money, normalizeText } from './core.mjs?v=2.7.2';

const VAPID_KEY = document.querySelector('meta[name="firebase-vapid-key"]')?.content.trim() || '';
const ACTIVE_DELIVERY_STORAGE_KEY = 'feijoada-dayse-active-courier-delivery';

function el(tag, className = '', text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function stampDate(value) {
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    return date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
        : 'Agora';
}

export function initCustomerExperience(api) {
    const { firebase } = api;
    const dom = {
        accountBtn: document.querySelector('#accountBtn'), accountLabel: document.querySelector('#accountLabel'), accountAvatar: document.querySelector('#accountAvatar'),
        authDialog: document.querySelector('#authDialog'), authForm: document.querySelector('#customerAuthForm'), authTitle: document.querySelector('#authTitle'),
        authNameField: document.querySelector('#authNameField'), authPhoneField: document.querySelector('#authPhoneField'), authName: document.querySelector('#authName'), authPhone: document.querySelector('#authPhone'),
        authEmail: document.querySelector('#authEmail'), authPassword: document.querySelector('#authPassword'), authPasswordField: document.querySelector('#authPasswordField'), authSubmit: document.querySelector('#authSubmitBtn'), authMessage: document.querySelector('#authMessage'),
        googleLogin: document.querySelector('#googleLoginBtn'), resetPassword: document.querySelector('#resetPasswordBtn'),
        accountDrawer: document.querySelector('#accountDrawer'), accountContent: document.querySelector('#accountContent'),
        notificationBtn: document.querySelector('#notificationBtn'), notificationCount: document.querySelector('#notificationCount'), notificationDrawer: document.querySelector('#notificationDrawer'), notificationList: document.querySelector('#notificationList'), readAll: document.querySelector('#readAllNotificationsBtn'),
        trackingDialog: document.querySelector('#orderTrackingDialog'), trackingContent: document.querySelector('#trackingContent'), activeOrderBar: document.querySelector('#activeOrderBar'), activeOrderLabel: document.querySelector('#activeOrderLabel'), activeOrderNumber: document.querySelector('#activeOrderNumber'), trackActive: document.querySelector('#trackActiveOrderBtn'),
        publicRankingList: document.querySelector('#publicRankingList'),
        adminOps: document.querySelector('#adminOps'), adminProductsPanel: document.querySelector('#adminProductsPanel'), adminMetrics: document.querySelector('#adminMetrics'), adminCurrentOrders: document.querySelector('#adminCurrentOrders'), adminOrderBoard: document.querySelector('#adminOrderBoard'), adminOrderSearch: document.querySelector('#adminOrderSearch'), adminOrderFilter: document.querySelector('#adminOrderFilter'), adminCustomerList: document.querySelector('#adminCustomerList'), adminCustomerSearch: document.querySelector('#adminCustomerSearch'), adminProductSearch: document.querySelector('#adminProductSearch'),
        loyaltyForm: document.querySelector('#loyaltySettingsForm'), loyaltyEnabled: document.querySelector('#loyaltyEnabled'), loyaltyPoints: document.querySelector('#loyaltyPoints'), gameRankingEnabled: document.querySelector('#gameRankingEnabled'), gameSeasonName: document.querySelector('#gameSeasonName'),
        financePeriod: document.querySelector('#adminFinancePeriod'), financeMetrics: document.querySelector('#adminFinanceMetrics'), paymentBreakdown: document.querySelector('#adminPaymentBreakdown'), productPerformance: document.querySelector('#adminProductPerformance'), courierPerformance: document.querySelector('#adminCourierPerformance'), dailyPerformance: document.querySelector('#adminDailyPerformance')
    };

    const state = {
        user: null, profile: null, isAdmin: false, isCourier: false, authMode: 'login', accountView: 'overview', addresses: [], favorites: [], orders: [], courierOrders: [], notifications: [],
        leaderboards: { game_weekly: [], game_all: [], customers_monthly: [], customers_all: [] }, publicRanking: 'game_weekly', adminOrders: [], customers: [], gameSession: null,
        settings: {}, pendingDeepLinkOrder: new URLSearchParams(location.search).get('pedido') || '', adminOrderIds: null, deliveryLocation: null, deliveryMap: null, trackedLocationOrderId: '', trackedLocationUnsubscribe: null, locationStops: new Map(), activeLocationOrderId: '', wakeLock: null,
        unsubscribers: [], adminUnsubscribers: []
    };

    const setMessage = (message = '', success = false) => {
        dom.authMessage.textContent = message;
        dom.authMessage.hidden = !message;
        dom.authMessage.classList.toggle('is-success', success);
    };

    function cleanup(list) {
        list.splice(0).forEach((unsubscribe) => unsubscribe?.());
    }

    function setAuthMode(mode) {
        state.authMode = mode;
        const signup = mode === 'signup';
        document.querySelectorAll('[data-auth-mode]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.authMode === mode)));
        dom.authNameField.hidden = !signup;
        dom.authPhoneField.hidden = !signup;
        dom.authName.required = signup;
        dom.authPasswordField.hidden = mode === 'reset';
        dom.authPassword.required = mode !== 'reset';
        dom.authTitle.textContent = signup ? 'Crie sua conta da casa' : mode === 'reset' ? 'Recupere seu acesso' : 'Entre para acompanhar tudo';
        dom.authSubmit.textContent = signup ? 'Criar conta' : mode === 'reset' ? 'Enviar link de recuperação' : 'Entrar';
        dom.googleLogin.hidden = mode === 'reset';
        dom.resetPassword.textContent = mode === 'reset' ? 'Voltar para entrar' : 'Esqueci minha senha';
        setMessage();
    }

    function openAuth(mode = 'login') {
        setAuthMode(mode);
        api.openOverlay(dom.authDialog, dom.authEmail);
    }

    function openAccount(view = 'overview') {
        if (!state.user) return openAuth();
        state.accountView = view;
        renderAccount();
        api.openOverlay(dom.accountDrawer, document.querySelector(`[data-account-view="${view}"]`) || dom.accountContent);
    }

    function closeAccount() { api.closeOverlay(dom.accountDrawer); }

    function syncHeader() {
        const name = state.profile?.displayName || state.user?.displayName || '';
        dom.accountLabel.textContent = state.user ? (name.split(/\s+/)[0] || 'Minha Conta') : 'Entrar';
        dom.accountAvatar.textContent = state.user ? (name[0] || state.user.email?.[0] || 'D').toUpperCase() : 'D';
        dom.notificationBtn.hidden = !state.user;
        const count = unreadCount(state.notifications);
        dom.notificationCount.textContent = String(count);
        dom.notificationCount.hidden = count === 0;
        dom.notificationBtn.classList.toggle('has-new', count > 0);
    }

    function syncFavoriteButtons() {
        document.querySelectorAll('[data-favorite-product]').forEach((button) => {
            const active = state.favorites.includes(button.dataset.favoriteProduct);
            button.classList.toggle('is-favorite', active);
            button.setAttribute('aria-pressed', String(active));
            button.setAttribute('aria-label', `${active ? 'Remover' : 'Adicionar'} ${button.dataset.productName || 'produto'} ${active ? 'dos' : 'aos'} favoritos`);
        });
    }

    async function toggleFavorite(productId) {
        if (!state.user) {
            openAuth();
            api.showToast('Entre para guardar seus favoritos.', 'error');
            return;
        }
        const active = !state.favorites.includes(String(productId));
        try {
            await firebase.toggleFavorite(state.user.uid, productId, active);
            api.showToast(active ? 'Guardado nos favoritos.' : 'Removido dos favoritos.');
        } catch (error) {
            api.showToast(firebase.firebaseErrorMessage(error, 'alterar o favorito'), 'error');
        }
    }

    function unsubscribeUserData() {
        cleanup(state.unsubscribers);
        state.profile = null; state.addresses = []; state.favorites = []; state.orders = []; state.courierOrders = []; state.notifications = [];
    }

    function subscribeUserData(user) {
        state.unsubscribers.push(
            firebase.subscribeProfile(user.uid, (profile) => { state.profile = profile || { displayName: user.displayName || '', email: user.email || '' }; syncHeader(); api.prefillCustomer?.(state.profile, state.addresses.find((address) => address.isDefault)); renderAccountIfOpen(); }, api.handleError),
            firebase.subscribeAddresses(user.uid, (addresses) => { state.addresses = addresses; api.prefillCustomer?.(state.profile, addresses.find((address) => address.isDefault)); renderAccountIfOpen(); }, api.handleError),
            firebase.subscribeFavorites(user.uid, (favorites) => { state.favorites = favorites; syncFavoriteButtons(); renderAccountIfOpen(); }, api.handleError),
            firebase.subscribeOrders(user.uid, (orders) => {
                state.orders = orders; renderActiveOrder(); renderAccountIfOpen(); renderTrackingIfOpen();
                if (state.pendingDeepLinkOrder && orders.some((order) => order.id === state.pendingDeepLinkOrder)) {
                    const orderId = state.pendingDeepLinkOrder; state.pendingDeepLinkOrder = ''; openTracking(orderId);
                }
            }, api.handleError),
            firebase.subscribeNotifications(user.uid, (notifications) => { state.notifications = notifications; syncHeader(); renderNotifications(); }, api.handleError)
        );
    }

    async function onAuth(user) {
        unsubscribeUserData();
        state.user = user;
        let context = { user, claims: {}, isAdmin: false, isCourier: false };
        if (user) {
            try { context = await firebase.getAuthContext(user); } catch (error) { api.handleError(error); }
            subscribeUserData(user);
        }
        state.isAdmin = context.isAdmin;
        state.isCourier = context.isCourier;
        document.querySelectorAll('[data-courier-only]').forEach((item) => { item.hidden = !state.isCourier; });
        if (user && state.isCourier) state.unsubscribers.push(firebase.subscribeCourierOrders(user.uid, (orders) => { state.courierOrders = orders; resumeSavedLocationSharing(orders); renderAccountIfOpen(); renderTrackingIfOpen(); }, api.handleError));
        api.onAuthContext(context);
        syncHeader(); syncFavoriteButtons(); renderActiveOrder();
        if (!user && !dom.accountDrawer.hidden) closeAccount();
        if (context.isAdmin) subscribeAdminData(); else cleanup(state.adminUnsubscribers);
    }

    function renderActiveOrder() {
        const active = state.orders.find((order) => !['delivered', 'cancelled'].includes(order.status));
        dom.activeOrderBar.hidden = !active;
        if (!active) return;
        dom.activeOrderLabel.textContent = statusLabel(active.status);
        dom.activeOrderNumber.textContent = friendlyOrderId(active.id);
        dom.trackActive.dataset.orderId = active.id;
    }

    function accountHeader(title, text) {
        const header = el('div', 'account-view-heading');
        header.append(el('h3', '', title), el('p', '', text));
        return header;
    }

    function renderOverview(container) {
        const name = state.profile?.displayName || state.user.displayName || 'Cliente da casa';
        const stats = state.profile?.stats || {};
        const level = loyaltyLevel(stats.completedOrders, state.settings.loyalty?.levels);
        const identity = el('div', 'profile-identity');
        const avatar = el('span', 'profile-avatar', (name[0] || 'D').toUpperCase());
        const copy = el('div'); copy.append(el('h3', '', `Oi, ${name.split(/\s+/)[0]}!`), el('p', '', state.user.email || ''));
        identity.append(avatar, copy);
        const metrics = el('div', 'account-metrics');
        [['Pedidos', stats.completedOrders || 0], ['Feijõezinhos', stats.loyaltyPoints || 0], ['Recorde', stats.gameBest || 0]].forEach(([label, value]) => { const card = el('div'); card.append(el('small', '', label), el('strong', '', String(value))); metrics.append(card); });
        const levelCard = el('div', 'loyalty-card'); levelCard.append(el('small', '', 'Seu nível'), el('strong', '', level.label), el('p', '', level.nextAt ? `Faltam ${Math.max(0, level.nextAt - (stats.completedOrders || 0))} pedidos concluídos para o próximo nível.` : 'Você chegou ao nível mais alto da casa.'));
        container.append(identity, metrics, levelCard);
        const latest = state.orders[0];
        if (latest) {
            const card = createOrderCard(latest, true);
            container.append(accountHeader('Seu pedido mais recente', 'Status e atalhos sem procurar conversa antiga.'), card);
        }
    }

    function createOrderCard(order, compact = false) {
        const card = el('article', `order-card status-${order.status || 'received'}`);
        const top = el('div', 'order-card__top');
        const title = el('div'); title.append(el('strong', '', friendlyOrderId(order.id)), el('small', '', stampDate(order.createdAt)));
        top.append(title, el('span', 'order-status', statusLabel(order.status)));
        const items = el('p', 'order-card__items', (order.items || []).map((item) => `${item.quantity}× ${item.name}`).join(' · ') || 'Itens indisponíveis');
        const bottom = el('div', 'order-card__bottom');
        bottom.append(el('strong', '', money(order.totals?.total || order.total || 0)));
        const track = el('button', 'text-button', 'Ver detalhes'); track.type = 'button'; track.dataset.trackOrder = order.id; bottom.append(track);
        if (!compact) { const again = el('button', 'button button--quiet', 'Pedir novamente'); again.type = 'button'; again.dataset.reorder = order.id; bottom.append(again); }
        card.append(top, items, bottom);
        return card;
    }

    function renderOrders(container) {
        container.append(accountHeader('Meus pedidos', 'Preços e disponibilidade são conferidos de novo ao repetir.'));
        if (!state.orders.length) return container.append(el('p', 'empty-note', 'Seu primeiro pedido acompanhado vai aparecer aqui.'));
        state.orders.forEach((order) => container.append(createOrderCard(order)));
    }

    function deliveryAddress(order) {
        const delivery = order.delivery || {};
        return [delivery.street, delivery.number, delivery.neighborhood, delivery.city, delivery.cep].filter(Boolean).join(', ');
    }

    function customerPhoneLinks(order) {
        const digits = String(order.customer?.phone || '').replace(/\D/g, '');
        const international = digits.startsWith('55') ? digits : `55${digits}`;
        const message = `Olá, ${String(order.customer?.name || 'cliente').split(/\s+/)[0]}! Sou o entregador da Feijoada da Dayse e estou a caminho com o pedido ${friendlyOrderId(order.id)}.`;
        return { tel: digits ? `tel:+${international}` : '', whatsapp: digits ? `https://wa.me/${international}?text=${encodeURIComponent(message)}` : '' };
    }

    function navigationLinks(order) {
        const destination = encodeURIComponent(deliveryAddress(order));
        return {
            maps: `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving&dir_action=navigate`,
            waze: `https://waze.com/ul?q=${destination}&navigate=yes`
        };
    }

    function renderDeliveries(container) {
        container.append(accountHeader('Minhas entregas', 'Ações disponíveis somente para os pedidos atribuídos à sua conta.'));
        const active = state.courierOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
        if (!active.length) return container.append(el('p', 'empty-note', 'Nenhuma entrega ativa atribuída a você.'));
        active.forEach((order) => {
            const card = el('article', `courier-card order-card status-${order.status}`);
            const heading = el('div', 'order-card__top'); heading.append(el('strong', '', friendlyOrderId(order.id)), el('span', 'order-status', statusLabel(order.status)));
            const beverages = orderBeverages(order.items);
            const beverageReminder = beverages.length ? el('aside', 'beverage-reminder') : null;
            if (beverageReminder) beverageReminder.append(el('strong', '', 'Confira as bebidas antes de sair'), el('p', '', beverages.map((item) => `${item.quantity}× ${item.name}`).join(' · ')));
            const contact = el('div', 'courier-customer'); contact.append(el('strong', '', order.customer?.name || 'Cliente'), el('small', '', order.customer?.phone || 'Telefone não informado'), el('p', '', deliveryAddress(order) || 'Endereço não informado'));
            const links = customerPhoneLinks(order); const contacts = el('div', 'courier-actions');
            if (links.tel) { const call = el('a', 'button button--quiet', 'Ligar'); call.href = links.tel; contacts.append(call); }
            if (links.whatsapp) { const whatsapp = el('a', 'button button--quiet', 'Chamar no WhatsApp'); whatsapp.href = links.whatsapp; whatsapp.target = '_blank'; whatsapp.rel = 'noopener noreferrer'; contacts.append(whatsapp); }
            const navigation = navigationLinks(order);
            if (['out_for_delivery', 'arrived'].includes(order.status)) {
                const maps = el('a', 'button button--quiet', 'Google Maps'); maps.href = navigation.maps; maps.target = '_blank'; maps.rel = 'noopener noreferrer';
                const waze = el('a', 'button button--quiet', 'Waze'); waze.href = navigation.waze; waze.target = '_blank'; waze.rel = 'noopener noreferrer'; contacts.append(maps, waze);
                if (order.status === 'out_for_delivery') { const location = el('button', 'button button--quiet', state.locationStops.has(order.id) ? 'Localização sendo enviada' : 'Ativar localização ao vivo'); location.type = 'button'; location.dataset.startCourierLocation = order.id; location.disabled = state.locationStops.has(order.id); contacts.append(location); }
            }
            const progress = el('div', 'courier-progress');
            const next = order.status === 'ready' ? ['out_for_delivery', 'Iniciar entrega'] : order.status === 'out_for_delivery' ? ['arrived', 'Cheguei ao endereço'] : order.status === 'arrived' ? ['delivered', 'Marcar como entregue'] : null;
            if (next) { const button = el('button', `button ${next[0] === 'arrived' ? 'button--sun' : 'button--red'}`, next[1]); button.type = 'button'; button.dataset.courierOrderStatus = next[0]; button.dataset.orderId = order.id; progress.append(button); }
            const locationNote = order.status === 'out_for_delivery' ? el('p', 'courier-location-note', 'Mantenha esta página aberta durante a rota. Quando permitido pelo aparelho, a tela ficará ligada e o GPS será retomado automaticamente ao voltar.') : null;
            card.append(heading); if (beverageReminder) card.append(beverageReminder); card.append(contact, contacts); if (locationNote) card.append(locationNote); card.append(progress); container.append(card);
        });
    }

    function renderFavorites(container) {
        container.append(accountHeader('Meus favoritos', 'Os pratos que você quer encontrar sem demora.'));
        const products = api.getProducts().filter((product) => state.favorites.includes(product.id));
        if (!products.length) return container.append(el('p', 'empty-note', 'Toque no coração de um prato para guardar aqui.'));
        products.forEach((product) => {
            const row = el('article', 'favorite-row'); const copy = el('div'); copy.append(el('strong', '', product.name), el('small', '', `${money(product.price)} · ${product.availability ? 'Disponível' : 'Pausado'}`));
            const add = el('button', 'button button--quiet', 'Adicionar'); add.type = 'button'; add.disabled = !product.availability; add.addEventListener('click', () => api.addProduct(product));
            row.append(copy, add); container.append(row);
        });
    }

    function addressForm(address = {}) {
        const form = el('form', 'account-form address-form'); form.dataset.addressId = address.id || '';
        const fields = [
            ['label', 'Nome do endereço', address.label || 'Casa', 30], ['cep', 'CEP', address.cep || '', 10], ['street', 'Rua', address.street || '', 120],
            ['number', 'Número', address.number || '', 20], ['neighborhood', 'Bairro', address.neighborhood || '', 80], ['city', 'Cidade / UF', address.city || '', 100]
        ];
        fields.forEach(([name, label, value, max]) => { const wrapper = el('label', `field${name === 'street' || name === 'city' ? ' field--wide' : ''}`, label); const input = el('input'); input.name = name; input.value = value; input.maxLength = max; input.required = true; wrapper.append(input); form.append(wrapper); });
        const defaultLabel = el('label', 'check-field'); const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.name = 'isDefault'; checkbox.checked = address.isDefault === true; defaultLabel.append(checkbox, document.createTextNode(' Usar como padrão'));
        const actions = el('div', 'address-actions'); const save = el('button', 'button button--red', address.id ? 'Salvar endereço' : 'Adicionar endereço'); save.type = 'submit'; actions.append(save);
        if (address.id) { const remove = el('button', 'text-button', 'Remover'); remove.type = 'button'; remove.dataset.deleteAddress = address.id; actions.append(remove); }
        form.append(defaultLabel, actions); return form;
    }

    function renderAddresses(container) {
        container.append(accountHeader('Endereços salvos', 'O endereço padrão preenche o próximo checkout.'));
        state.addresses.forEach((address) => container.append(addressForm(address)));
        container.append(addressForm());
    }

    function renderRankingList(container, entries, emptyText = 'O ranking ainda não tem participantes.') {
        if (!entries.length) return container.append(el('p', 'empty-note', emptyText));
        entries.slice(0, 20).forEach((entry) => {
            const row = el('div', `rank-row${entry.isCurrent ? ' is-current' : ''}`);
            row.append(el('strong', 'rank-position', `#${entry.position}`), el('span', '', entry.publicName), el('b', '', Number(entry.score).toLocaleString('pt-BR'))); container.append(row);
        });
    }

    function renderRankings(container) {
        container.append(accountHeader('Sua posição', 'Somente seu nome público aparece quando você aceita participar.'));
        const stats = state.profile?.stats || {};
        const weeklyPosition = rankEntries(state.leaderboards.game_weekly, state.user.uid).find((entry) => entry.isCurrent)?.position;
        const allPosition = rankEntries(state.leaderboards.game_all, state.user.uid).find((entry) => entry.isCurrent)?.position;
        const summary = el('div', 'account-metrics'); [['Semanal', weeklyPosition ? `#${weeklyPosition}` : '—'], ['Geral', allPosition ? `#${allPosition}` : '—'], ['Partidas', stats.gamePlays || 0]].forEach(([label, value]) => { const card = el('div'); card.append(el('small', '', label), el('strong', '', String(value))); summary.append(card); });
        container.append(summary, accountHeader('Corre, Feijão! · semana', 'As melhores pontuações válidas da semana.'));
        const list = el('div', 'ranking-list'); renderRankingList(list, rankEntries(state.leaderboards.game_weekly, state.user.uid)); container.append(list);
    }

    function renderPreferences(container) {
        container.append(accountHeader('Perfil e privacidade', 'Você decide como aparece e quais avisos quer receber.'));
        const form = el('form', 'account-form profile-form'); form.id = 'profileForm';
        const fields = [['displayName', 'Nome', state.profile?.displayName || state.user.displayName || ''], ['publicName', 'Nome público', state.profile?.publicName || publicName(state.profile || state.user)], ['phone', 'Telefone', state.profile?.phone || '']];
        fields.forEach(([name, label, value]) => { const wrapper = el('label', 'field', label); const input = el('input'); input.name = name; input.value = value; input.required = name !== 'phone'; input.maxLength = name === 'publicName' ? 40 : 80; wrapper.append(input); form.append(wrapper); });
        [['rankingOptIn', 'Participar do ranking Clientes da Casa', state.profile?.rankingOptIn], ['gameRankingOptIn', 'Aparecer no ranking do jogo', state.profile?.gameRankingOptIn], ['orderUpdates', 'Receber atualizações dos pedidos', state.profile?.notifications?.orderUpdates !== false], ['game', 'Avisos futuros do jogo e ranking', state.profile?.notifications?.game]].forEach(([name, label, checked]) => { const wrapper = el('label', 'check-field'); const input = el('input'); input.type = 'checkbox'; input.name = name; input.checked = checked === true; wrapper.append(input, document.createTextNode(` ${label}`)); form.append(wrapper); });
        const save = el('button', 'button button--red', 'Salvar preferências'); save.type = 'submit'; form.append(save); container.append(form);
        const push = el('section', 'push-callout'); push.append(el('strong', '', 'Aviso quando sair para entrega'), el('p', '', VAPID_KEY ? 'Ative neste aparelho quando quiser.' : 'O código está pronto; falta cadastrar a chave Web Push da loja.'));
        const pushButton = el('button', 'button button--quiet', 'Ativar notificações neste aparelho'); pushButton.type = 'button'; pushButton.dataset.enablePush = 'true'; pushButton.disabled = !VAPID_KEY; push.append(pushButton); container.append(push);
        const deletion = el('section', 'danger-zone'); deletion.append(el('strong', '', 'Excluir meus dados'), el('p', '', 'Envia uma solicitação para a equipe concluir a exclusão da conta e dos dados vinculados.'));
        const deletionButton = el('button', 'text-button danger-text', 'Solicitar exclusão da conta'); deletionButton.type = 'button'; deletionButton.dataset.requestDeletion = 'true'; deletion.append(deletionButton); container.append(deletion);
        const logout = el('button', 'text-button account-logout', 'Sair da conta'); logout.type = 'button'; logout.dataset.customerLogout = 'true'; container.append(logout);
        const privacy = el('p', 'privacy-note', 'Seus dados são usados para conta, pedidos e avisos escolhidos. Ranking público nunca mostra e-mail, telefone, endereço ou valores gastos.'); container.append(privacy);
    }

    function renderAccount() {
        dom.accountContent.replaceChildren();
        document.querySelectorAll('[data-account-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.accountView === state.accountView)));
        const renderers = { overview: renderOverview, deliveries: renderDeliveries, orders: renderOrders, favorites: renderFavorites, addresses: renderAddresses, rankings: renderRankings, preferences: renderPreferences };
        (renderers[state.accountView] || renderOverview)(dom.accountContent);
    }

    function renderAccountIfOpen() { if (!dom.accountDrawer.hidden) renderAccount(); }

    function renderNotifications() {
        dom.notificationList.replaceChildren();
        if (!state.notifications.length) return dom.notificationList.append(el('p', 'empty-note', 'Nenhum aviso por aqui. Quando o pedido andar, a cozinha conta.'));
        state.notifications.forEach((item) => {
            const button = el('button', `notification-item${item.read ? '' : ' is-unread'}`); button.type = 'button'; button.dataset.notificationId = item.id; if (item.orderId) button.dataset.trackOrder = item.orderId;
            button.append(el('strong', '', item.title || 'Atualização do pedido'), el('span', '', item.message || ''), el('small', '', stampDate(item.createdAt))); dom.notificationList.append(button);
        });
    }

    function destroyDeliveryMap() {
        state.deliveryMap?.map?.remove();
        state.deliveryMap = null;
    }

    function destinationPoint(order) {
        const latitude = Number(order?.delivery?.latitude); const longitude = Number(order?.delivery?.longitude);
        return Number.isFinite(latitude) && Number.isFinite(longitude) ? { lat: latitude, lng: longitude } : null;
    }

    function locationCopy(location, destination) {
        const updated = new Date(Number(location?.updatedAt) || Date.now());
        const age = Math.max(0, Date.now() - updated.getTime());
        const precision = Number(location?.accuracy);
        const courier = { lat: Number(location?.latitude), lng: Number(location?.longitude) };
        const distance = destination ? haversineKm(courier, destination) : null;
        return {
            text: `${age > 60000 ? 'Último sinal' : 'Atualizado'} às ${new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' }).format(updated)}${Number.isFinite(precision) ? ` · precisão de ${Math.round(precision)} m` : ''}`,
            distance: Number.isFinite(distance) ? `${distance < 1 ? `${Math.max(10, Math.round(distance * 1000))} m` : `${distance.toFixed(1)} km`} do destino (aprox.)` : '',
            stale: age > 60000
        };
    }

    function updateDeliveryMap(location) {
        const live = state.deliveryMap;
        if (!live || !location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) return;
        const point = [Number(location.latitude), Number(location.longitude)];
        live.marker.setLatLng(point);
        live.accuracy.setLatLng(point).setRadius(Math.max(5, Number(location.accuracy) || 5));
        const trail = (Array.isArray(location.trail) ? location.trail : Object.values(location.trail || {}))
            .map((item) => [Number(item?.latitude), Number(item?.longitude)])
            .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        live.trail.setLatLngs(trail);
        if (live.destination) live.route.setLatLngs([point, [live.destination.lat, live.destination.lng]]);
        const copy = locationCopy(location, live.destination);
        live.meta.textContent = copy.text;
        live.meta.classList.toggle('is-stale', copy.stale);
        live.distance.textContent = copy.distance;
        if (live.follow) live.map.panTo(point, { animate: true, duration: 0.6 });
    }

    function mountDeliveryMap(order, host, meta, distance, centerButton) {
        if (!window.L || !state.deliveryLocation || !host.isConnected) return;
        const point = [Number(state.deliveryLocation.latitude), Number(state.deliveryLocation.longitude)];
        if (!point.every(Number.isFinite)) return;
        const destination = destinationPoint(order);
        const map = window.L.map(host, { zoomControl: true, attributionControl: true }).setView(point, 16);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
        const courierIcon = window.L.divIcon({ className: 'delivery-map-marker', html: '<span class="site-icon site-icon--courier" aria-hidden="true"></span>', iconSize: [46, 46], iconAnchor: [23, 23] });
        const homeIcon = window.L.divIcon({ className: 'delivery-map-marker is-home', html: '<span class="site-icon site-icon--home" aria-hidden="true"></span>', iconSize: [40, 40], iconAnchor: [20, 20] });
        const marker = window.L.marker(point, { icon: courierIcon, title: 'Posição do entregador', alt: 'Posição do entregador' }).addTo(map);
        const accuracy = window.L.circle(point, { radius: Math.max(5, Number(state.deliveryLocation.accuracy) || 5), color: '#661f25', fillColor: '#f5bd49', fillOpacity: 0.15, weight: 1 }).addTo(map);
        const trail = window.L.polyline([], { color: '#661f25', opacity: 0.65, weight: 5 }).addTo(map);
        const route = window.L.polyline([], { color: '#44744a', dashArray: '8 9', opacity: 0.75, weight: 3 }).addTo(map);
        if (destination) {
            window.L.marker([destination.lat, destination.lng], { icon: homeIcon, title: 'Endereço de entrega', alt: 'Endereço de entrega' }).addTo(map);
            map.fitBounds(window.L.latLngBounds([point, [destination.lat, destination.lng]]), { padding: [42, 42], maxZoom: 16 });
        }
        state.deliveryMap = { orderId: order.id, map, marker, accuracy, trail, route, destination, meta, distance, follow: false };
        centerButton.addEventListener('click', () => { if (!state.deliveryMap) return; state.deliveryMap.follow = true; state.deliveryMap.map.setView(state.deliveryMap.marker.getLatLng(), 17, { animate: true }); });
        map.on('dragstart zoomstart', () => { if (state.deliveryMap) state.deliveryMap.follow = false; });
        updateDeliveryMap(state.deliveryLocation);
        setTimeout(() => map.invalidateSize(), 50);
    }

    function renderTracking(order) {
        destroyDeliveryMap();
        dom.trackingContent.replaceChildren();
        if (!order) return dom.trackingContent.append(el('p', 'empty-note', 'Não foi possível localizar este pedido.'));
        const header = el('div', 'tracking-heading'); header.append(el('p', 'eyebrow eyebrow--dark', 'Seu pedido'), el('h2', '', friendlyOrderId(order.id)), el('span', 'order-status', statusLabel(order.status)), el('p', '', `Atualizado ${stampDate(order.updatedAt || order.createdAt)}`));
        const timeline = el('ol', 'order-timeline'); const flow = orderFlow(order.fulfillment); const currentIndex = flow.indexOf(order.status);
        flow.forEach((status, index) => { const item = el('li', `${index < currentIndex || order.status === 'delivered' ? 'is-done' : ''}${index === currentIndex ? ' is-current' : ''}`); item.append(el('span', '', String(index + 1)), el('strong', '', statusLabel(status))); const history = (order.statusHistory || []).find((entry) => entry.status === status); if (history) item.append(el('small', '', stampDate(history.at))); timeline.append(item); });
        if (order.status === 'cancelled') timeline.append(el('li', 'is-cancelled', 'Pedido cancelado'));
        const summary = el('div', 'tracking-summary'); summary.append(el('h3', '', 'Resumo'), el('p', '', (order.items || []).map((item) => `${item.quantity}× ${item.name}`).join(' · ')), el('strong', '', money(order.totals?.total || order.total || 0)));
        const location = el('div', 'delivery-location');
        if (['out_for_delivery', 'arrived'].includes(order.status)) {
            const courierName = order.courier?.name || 'Seu entregador';
            const locationHeading = el('div', 'delivery-location__heading');
            const locationCopy = el('div'); locationCopy.append(el('h3', '', order.status === 'arrived' ? `${courierName} chegou` : `${courierName} está a caminho`), el('p', '', order.status === 'arrived' ? 'Vá ao encontro do entregador.' : 'A posição é atualizada enquanto o navegador do entregador permanece ativo.'));
            const avatar = el('span', 'delivery-avatar');
            avatar.innerHTML = '<span class="site-icon site-icon--courier" aria-hidden="true"></span>';
            locationHeading.append(avatar, locationCopy); location.append(locationHeading);
            if (state.deliveryLocation?.latitude != null && state.deliveryLocation?.longitude != null) {
                const meta = el('p', 'delivery-location__meta'); const distance = el('strong', 'delivery-location__distance');
                const mapHost = el('div', 'delivery-map'); mapHost.setAttribute('role', 'application'); mapHost.setAttribute('aria-label', 'Mapa ao vivo da entrega');
                const actions = el('div', 'delivery-map-actions'); const center = el('button', 'button button--quiet', 'Centralizar entregador'); center.type = 'button';
                const external = el('a', 'text-button', 'Abrir no Google Maps'); external.target = '_blank'; external.rel = 'noopener noreferrer'; external.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${state.deliveryLocation.latitude},${state.deliveryLocation.longitude}`)}`;
                actions.append(center, external); location.append(meta, distance, mapHost, actions);
                requestAnimationFrame(() => mountDeliveryMap(order, mapHost, meta, distance, center));
            } else location.append(el('p', 'empty-note', order.status === 'arrived' ? 'O entregador informou que chegou ao endereço.' : 'Aguardando o primeiro sinal de localização do entregador.'));
        }
        const wait = el('div', 'tracking-game'); wait.append(el('strong', '', 'Enquanto sua feijoada não chega…')); const play = el('button', 'button button--sun', 'Jogar Corre, Feijão!'); play.type = 'button'; play.addEventListener('click', api.openGame); wait.append(play);
        header.append(timeline); if (['out_for_delivery', 'arrived'].includes(order.status)) header.append(location); header.append(summary); if (!['delivered', 'cancelled'].includes(order.status)) header.append(wait); dom.trackingContent.append(header);
    }

    function watchTrackedLocation(order) {
        const shouldWatch = order && ['out_for_delivery', 'arrived'].includes(order.status);
        if (!shouldWatch) {
            state.trackedLocationUnsubscribe?.(); state.trackedLocationUnsubscribe = null; state.trackedLocationOrderId = ''; state.deliveryLocation = null; return;
        }
        if (state.trackedLocationOrderId === order.id) return;
        state.trackedLocationUnsubscribe?.(); state.deliveryLocation = null; state.trackedLocationOrderId = order.id;
        state.trackedLocationUnsubscribe = firebase.subscribeDeliveryLocation(order.id, (location) => {
            const hadLocation = Boolean(state.deliveryLocation);
            state.deliveryLocation = location;
            if (location && hadLocation && state.deliveryMap?.orderId === order.id) updateDeliveryMap(location);
            else renderTrackingIfOpen();
        }, () => { state.deliveryLocation = null; renderTrackingIfOpen(); });
    }

    function openTracking(orderId) {
        const order = state.orders.find((item) => item.id === orderId) || state.courierOrders.find((item) => item.id === orderId) || state.adminOrders.find((item) => item.id === orderId);
        watchTrackedLocation(order); renderTracking(order); dom.trackingDialog.dataset.orderId = orderId; api.openOverlay(dom.trackingDialog, dom.trackingContent);
    }

    function renderTrackingIfOpen() {
        if (dom.trackingDialog.hidden) return;
        const id = dom.trackingDialog.dataset.orderId;
        const order = state.orders.find((item) => item.id === id) || state.courierOrders.find((item) => item.id === id) || state.adminOrders.find((item) => item.id === id);
        watchTrackedLocation(order); renderTracking(order);
    }

    function renderPublicRanking() {
        dom.publicRankingList.replaceChildren();
        renderRankingList(dom.publicRankingList, rankEntries(state.leaderboards[state.publicRanking], state.user?.uid));
    }

    async function reorder(orderId) {
        const order = state.orders.find((item) => item.id === orderId);
        if (!order) return;
        const result = reorderFromHistory(order.items, api.getProducts());
        if (!result.cart.length) return api.showToast('Nenhum item deste pedido está disponível agora.', 'error');
        api.replaceCart(result.cart);
        const skipped = [...result.unavailable, ...result.removed];
        api.showToast(skipped.length ? `Sacola atualizada. ${skipped.length} item(ns) não puderam voltar.` : 'Pedido reconstruído com preços atuais.');
        closeAccount(); api.openCart();
    }

    async function createTrackedOrder(payload) {
        if (!state.user) await firebase.ensureOrderSession(payload.customer);
        const result = await firebase.createTrackedOrder(payload);
        return result;
    }

    async function beginGameSession() {
        if (!state.user || state.profile?.gameRankingOptIn !== true) { state.gameSession = null; return; }
        try { state.gameSession = await firebase.startGameSession(); } catch { state.gameSession = null; }
    }

    async function finishGame(stats) {
        if (!state.user || !state.gameSession?.sessionId) return;
        try {
            const result = await firebase.submitGameScore({ sessionId: state.gameSession.sessionId, ...stats });
            if (result?.personalBest) api.showToast(result.position ? `Novo recorde! Você está em #${result.position}.` : 'Novo recorde pessoal!');
        } catch (error) {
            console.warn('Pontuação não enviada:', error);
        } finally { state.gameSession = null; }
    }

    function subscribeAdminData() {
        cleanup(state.adminUnsubscribers);
        state.adminUnsubscribers.push(
            firebase.subscribeAdminOrders((orders) => {
                const currentIds = new Set(orders.map((order) => order.id));
                if (state.adminOrderIds) {
                    const arrivals = orders.filter((order) => order.status === 'received' && !state.adminOrderIds.has(order.id));
                    if (arrivals.length) {
                        api.showToast(`${arrivals.length === 1 ? friendlyOrderId(arrivals[0].id) : `${arrivals.length} pedidos`} acabou de chegar!`);
                        playAdminAlert();
                    }
                }
                state.adminOrderIds = currentIds;
                state.adminOrders = orders;
                renderAdmin();
            }, api.handleError),
            firebase.subscribeCustomers((customers) => { state.customers = customers; renderAdmin(); }, api.handleError)
        );
    }

    function playAdminAlert() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(740, context.currentTime);
            gain.gain.setValueAtTime(0.0001, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
            oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.46);
            oscillator.addEventListener('ended', () => context.close());
        } catch { /* O alerta visual continua disponível quando o navegador bloqueia áudio. */ }
    }

    function metric(label, value, tone = '') { const card = el('article', `ops-metric ${tone}`); card.append(el('small', '', label), el('strong', '', String(value))); return card; }

    function filteredAdminOrders() {
        const query = normalizeText(dom.adminOrderSearch.value);
        const status = dom.adminOrderFilter.value;
        return state.adminOrders.filter((order) => (status === 'all' || order.status === status) && (!query || normalizeText(`${order.id} ${order.customer?.name || ''} ${order.customer?.phone || ''}`).includes(query)));
    }

    function adminOrderCard(order) {
        const card = createOrderCard(order, true); card.classList.add('admin-order-card');
        if (order.fulfillment !== 'pickup') {
            const courierProfile = state.customers.find((customer) => customer.id === order.courierId);
            const courierName = order.courier?.name || courierProfile?.displayName || courierProfile?.publicName || courierProfile?.email || '';
            const courierText = courierName
                ? (order.status === 'delivered' ? `Entrega feita por ${courierName}` : `Entregador: ${courierName}`)
                : 'Entregador ainda não atribuído';
            card.append(el('p', `order-card__courier${courierName ? '' : ' is-pending'}`, courierText));
        }
        if (order.fulfillment !== 'pickup' && !['delivered', 'cancelled'].includes(order.status)) {
            const couriers = state.customers.filter((customer) => customer.isCourier === true);
            const assignment = el('label', 'courier-assignment', 'Entregador'); const select = el('select'); select.dataset.assignCourier = order.id;
            const placeholder = el('option', '', couriers.length ? 'Selecionar entregador' : 'Cadastre uma conta de entregador'); placeholder.value = ''; select.append(placeholder);
            couriers.forEach((courier) => { const option = el('option', '', courier.displayName || courier.publicName || courier.email || 'Entregador'); option.value = courier.id; option.selected = courier.id === order.courierId; select.append(option); });
            select.disabled = !couriers.length; assignment.append(select); card.append(assignment);
        }
        const actions = el('div', 'order-status-actions');
        validNextStatuses(order.status, order.fulfillment).forEach((status) => { const button = el('button', status === 'cancelled' ? 'text-button danger-text' : 'button button--quiet', statusLabel(status)); button.type = 'button'; button.dataset.adminOrderStatus = status; button.dataset.orderId = order.id; actions.append(button); });
        card.append(actions); return card;
    }

    function renderAdmin() {
        if (!state.isAdmin) return;
        const today = new Date().toDateString(); const todayOrders = state.adminOrders.filter((order) => (order.createdAt?.toDate?.() || new Date(0)).toDateString() === today);
        const counts = (status) => todayOrders.filter((order) => status.includes(order.status)).length;
        dom.adminMetrics.replaceChildren(metric('Pedidos hoje', todayOrders.length), metric('Aguardando', counts(['received', 'confirmed']), 'is-waiting'), metric('Na cozinha', counts(['preparing', 'ready']), 'is-cooking'), metric('Em entrega', counts(['out_for_delivery']), 'is-delivery'), metric('Concluídos', counts(['delivered']), 'is-done'));
        dom.adminCurrentOrders.replaceChildren(); const active = state.adminOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).slice(0, 6); if (!active.length) dom.adminCurrentOrders.append(el('p', 'empty-note', 'Nenhum pedido ativo.')); else active.forEach((order) => dom.adminCurrentOrders.append(adminOrderCard(order)));
        dom.adminOrderBoard.replaceChildren(); const filtered = filteredAdminOrders(); if (!filtered.length) dom.adminOrderBoard.append(el('p', 'empty-note', 'Nenhum pedido encontrado.')); else filtered.forEach((order) => dom.adminOrderBoard.append(adminOrderCard(order)));
        const customerQuery = normalizeText(dom.adminCustomerSearch.value); dom.adminCustomerList.replaceChildren(); const customers = state.customers.filter((customer) => !customerQuery || normalizeText(`${customer.displayName || ''} ${customer.phone || ''} ${customer.email || ''}`).includes(customerQuery)); if (!customers.length) dom.adminCustomerList.append(el('p', 'empty-note', 'Nenhuma conta encontrada.')); else customers.forEach((customer) => { const row = el('article', 'admin-customer-row'); const copy = el('div'); copy.append(el('strong', '', customer.displayName || 'Conta sem nome'), el('small', '', [customer.phone, customer.email].filter(Boolean).join(' · '))); const stats = el('div', 'customer-stats'); stats.append(el('span', '', `${customer.stats?.completedOrders || 0} pedidos`), el('span', '', customer.isCourier ? 'Entregador ativo' : `${customer.stats?.loyaltyPoints || 0} feijõezinhos`)); const role = el('button', customer.isCourier ? 'button button--quiet' : 'button button--red', customer.isCourier ? 'Remover entregador' : 'Tornar entregador'); role.type = 'button'; role.dataset.setCourier = customer.id; role.dataset.courierEnabled = String(!customer.isCourier); row.append(copy, stats, role); dom.adminCustomerList.append(row); });
        renderFinance();
    }

    function financeRange(period) {
        if (period === 'all') return {};
        const end = new Date();
        const start = new Date(end);
        if (period === 'today') start.setHours(0, 0, 0, 0);
        else start.setDate(start.getDate() - (period === '7days' ? 6 : 29));
        return { start, end };
    }

    function financeRow(label, detail, value) {
        const row = el('div', 'finance-row'); const copy = el('span'); copy.append(el('strong', '', label), el('small', '', detail)); row.append(copy, el('b', '', value)); return row;
    }

    function renderFinance() {
        const summary = financialSummary(state.adminOrders, financeRange(dom.financePeriod.value));
        dom.financeMetrics.replaceChildren(
            metric('Faturamento total', money(summary.revenue), 'is-done'),
            metric('Vendas de produtos', money(summary.productSales)),
            metric('Taxas de entrega', money(summary.deliveryFees), 'is-delivery'),
            metric('Taxas de cartão', money(summary.paymentFees)),
            metric('Pedidos entregues', summary.orders),
            metric('Itens vendidos', summary.itemsSold),
            metric('Ticket médio', money(summary.averageTicket)),
            metric('Cancelados', summary.cancelledOrders, summary.cancelledOrders ? 'is-waiting' : '')
        );
        dom.paymentBreakdown.replaceChildren();
        if (!summary.payments.length) dom.paymentBreakdown.append(el('p', 'empty-note', 'Nenhum pedido entregue neste período.'));
        summary.payments.forEach((item) => dom.paymentBreakdown.append(financeRow(item.method, `${item.orders} pedido(s)`, money(item.total))));
        dom.productPerformance.replaceChildren();
        if (!summary.products.length) dom.productPerformance.append(el('p', 'empty-note', 'As vendas dos produtos aparecerão aqui.'));
        summary.products.slice(0, 10).forEach((item) => dom.productPerformance.append(financeRow(item.name, `${item.quantity} unidade(s)`, money(item.total))));
        dom.courierPerformance.replaceChildren();
        if (!summary.couriers.length) dom.courierPerformance.append(el('p', 'empty-note', 'As entregas concluídas por entregador aparecerão aqui.'));
        summary.couriers.forEach((item) => dom.courierPerformance.append(financeRow(item.name, `${item.orders} entrega(s)`, money(item.total))));
        dom.dailyPerformance.replaceChildren();
        if (!summary.days.length) dom.dailyPerformance.append(el('p', 'empty-note', 'Nenhum movimento neste período.'));
        summary.days.slice(0, 14).forEach((item) => dom.dailyPerformance.append(financeRow(item.label, `${item.orders} pedido(s) · ${item.items} item(ns)`, money(item.total))));
    }

    function switchAdminView(view) {
        document.querySelectorAll('[data-admin-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.adminView === view)));
        document.querySelectorAll('[data-admin-panel]').forEach((panel) => { panel.hidden = panel.dataset.adminPanel !== view; });
        dom.adminProductsPanel.hidden = view !== 'products';
    }

    async function updateAdminOrder(orderId, status) {
        const run = async () => { await firebase.updateTrackedOrderStatus({ orderId, status }); api.showToast(`${friendlyOrderId(orderId)}: ${statusLabel(status)}.`); };
        if (status === 'cancelled') return api.askConfirmation({ title: `Cancelar ${friendlyOrderId(orderId)}?`, text: 'O cliente será avisado e o pedido não contará para fidelidade.', confirmLabel: 'Cancelar pedido', action: run });
        try { await run(); } catch (error) { api.showToast(firebase.firebaseErrorMessage(error, 'atualizar o pedido'), 'error'); }
    }

    async function assignCourier(orderId, courierId, select) {
        if (!courierId) return;
        select.disabled = true;
        try { await firebase.assignOrderCourier({ orderId, courierId }); api.showToast('Entregador atribuído ao pedido.'); }
        catch (error) { api.showToast(firebase.firebaseErrorMessage(error, 'atribuir o entregador'), 'error'); }
        finally { select.disabled = false; }
    }

    async function setCourier(uid, enabled, button) {
        button.disabled = true;
        try { await firebase.setCourierRole({ uid, enabled }); api.showToast(enabled ? 'Conta definida como entregador.' : 'Permissão de entregador removida.'); }
        catch (error) { api.showToast(firebase.firebaseErrorMessage(error, 'alterar a função da conta'), 'error'); }
        finally { button.disabled = false; }
    }

    function confirmCourierChange(button) {
        const enabled = button.dataset.courierEnabled === 'true';
        return api.askConfirmation({
            title: enabled ? 'Tornar esta conta entregador?' : 'Remover permissão de entregador?',
            text: enabled ? 'A conta poderá visualizar endereço e telefone somente dos pedidos atribuídos a ela.' : 'A conta perderá o acesso à área de entregas ao entrar novamente.',
            confirmLabel: enabled ? 'Tornar entregador' : 'Remover permissão',
            action: () => setCourier(button.dataset.setCourier, enabled, button)
        });
    }

    async function performCourierOrderUpdate(orderId, status, button) {
        button.disabled = true;
        try {
            const result = await firebase.updateCourierDelivery({ orderId, status });
            if (status === 'out_for_delivery') startLocationSharing(orderId);
            if (['arrived', 'delivered'].includes(status)) stopLocationSharing(orderId);
            const sent = Number(result?.push?.sent) || 0;
            api.showToast(status === 'arrived' ? `Cliente avisado${sent ? ' por notificação push' : ' dentro da conta'}.` : `${friendlyOrderId(orderId)}: ${statusLabel(status)}.`);
        } catch (error) { api.showToast(firebase.firebaseErrorMessage(error, 'atualizar a entrega'), 'error'); }
        finally { button.disabled = false; }
    }

    function updateCourierOrder(orderId, status, button) {
        const order = state.courierOrders.find((item) => item.id === orderId);
        const beverages = orderBeverages(order?.items);
        if (status === 'out_for_delivery' && beverages.length) {
            return api.askConfirmation({
                title: 'As bebidas estão com você?',
                text: `Confira antes de sair: ${beverages.map((item) => `${item.quantity}× ${item.name}`).join(' · ')}.`,
                confirmLabel: 'Conferi as bebidas',
                action: () => performCourierOrderUpdate(orderId, status, button)
            });
        }
        return performCourierOrderUpdate(orderId, status, button);
    }

    async function acquireWakeLock() {
        if (!state.activeLocationOrderId || !('wakeLock' in navigator) || document.visibilityState !== 'visible' || state.wakeLock) return;
        try {
            const lock = await navigator.wakeLock.request('screen');
            if (!state.activeLocationOrderId) { await lock.release(); return; }
            state.wakeLock = lock;
            lock.addEventListener('release', () => { if (state.wakeLock === lock) state.wakeLock = null; });
        } catch { /* Alguns aparelhos não permitem Wake Lock; o GPS continua com a proteção disponível. */ }
    }

    function stopLocationSharing(orderId) {
        state.locationStops.get(orderId)?.();
        state.locationStops.delete(orderId);
        if (state.activeLocationOrderId === orderId) {
            state.activeLocationOrderId = '';
            try { localStorage.removeItem(ACTIVE_DELIVERY_STORAGE_KEY); } catch { /* Armazenamento privado pode estar bloqueado. */ }
            state.wakeLock?.release?.().catch(() => {});
            state.wakeLock = null;
        }
    }

    function resumeSavedLocationSharing(orders) {
        let savedOrderId = '';
        try { savedOrderId = localStorage.getItem(ACTIVE_DELIVERY_STORAGE_KEY) || ''; } catch { return; }
        if (!savedOrderId) return;
        const active = orders.find((order) => order.id === savedOrderId && order.status === 'out_for_delivery');
        if (active) startLocationSharing(savedOrderId, true);
        else {
            try { localStorage.removeItem(ACTIVE_DELIVERY_STORAGE_KEY); } catch { /* Armazenamento privado pode estar bloqueado. */ }
        }
    }

    function startLocationSharing(orderId, resumed = false) {
        state.activeLocationOrderId = orderId;
        try { localStorage.setItem(ACTIVE_DELIVERY_STORAGE_KEY, orderId); } catch { /* O rastreamento ainda funciona sem persistência. */ }
        acquireWakeLock();
        if (state.locationStops.has(orderId)) return;
        try {
            const stop = firebase.startCourierLocation(orderId, () => renderAccountIfOpen(), (error) => api.showToast(firebase.firebaseErrorMessage(error, 'enviar sua localização'), 'error'));
            state.locationStops.set(orderId, stop); renderAccountIfOpen(); api.showToast('Localização ao vivo ativada durante esta entrega.');
        } catch (error) {
            stopLocationSharing(orderId);
            if (!resumed) api.showToast(firebase.firebaseErrorMessage(error, 'ativar a localização'), 'error');
        }
    }

    const resumeCourierProtection = () => {
        if (document.visibilityState === 'visible' && state.activeLocationOrderId) acquireWakeLock();
    };
    document.addEventListener('visibilitychange', resumeCourierProtection);
    window.addEventListener('pageshow', resumeCourierProtection);

    async function handleAccountSubmit(event) {
        const form = event.target;
        if (form.matches('.address-form')) {
            event.preventDefault(); const data = Object.fromEntries(new FormData(form)); data.isDefault = form.elements.isDefault.checked;
            try { await firebase.saveAddress(state.user.uid, form.dataset.addressId, data); api.showToast('Endereço salvo.'); } catch (error) { api.showToast(firebase.firebaseErrorMessage(error, 'salvar o endereço'), 'error'); }
        }
        if (form.id === 'profileForm') {
            event.preventDefault(); const data = Object.fromEntries(new FormData(form));
            data.rankingOptIn = form.elements.rankingOptIn.checked; data.gameRankingOptIn = form.elements.gameRankingOptIn.checked; data.notifications = { orderUpdates: form.elements.orderUpdates.checked, game: form.elements.game.checked };
            try { await firebase.saveProfile(state.user.uid, data); await state.user.updateProfile({ displayName: data.displayName }); api.showToast('Perfil atualizado.'); } catch (error) { api.showToast(firebase.firebaseErrorMessage(error, 'salvar o perfil'), 'error'); }
        }
    }

    dom.accountBtn.addEventListener('click', () => state.user ? openAccount() : openAuth());
    document.querySelectorAll('[data-open-account]').forEach((button) => button.addEventListener('click', () => openAccount(button.dataset.openAccount || 'overview')));
    document.querySelectorAll('[data-close-auth]').forEach((button) => button.addEventListener('click', () => api.closeOverlay(dom.authDialog)));
    document.querySelectorAll('[data-close-account]').forEach((button) => button.addEventListener('click', closeAccount));
    document.querySelectorAll('[data-close-notifications]').forEach((button) => button.addEventListener('click', () => api.closeOverlay(dom.notificationDrawer)));
    document.querySelectorAll('[data-close-tracking]').forEach((button) => button.addEventListener('click', () => { state.trackedLocationUnsubscribe?.(); state.trackedLocationUnsubscribe = null; state.trackedLocationOrderId = ''; state.deliveryLocation = null; destroyDeliveryMap(); api.closeOverlay(dom.trackingDialog); }));
    document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
    dom.resetPassword.addEventListener('click', () => setAuthMode(state.authMode === 'reset' ? 'login' : 'reset'));
    dom.authPhone.addEventListener('input', () => { dom.authPhone.value = formatPhone(dom.authPhone.value); });
    dom.authForm.addEventListener('submit', async (event) => {
        event.preventDefault(); setMessage(); if (!dom.authForm.checkValidity()) return dom.authForm.reportValidity(); dom.authSubmit.disabled = true;
        try {
            if (state.authMode === 'signup') await firebase.signUp({ name: dom.authName.value.trim(), phone: dom.authPhone.value, email: dom.authEmail.value.trim(), password: dom.authPassword.value });
            else if (state.authMode === 'reset') { await firebase.sendPasswordReset(dom.authEmail.value.trim()); setMessage('Link enviado. Confira também a caixa de spam.', true); return; }
            else await firebase.signIn(dom.authEmail.value.trim(), dom.authPassword.value);
            dom.authForm.reset(); api.closeOverlay(dom.authDialog); api.showToast(state.authMode === 'signup' ? 'Conta criada. Seja bem-vindo!' : 'Você entrou na sua conta.');
        } catch (error) { setMessage(firebase.firebaseErrorMessage(error, 'entrar')); } finally { dom.authSubmit.disabled = false; }
    });
    dom.googleLogin.addEventListener('click', async () => { dom.googleLogin.disabled = true; try { await firebase.signInWithGoogle(); api.closeOverlay(dom.authDialog); api.showToast('Conta conectada com Google.'); } catch (error) { setMessage(firebase.firebaseErrorMessage(error, 'entrar com Google')); } finally { dom.googleLogin.disabled = false; } });
    dom.accountDrawer.addEventListener('click', async (event) => {
        const view = event.target.closest('[data-account-view]'); if (view) { state.accountView = view.dataset.accountView; renderAccount(); return; }
        const track = event.target.closest('[data-track-order]'); if (track) return openTracking(track.dataset.trackOrder);
        const again = event.target.closest('[data-reorder]'); if (again) return reorder(again.dataset.reorder);
        const courierStatus = event.target.closest('[data-courier-order-status]'); if (courierStatus) return updateCourierOrder(courierStatus.dataset.orderId, courierStatus.dataset.courierOrderStatus, courierStatus);
        const startLocation = event.target.closest('[data-start-courier-location]'); if (startLocation) return startLocationSharing(startLocation.dataset.startCourierLocation);
        const remove = event.target.closest('[data-delete-address]'); if (remove) return api.askConfirmation({ title: 'Remover este endereço?', text: 'Ele deixará de aparecer no próximo checkout.', confirmLabel: 'Remover endereço', action: () => firebase.deleteAddress(state.user.uid, remove.dataset.deleteAddress) });
        if (event.target.closest('[data-customer-logout]')) { await firebase.signOut(); api.showToast('Você saiu da conta.'); }
        if (event.target.closest('[data-request-deletion]')) return api.askConfirmation({ title: 'Solicitar exclusão da conta?', text: 'A equipe receberá a solicitação. Seus dados não serão apagados instantaneamente para preservar pedidos e obrigações legais.', confirmLabel: 'Enviar solicitação', action: async () => { await firebase.requestAccountDeletion(); await firebase.signOut(); closeAccount(); api.showToast('Solicitação de exclusão registrada.'); } });
        if (event.target.closest('[data-enable-push]')) { try { await firebase.enablePush(state.user.uid, VAPID_KEY); api.showToast('Avisos ativados neste aparelho.'); } catch (error) { api.showToast(firebase.firebaseErrorMessage(error, 'ativar notificações'), 'error'); } }
    });
    dom.accountContent.addEventListener('submit', handleAccountSubmit);
    dom.notificationBtn.addEventListener('click', () => { renderNotifications(); api.openOverlay(dom.notificationDrawer, dom.readAll); });
    dom.notificationList.addEventListener('click', async (event) => { const item = event.target.closest('[data-notification-id]'); if (!item) return; await firebase.markNotificationRead(state.user.uid, item.dataset.notificationId); if (item.dataset.trackOrder) openTracking(item.dataset.trackOrder); });
    dom.readAll.addEventListener('click', async () => { try { await firebase.markAllNotificationsRead(state.user.uid); } catch (error) { api.handleError(error); } });
    dom.trackActive.addEventListener('click', () => openTracking(dom.trackActive.dataset.orderId));
    document.querySelectorAll('[data-public-ranking]').forEach((button) => button.addEventListener('click', () => { state.publicRanking = button.dataset.publicRanking; document.querySelectorAll('[data-public-ranking]').forEach((item) => item.setAttribute('aria-selected', String(item === button))); renderPublicRanking(); }));
    document.querySelector('.admin-nav').addEventListener('click', (event) => { const view = event.target.closest('[data-admin-view]'); if (view) switchAdminView(view.dataset.adminView); });
    dom.adminOps.addEventListener('click', (event) => { const jump = event.target.closest('[data-admin-view-jump]'); if (jump) switchAdminView(jump.dataset.adminViewJump); const status = event.target.closest('[data-admin-order-status]'); if (status) updateAdminOrder(status.dataset.orderId, status.dataset.adminOrderStatus); const track = event.target.closest('[data-track-order]'); if (track) openTracking(track.dataset.trackOrder); const courier = event.target.closest('[data-set-courier]'); if (courier) confirmCourierChange(courier); });
    dom.adminOps.addEventListener('change', (event) => { const select = event.target.closest('[data-assign-courier]'); if (select) assignCourier(select.dataset.assignCourier, select.value, select); });
    [dom.adminOrderSearch, dom.adminOrderFilter, dom.adminCustomerSearch].forEach((input) => input.addEventListener('input', renderAdmin));
    dom.financePeriod.addEventListener('change', renderFinance);
    dom.adminProductSearch.addEventListener('input', () => api.filterAdminProducts(dom.adminProductSearch.value));
    dom.loyaltyForm.addEventListener('submit', async (event) => { event.preventDefault(); try { await firebase.saveOperationalSettings({ loyalty: { enabled: dom.loyaltyEnabled.checked, pointsPerCompletedOrder: dom.loyaltyPoints.value }, game: { rankingEnabled: dom.gameRankingEnabled.checked, seasonName: dom.gameSeasonName.value } }); api.showToast('Configurações salvas.'); } catch (error) { api.showToast(firebase.firebaseErrorMessage(error, 'salvar as configurações'), 'error'); } });

    ['game_weekly', 'game_all', 'customers_monthly', 'customers_all'].forEach((id) => firebase.subscribeLeaderboard(id, (document) => { state.leaderboards[id] = document.entries || []; renderPublicRanking(); renderAccountIfOpen(); }, () => { state.leaderboards[id] = []; renderPublicRanking(); }));
    const unsubscribeForegroundPush = firebase.observeForegroundPush(() => api.showToast('Você recebeu uma nova notificação.'));
    const unsubscribeAuth = firebase.observeAuth(onAuth);
    renderPublicRanking(); syncHeader();

    return {
        toggleFavorite, syncFavoriteButtons, createTrackedOrder, beginGameSession, finishGame, openTracking, openAccount, getUser: () => state.user,
        applySettings: (settings = {}) => {
            state.settings = settings;
            dom.loyaltyEnabled.checked = settings.loyalty?.enabled === true;
            dom.loyaltyPoints.value = String(settings.loyalty?.pointsPerCompletedOrder ?? 10);
            dom.gameRankingEnabled.checked = settings.game?.rankingEnabled !== false;
            dom.gameSeasonName.value = settings.game?.seasonName || '';
            renderAccountIfOpen();
        },
        destroy: () => { unsubscribeAuth?.(); unsubscribeForegroundPush?.(); state.trackedLocationUnsubscribe?.(); state.locationStops.forEach((stop) => stop()); state.wakeLock?.release?.().catch(() => {}); document.removeEventListener('visibilitychange', resumeCourierProtection); window.removeEventListener('pageshow', resumeCourierProtection); cleanup(state.unsubscribers); cleanup(state.adminUnsubscribers); }
    };
}
