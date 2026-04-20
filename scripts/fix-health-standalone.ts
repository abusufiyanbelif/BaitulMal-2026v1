
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Minimal admin init logic from src/lib/firebase-admin-sdk.ts
function getAdmin() {
    if (admin.apps.length === 0) {
        const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccountPath),
            });
        } else {
            admin.initializeApp();
        }
    }
    return admin.firestore();
}

async function runHealthFix() {
    const db = getAdmin();
    console.log('Scanning for undefined donorId in donations...');
    
    const donationsSnap = await db.collection('donations').get();
    let fixedCount = 0;
    const batch = db.batch();
    
    donationsSnap.docs.forEach(doc => {
        const data = doc.data();
        let needsUpdate = false;
        const updates: any = {};
        
        if (data.donorId === undefined) {
            updates.donorId = null;
            needsUpdate = true;
        }
        
        if (data.status === undefined) {
            updates.status = 'Pending';
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            batch.update(doc.ref, { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            fixedCount++;
        }
    });
    
    if (fixedCount > 0) {
        await batch.commit();
        console.log(`Fixed ${fixedCount} donations.`);
    } else {
        console.log('No donation issues found.');
    }
    
    console.log('Scanning for missing authenticityStatus in initiatives...');
    const campaignsSnap = await db.collection('campaigns').get();
    const leadsSnap = await db.collection('leads').get();
    
    const initBatch = db.batch();
    let initFixed = 0;
    
    [...campaignsSnap.docs, ...leadsSnap.docs].forEach(doc => {
        const data = doc.data();
        if (!data.authenticityStatus || !data.publicVisibility || data.collectedAmount === undefined) {
            initBatch.update(doc.ref, {
                authenticityStatus: data.authenticityStatus || 'Pending Verification',
                publicVisibility: data.publicVisibility || 'Hold',
                collectedAmount: data.collectedAmount ?? 0,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            initFixed++;
        }
    });
    
    if (initFixed > 0) {
        await initBatch.commit();
        console.log(`Fixed ${initFixed} initiatives.`);
    } else {
        console.log('No initiative issues found.');
    }
    
    console.log('Health check complete.');
}

runHealthFix().catch(console.error);
