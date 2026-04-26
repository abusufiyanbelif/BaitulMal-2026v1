import { getAdminServices } from '../src/lib/firebase-admin-sdk';

async function checkUserProfile() {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        console.error('Admin DB not available');
        return;
    }

    const uid = 'cyMl1lQME0Yur1YS3VCms1AvrOJ2';
    const userSnap = await adminDb.collection('users').doc(uid).get();

    if (!userSnap.exists) {
        console.log(`User ${uid} not found in 'users' collection.`);
        return;
    }

    const userData = userSnap.data();
    console.log('User Data:', JSON.stringify(userData, null, 2));
}

checkUserProfile();
