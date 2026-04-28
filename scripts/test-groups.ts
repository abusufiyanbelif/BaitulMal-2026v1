import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

async function main() {
  const serviceAccount = require(path.join(__dirname, '../service-account-key.json'));
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
  }
  const db = getFirestore();
  const snap = await db.collection('notification_groups').get();
  console.log(`Total groups: ${snap.size}`);
  snap.forEach(doc => console.log(doc.id, JSON.stringify(doc.data(), null, 2)));
}
main().catch(console.error);
