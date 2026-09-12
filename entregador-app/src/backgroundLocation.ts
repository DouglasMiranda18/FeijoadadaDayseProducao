import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { ref, remove, serverTimestamp, set } from 'firebase/database';
import { auth, realtime } from './firebase';
import { appStorage } from './storage';

export const LOCATION_TASK = 'feijoada-dayse-active-delivery-location';
export const ACTIVE_ORDER_KEY = '@dayse/active-order-id';
const TRAIL_KEY = '@dayse/active-delivery-trail';

type LocationTaskData = { locations?: Location.LocationObject[] };

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const orderId = await appStorage.getItem(ACTIVE_ORDER_KEY);
  if (!orderId) return;
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return;

  const locations = (data as LocationTaskData).locations || [];
  const latest = locations.at(-1);
  if (!latest) return;
  const previous = JSON.parse((await appStorage.getItem(TRAIL_KEY)) || '[]') as Array<{ latitude: number; longitude: number; updatedAt: number }>;
  const point = { latitude: latest.coords.latitude, longitude: latest.coords.longitude, updatedAt: latest.timestamp };
  const trail = [...previous, point].slice(-60);
  await appStorage.setItem(TRAIL_KEY, JSON.stringify(trail));
  await set(ref(realtime, `activeDeliveries/${orderId}`), {
    courierId: user.uid,
    latitude: latest.coords.latitude,
    longitude: latest.coords.longitude,
    accuracy: Math.max(0, latest.coords.accuracy || 0),
    heading: Math.max(0, latest.coords.heading || 0),
    speed: Math.max(0, latest.coords.speed || 0),
    updatedAt: serverTimestamp(),
    trail
  });
});

export async function startDeliveryTracking(orderId: string) {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') throw new Error('Permita o acesso à localização para iniciar a entrega.');
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') throw new Error('Selecione “Permitir sempre” para compartilhar a localização durante toda a entrega.');

  const current = await appStorage.getItem(ACTIVE_ORDER_KEY);
  if (current && current !== orderId) throw new Error('Finalize a entrega atual antes de iniciar outra.');
  await appStorage.multiSet([[ACTIVE_ORDER_KEY, orderId], [TRAIL_KEY, '[]']]);
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (!running) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Highest,
      activityType: Location.ActivityType.AutomotiveNavigation,
      distanceInterval: 8,
      timeInterval: 15000,
      deferredUpdatesDistance: 8,
      deferredUpdatesInterval: 15000,
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
  return true;
}

export async function stopDeliveryTracking(orderId?: string) {
  const current = await appStorage.getItem(ACTIVE_ORDER_KEY);
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  await appStorage.multiRemove([ACTIVE_ORDER_KEY, TRAIL_KEY]);
  if (orderId || current) await remove(ref(realtime, `activeDeliveries/${orderId || current}`));
}

export async function getTrackedOrderId() {
  return appStorage.getItem(ACTIVE_ORDER_KEY);
}
