import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, Image, Linking, Modal, Platform, Pressable,
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import MapView, { Marker, Polyline } from 'react-native-maps';
import {
  Bell, Bike, Check, ChevronRight, CircleUserRound, LogOut, MapPin,
  MessageCircle, Navigation, PackageCheck, Phone, Route, ShieldCheck, UtensilsCrossed
} from 'lucide-react-native';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { onValue, ref } from 'firebase/database';
import { auth, cloudFunctions, firestore, realtime } from './src/firebase';
import { getTrackedOrderId, refreshDeliveryPosition, startDeliveryTracking, stopDeliveryTracking } from './src/backgroundLocation';
import { addressOf, beverages, colors, friendlyOrderId, money, navigationLinks, phoneLinks, statusCopy } from './src/format';
import type { DeliveryOrder, DeliveryPosition } from './src/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true })
});

function messageOf(error: unknown) {
  const value = error as { code?: string; message?: string };
  if (value.code?.includes('invalid-credential')) return 'E-mail ou senha incorretos.';
  if (value.code?.includes('too-many-requests')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  if (value.code?.includes('network-request-failed')) return 'Sem conexão com a internet. Confira o sinal.';
  return value.message?.replace(/^Firebase:\s*/i, '') || 'Não foi possível concluir. Tente novamente.';
}

async function openUrl(url: string, unavailable: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error(unavailable);
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert('Não foi possível abrir', messageOf(error));
  }
}

export default function App() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isCourier, setIsCourier] = useState(false);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trackedId, setTrackedId] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setLoadingAuth(true);
    if (!nextUser) {
      setUser(null); setIsCourier(false); setOrders([]); setLoadingAuth(false); return;
    }
    try {
      const token = await nextUser.getIdTokenResult(true);
      setUser(nextUser);
      setIsCourier(token.claims.courier === true);
    } catch (error) {
      Alert.alert('Erro ao validar a conta', messageOf(error));
      setUser(nextUser); setIsCourier(false);
    } finally {
      setLoadingAuth(false);
    }
  }), []);

  useEffect(() => {
    getTrackedOrderId().then(setTrackedId);
    if (Platform.OS === 'android') Notifications.setNotificationChannelAsync('entregas', {
      name: 'Entregas', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 150, 250], lightColor: colors.orange
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || !isCourier) return;
    const ordersQuery = query(collection(firestore, 'orders'), where('courierId', '==', user.uid));
    return onSnapshot(ordersQuery, (snapshot) => {
      const next = snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as DeliveryOrder))
        .filter((order) => !['delivered', 'cancelled'].includes(order.status))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setOrders(next);
      setSelectedId((current) => current && next.some((order) => order.id === current) ? current : next[0]?.id || null);
    }, (error) => Alert.alert('Falha ao carregar entregas', messageOf(error)));
  }, [user, isCourier]);

  useEffect(() => {
    if (!trackedId || !orders.length) return;
    const tracked = orders.find((order) => order.id === trackedId);
    if (!tracked || tracked.status !== 'out_for_delivery') {
      stopDeliveryTracking(trackedId).catch(() => {});
      setTrackedId(null);
    }
  }, [orders, trackedId]);

  const selected = useMemo(() => orders.find((order) => order.id === selectedId) || null, [orders, selectedId]);

  if (loadingAuth) return <LoadingScreen />;
  if (!user) return <LoginScreen />;
  if (!isCourier) return <AccessDenied user={user} />;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {selected ? (
        <DeliveryScreen
          order={selected}
          orders={orders}
          tracked={trackedId === selected.id}
          onTrackChange={setTrackedId}
          onSelect={setSelectedId}
        />
      ) : <EmptyScreen user={user} />}
    </SafeAreaView>
  );
}

function LoadingScreen() {
  return <LinearGradient colors={[colors.wine, colors.darkWine]} style={styles.center}><Image source={require('./assets/icon.png')} style={styles.loadingLogo} /><ActivityIndicator color="#fff" size="large" /><Text style={styles.loadingText}>Preparando suas entregas…</Text></LinearGradient>;
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const login = async () => {
    if (!email.trim() || !password) return Alert.alert('Preencha os dados', 'Informe seu e-mail e sua senha.');
    setBusy(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (error) { Alert.alert('Não foi possível entrar', messageOf(error)); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (!email.trim()) return Alert.alert('Informe seu e-mail', 'Digite o e-mail da conta antes de recuperar a senha.');
    try { await sendPasswordResetEmail(auth, email.trim()); Alert.alert('E-mail enviado', 'Confira sua caixa de entrada para criar uma nova senha.'); }
    catch (error) { Alert.alert('Não foi possível enviar', messageOf(error)); }
  };
  return (
    <LinearGradient colors={[colors.wine, colors.darkWine]} style={styles.loginPage}>
      <StatusBar style="light" />
      <View style={styles.loginBrand}><Image source={require('./assets/icon.png')} style={styles.loginLogo} /><Text style={styles.loginTitle}>Feijoada da Dayse</Text><Text style={styles.loginEyebrow}>APLICATIVO DO ENTREGADOR</Text></View>
      <View style={styles.loginCard}>
        <View style={styles.loginIcon}><Bike color={colors.white} size={26} /></View>
        <Text style={styles.loginHeading}>Pronto para levar sabor?</Text>
        <Text style={styles.loginDescription}>Entre com a conta que a cozinha cadastrou como entregador.</Text>
        <Text style={styles.label}>E-mail</Text>
        <TextInput value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="seuemail@exemplo.com" placeholderTextColor="#a3948d" />
        <Text style={styles.label}>Senha</Text>
        <TextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry autoComplete="current-password" placeholder="Sua senha" placeholderTextColor="#a3948d" onSubmitEditing={login} />
        <Pressable onPress={login} disabled={busy} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryButtonText}>Entrar no aplicativo</Text><ChevronRight color="#fff" size={20} /></>}</Pressable>
        <Pressable onPress={reset} style={styles.textButton}><Text style={styles.textButtonLabel}>Esqueci minha senha</Text></Pressable>
      </View>
      <View style={styles.privacyRow}><ShieldCheck color="#f6c8b2" size={18} /><Text style={styles.privacyText}>Sua localização só é compartilhada durante uma entrega ativa.</Text></View>
    </LinearGradient>
  );
}

function AccessDenied({ user }: { user: User }) {
  return <View style={styles.centerPaper}><View style={styles.bigRound}><ShieldCheck color={colors.wine} size={38} /></View><Text style={styles.emptyTitle}>Conta sem acesso de entregador</Text><Text style={styles.emptyText}>{user.email}{'\n'}Peça ao administrador para ativar esta conta na aba Clientes e depois entre novamente.</Text><Pressable style={styles.secondaryButton} onPress={() => signOut(auth)}><LogOut color={colors.wine} size={18} /><Text style={styles.secondaryButtonText}>Sair</Text></Pressable></View>;
}

function EmptyScreen({ user }: { user: User }) {
  return <View style={styles.appPage}><Header deliveryCount={0} uid={user.uid} /><View style={styles.centerPaper}><View style={styles.bigRound}><PackageCheck color={colors.orange} size={38} /></View><Text style={styles.emptyTitle}>Nenhuma entrega agora</Text><Text style={styles.emptyText}>Quando a cozinha atribuir um pedido para {user.displayName || user.email}, ele aparecerá aqui automaticamente.</Text><Pressable style={styles.secondaryButton} onPress={() => signOut(auth)}><LogOut color={colors.wine} size={18} /><Text style={styles.secondaryButtonText}>Sair da conta</Text></Pressable></View></View>;
}

type AppNotification = { id: string; title?: string; message?: string; read?: boolean };

function Header({ deliveryCount, uid }: { deliveryCount: number; uid: string }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const initialized = useRef(false);
  useEffect(() => {
    const notificationsQuery = query(collection(firestore, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(30));
    return onSnapshot(notificationsQuery, (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as AppNotification));
      if (initialized.current) {
        const fresh = snapshot.docChanges().find((change) => change.type === 'added' && change.doc.data().read !== true);
        if (fresh) Notifications.requestPermissionsAsync().then((permission) => {
          if (permission.granted) return Notifications.scheduleNotificationAsync({ content: { title: fresh.doc.data().title || 'Nova entrega', body: fresh.doc.data().message || 'Confira o aplicativo do entregador.', sound: true }, trigger: null });
        }).catch(() => {});
      }
      initialized.current = true;
      setItems(next);
    });
  }, [uid]);
  const unread = items.filter((item) => !item.read).length;
  const show = () => {
    setOpen(true);
    items.filter((item) => !item.read).forEach((item) => updateDoc(doc(firestore, 'users', uid, 'notifications', item.id), { read: true, readAt: serverTimestamp() }).catch(() => {}));
  };
  return (
    <>
      <LinearGradient colors={[colors.wine, '#9e252b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerBrand}><Image source={require('./assets/icon.png')} style={styles.headerLogo} /><View><Text style={styles.headerTitle}>Feijoada da Dayse</Text><Text style={styles.headerSubtitle}>ENTREGADOR · {deliveryCount} ATIVA{deliveryCount === 1 ? '' : 'S'}</Text></View></View>
        <Pressable style={styles.bellButton} onPress={show}><Bell color="#fff" size={23} />{unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>}</Pressable>
      </LinearGradient>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}><Pressable style={styles.sheet}><View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>Avisos da cozinha</Text>{items.length ? items.map((item) => <View key={item.id} style={styles.notificationRow}><View style={styles.notificationIcon}><Bell color={colors.orange} size={18} /></View><View style={styles.flex}><Text style={styles.optionTitle}>{item.title || 'Aviso'}</Text><Text style={styles.notificationText}>{item.message || 'Confira suas entregas.'}</Text></View></View>) : <Text style={styles.emptyNotification}>Nenhum aviso por enquanto.</Text>}</Pressable></Pressable></Modal>
    </>
  );
}

type DeliveryProps = { order: DeliveryOrder; orders: DeliveryOrder[]; tracked: boolean; onTrackChange: (value: string | null) => void; onSelect: (id: string) => void };

function DeliveryScreen({ order, orders, tracked, onTrackChange, onSelect }: DeliveryProps) {
  const [position, setPosition] = useState<DeliveryPosition | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const mapRef = useRef<MapView>(null);
  const drinks = beverages(order.items);
  const next = order.status === 'ready' ? { status: 'out_for_delivery' as const, label: 'Iniciar entrega' }
    : order.status === 'out_for_delivery' ? { status: 'arrived' as const, label: 'Cheguei ao endereço' }
      : order.status === 'arrived' ? { status: 'delivered' as const, label: 'Confirmar entrega' } : null;

  useEffect(() => onValue(ref(realtime, `activeDeliveries/${order.id}`), (snapshot) => setPosition(snapshot.val() as DeliveryPosition | null)), [order.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && position) mapRef.current?.animateToRegion(regionFor(order, position), 500);
    });
    return () => subscription.remove();
  }, [order, position]);

  const performStatus = async (status: 'out_for_delivery' | 'arrived' | 'delivered') => {
    setBusy(true);
    try {
      if (status === 'out_for_delivery') {
        await startDeliveryTracking(order.id);
        onTrackChange(order.id);
      }
      if (status === 'arrived' || status === 'delivered') await refreshDeliveryPosition(order.id);
      const update = httpsCallable<{ orderId: string; status: string }, { changed: boolean }>(cloudFunctions, 'updateCourierDelivery');
      await update({ orderId: order.id, status });
      if (status === 'delivered') {
        await stopDeliveryTracking(order.id);
        onTrackChange(null);
      }
      const titles = { out_for_delivery: 'Entrega iniciada', arrived: 'Cliente avisado', delivered: 'Entrega concluída' };
      Alert.alert(titles[status], status === 'arrived' ? 'O cliente recebeu uma notificação de que você chegou.' : status === 'delivered' ? 'O pedido foi finalizado com sucesso.' : 'O cliente já pode acompanhar seu deslocamento no mapa.');
    } catch (error) {
      if (status === 'out_for_delivery') { await stopDeliveryTracking(order.id).catch(() => {}); onTrackChange(null); }
      Alert.alert('Não foi possível atualizar', messageOf(error));
    } finally { setBusy(false); }
  };

  const advance = () => {
    if (!next) return;
    if (next.status === 'out_for_delivery' && drinks.length) {
      Alert.alert('Confira as bebidas', drinks.map((item) => `${item.quantity}× ${item.name}`).join('\n'), [
        { text: 'Voltar', style: 'cancel' }, { text: 'Conferi, iniciar', onPress: () => performStatus(next.status) }
      ]);
      return;
    }
    const question = next.status === 'delivered' ? 'Confirma que o pedido foi entregue ao cliente?' : next.status === 'arrived' ? 'Você já está no endereço do cliente?' : 'Iniciar esta entrega agora?';
    Alert.alert(next.label, question, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', onPress: () => performStatus(next.status) }]);
  };

  const contacts = phoneLinks(order);
  const routes = navigationLinks(order);
  const region = regionFor(order, position);
  const destination = order.delivery?.latitude != null && order.delivery?.longitude != null ? { latitude: order.delivery.latitude, longitude: order.delivery.longitude } : null;
  const current = position ? { latitude: position.latitude, longitude: position.longitude } : null;
  const trail = position?.trail?.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) || [];

  return (
    <View style={styles.appPage}>
      <Header deliveryCount={orders.length} uid={auth.currentUser?.uid || ''} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.progressCard} onPress={() => orders.length > 1 && setPickerOpen(true)}>
          <View style={styles.progressIcon}><Bike color="#fff" size={26} /></View>
          <View style={styles.flex}><Text style={styles.progressTitle}>{statusCopy[order.status]}</Text><Text style={styles.progressSubtitle}>{order.status === 'ready' ? 'Seu pedido está pronto na cozinha' : order.status === 'arrived' ? 'Avise o cliente e faça a entrega' : 'Você está a caminho do cliente!'}</Text></View>
          {orders.length > 1 && <ChevronRight color="#967f75" size={24} />}
        </Pressable>

        <View style={styles.card}>
          <View style={styles.infoRow}><CircleUserRound color="#8b8580" size={26} /><View style={styles.flex}><Text style={styles.infoLabel}>Cliente</Text><Text style={styles.infoValue}>{order.customer?.name || 'Cliente'}</Text></View>
            {contacts.phone ? <RoundAction icon={<Phone color={colors.green} size={23} />} onPress={() => openUrl(contacts.phone, 'Telefone indisponível.')} /> : null}
            {contacts.whatsapp ? <RoundAction icon={<MessageCircle color={colors.green} size={23} />} onPress={() => openUrl(contacts.whatsapp, 'WhatsApp indisponível.')} /> : null}
          </View>
          <View style={styles.divider} />
          <Pressable style={styles.infoRow} onPress={() => openUrl(routes.maps, 'Aplicativo de mapas indisponível.')}><MapPin color={colors.wine} size={27} /><View style={styles.flex}><Text style={styles.infoLabel}>Endereço de entrega</Text><Text style={styles.address}>{addressOf(order) || 'Endereço não informado'}</Text></View><ChevronRight color="#967f75" size={24} /></Pressable>
        </View>

        {drinks.length > 0 && order.status === 'ready' && <View style={styles.drinkAlert}><View style={styles.drinkIcon}><UtensilsCrossed color="#9c3b00" size={20} /></View><View style={styles.flex}><Text style={styles.drinkTitle}>Não esqueça as bebidas</Text><Text style={styles.drinkText}>{drinks.map((item) => `${item.quantity}× ${item.name}`).join(' · ')}</Text></View></View>}

        <Pressable style={styles.routeButton} onPress={() => Alert.alert('Escolha o navegador', 'Qual aplicativo você quer usar?', [
          { text: 'Cancelar', style: 'cancel' }, { text: 'Waze', onPress: () => openUrl(routes.waze, 'Waze não instalado.') }, { text: 'Google Maps', onPress: () => openUrl(routes.maps, 'Google Maps indisponível.') }
        ])}><Navigation fill="#fff" color="#fff" size={22} /><Text style={styles.routeButtonText}>Abrir rota</Text><Route color="#fff" size={21} /></Pressable>

        <View style={styles.mapCard}>
          {Platform.OS !== 'android' || Constants.expoConfig?.extra?.androidMapsConfigured === true ? <MapView ref={mapRef} style={styles.map} initialRegion={region} region={region} showsCompass showsMyLocationButton={false} toolbarEnabled={false}>
            {trail.length > 1 && <Polyline coordinates={trail} strokeColor={colors.orange} strokeWidth={5} />}
            {current && destination && <Polyline coordinates={[current, destination]} strokeColor={colors.wine} strokeWidth={3} lineDashPattern={[8, 7]} />}
            {current && <Marker coordinate={current} title="Sua localização"><View style={styles.courierMarker}><Bike color="#fff" size={18} /></View></Marker>}
            {destination && <Marker coordinate={destination} title="Cliente"><View style={styles.destinationMarker}><UtensilsCrossed color="#fff" size={17} /></View></Marker>}
          </MapView> : <View style={[styles.map, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}><Text style={{ color: colors.ink, textAlign: 'center' }}>Mapa indisponível nesta versão. Atualize o aplicativo. Você ainda pode abrir a rota no Waze ou Google Maps.</Text></View>}
          <View style={[styles.locationChip, tracked ? styles.locationChipActive : null]}><View style={[styles.signalDot, tracked ? styles.signalDotActive : null]} /><View style={styles.flex}><Text style={[styles.locationTitle, tracked ? styles.locationTitleActive : null]}>{tracked ? 'Localização ativa' : order.status === 'ready' ? 'Pronta para ativar' : 'Buscando sinal…'}</Text><Text style={styles.locationText}>{tracked ? 'Enviando durante esta entrega' : 'Será ativada ao iniciar a entrega'}</Text></View></View>
          <Pressable style={styles.centerMap} onPress={() => mapRef.current?.animateToRegion(region, 500)}><Navigation color={colors.ink} size={21} /></Pressable>
        </View>

        <View style={styles.summaryCard}><View style={styles.summaryTop}><PackageCheck color={colors.ink} size={22} /><Text style={styles.summaryTitle}>Resumo do pedido</Text><Text style={styles.orderId}>{friendlyOrderId(order.id)}</Text></View><View style={styles.summaryBottom}><Text numberOfLines={2} style={styles.summaryItems}>{(order.items || []).map((item) => `${item.quantity}× ${item.name}`).join(' + ') || 'Itens do pedido'}</Text><Text style={styles.summaryTotal}>{money(order.totals?.total || order.total)}</Text></View>{order.paymentMethod ? <Text style={styles.payment}>{order.paymentMethod}{order.notes ? ` · Obs.: ${order.notes}` : ''}</Text> : null}</View>

        {contacts.whatsapp ? <Pressable style={styles.contactButton} onPress={() => openUrl(contacts.whatsapp, 'WhatsApp indisponível.')}><MessageCircle color={colors.wine} size={20} /><Text style={styles.contactButtonText}>Falar com cliente</Text></Pressable> : null}
        {next && <Pressable disabled={busy || (order.status === 'out_for_delivery' && !tracked)} style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed, (busy || (order.status === 'out_for_delivery' && !tracked)) && styles.disabled]} onPress={advance}>{busy ? <ActivityIndicator color="#fff" /> : <><Check color="#fff" size={28} strokeWidth={3} /><Text style={styles.confirmButtonText}>{next.label}</Text></>}</Pressable>}
        {['out_for_delivery', 'arrived'].includes(order.status) && <Pressable style={styles.contactButton} disabled={busy} onPress={async () => {
          setBusy(true);
          try { await startDeliveryTracking(order.id); onTrackChange(order.id); Alert.alert('GPS atualizado', 'A localização foi enviada para o cliente.'); }
          catch (error) { Alert.alert('Falha no GPS', messageOf(error)); }
          finally { setBusy(false); }
        }}><Navigation color={colors.wine} size={20} /><Text style={styles.contactButtonText}>Atualizar / retomar GPS</Text></Pressable>}
        {['out_for_delivery', 'arrived'].includes(order.status) && <Text style={styles.warningText}>Chegada e conclusão exigem GPS recente e preciso, a até 100 metros do destino.</Text>}
        <Pressable style={styles.logoutLink} onPress={() => tracked ? Alert.alert('Entrega em andamento', 'Finalize esta entrega antes de sair da conta.') : signOut(auth)}><LogOut color={colors.muted} size={16} /><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
      </ScrollView>

      <OrderPicker visible={pickerOpen} orders={orders} selected={order.id} onClose={() => setPickerOpen(false)} onSelect={(id) => { onSelect(id); setPickerOpen(false); }} />
    </View>
  );
}

function regionFor(order: DeliveryOrder, position: DeliveryPosition | null) {
  const latitude = position?.latitude ?? order.delivery?.latitude ?? -8.0476;
  const longitude = position?.longitude ?? order.delivery?.longitude ?? -34.877;
  return { latitude, longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 };
}

function RoundAction({ icon, onPress }: { icon: React.ReactNode; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.roundAction, pressed && styles.pressed]}>{icon}</Pressable>;
}

function OrderPicker({ visible, orders, selected, onClose, onSelect }: { visible: boolean; orders: DeliveryOrder[]; selected: string; onClose: () => void; onSelect: (id: string) => void }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><Pressable style={styles.modalBackdrop} onPress={onClose}><Pressable style={styles.sheet}><View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>Minhas entregas</Text>{orders.map((order) => <Pressable key={order.id} style={[styles.orderOption, selected === order.id && styles.orderOptionSelected]} onPress={() => onSelect(order.id)}><View style={styles.optionIcon}><Bike color={colors.orange} size={20} /></View><View style={styles.flex}><Text style={styles.optionTitle}>{friendlyOrderId(order.id)} · {order.customer?.name || 'Cliente'}</Text><Text style={styles.optionText}>{statusCopy[order.status]} · {addressOf(order)}</Text></View><ChevronRight color={colors.muted} size={20} /></Pressable>)}</Pressable></Pressable></Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.wine }, appPage: { flex: 1, backgroundColor: colors.paper }, flex: { flex: 1 }, pressed: { opacity: 0.76 }, disabled: { opacity: 0.48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }, loadingLogo: { width: 116, height: 116, resizeMode: 'contain' }, loadingText: { color: '#f9ded1', fontSize: 15 },
  loginPage: { flex: 1, justifyContent: 'center', padding: 22 }, loginBrand: { alignItems: 'center', marginBottom: 20 }, loginLogo: { width: 96, height: 96, resizeMode: 'contain' }, loginTitle: { color: '#fff', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 30, fontWeight: '700' }, loginEyebrow: { color: '#f0b99e', fontSize: 10, letterSpacing: 3, marginTop: 5, fontWeight: '800' },
  loginCard: { backgroundColor: colors.cream, borderRadius: 25, padding: 23, shadowColor: '#1e0205', shadowOpacity: .28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12 }, loginIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, loginHeading: { color: colors.ink, fontSize: 23, fontWeight: '800' }, loginDescription: { color: colors.muted, lineHeight: 20, marginTop: 6, marginBottom: 18 }, label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 10 }, input: { height: 51, borderWidth: 1, borderColor: '#ddcfc4', backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 15, fontSize: 16, color: colors.ink },
  primaryButton: { marginTop: 21, height: 54, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }, primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 }, textButton: { padding: 15, alignItems: 'center' }, textButtonLabel: { color: colors.wine, fontWeight: '700' }, privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 21, paddingHorizontal: 18 }, privacyText: { color: '#f6c8b2', fontSize: 12, flexShrink: 1, textAlign: 'center' },
  header: { minHeight: 86, paddingHorizontal: 19, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 }, headerLogo: { width: 49, height: 49, resizeMode: 'contain' }, headerTitle: { color: '#fff', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '700', fontSize: 19 }, headerSubtitle: { color: '#f2b79e', fontSize: 8, letterSpacing: 3, fontWeight: '900', marginTop: 2 }, bellButton: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, borderColor: '#ffffff38', alignItems: 'center', justifyContent: 'center' }, badge: { position: 'absolute', right: -1, top: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#9e252b' }, badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  content: { padding: 14, paddingBottom: 34, gap: 11 }, progressCard: { backgroundColor: '#fff8f1', borderRadius: 19, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#6d3b29', shadowOpacity: .09, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, progressIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }, progressTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' }, progressSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  card: { backgroundColor: '#fff', borderRadius: 17, paddingHorizontal: 15, shadowColor: '#5b3324', shadowOpacity: .07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 }, infoRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 }, infoLabel: { color: colors.muted, fontSize: 12 }, infoValue: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 2 }, address: { color: colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 2 }, divider: { height: 1, backgroundColor: colors.border, marginLeft: 39 }, roundAction: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#e9f8ee', alignItems: 'center', justifyContent: 'center', marginLeft: 1 },
  drinkAlert: { backgroundColor: '#fff0dc', borderColor: '#f3c38b', borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: 'row', gap: 11, alignItems: 'center' }, drinkIcon: { width: 39, height: 39, borderRadius: 20, backgroundColor: '#ffd49f', alignItems: 'center', justifyContent: 'center' }, drinkTitle: { color: '#75310d', fontWeight: '900', fontSize: 14 }, drinkText: { color: '#8f5735', fontSize: 12, marginTop: 2 },
  routeButton: { height: 56, borderRadius: 15, backgroundColor: colors.wine, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, routeButtonText: { color: '#fff', fontSize: 17, fontWeight: '900', flex: .75, textAlign: 'center' },
  mapCard: { height: 272, borderRadius: 18, overflow: 'hidden', backgroundColor: '#e9e6df' }, map: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, locationChip: { position: 'absolute', top: 12, left: 12, maxWidth: 225, backgroundColor: '#ffffffee', borderRadius: 13, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: .12, shadowRadius: 7, elevation: 4 }, locationChipActive: { borderWidth: 1, borderColor: '#a8e5bd' }, signalDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#c3aaa0' }, signalDotActive: { backgroundColor: colors.green, shadowColor: colors.green, shadowOpacity: .8, shadowRadius: 5 }, locationTitle: { fontSize: 12, fontWeight: '900', color: colors.muted }, locationTitleActive: { color: colors.green }, locationText: { fontSize: 10, color: colors.muted, marginTop: 1 }, centerMap: { position: 'absolute', right: 12, top: 12, width: 43, height: 43, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4 }, courierMarker: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.wine, borderColor: '#fff', borderWidth: 3, alignItems: 'center', justifyContent: 'center' }, destinationMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.orange, borderColor: '#fff', borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14 }, summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 9 }, summaryTitle: { fontSize: 15, fontWeight: '900', color: colors.ink, flex: 1 }, orderId: { color: colors.muted, fontWeight: '700' }, summaryBottom: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 9, gap: 12 }, summaryItems: { color: colors.muted, fontSize: 12, flex: 1, lineHeight: 18 }, summaryTotal: { color: colors.ink, fontSize: 16, fontWeight: '900' }, payment: { color: colors.muted, fontSize: 11, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  contactButton: { height: 53, borderRadius: 14, borderWidth: 1.5, borderColor: '#d6bdb3', backgroundColor: '#fff8f3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, contactButtonText: { color: colors.wine, fontWeight: '900', fontSize: 15 }, confirmButton: { height: 59, borderRadius: 15, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, shadowColor: colors.orange, shadowOpacity: .25, shadowRadius: 9, elevation: 4 }, confirmButtonText: { color: '#fff', fontSize: 18, fontWeight: '900' }, warningText: { color: '#a43b2e', fontSize: 12, textAlign: 'center' }, logoutLink: { padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, logoutText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  centerPaper: { flex: 1, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', padding: 30 }, bigRound: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, emptyTitle: { color: colors.ink, fontSize: 23, fontWeight: '900', textAlign: 'center' }, emptyText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9, marginBottom: 22 }, secondaryButton: { borderWidth: 1, borderColor: '#d1b8ac', borderRadius: 13, paddingHorizontal: 19, height: 48, flexDirection: 'row', gap: 8, alignItems: 'center' }, secondaryButtonText: { color: colors.wine, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: '#250a0b99', justifyContent: 'flex-end' }, sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 18, paddingBottom: 35 }, sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#d4c4bb', alignSelf: 'center', marginBottom: 17 }, sheetTitle: { color: colors.ink, fontSize: 21, fontWeight: '900', marginBottom: 12 }, orderOption: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', gap: 11, alignItems: 'center', marginTop: 8, backgroundColor: '#fff' }, orderOptionSelected: { borderColor: colors.orange, backgroundColor: '#fff4e9' }, optionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff0df', alignItems: 'center', justifyContent: 'center' }, optionTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, optionText: { color: colors.muted, fontSize: 11, marginTop: 3 },
  notificationRow: { backgroundColor: '#fff', borderRadius: 13, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }, notificationIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff0df', alignItems: 'center', justifyContent: 'center' }, notificationText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, emptyNotification: { color: colors.muted, textAlign: 'center', padding: 24 },
});
