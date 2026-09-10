import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const email = process.argv[2];
if (!email) throw new Error('Uso: node scripts/set-admin.mjs admin@exemplo.com');
initializeApp({ credential: applicationDefault() });
const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
await getFirestore().collection('users').doc(user.uid).set({ role: 'admin', email: user.email || email, displayName: user.displayName || 'Administrador', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
console.log(`Permissão administrativa aplicada a ${email}. A pessoa deve entrar novamente.`);
