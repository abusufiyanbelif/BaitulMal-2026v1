const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
    let credential;
    try {
        const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
        credential = admin.credential.cert(require(serviceAccountPath));
    } catch (error) {
        credential = admin.credential.applicationDefault();
    }
    admin.initializeApp({
        credential,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'docuextract-q8vaa'
    });
}

const db = admin.firestore();

function cleanPhone(phone: any): string | null {
    if (!phone) return null;
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) {
        digits = digits.substring(2);
    }
    return digits.length === 10 ? digits : null;
}

async function run() {
    console.log('--- Deep Scanning Profiles & Syncing Multiple Identities ---');

    // 1. Fetch all collections
    const donorsSnap = await db.collection('donors').get();
    const beneficiariesSnap = await db.collection('beneficiaries').get();
    const usersSnap = await db.collection('users').get();
    const donationsSnap = await db.collection('donations').get();

    // Dictionaries mapped by cleaned phone
    const donorsByPhone: Record<string, string> = {};
    const beneficiariesByPhone: Record<string, string> = {};
    const usersByPhone: Record<string, any> = {};

    donorsSnap.forEach((doc: any) => {
        const d = doc.data();
        const p = cleanPhone(d.phone || (d.phones && d.phones[0]));
        if (p) donorsByPhone[p] = doc.id;
    });

    beneficiariesSnap.forEach((doc: any) => {
        const p = cleanPhone(doc.data().phone);
        if (p) beneficiariesByPhone[p] = doc.id;
    });

    usersSnap.forEach((doc: any) => {
        const d = doc.data();
        const p = cleanPhone(d.phone);
        if (p) usersByPhone[p] = { id: doc.id, ...d };
    });

    let usersUpdated = 0;
    let donationsLinked = 0;

    // 2. Identify Multi-profile Users
    for (const p of Object.keys(usersByPhone)) {
        const user = usersByPhone[p];
        const updates: any = {};
        
        const donorId = donorsByPhone[p];
        const beneficiaryId = beneficiariesByPhone[p];

        if (donorId && user.linkedDonorId !== donorId) {
            updates.linkedDonorId = donorId;
        }
        if (beneficiaryId && user.linkedBeneficiaryId !== beneficiaryId) {
            updates.linkedBeneficiaryId = beneficiaryId;
        }

        if (Object.keys(updates).length > 0) {
             await db.collection('users').doc(user.id).update(updates);
             usersUpdated++;
             console.log(`Linked User ${user.name} to Role Profiles:`, updates);
        }
    }

    // 3. Fix unlinked donations mapping
    for (const doc of donationsSnap.docs) {
        const don = doc.data();
        if (!don.donorId) {
            const p = cleanPhone(don.donorPhone);
            if (p && donorsByPhone[p]) {
                await doc.ref.update({ donorId: donorsByPhone[p] });
                donationsLinked++;
            }
        }
    }

    console.log(`Scan Complete. Identity Profiles Synced: ${usersUpdated}. Unlinked Donations Fixed: ${donationsLinked}`);
}

run().catch(console.error);
