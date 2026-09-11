import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();
const REGION = 'southamerica-east1';
const PAYMENT_FEES = { 'Cartão de Crédito': 2, 'Cartão de Débito': 1, Pix: 0, Dinheiro: 0 };
const FLOWS = {
  delivery: ['received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'arrived', 'delivered'],
  pickup: ['received', 'confirmed', 'preparing', 'ready_for_pickup', 'delivered']
};
const STATUS_COPY = {
  confirmed: ['Pedido confirmado', 'A cozinha confirmou seu pedido.'], preparing: ['Panela no fogo', 'Seu pedido começou a ser preparado.'],
  ready: ['Pedido pronto', 'Seu pedido está pronto para seguir viagem.'], ready_for_pickup: ['Pronto para retirada', 'Seu pedido já pode ser retirado.'],
  out_for_delivery: ['Seu pedido saiu para entrega!', 'O entregador já está a caminho.'], arrived: ['O entregador chegou!', 'Seu pedido está no endereço. Vá ao encontro do entregador.'], delivered: ['Pedido entregue', 'Bom apetite e até a próxima!'],
  cancelled: ['Pedido cancelado', 'O pedido foi cancelado. Fale com a cozinha se precisar de ajuda.']
};

function requireUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para continuar.');
  return request.auth;
}
function requireAdmin(request) {
  const auth = requireUser(request);
  if (auth.token.admin !== true) throw new HttpsError('permission-denied', 'Permissão administrativa necessária.');
  return auth;
}
function requireCourier(request) {
  const auth = requireUser(request);
  if (auth.token.courier !== true) throw new HttpsError('permission-denied', 'Permissão de entregador necessária.');
  return auth;
}
const safeText = (value, max) => String(value || '').trim().slice(0, max);
const weekKey = (date = new Date()) => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return `${utc.getUTCFullYear()}-W${String(Math.ceil((((utc - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
};
const monthKey = (date = new Date()) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export const createOrder = onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  const auth = requireUser(request);
  const data = request.data || {};
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 30) throw new HttpsError('invalid-argument', 'Pedido sem itens válidos.');
  const normalized = data.items.map((item) => ({ productId: safeText(item.productId, 120), quantity: Math.trunc(Number(item.quantity)) }));
  if (normalized.some((item) => !item.productId || item.quantity < 1 || item.quantity > 20)) throw new HttpsError('invalid-argument', 'Quantidade inválida.');
  const refs = normalized.map((item) => db.collection('products').doc(item.productId));
  const snapshots = await db.getAll(...refs);
  const items = snapshots.map((snapshot, index) => {
    const product = snapshot.data();
    if (!snapshot.exists || product.availability === false) throw new HttpsError('failed-precondition', 'Um item não está mais disponível.');
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) throw new HttpsError('failed-precondition', 'Preço de produto inválido.');
    return { productId: snapshot.id, name: safeText(product.name, 90), category: safeText(product.category, 40), price, quantity: normalized[index].quantity };
  });
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
  const paymentMethod = safeText(data.paymentMethod, 40);
  if (!(paymentMethod in PAYMENT_FEES)) throw new HttpsError('invalid-argument', 'Forma de pagamento inválida.');
  const quotedFee = Number(data.delivery?.quote?.fee);
  if (!Number.isFinite(quotedFee) || quotedFee < 0 || quotedFee > 100) throw new HttpsError('invalid-argument', 'Taxa de entrega inválida.');
  const paymentFee = PAYMENT_FEES[paymentMethod];
  const order = {
    customerId: auth.uid,
    customer: { name: safeText(data.customer?.name || auth.token.name, 80), phone: safeText(data.customer?.phone, 24), email: safeText(auth.token.email, 120) },
    fulfillment: 'delivery',
    delivery: {
      cep: safeText(data.delivery?.cep, 10), street: safeText(data.delivery?.street, 120), number: safeText(data.delivery?.number, 20), neighborhood: safeText(data.delivery?.neighborhood, 80), city: safeText(data.delivery?.city, 100), quotedDistance: Number(data.delivery?.quote?.distance) || null,
      latitude: Number.isFinite(Number(data.delivery?.quote?.latitude)) ? Math.max(-90, Math.min(90, Number(data.delivery.quote.latitude))) : null,
      longitude: Number.isFinite(Number(data.delivery?.quote?.longitude)) ? Math.max(-180, Math.min(180, Number(data.delivery.quote.longitude))) : null
    },
    items, paymentMethod, changeAmount: Math.max(0, Number(data.changeAmount) || 0), notes: safeText(data.notes, 300),
    totals: { subtotal, deliveryFee: quotedFee, paymentFee, total: Math.round((subtotal + quotedFee + paymentFee) * 100) / 100 },
    status: 'received', statusHistory: [{ status: 'received', at: Timestamp.now(), actor: 'customer' }],
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  };
  const ref = await db.collection('orders').add(order);
  notifyAdminsNewOrder(ref.id, order).catch((error) => console.error('Falha ao avisar administradores:', error));
  return { orderId: ref.id, status: 'received', totals: order.totals };
});

export const startGameSession = onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  const auth = requireUser(request); const ref = db.collection('gameSessions').doc();
  await ref.set({ uid: auth.uid, startedAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000), used: false });
  return { sessionId: ref.id };
});

async function rebuildGameBoards() {
  const currentWeek = weekKey();
  const [weekly, all] = await Promise.all([
    db.collection('gameScores').where('weekKey', '==', currentWeek).orderBy('bestWeekly', 'desc').limit(50).get(),
    db.collection('gameScores').orderBy('bestAll', 'desc').limit(50).get()
  ]);
  const entries = (snapshot, field) => snapshot.docs.filter((doc) => doc.data().optIn === true).slice(0, 20).map((doc) => ({ uid: doc.id, publicName: doc.data().publicName, score: doc.data()[field] }));
  await Promise.all([
    db.collection('leaderboards').doc('game_weekly').set({ weekKey: currentWeek, entries: entries(weekly, 'bestWeekly'), updatedAt: FieldValue.serverTimestamp() }),
    db.collection('leaderboards').doc('game_all').set({ entries: entries(all, 'bestAll'), updatedAt: FieldValue.serverTimestamp() })
  ]);
}

export const submitGameScore = onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  const auth = requireUser(request); const { sessionId } = request.data || {}; const score = Number(request.data?.score); const collections = Number(request.data?.collections); const powerUps = Number(request.data?.powerUps);
  if (!sessionId || !Number.isInteger(score) || score < 0) throw new HttpsError('invalid-argument', 'Pontuação inválida.');
  const sessionRef = db.collection('gameSessions').doc(sessionId); const scoreRef = db.collection('gameScores').doc(auth.uid); const userRef = db.collection('users').doc(auth.uid); const currentWeek = weekKey();
  const result = await db.runTransaction(async (transaction) => {
    const [sessionSnap, scoreSnap, userSnap] = await Promise.all([transaction.get(sessionRef), transaction.get(scoreRef), transaction.get(userRef)]); const session = sessionSnap.data();
    if (!sessionSnap.exists || session.uid !== auth.uid || session.used || session.expiresAt.toMillis() < Date.now()) throw new HttpsError('failed-precondition', 'Partida expirada ou já enviada.');
    const duration = Date.now() - session.startedAt.toMillis(); const maximum = Math.min(Math.floor(duration / 300) * 50, Math.max(0, collections) * 400 + Math.max(0, powerUps) * 100);
    if (duration < 1000 || score > maximum) throw new HttpsError('invalid-argument', 'Pontuação incompatível com a partida.');
    const previous = scoreSnap.data() || {}; const previousBest = Number(previous.bestAll) || 0; const previousWeekly = previous.weekKey === currentWeek ? Number(previous.bestWeekly) || 0 : 0; const bestAll = Math.max(previousBest, score); const bestWeekly = Math.max(previousWeekly, score); const profile = userSnap.data() || {};
    transaction.update(sessionRef, { used: true, score, durationMs: duration, completedAt: FieldValue.serverTimestamp() });
    transaction.set(scoreRef, { uid: auth.uid, publicName: safeText(profile.publicName || profile.displayName, 40) || 'Cliente da casa', optIn: profile.gameRankingOptIn === true, bestAll, bestWeekly, weekKey: currentWeek, plays: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(userRef, { stats: { ...(profile.stats || {}), gameBest: bestAll, gamePlays: (profile.stats?.gamePlays || 0) + 1 }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { personalBest: score > previousBest };
  });
  await rebuildGameBoards();
  const board = await db.collection('leaderboards').doc('game_weekly').get(); const position = (board.data()?.entries || []).findIndex((entry) => entry.uid === auth.uid) + 1;
  return { ...result, position: position || null };
});

async function sendOrderPush(uid, orderId, title, body) {
  const [profile, tokens] = await Promise.all([db.collection('users').doc(uid).get(), db.collection('users').doc(uid).collection('pushTokens').get()]);
  if (profile.data()?.notifications?.orderUpdates === false || tokens.empty) return { sent: 0 };
  const refs = tokens.docs; const response = await getMessaging().sendEachForMulticast({ tokens: refs.map((doc) => doc.data().token), notification: { title, body }, data: { orderId, url: `/?pedido=${orderId}` }, webpush: { fcmOptions: { link: `/?pedido=${orderId}` } } });
  const batch = db.batch(); response.responses.forEach((item, index) => { if (!item.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(item.error?.code)) batch.delete(refs[index].ref); }); await batch.commit();
  return { sent: response.successCount, failed: response.failureCount };
}

async function notifyAdminsNewOrder(orderId, order) {
  const admins = await db.collection('users').where('role', '==', 'admin').get();
  if (admins.empty) return;
  const title = 'Novo pedido recebido';
  const body = `${safeText(order.customer?.name, 50) || 'Cliente'} enviou um pedido de R$ ${Number(order.totals?.total || 0).toFixed(2).replace('.', ',')}.`;
  const batch = db.batch();
  admins.docs.forEach((admin) => batch.set(admin.ref.collection('notifications').doc(`${orderId}_received`), { orderId, status: 'received', title, message: body, read: false, createdAt: FieldValue.serverTimestamp() }));
  await batch.commit();
  await Promise.all(admins.docs.map((admin) => sendOrderPush(admin.id, orderId, title, body).catch(() => ({ sent: 0 }))));
}

export const assignOrderCourier = onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  const auth = requireAdmin(request);
  const orderId = safeText(request.data?.orderId, 120);
  const courierId = safeText(request.data?.courierId, 128);
  if (!orderId || !courierId) throw new HttpsError('invalid-argument', 'Pedido e entregador são obrigatórios.');
  const orderRef = db.collection('orders').doc(orderId);
  const courierRef = db.collection('users').doc(courierId);
  const [orderSnap, courierSnap] = await Promise.all([orderRef.get(), courierRef.get()]);
  if (!orderSnap.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
  if (!courierSnap.exists || courierSnap.data()?.isCourier !== true) throw new HttpsError('failed-precondition', 'A conta escolhida não está cadastrada como entregador.');
  if (['delivered', 'cancelled'].includes(orderSnap.data().status)) throw new HttpsError('failed-precondition', 'Este pedido já foi encerrado.');
  const courier = courierSnap.data();
  await orderRef.update({
    courierId,
    courier: { name: safeText(courier.displayName || courier.publicName, 80), phone: safeText(courier.phone, 24) },
    assignedAt: FieldValue.serverTimestamp(), assignedBy: auth.uid, updatedAt: FieldValue.serverTimestamp()
  });
  await getDatabase().ref(`deliveryAccess/${orderId}`).set({ customerId: orderSnap.data().customerId, courierId, assignedAt: Date.now() }).catch((error) => console.error('Falha ao preparar rastreamento:', error));
  const title = 'Nova entrega atribuída';
  const body = `O pedido ${orderId.slice(-6).toUpperCase()} está na sua lista de entregas.`;
  await courierRef.collection('notifications').add({ orderId, title, message: body, read: false, createdAt: FieldValue.serverTimestamp() });
  const push = await sendOrderPush(courierId, orderId, title, body).catch(() => ({ sent: 0, failed: true }));
  return { assigned: true, courierId, push };
});

export const setCourierRole = onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  const auth = requireAdmin(request);
  const uid = safeText(request.data?.uid, 128);
  const enabled = request.data?.enabled === true;
  if (!uid) throw new HttpsError('invalid-argument', 'Selecione uma conta válida.');
  if (uid === auth.uid) throw new HttpsError('failed-precondition', 'Use outra conta para o entregador; a conta administrativa principal não deve mudar de função.');
  let user;
  try { user = await getAuth().getUser(uid); }
  catch { throw new HttpsError('not-found', 'Conta não encontrada no Firebase Authentication.'); }
  const claims = { ...(user.customClaims || {}) };
  if (enabled) claims.courier = true; else delete claims.courier;
  await getAuth().setCustomUserClaims(uid, claims);
  await db.collection('users').doc(uid).set({ isCourier: enabled, courierUpdatedAt: FieldValue.serverTimestamp(), courierUpdatedBy: auth.uid }, { merge: true });
  return { uid, isCourier: enabled };
});

export const updateCourierDelivery = onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  const auth = requireCourier(request);
  const orderId = safeText(request.data?.orderId, 120);
  const next = safeText(request.data?.status, 40);
  if (!orderId || !['out_for_delivery', 'arrived', 'delivered'].includes(next)) throw new HttpsError('invalid-argument', 'Ação de entrega inválida.');
  const expectedPrevious = { out_for_delivery: 'ready', arrived: 'out_for_delivery', delivered: 'arrived' }[next];
  const orderRef = db.collection('orders').doc(orderId);
  const eventRef = db.collection('notificationEvents').doc(`${orderId}_${next}`);
  let order;
  const changed = await db.runTransaction(async (transaction) => {
    const [orderSnap, eventSnap] = await Promise.all([transaction.get(orderRef), transaction.get(eventRef)]);
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
    order = orderSnap.data();
    if (order.courierId !== auth.uid) throw new HttpsError('permission-denied', 'Esta entrega não foi atribuída à sua conta.');
    if (eventSnap.exists) return false;
    if (order.status !== expectedPrevious) throw new HttpsError('failed-precondition', 'A entrega mudou de etapa. Atualize a tela.');
    if (next === 'delivered') await recordCompletedOrder(transaction, order);
    const at = Timestamp.now();
    const timestamps = next === 'out_for_delivery' ? { deliveryStartedAt: at } : next === 'arrived' ? { arrivedAt: at } : { deliveredAt: at };
    transaction.update(orderRef, { status: next, ...timestamps, statusHistory: FieldValue.arrayUnion({ status: next, at, actor: auth.uid, actorRole: 'courier' }), updatedAt: FieldValue.serverTimestamp() });
    transaction.set(eventRef, { orderId, customerId: order.customerId, courierId: auth.uid, status: next, createdAt: FieldValue.serverTimestamp() });
    const [title, message] = STATUS_COPY[next];
    transaction.set(db.collection('users').doc(order.customerId).collection('notifications').doc(`${orderId}_${next}`), { orderId, status: next, title, message, read: false, createdAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!changed) return { changed: false, duplicate: true };
  const [title, body] = STATUS_COPY[next];
  const push = await sendOrderPush(order.customerId, orderId, title, body).catch(() => ({ sent: 0, failed: true }));
  await eventRef.set({ push, processedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (next === 'delivered') await Promise.all([getDatabase().ref(`activeDeliveries/${orderId}`).remove(), getDatabase().ref(`deliveryAccess/${orderId}`).remove()]).catch(() => {});
  if (next === 'delivered') await rebuildCustomerBoard();
  return { changed: true, status: next, push };
});

async function recordCompletedOrder(transaction, order) {
  const userRef = db.collection('users').doc(order.customerId); const statsRef = db.collection('customerStats').doc(order.customerId); const settingsRef = db.collection('settings').doc('main');
  const [userSnap, statsSnap, settingsSnap] = await Promise.all([transaction.get(userRef), transaction.get(statsRef), transaction.get(settingsRef)]); const user = userSnap.data() || {}; const stats = statsSnap.data() || {}; const settings = settingsSnap.data() || {}; const points = settings.loyalty?.enabled ? Number(settings.loyalty.pointsPerCompletedOrder) || 0 : 0; const month = monthKey(); const monthlyOrders = stats.monthKey === month ? (stats.monthlyOrders || 0) + 1 : 1;
  transaction.set(userRef, { stats: { ...(user.stats || {}), completedOrders: (user.stats?.completedOrders || 0) + 1, loyaltyPoints: (user.stats?.loyaltyPoints || 0) + points, lastOrderAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  transaction.set(statsRef, { publicName: safeText(user.publicName || user.displayName, 40) || 'Cliente da casa', optIn: user.rankingOptIn === true, completedOrders: (stats.completedOrders || 0) + 1, monthlyOrders, monthKey: month, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

async function rebuildCustomerBoard() {
  const month = monthKey();
  const [monthly, all] = await Promise.all([
    db.collection('customerStats').where('monthKey', '==', month).orderBy('monthlyOrders', 'desc').limit(50).get(),
    db.collection('customerStats').orderBy('completedOrders', 'desc').limit(50).get()
  ]);
  const entries = (snapshot, field) => snapshot.docs.filter((doc) => doc.data().optIn === true).slice(0, 20).map((doc) => ({ uid: doc.id, publicName: doc.data().publicName, score: doc.data()[field] }));
  await Promise.all([
    db.collection('leaderboards').doc('customers_monthly').set({ monthKey: month, entries: entries(monthly, 'monthlyOrders'), updatedAt: FieldValue.serverTimestamp() }),
    db.collection('leaderboards').doc('customers_all').set({ entries: entries(all, 'completedOrders'), updatedAt: FieldValue.serverTimestamp() })
  ]);
}

export const updateOrderStatus = onCall({ region: REGION, enforceAppCheck: false }, async (request) => {
  const auth = requireAdmin(request); const orderId = safeText(request.data?.orderId, 120); const next = safeText(request.data?.status, 40); if (!orderId) throw new HttpsError('invalid-argument', 'Pedido inválido.');
  const orderRef = db.collection('orders').doc(orderId); const eventRef = db.collection('notificationEvents').doc(`${orderId}_${next}`); let order;
  const changed = await db.runTransaction(async (transaction) => {
    const [orderSnap, eventSnap] = await Promise.all([transaction.get(orderRef), transaction.get(eventRef)]); if (!orderSnap.exists) throw new HttpsError('not-found', 'Pedido não encontrado.'); if (eventSnap.exists) return false;
    order = orderSnap.data(); const flow = FLOWS[order.fulfillment || 'delivery']; const expected = flow[flow.indexOf(order.status) + 1]; if (next !== expected && next !== 'cancelled') throw new HttpsError('failed-precondition', 'Mudança de status fora da sequência.');
    if (next === 'delivered') await recordCompletedOrder(transaction, order);
    const at = Timestamp.now(); const statusTimestamp = next === 'out_for_delivery' ? { deliveryStartedAt: at } : next === 'arrived' ? { arrivedAt: at } : next === 'delivered' ? { deliveredAt: at } : {};
    transaction.update(orderRef, { status: next, ...statusTimestamp, statusHistory: FieldValue.arrayUnion({ status: next, at, actor: auth.uid }), updatedAt: FieldValue.serverTimestamp() });
    transaction.set(eventRef, { orderId, customerId: order.customerId, status: next, createdAt: FieldValue.serverTimestamp() });
    const [title, message] = STATUS_COPY[next] || ['Pedido atualizado', 'Seu pedido teve uma atualização.']; transaction.set(db.collection('users').doc(order.customerId).collection('notifications').doc(`${orderId}_${next}`), { orderId, status: next, title, message, read: false, createdAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!changed) return { changed: false, duplicate: true };
  const [title, body] = STATUS_COPY[next] || ['Pedido atualizado', 'Seu pedido teve uma atualização.']; const push = await sendOrderPush(order.customerId, orderId, title, body).catch(() => ({ sent: 0, failed: true }));
  await eventRef.set({ push, processedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (next === 'delivered') await rebuildCustomerBoard();
  return { changed: true, status: next, push };
});

export const requestAccountDeletion = onCall({ region: REGION }, async (request) => {
  const auth = requireUser(request); await db.collection('users').doc(auth.uid).set({ deletionRequestedAt: FieldValue.serverTimestamp(), disabled: true }, { merge: true });
  return { requested: true };
});
