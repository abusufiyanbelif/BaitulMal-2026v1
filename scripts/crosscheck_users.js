const a = require('firebase-admin');
const s = require('./serviceAccountKey.json');
if (!a.apps.length) a.initializeApp({ credential: a.credential.cert(s) });

async function run() {
    const [authResult, fsResult] = await Promise.all([
        a.auth().listUsers(100),
        a.firestore().collection('users').get()
    ]);

    const authUIDs = new Set(authResult.users.map(u => u.uid));
    const fsIDs = new Set();
    fsResult.forEach(d => fsIDs.add(d.id));

    console.log('\n=== FIREBASE AUTH USERS ===');
    authResult.users.forEach(u => {
        const hasDoc = fsIDs.has(u.uid);
        console.log(`UID: ${u.uid} | EMAIL: ${u.email} | HAS_FIRESTORE_DOC: ${hasDoc}`);
    });

    console.log('\n=== FIRESTORE USER DOCS ===');
    fsResult.forEach(d => {
        const x = d.data();
        const inAuth = authUIDs.has(d.id);
        console.log(`DOC_ID: ${d.id} | NAME: ${x.name} | ROLE: ${x.role} | STATUS: ${x.status} | MATCHED_IN_AUTH: ${inAuth}`);
        console.log(`  permissions keys: ${x.permissions ? JSON.stringify(Object.keys(x.permissions)) : 'NONE'}`);
    });

    console.log('\n=== CROSS-CHECK: Auth UIDs missing Firestore docs ===');
    authResult.users.forEach(u => {
        if (!fsIDs.has(u.uid)) {
            console.log(`MISSING DOC for auth user: ${u.uid} (${u.email})`);
        }
    });
}

run().catch(console.error);
