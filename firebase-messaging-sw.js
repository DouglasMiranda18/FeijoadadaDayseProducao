/* Somente assets públicos entram no cache. Pedidos, conta e respostas Firebase nunca são armazenados. */
const CACHE_NAME = 'feijoada-dayse-static-v12';
const STATIC_ASSETS = ['./', './Index.html', './style.css?v=2.7.2', './js/app.mjs?v=2.7.2', './js/icons.mjs?v=2.7.2', './js/core.mjs?v=2.7.2', './js/account-core.mjs?v=2.7.2', './js/customer.mjs?v=2.7.2', './js/firebase.mjs?v=2.7.2', './imagens/Feijoada%20Da%20Dayse(Logotipo).png', './imagens/jogo-panela-corredora.png', './imagens/icones-site-atlas.png', './imagens/icones-controles-atlas.png', './imagens/jogo-itens-atlas.png'];

self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./Index.html')));
    return;
  }
  if (!STATIC_ASSETS.some((asset) => url.pathname.endsWith(asset.replace('./', '/')))) return;
  event.respondWith(fetch(request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    return response;
  }).catch(() => caches.match(request)));
});

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: 'AIzaSyC1zIakJQ0YZSFDNKl8l_K39ajNeAbRtbU',
  authDomain: 'feijoadadadayse-a074d.firebaseapp.com',
  projectId: 'feijoadadadayse-a074d',
  messagingSenderId: '193167774782',
  appId: '1:193167774782:web:6b32f1088a010d992ead6f'
});
firebase.messaging().onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Feijoada da Dayse';
  const options = { body: payload.notification?.body || 'Seu pedido teve uma atualização.', icon: './imagens/Feijoada%20Da%20Dayse(Logotipo).png', badge: './imagens/Feijoada%20Da%20Dayse(Logotipo).png', data: payload.data || {} };
  return self.registration.showNotification(title, options);
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const orderId = event.notification.data?.orderId;
  event.waitUntil(self.clients.openWindow(`./Index.html${orderId ? `?pedido=${encodeURIComponent(orderId)}` : ''}`));
});
