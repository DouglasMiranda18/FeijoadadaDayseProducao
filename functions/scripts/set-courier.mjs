import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const email = process.argv[2];
if (!email) throw new Error('Uso: node scripts/set-courier.mjs entregador@exemplo.com');

initializeApp({ credential: applicationDefault() });
const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), courier: true });
await getFirestore().collection('users').doc(user.uid).set({
  isCourier: true,
  email: user.email || email,
  displayName: user.displayName || 'Entregador',
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });
console.log(`Permissão de entregador aplicada a ${email}. A pessoa deve entrar novamente.`);
