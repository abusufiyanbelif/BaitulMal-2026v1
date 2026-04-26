
import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account file not found!');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

try {
    getApp();
} catch (e) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

function standardizePhone(phone: string | undefined | null): string | null {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 10) {
        return '+91' + clean;
    }
    if (clean.length === 12 && clean.startsWith('91')) {
        return '+' + clean;
    }
    if (phone.startsWith('+')) return phone;
    return phone; // Leave as is if we can't determine
}

async function migrate() {
    const collections = ['users', 'donors', 'leads', 'beneficiaries'];
    const batch = db.batch();
    let count = 0;

    for (const col of collections) {
        console.log(`Processing ${col}...`);
        const snap = await db.collection(col).get();
        
        for (const doc of snap.docs) {
            const data = doc.data();
            const fieldsToCheck = ['phone', 'contactPhone', 'whatsapp', 'alternatePhone', 'guardianPhone'];
            const updates: any = {};
            let changed = false;

            for (const field of fieldsToCheck) {
                if (data[field]) {
                    const newPhone = standardizePhone(data[field]);
                    if (newPhone && newPhone !== data[field]) {
                        updates[field] = newPhone;
                        changed = true;
                    }
                }
            }

            if (changed) {
                batch.update(doc.ref, updates);
                count++;

                // Special handling for users and user_lookups
                if (col === 'users' && updates.phone) {
                    const oldPhone = data.phone;
                    const newPhone = updates.phone;
                    const email = data.email;

                    if (oldPhone) {
                        // Delete old lookup if it was the phone
                        batch.delete(db.collection('user_lookups').doc(oldPhone));
                    }
                    // Create new lookup
                    batch.set(db.collection('user_lookups').doc(newPhone), {
                        email: email,
                        uid: doc.id,
                        type: 'phone'
                    }, { merge: true });
                }
            }
        }
    }

    if (count > 0) {
        console.log(`Committing ${count} updates...`);
        await batch.commit();
        console.log('Migration complete.');
    } else {
        console.log('No updates needed.');
    }
}

migrate().catch(console.error);
