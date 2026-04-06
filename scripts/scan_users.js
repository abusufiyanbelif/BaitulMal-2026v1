const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function run() {
    const snap = await db.collection('users').get();
    console.log(`\n=== USERS (${snap.size} total) ===`);
    snap.forEach(d => {
        const data = d.data();
        const permModules = data.permissions ? Object.keys(data.permissions) : [];
        console.log(JSON.stringify({
            firebaseDocId: d.id,
            name: data.name,
            email: data.email,
            role: data.role,
            loginId: data.loginId,
            status: data.status,
            organizationGroup: data.organizationGroup,
            organizationRole: data.organizationRole,
            hasPermissions: !!data.permissions,
            permModules,
        }, null, 2));
        console.log('---');
    });

    // Check user_lookups collection
    const lookSnap = await db.collection('user_lookups').get();
    console.log(`\n=== USER_LOOKUPS (${lookSnap.size} total) ===`);
    lookSnap.forEach(d => {
        console.log(JSON.stringify({ id: d.id, ...d.data() }));
    });
}
run().catch(console.error);
