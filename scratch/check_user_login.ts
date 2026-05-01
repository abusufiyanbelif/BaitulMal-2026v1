import { getAdminServices } from './src/lib/firebase-admin-sdk';

async function checkUser() {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        console.error("Admin DB not initialized");
        return;
    }

    const phone = "9309930691";
    console.log(`Checking for phone: ${phone}`);

    // Check beneficiaries
    const benRef = adminDb.collection('beneficiaries');
    const benSnap = await benRef.where('phone', '==', phone).get();
    
    if (benSnap.empty) {
        console.log("No beneficiary found with this phone number.");
    } else {
        benSnap.forEach(doc => {
            console.log("Beneficiary Found:");
            console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
        });
    }

    // Check users
    const userRef = adminDb.collection('users');
    const userSnap = await userRef.where('phone', '==', phone).get();
    
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
