import { normalizeProduct } from './core.mjs?v=2.5.0';

const firebaseConfig = Object.freeze({
    apiKey: 'AIzaSyC1zIakJQ0YZSFDNKl8l_K39ajNeAbRtbU',
    authDomain: 'feijoadadadayse-a074d.firebaseapp.com',
    projectId: 'feijoadadadayse-a074d',
    storageBucket: 'feijoadadadayse-a074d.appspot.com',
    messagingSenderId: '193167774782',
    appId: '1:193167774782:web:6b32f1088a010d992ead6f',
    databaseURL: document.querySelector('meta[name="firebase-database-url"]')?.content.trim() || undefined
});

if (!window.firebase) {
    throw new Error('Firebase não carregou. Verifique a conexão e tente novamente.');
}

const firebase = window.firebase;
const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
export const auth = app.auth();
export const db = app.firestore();
export const realtimeDb = typeof app.database === 'function' && firebaseConfig.databaseURL ? app.database() : null;
export const functions = typeof app.functions === 'function' ? app.functions('southamerica-east1') : null;
let messagingInstance = null;
try {
    if (typeof app.messaging === 'function') messagingInstance = app.messaging();
} catch {
    // Alguns navegadores não oferecem os recursos exigidos pelo FCM.
}
export const messaging = messagingInstance;

const productsRef = db.collection('products');
const settingsRef = db.collection('settings').doc('main');

export function subscribeProducts(onData, onError) {
    return productsRef.onSnapshot((snapshot) => {
        const products = snapshot.docs
            .map((document) => normalizeProduct(document.id, document.data()))
            .filter(Boolean);
        onData(products);
    }, onError);
}

export function subscribeSettings(onData, onError) {
    return settingsRef.onSnapshot((snapshot) => {
        onData(snapshot.exists ? snapshot.data() : { isClosed: false });
    }, onError);
}

export function observeAuth(onChange) {
    return auth.onAuthStateChanged(onChange);
}

export async function signIn(email, password) {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    return auth.signInWithEmailAndPassword(email, password);
}

export async function signUp({ name, email, password, phone = '' }) {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    await credential.user.updateProfile({ displayName: name });
    await db.collection('users').doc(credential.user.uid).set({
        displayName: name,
        publicName: name.split(/\s+/).slice(0, 2).join(' '),
        email: credential.user.email,
        phone,
        role: 'customer',
        rankingOptIn: false,
        gameRankingOptIn: false,
        notifications: { orderUpdates: true, game: false },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return credential;
}

export async function signInWithGoogle() {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await auth.signInWithPopup(provider);
    const userRef = db.collection('users').doc(credential.user.uid);
    const snapshot = await userRef.get();
    const profile = {
        displayName: credential.user.displayName || 'Cliente da casa',
        publicName: (credential.user.displayName || 'Cliente da casa').split(/\s+/).slice(0, 2).join(' '),
        avatarUrl: credential.user.photoURL || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!snapshot.exists) {
        Object.assign(profile, {
            role: 'customer',
            email: credential.user.email,
            rankingOptIn: false,
            gameRankingOptIn: false,
            notifications: { orderUpdates: true, game: false },
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    await userRef.set(profile, { merge: true });
    return credential;
}

export function sendPasswordReset(email) {
    return auth.sendPasswordResetEmail(email);
}

export function signOut() {
    return auth.signOut();
}

export async function ensureOrderSession(customer = {}) {
    if (auth.currentUser) return auth.currentUser;
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const credential = await auth.signInAnonymously();
    await db.collection('users').doc(credential.user.uid).set({
        displayName: String(customer.name || 'Cliente visitante').trim().slice(0, 80),
        publicName: 'Cliente visitante',
        phone: String(customer.phone || '').trim().slice(0, 24),
        role: 'customer',
        isGuest: true,
        rankingOptIn: false,
        gameRankingOptIn: false,
        notifications: { orderUpdates: true, game: false },
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return credential.user;
}

export async function getAuthContext(user = auth.currentUser) {
    if (!user) return { user: null, claims: {}, isAdmin: false, isCourier: false };
    const token = await user.getIdTokenResult();
    return { user, claims: token.claims, isAdmin: token.claims.admin === true, isCourier: token.claims.courier === true };
}

export function subscribeProfile(uid, onData, onError) {
    return db.collection('users').doc(uid).onSnapshot((snapshot) => onData(snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null), onError);
}

export function saveProfile(uid, profile) {
    if (auth.currentUser?.uid !== uid) throw new Error('Sua sessão expirou. Entre novamente.');
    const allowed = {
        displayName: String(profile.displayName || '').trim().slice(0, 80),
        publicName: String(profile.publicName || '').trim().slice(0, 40),
        phone: String(profile.phone || '').trim().slice(0, 24),
        rankingOptIn: profile.rankingOptIn === true,
        gameRankingOptIn: profile.gameRankingOptIn === true,
        notifications: {
            orderUpdates: profile.notifications?.orderUpdates !== false,
            game: profile.notifications?.game === true
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    return db.collection('users').doc(uid).set(allowed, { merge: true });
}

export function subscribeAddresses(uid, onData, onError) {
    return db.collection('users').doc(uid).collection('addresses').onSnapshot((snapshot) => {
        onData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }, onError);
}

export async function saveAddress(uid, id, address) {
    if (auth.currentUser?.uid !== uid) throw new Error('Sua sessão expirou. Entre novamente.');
    const ref = id
        ? db.collection('users').doc(uid).collection('addresses').doc(id)
        : db.collection('users').doc(uid).collection('addresses').doc();
    const payload = {
        label: String(address.label || 'Casa').trim().slice(0, 30),
        cep: String(address.cep || '').trim().slice(0, 10),
        street: String(address.street || '').trim().slice(0, 120),
        number: String(address.number || '').trim().slice(0, 20),
        neighborhood: String(address.neighborhood || '').trim().slice(0, 80),
        city: String(address.city || '').trim().slice(0, 100),
        isDefault: address.isDefault === true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!payload.isDefault) return ref.set(payload, { merge: true });
    const snapshot = await db.collection('users').doc(uid).collection('addresses').get();
    const batch = db.batch();
    snapshot.docs.forEach((document) => {
        if (document.id !== ref.id && document.data().isDefault === true) batch.update(document.ref, { isDefault: false });
    });
    batch.set(ref, payload, { merge: true });
    return batch.commit();
}

export function deleteAddress(uid, id) {
    if (auth.currentUser?.uid !== uid) throw new Error('Sua sessão expirou. Entre novamente.');
    return db.collection('users').doc(uid).collection('addresses').doc(id).delete();
}

export function subscribeFavorites(uid, onData, onError) {
    return db.collection('users').doc(uid).collection('favorites').onSnapshot((snapshot) => {
        onData(snapshot.docs.map((doc) => doc.id));
    }, onError);
}

export function toggleFavorite(uid, productId, active) {
    if (auth.currentUser?.uid !== uid) throw new Error('Sua sessão expirou. Entre novamente.');
    const ref = db.collection('users').doc(uid).collection('favorites').doc(String(productId));
    return active
        ? ref.set({ productId: String(productId), createdAt: firebase.firestore.FieldValue.serverTimestamp() })
        : ref.delete();
}

export function subscribeOrders(uid, onData, onError) {
    return db.collection('orders').where('customerId', '==', uid).onSnapshot((snapshot) => {
        const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        onData(orders);
    }, onError);
}

export function subscribeNotifications(uid, onData, onError) {
    return db.collection('users').doc(uid).collection('notifications').orderBy('createdAt', 'desc').limit(50).onSnapshot((snapshot) => {
        onData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }, onError);
}

export function markNotificationRead(uid, id, read = true) {
    if (auth.currentUser?.uid !== uid) throw new Error('Sua sessão expirou. Entre novamente.');
    return db.collection('users').doc(uid).collection('notifications').doc(id).update({
        read: Boolean(read),
        readAt: read ? firebase.firestore.FieldValue.serverTimestamp() : null
    });
}

export async function markAllNotificationsRead(uid) {
    if (auth.currentUser?.uid !== uid) throw new Error('Sua sessão expirou. Entre novamente.');
    const snapshot = await db.collection('users').doc(uid).collection('notifications').where('read', '==', false).limit(100).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, { read: true, readAt: firebase.firestore.FieldValue.serverTimestamp() }));
    return batch.commit();
}

export function subscribeLeaderboard(id, onData, onError) {
    return db.collection('leaderboards').doc(id).onSnapshot((snapshot) => onData(snapshot.exists ? snapshot.data() : { entries: [] }), onError);
}

export function subscribeAdminOrders(onData, onError) {
    return db.collection('orders').orderBy('createdAt', 'desc').limit(500).onSnapshot((snapshot) => {
        onData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }, onError);
}

export function subscribeCourierOrders(uid, onData, onError) {
    return db.collection('orders').where('courierId', '==', uid).onSnapshot((snapshot) => {
        const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
        onData(orders);
    }, onError);
}

export function subscribeDeliveryLocation(orderId, onData, onError) {
    if (!realtimeDb) { onError?.(Object.assign(new Error('Realtime Database não configurado.'), { code: 'database/unavailable' })); return () => {}; }
    const ref = realtimeDb.ref(`activeDeliveries/${orderId}`);
    const handler = ref.on('value', (snapshot) => onData(snapshot.exists() ? snapshot.val() : null), onError);
    return () => ref.off('value', handler);
}

export function startCourierLocation(orderId, onData, onError) {
    if (!realtimeDb) throw Object.assign(new Error('Realtime Database não configurado.'), { code: 'database/unavailable' });
    if (!navigator.geolocation) throw Object.assign(new Error('GPS indisponível neste aparelho.'), { code: 'geolocation/unsupported' });
    const ref = realtimeDb.ref(`activeDeliveries/${orderId}`);
    const trail = [];
    let lastTrailPoint = null;
    const distanceMeters = (a, b) => {
        if (!a || !b) return Infinity;
        const toRad = (value) => value * Math.PI / 180;
        const dLat = toRad(b.latitude - a.latitude); const dLng = toRad(b.longitude - a.longitude);
        const lat1 = toRad(a.latitude); const lat2 = toRad(b.latitude);
        const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    };
    const watchId = navigator.geolocation.watchPosition((position) => {
        const now = Date.now();
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude, updatedAt: now };
        if (!lastTrailPoint || distanceMeters(lastTrailPoint, point) >= 8 || now - lastTrailPoint.updatedAt >= 15000) {
            trail.push(point);
            if (trail.length > 60) trail.shift();
            lastTrailPoint = point;
        }
        const payload = {
            courierId: auth.currentUser?.uid || '', latitude: position.coords.latitude, longitude: position.coords.longitude,
            accuracy: position.coords.accuracy, heading: position.coords.heading ?? null, speed: position.coords.speed ?? null,
            updatedAt: firebase.database.ServerValue.TIMESTAMP, trail
        };
        ref.set(payload).then(() => onData?.(payload)).catch(onError);
    }, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => { navigator.geolocation.clearWatch(watchId); };
}

export function subscribeCustomers(onData, onError) {
    return db.collection('users').limit(200).onSnapshot((snapshot) => {
        const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0) || String(a.displayName || '').localeCompare(String(b.displayName || ''), 'pt-BR'));
        onData(users);
    }, onError);
}

async function callFunction(name, payload = {}) {
    if (!functions) throw Object.assign(new Error('Funções seguras ainda não estão disponíveis.'), { code: 'functions/unavailable' });
    const result = await functions.httpsCallable(name)(payload);
    return result.data;
}

export const createTrackedOrder = (payload) => callFunction('createOrder', payload);
export const updateTrackedOrderStatus = (payload) => callFunction('updateOrderStatus', payload);
export const assignOrderCourier = (payload) => callFunction('assignOrderCourier', payload);
export const updateCourierDelivery = (payload) => callFunction('updateCourierDelivery', payload);
export const setCourierRole = (payload) => callFunction('setCourierRole', payload);
export const startGameSession = () => callFunction('startGameSession');
export const submitGameScore = (payload) => callFunction('submitGameScore', payload);
export const requestAccountDeletion = () => callFunction('requestAccountDeletion');

export async function enablePush(uid, vapidKey) {
    if (!messaging || !('serviceWorker' in navigator) || !vapidKey) {
        throw Object.assign(new Error('Notificações push ainda não estão configuradas.'), { code: 'messaging/unsupported-browser' });
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw Object.assign(new Error('Permissão de notificação não concedida.'), { code: 'messaging/permission-blocked' });
    const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
    const token = await messaging.getToken({ vapidKey, serviceWorkerRegistration: registration });
    if (!token) throw new Error('Não foi possível registrar este aparelho.');
    const tokenId = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
        .then((bytes) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join(''));
    await db.collection('users').doc(uid).collection('pushTokens').doc(tokenId).set({
        token,
        userAgent: navigator.userAgent.slice(0, 250),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return token;
}

export function observeForegroundPush(onMessage) {
    if (!messaging) return () => {};
    return messaging.onMessage(async (payload) => {
        onMessage?.(payload);
        if (Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(payload.notification?.title || 'Feijoada da Dayse', {
            body: payload.notification?.body || 'Seu pedido teve uma atualização.',
            icon: './imagens/Feijoada%20Da%20Dayse(Logotipo).png',
            badge: './imagens/Feijoada%20Da%20Dayse(Logotipo).png',
            data: payload.data || {},
            tag: payload.data?.orderId ? `pedido-${payload.data.orderId}` : undefined
        });
    });
}

function requireAdmin() {
    if (!auth.currentUser) {
        const error = new Error('Sua sessão expirou. Entre novamente.');
        error.code = 'auth/requires-recent-login';
        throw error;
    }
}

export async function saveProduct(id, product) {
    requireAdmin();
    const payload = {
        name: product.name,
        category: product.category,
        price: product.price,
        description: product.description || '',
        image: product.image || '',
        availability: product.availability !== false,
        badge: product.badge || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (id) {
        await productsRef.doc(id).update(payload);
        return id;
    }

    payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    const document = await productsRef.add(payload);
    return document.id;
}

export async function setProductAvailability(id, availability) {
    requireAdmin();
    await productsRef.doc(id).update({
        availability,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

export async function deleteProduct(id) {
    requireAdmin();
    await productsRef.doc(id).delete();
}

export async function setStoreMode(mode) {
    requireAdmin();
    const storeMode = ['auto', 'open', 'closed'].includes(mode) ? mode : 'auto';
    await settingsRef.set({
        storeMode,
        isClosed: storeMode === 'closed',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

export async function saveOperationalSettings(settings) {
    requireAdmin();
    await settingsRef.set({
        loyalty: {
            enabled: settings.loyalty?.enabled === true,
            pointsPerCompletedOrder: Math.min(10000, Math.max(0, Number(settings.loyalty?.pointsPerCompletedOrder) || 0))
        },
        game: {
            rankingEnabled: settings.game?.rankingEnabled !== false,
            seasonName: String(settings.game?.seasonName || '').trim().slice(0, 60)
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

export function firebaseErrorMessage(error, action = 'concluir esta ação') {
    const messages = {
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/user-disabled': 'Esta conta foi desativada.',
        'auth/user-not-found': 'E-mail ou senha incorretos.',
        'auth/wrong-password': 'E-mail ou senha incorretos.',
        'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
        'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
        'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
        'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de concluir.',
        'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere pop-ups e tente novamente.',
        'auth/network-request-failed': 'Sem conexão com o serviço de login.',
        'permission-denied': 'Sua conta não tem permissão para esta alteração.',
        'functions/permission-denied': 'Sua conta não tem permissão para esta ação.',
        'functions/unauthenticated': 'Sua sessão expirou. Entre novamente.',
        'functions/failed-precondition': 'Esta ação não está disponível neste momento.',
        'messaging/permission-blocked': 'As notificações foram bloqueadas neste navegador.',
        'messaging/unsupported-browser': 'Este navegador não oferece notificações push.',
        'database/unavailable': 'O rastreamento ao vivo ainda não foi ativado no Firebase.',
        'geolocation/unsupported': 'Este aparelho não oferece localização pelo navegador.',
        'unavailable': 'O serviço está indisponível agora. Tente novamente em instantes.',
        'failed-precondition': 'O dado mudou em outro lugar. Recarregue e tente novamente.'
    };
    return messages[error?.code] || `Não foi possível ${action}. Tente novamente.`;
}
