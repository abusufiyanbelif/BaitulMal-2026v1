import { getAdminServices } from '../src/lib/firebase-admin-sdk';

async function checkGroups() {
    const { adminDb } = getAdminServices();
    if (!adminDb) return;
    const snap = await adminDb.collection('notification_groups').get();
    const groups = snap.docs.map(doc => doc.data());
    console.log(JSON.stringify(groups, null, 2));
}

checkGroups();
