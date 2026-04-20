
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function getAdmin() {
    if (admin.apps.length === 0) {
        const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccountPath),
            });
            console.log('Initialized with serviceAccountKey.json');
        } else {
            admin.initializeApp();
            console.log('Initialized with default credentials');
        }
    }
    return admin.firestore();
}

async function runHealthFix() {
    const db = getAdmin();
    console.log('Scanning for issues...');
    
    const donationsSnap = await db.collection('donations').get();
    let fixedDonations = 0;
    const batch = db.batch();
    
    donationsSnap.docs.forEach(doc => {
        const data = doc.data();
        let needsUpdate = false;
        const updates = {};
        
        if (data.donorId === undefined) { updates.donorId = null; needsUpdate = true; }
        if (data.status === undefined) { updates.status = 'Pending'; needsUpdate = true; }
        if (data.linkSplit === undefined) { updates.linkSplit = []; needsUpdate = true; }
        
        if (needsUpdate) {
            batch.update(doc.ref, { ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            fixedDonations++;
        }
    });
    
    if (fixedDonations > 0) {
        await batch.commit();
        console.log(`Fixed ${fixedDonations} donations.`);
    }

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
    }
    
    console.log('Data Health Fix Complete.');
}

runHealthFix().catch(console.error);
