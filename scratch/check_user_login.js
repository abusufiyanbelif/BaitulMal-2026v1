const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkUser() {
    const phone = "9309930691";
    console.log(`Checking for phone: ${phone}`);

    // Check beneficiaries
    const benSnap = await db.collection('beneficiaries').where('phone', '==', phone).get();
    if (benSnap.empty) {
        console.log("No beneficiary found with this phone number.");
    } else {
        benSnap.forEach(doc => {
            console.log("Beneficiary Found:");
            console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
        });
    }

    // Check donors
    const donorSnap = await db.collection('donors').where('phone', '==', phone).get();
    if (donorSnap.empty) {
        console.log("No donor found with this phone number.");
    } else {
        donorSnap.forEach(doc => {
            console.log("Donor Found:");
            console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
        });
    }

    // Check users
    const userSnap = await db.collection('users').where('phone', '==', phone).get();
    if (userSnap.empty) {
        console.log("No user found with this phone number.");
    } else {
        userSnap.forEach(doc => {
            console.log("User Found:");
            console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
        });
    }
}

checkUser().catch(console.error);
