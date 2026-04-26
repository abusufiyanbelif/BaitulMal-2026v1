
import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
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

async function analyzePhones() {
    const collections = ['users', 'donors', 'leads', 'beneficiaries'];
    const stats: any = {};

    for (const col of collections) {
        console.log(`Analyzing collection: ${col}...`);
        const snap = await db.collection(col).get();
        stats[col] = {
            total: snap.size,
            noCountryCode: 0,
            hasCountryCode: 0,
            invalid: 0
        };

        snap.forEach(doc => {
            const data = doc.data();
            const phone = data.phone || data.contactPhone || data.whatsapp || '';
            if (!phone) return;

            if (phone.startsWith('+')) {
                stats[col].hasCountryCode++;
            } else if (/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
                stats[col].noCountryCode++;
            } else {
                stats[col].invalid++;
            }
        });
    }

    console.log('Phone Format Statistics:');
    console.log(JSON.stringify(stats, null, 2));
}

analyzePhones();
