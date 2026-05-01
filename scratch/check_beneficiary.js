const { getAdminServices } = require('./src/lib/firebase-admin-sdk');

async function checkBeneficiary() {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        console.error("Admin DB not initialized");
        return;
    }

    const phone = "9309930691";
    console.log(`Checking beneficiary with phone: ${phone}`);

    // Check user_lookups
    const lookupSnap = await adminDb.collection('user_lookups').doc(phone).get();
    if (lookupSnap.exists) {
        console.log("Found in user_lookups:", lookupSnap.data());
    } else {
        console.log("Not found in user_lookups");
    }

    // Check beneficiaries collection
    const benSnap = await adminDb.collection('beneficiaries').where('phone', '==', phone).get();
    if (!benSnap.empty) {
        benSnap.docs.forEach(doc => {
            console.log("Found in beneficiaries:", doc.id, doc.data());
        });
    } else {
        console.log("Not found in beneficiaries with 10-digit phone");
        
        // Check with +91
        const benSnap2 = await adminDb.collection('beneficiaries').where('phone', '==', "+91" + phone).get();
        if (!benSnap2.empty) {
            benSnap2.docs.forEach(doc => {
                console.log("Found in beneficiaries with +91:", doc.id, doc.data());
            });
        } else {
            console.log("Not found in beneficiaries with +91 phone");
        }
    }
}

checkBeneficiary();
