import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { ref, remove, serverTimestamp, set } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { auth, realtime, cloudFunctions } from './firebase';
import { appStorage } from './storage';

export const LOCATION_TASK = 'feijoada-dayse-active-delivery-location';
export const ACTIVE_ORDER_KEY = '@dayse/active-order-id';
const TRAIL_KEY = '@dayse/active-delivery-trail';

type LocationTaskData = { locations?: Location.LocationObject[] };
let foregroundWatch: Location.LocationSubscription | null = null;
let sendQueue: Promise<void> = Promise.resolve();

function sendPoint(orderId: string, latest: Location.LocationObject) {
  const send = async () => {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) throw new Error('Entre novamente para enviar a localização.');
    const previous = JSON.parse((await appStorage.getItem(TRAIL_KEY)) || '[]');
    if (previous.at(-1)?.updatedAt >= latest.timestamp) return;
    const point = { latitude: latest.coords.latitude, longitude: latest.coords.longitude, updatedAt: latest.timestamp };
    const trail = [...previous, point].slice(-60);
    await Promise.race([
      set(ref(realtime, `activeDeliveries/${orderId}`), {
        courierId: user.uid, ...point, updatedAt: serverTimestamp(), sampledAt: latest.timestamp,
        accuracy: latest.coords.accuracy ?? 9999,
        heading: Math.max(0, latest.coords.heading || 0), speed: Math.max(0, latest.coords.speed || 0), trail,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sem confirmação de envio do GPS. Verifique sua internet e tente novamente.')), 20000)),
    ]);
    await appStorage.setItem(TRAIL_KEY, JSON.stringify(trail));
  };
  const result = sendQueue.then(send);
  sendQueue = result.catch(() => {});
  return result;
}

export async function refreshDeliveryPosition(orderId: string) {
  const latest = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  await sendPoint(orderId, latest);
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) { console.error('Falha no GPS em segundo plano:', error.message); return; }
  if (!data) return;
  const orderId = await appStorage.getItem(ACTIVE_ORDER_KEY);
  if (!orderId) return;
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return;

  const locations = (data as LocationTaskData).locations || [];
  const latest = locations.at(-1);
  if (!latest) return;
  await sendPoint(orderId, latest);
});

export async function startDeliveryTracking(orderId: string) {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Permita o acesso à localização para iniciar a entrega.');
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') throw new Error('Selecione “Permitir sempre” para compartilhar a localização durante toda a entrega.');

  const current = await appStorage.getItem(ACTIVE_ORDER_KEY);
  if (current && current !== orderId) throw new Error('Finalize a entrega atual antes de iniciar outra.');
  await httpsCallable(cloudFunctions, 'prepareDeliveryTracking')({ orderId });
  await appStorage.multiSet([[ACTIVE_ORDER_KEY, orderId], [TRAIL_KEY, '[]']]);
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (!running) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Highest,
      activityType: Location.ActivityType.AutomotiveNavigation,
      distanceInterval: 8,
      timeInterval: 15000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Entrega em andamento',
        notificationBody: 'Localização ativa para o cliente acompanhar a entrega.',
        notificationColor: '#c44b16',
        killServiceOnDestroy: false
      }
    });
  }
  await refreshDeliveryPosition(orderId);
  foregroundWatch?.remove();
  foregroundWatch = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 5 }, (location) => {
    sendPoint(orderId, location).catch((error) => console.error('Falha ao enviar localização:', error));
  });
  return true;
}

export async function stopDeliveryTracking(orderId?: string) {
  foregroundWatch?.remove();
  foregroundWatch = null;
  const current = await appStorage.getItem(ACTIVE_ORDER_KEY);
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  await appStorage.multiRemove([ACTIVE_ORDER_KEY, TRAIL_KEY]);
  if (orderId || current) await remove(ref(realtime, `activeDeliveries/${orderId || current}`));
}

export async function getTrackedOrderId() {
  return appStorage.getItem(ACTIVE_ORDER_KEY);
}
