const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function scanForFlaws() {
    try {
        const usersSnap = await db.collection('users').get();
        const flaws = [];
        
        usersSnap.forEach(doc => {
            const data = doc.data();
            const userFlaws = [];
            
            if (!data.name) userFlaws.push("Missing Name");
            if (!data.role) userFlaws.push("Missing Auth Role");
            if (!data.organizationGroup) userFlaws.push("Missing Org Group");
            if (!data.organizationRole) userFlaws.push("Missing Org Role");
            if (!data.phone) userFlaws.push("Missing Phone (Mandatory for WhatsApp)");
            if (data.status === 'Active' && !data.organizationGroup) userFlaws.push("Active user with no Org Group");
            
            if (userFlaws.length > 0) {
                flaws.push({
                    id: doc.id,
                    name: data.name || "Unknown",
                    flaws: userFlaws
                });
            }
        });
        
        console.log("USER_FLAWS:");
        console.log(JSON.stringify(flaws, null, 2));

        // Check settings/members
        const settingsDoc = await db.collection('settings').doc('members').get();
        if (!settingsDoc.exists) {
            console.log("SETTINGS_MEMBERS_MISSING");
        } else {
            console.log("SETTINGS_MEMBERS_DATA:");
            console.log(JSON.stringify(settingsDoc.data(), null, 2));
        }

    } catch (e) {
        console.error(e);
    }
}

scanForFlaws();
