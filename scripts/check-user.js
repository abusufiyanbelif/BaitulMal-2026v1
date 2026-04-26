const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

async function checkUserProfile() {
    if (getApps().length === 0) {
        const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            initializeApp({
                credential: cert(serviceAccountPath),
            });
        } else {
            initializeApp();
        }
    }

    const adminDb = getFirestore();
    const uid = 'cyMl1lQME0Yur1YS3VCms1AvrOJ2';
    const userSnap = await adminDb.collection('users').doc(uid).get();

    if (!userSnap.exists) {
        console.log(`User ${uid} not found in 'users' collection.`);
        return;
    }

    const userData = userSnap.data();
    console.log('User Data:', JSON.stringify(userData, null, 2));
}

checkUserProfile().catch(console.error);
