const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixUserOrgs() {
    const usersSnap = await db.collection('users').get();
    const batch = db.batch();
    let count = 0;

    usersSnap.forEach(doc => {
        const data = doc.data();
        const updates = {};
        if (!data.organizationGroup) {
            updates.organizationGroup = 'general';
        }
        if (!data.organizationRole) {
            updates.organizationRole = data.role === 'Admin' ? 'Administrator' : 'Member';
        }
        if (Object.keys(updates).length > 0) {
            batch.update(doc.ref, updates);
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`Successfully updated ${count} user records with default organizationGroup and organizationRole.`);
    } else {
        console.log("No user records needed updating.");
    }
}

fixUserOrgs().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
