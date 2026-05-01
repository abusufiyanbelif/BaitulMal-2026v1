const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
    const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath)),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

async function clearFirestoreDummyEmails() {
    console.log('Fetching users to identify dummy email records in Firestore...');
    const snap = await db.collection('users').get();
    let updatedCount = 0;

    const batch = db.batch();
    
    for (const doc of snap.docs) {
        const data = doc.data();
        if (data.email && data.email.endsWith('@donor.demo.local')) {
            console.log(`Clearing email for user: ${doc.id} (${data.email})`);
            batch.update(doc.ref, { email: '' });
            updatedCount++;
        }
    }

    if (updatedCount > 0) {
        await batch.commit();
    }

    console.log(`Firestore cleanup complete. Updated ${updatedCount} records.`);
}

clearFirestoreDummyEmails().catch(console.error);
