const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "docuextract-q8vaa"
    });
}

const uid = 'S5efNV5jpTPoxYNv6SnAlv3jNPO2';

async function fixUser() {
    console.log('Fixing User Profile for:', uid);
    try {
        await admin.auth().updateUser(uid, {
            displayName: 'Abusufiyan Belif'
        });
        console.log('Successfully updated displayName in Firebase Auth.');
        
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (userDoc.exists) {
            await admin.firestore().collection('users').doc(uid).update({
                name: 'Abusufiyan Belif'
            });
            console.log('Successfully updated name in Firestore users collection.');
        }
    } catch (e) {
        console.error('Error updating user:', e.message);
    }
}

fixUser();
