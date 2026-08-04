import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { CodeStore, CodeRecord } from './store';

function db() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) });
  }
  return getFirestore();
}

/** Firestore-backed CodeStore. Collection: `authCodes`, doc id = email. */
export class FirestoreCodeStore implements CodeStore {
  async set(email: string, rec: CodeRecord) { await db().collection('authCodes').doc(email).set(rec); }
  async get(email: string) {
    const snap = await db().collection('authCodes').doc(email).get();
    return snap.exists ? (snap.data() as CodeRecord) : null;
  }
  async delete(email: string) { await db().collection('authCodes').doc(email).delete(); }
}
