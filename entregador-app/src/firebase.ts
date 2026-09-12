import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Persistence } from 'firebase/auth';
import * as FirebaseAuthNative from '@firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { appStorage } from './storage';

const firebaseConfig = {
  apiKey: 'AIzaSyC1zIakJQ0YZSFDNKl8l_K39ajNeAbRtbU',
  authDomain: 'feijoadadadayse-a074d.firebaseapp.com',
  projectId: 'feijoadadadayse-a074d',
  storageBucket: 'feijoadadadayse-a074d.appspot.com',
  messagingSenderId: '193167774782',
  appId: '1:193167774782:web:6b32f1088a010d992ead6f',
  databaseURL: 'https://feijoadadadayse-a074d-default-rtdb.firebaseio.com'
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const getReactNativePersistence = (FirebaseAuthNative as unknown as {
  getReactNativePersistence: (storage: typeof appStorage) => Persistence;
}).getReactNativePersistence;

let firebaseAuth;
try {
  firebaseAuth = initializeAuth(firebaseApp, { persistence: getReactNativePersistence(appStorage) });
} catch {
  firebaseAuth = getAuth(firebaseApp);
}

export const auth = firebaseAuth;
export const firestore = getFirestore(firebaseApp);
export const realtime = getDatabase(firebaseApp);
export const cloudFunctions = getFunctions(firebaseApp, 'southamerica-east1');
