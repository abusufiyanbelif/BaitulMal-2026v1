const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Avoid multiple initialization
if (!admin.apps.length) {
    let credential;
    try {
        const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
        credential = admin.credential.cert(require(serviceAccountPath));
    } catch (error) {
        console.warn('Could not load serviceAccountKey.json, using application default credentials.');
        credential = admin.credential.applicationDefault();
    }
    
    admin.initializeApp({
        credential,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'docuextract-q8vaa'
    });
}

const db = admin.firestore();
const auth = admin.auth();

function cleanPhone(phone: any) {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) {
        digits = digits.substring(2);
    }
    return digits;
}

async function run() {
    console.log('Starting Donor Migration Sync...');
    const donorsSnap = await db.collection('donors').get();
    
    let created = 0;
    let linked = 0;
    let skipped = 0;

    for (const doc of donorsSnap.docs) {
        const data = doc.data();
        const rawPhone = data.phone || (data.phones && data.phones[0]) || '';
        const phone = cleanPhone(rawPhone);

        if (!phone || phone.length < 10) {
            console.log(`Skipping donor ${doc.id} (${data.name}) - Invalid phone: ${rawPhone}`);
            skipped++;
            continue;
        }

        const email = `${phone}@donor.demo.local`;
        const phoneE164 = `+91${phone}`;

        try {
            // Check if user exists by email
            let userRecord;
            try {
                userRecord = await auth.getUserByEmail(email);
            } catch (err: any) {
                if (err.code === 'auth/user-not-found') {
                    // Create newly 
                    userRecord = await auth.createUser({
                        email: email,
                        phoneNumber: phoneE164,
                        password: phone, // Default password as phone number
                        displayName: data.name,
                    });
                    console.log(`Created new Auth User for Donor ${data.name} (Phone: ${phone})`);
                    created++;
                } else {
                    throw err;
                }
            }

            // Sync UserProfile to Users collection
            const userRef = db.collection('users').doc(userRecord.uid);
            const userSnap = await userRef.get();
            
            if (!userSnap.exists) {
                await userRef.set({
                    id: userRecord.uid,
                    name: data.name || '',
                    email: email,
                    phone: phone,
                    loginId: phone,
                    userKey: `donor_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    role: 'Donor',
                    status: 'Active',
                    permissions: {},
                    linkedDonorId: doc.id,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`Created users document for Donor ${data.name}`);
                linked++;
            } else {
                // If it exists, just ensure it links Donor ID safely
                const existingData = userSnap.data();
                if (!existingData.linkedDonorId) {
                    await userRef.update({
                        linkedDonorId: doc.id,
                        role: existingData.role === 'Admin' ? 'Admin' : (existingData.role === 'User' ? 'User' : 'Donor')
                    });
                    console.log(`Updated users document ${userRecord.uid} with linkedDonorId`);
                    linked++;
                } else {
                    skipped++;
                }
            }

            // Update Donor document to point to User ID
            await doc.ref.update({
                linkedUserId: userRecord.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

        } catch (error: any) {
            console.error(`Failed to migrate donor ${doc.id} (${data.name}):`, error.message);
        }
    }

    console.log(`Migration Complete. Created Auth: ${created}. Linked users doc: ${linked}. Skipped: ${skipped}`);
}

run().catch(console.error);
