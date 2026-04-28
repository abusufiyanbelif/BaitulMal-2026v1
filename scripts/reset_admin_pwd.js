const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

async function resetPwd() {
    const email = 'baitulmalss.solapur@gmail.com';
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, {
        password: 'Password@2026'
    });
    console.log(`Successfully updated password for ${email} (uid: ${user.uid}) to: Password@2026`);
}

resetPwd().catch(console.error);
