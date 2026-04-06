const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkMembers() {
    try {
        const doc = await db.collection('settings').doc('members').get();
        if (doc.exists) {
            console.log("DOCUMENT_EXISTS");
            console.log(JSON.stringify(doc.data(), null, 2));
        } else {
            console.log("DOCUMENT_MISSING");
        }
    } catch (e) {
        console.error(e);
    }
}

checkMembers();
