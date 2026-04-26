
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function checkUser() {
    try {
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        if (!fs.existsSync(serviceAccountPath)) {
            console.error('serviceAccountKey.json not found');
            return;
        }
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        const db = admin.firestore();
        const doc = await db.collection('users').doc('S5efNV5jpTPoxYNv6SnAlv3jNPO2').get();
        if (doc.exists) {
            console.log('User found:');
            console.log(JSON.stringify(doc.data(), null, 2));
        } else {
            console.log('User NOT found in /users/S5efNV5jpTPoxYNv6SnAlv3jNPO2');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

checkUser();
