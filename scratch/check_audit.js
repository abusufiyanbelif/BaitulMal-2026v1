
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

async function checkAuditLogs() {
    try {
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        if (!fs.existsSync(serviceAccountPath)) {
            console.error('serviceAccountKey.json not found');
            return;
        }
        const serviceAccount = require(serviceAccountPath);
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        const db = admin.firestore();
        const snapshot = await db.collection('audit_logs').limit(5).get();
        if (snapshot.empty) {
            console.log('No audit logs found.');
        } else {
            console.log(`Found ${snapshot.size} audit logs:`);
            snapshot.docs.forEach(doc => {
                console.log(JSON.stringify({id: doc.id, ...doc.data()}, null, 2));
            });
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

checkAuditLogs();
