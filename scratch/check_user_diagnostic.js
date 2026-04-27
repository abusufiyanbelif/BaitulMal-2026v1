const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "docuextract-q8vaa"
    });
}

const db = admin.firestore();
const uid = 'S5efNV5jpTPoxYNv6SnAlv3jNPO2';

async function checkUser() {
    console.log('Checking User:', uid);
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
        console.log('No user document found in Firestore.');
    } else {
        console.log('Firestore User Data:', JSON.stringify(userDoc.data(), null, 2));
    }

    try {
        const authUser = await admin.auth().getUser(uid);
        console.log('Firebase Auth User Data:', JSON.stringify({
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName,
            emailVerified: authUser.emailVerified,
            customClaims: authUser.customClaims
        }, null, 2));
    } catch (e) {
        console.error('Error fetching Auth User:', e.message);
    }
}

checkUser();
