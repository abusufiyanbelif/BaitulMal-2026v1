const { getAdminServices } = require('./src/lib/firebase-admin-sdk');

async function checkUser() {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        console.error("DB Unavailable");
        return;
    }

    const uid = "S5efNV5jpTPoxYNv6SnAlv3jNPO2";
    const userDoc = await adminDb.collection('users').doc(uid).get();

    if (userDoc.exists) {
        console.log("User Data:", userDoc.data());
    } else {
        console.log("User document NOT FOUND for UID:", uid);
    }
}

checkUser();
