const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

async function resetPwd() {
    // 1. Reset Admin
    const email1 = 'baitulmalss.solapur@gmail.com';
    const user1 = await admin.auth().getUserByEmail(email1);
    await admin.auth().updateUser(user1.uid, {
        password: 'password'
    });
    console.log(`Successfully updated password for ${email1} (uid: ${user1.uid}) to: password`);

    // 2. Reset Abusufiyan
    const email2 = 'abusufiyan.belif@gmail.com';
    const user2 = await admin.auth().getUserByEmail(email2);
    await admin.auth().updateUser(user2.uid, {
        password: 'password'
    });
    console.log(`Successfully updated password for ${email2} (uid: ${user2.uid}) to: password`);
}

resetPwd().catch(console.error);
