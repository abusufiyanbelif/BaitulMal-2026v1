import { getAdminServices } from './src/lib/firebase-admin-sdk';

async function migratePhones() {
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        console.error("Admin SDK not initialized");
        return;
    }

    const collections = ['users', 'donors', 'beneficiaries', 'user_lookups'];
    
    function cleanPhone(phone: any): string {
        if (typeof phone !== 'string') return String(phone || '');
        const digits = phone.replace(/\D/g, '');
        return digits.length > 10 ? digits.slice(-10) : digits;
    }

    for (const col of collections) {
        console.log(`Migrating collection: ${col}`);
        const snapshot = await adminDb.collection(col).get();
        const batch = adminDb.batch();
        let count = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            let updated = false;
            const newData: any = {};

            if (data.phone) {
                const cleaned = cleanPhone(data.phone);
                if (cleaned !== data.phone) {
                    newData.phone = cleaned;
                    updated = true;
                }
            }

            if (data.loginId) {
                const cleaned = cleanPhone(data.loginId);
                if (cleaned !== data.loginId) {
                    newData.loginId = cleaned;
                    updated = true;
                }
            }

            // For user_lookups, the document ID might be the phone number
            if (col === 'user_lookups') {
                const cleanedId = cleanPhone(doc.id);
                if (cleanedId !== doc.id) {
                    // We need to create a new document and delete the old one
                    batch.set(adminDb.collection('user_lookups').doc(cleanedId), {
                        ...data,
                        phone: cleanPhone(data.phone || doc.id)
                    });
                    batch.delete(doc.ref);
                    count++;
                    updated = false; // Already handled via set/delete
                }
            }

            if (updated) {
                batch.update(doc.ref, newData);
                count++;
            }

            if (count >= 400) { // Firestore batch limit is 500
                await batch.commit();
                console.log(`Committed batch of ${count} in ${col}`);
                count = 0;
            }
        }

        if (count > 0) {
            await batch.commit();
            console.log(`Committed final batch of ${count} in ${col}`);
        }
    }

    console.log("Migration complete");
}

migratePhones();
