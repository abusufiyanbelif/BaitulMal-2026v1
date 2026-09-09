import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import { getStorageFolderName, getDonationStorageFolderName, extractCaseIdsFromDonation } from '../src/lib/storage-path';

async function repairFirestoreUrls() {
    console.log('🔧 Starting Firestore file URL repair & alignment...');
    const { adminDb, adminStorage } = getAdminServices();
    if (!adminDb || !adminStorage) {
        console.error('❌ Admin SDK not initialized.');
        process.exit(1);
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'docuextract-q8vaa.firebasestorage.app';
    const bucket = adminStorage.bucket(bucketName);

    let updatedLeads = 0;
    let updatedCampaigns = 0;
    let updatedDonations = 0;

    // 1. Repair LEADS
    console.log('\n--- Repairing Leads ---');
    const leadsSnap = await adminDb.collection('leads').get();
    for (const doc of leadsSnap.docs) {
        const data = doc.data();
        const caseId = data.caseId;
        const folderName = getStorageFolderName(caseId, doc.id);
        const prefix = `leads/${folderName}/`;

        const [files] = await bucket.getFiles({ prefix });
        console.log(`Lead ${doc.id} (Case: ${caseId}) -> Found ${files.length} files under ${prefix}`);

        if (files.length === 0) continue;

        const updatePayload: Record<string, any> = {};
        let isUpdated = false;

        // Find main image file
        const mainImgFile = files.find(f => !f.name.slice(prefix.length).includes('/'));
        if (mainImgFile) {
            const correctUrl = `https://storage.googleapis.com/${bucket.name}/${mainImgFile.name}`;
            console.log(`Lead ${doc.id}: Current imageUrl = "${data.imageUrl}", Correct = "${correctUrl}"`);
            if (data.imageUrl !== correctUrl) {
                updatePayload.imageUrl = correctUrl;
                isUpdated = true;
            }
        }

        // Repair documents array
        if (Array.isArray(data.documents) && data.documents.length > 0) {
            const docFiles = files.filter(f => f.name.includes('/documents/'));
            const newDocs = data.documents.map((docItem: any) => {
                if (!docItem.url && !docItem.name) return docItem;
                const docName = docItem.name || docItem.url?.split('?')[0].split('/').pop();
                const matchedFile = docFiles.find(f => f.name.endsWith(decodeURIComponent(docName)));
                if (matchedFile) {
                    const correctUrl = `https://storage.googleapis.com/${bucket.name}/${matchedFile.name}`;
                    return { ...docItem, url: correctUrl };
                }
                return docItem;
            });
            if (JSON.stringify(newDocs) !== JSON.stringify(data.documents)) {
                updatePayload.documents = newDocs;
                isUpdated = true;
            }
        }

        if (isUpdated) {
            await doc.ref.update(updatePayload);
            updatedLeads++;
            console.log(`✅ Lead ${doc.id} UPDATED!`);
        }
    }

    // 2. Repair CAMPAIGNS
    console.log('\n--- Repairing Campaigns ---');
    const campaignsSnap = await adminDb.collection('campaigns').get();
    for (const doc of campaignsSnap.docs) {
        const data = doc.data();
        const caseId = data.caseId;
        const folderName = getStorageFolderName(caseId, doc.id);
        const prefix = `campaigns/${folderName}/`;

        const [files] = await bucket.getFiles({ prefix });
        console.log(`Campaign ${doc.id} (Case: ${caseId}) -> Found ${files.length} files under ${prefix}`);

        if (files.length === 0) continue;

        const updatePayload: Record<string, any> = {};
        let isUpdated = false;

        const mainImgFile = files.find(f => !f.name.slice(prefix.length).includes('/'));
        if (mainImgFile) {
            const correctUrl = `https://storage.googleapis.com/${bucket.name}/${mainImgFile.name}`;
            console.log(`Campaign ${doc.id}: Current imageUrl = "${data.imageUrl}", Correct = "${correctUrl}"`);
            if (data.imageUrl !== correctUrl) {
                updatePayload.imageUrl = correctUrl;
                isUpdated = true;
            }
        }

        if (Array.isArray(data.documents) && data.documents.length > 0) {
            const docFiles = files.filter(f => f.name.includes('/documents/'));
            const newDocs = data.documents.map((docItem: any) => {
                if (!docItem.url && !docItem.name) return docItem;
                const docName = docItem.name || docItem.url?.split('?')[0].split('/').pop();
                const matchedFile = docFiles.find(f => f.name.endsWith(decodeURIComponent(docName)));
                if (matchedFile) {
                    const correctUrl = `https://storage.googleapis.com/${bucket.name}/${matchedFile.name}`;
                    return { ...docItem, url: correctUrl };
                }
                return docItem;
            });
            if (JSON.stringify(newDocs) !== JSON.stringify(data.documents)) {
                updatePayload.documents = newDocs;
                isUpdated = true;
            }
        }

        if (isUpdated) {
            await doc.ref.update(updatePayload);
            updatedCampaigns++;
            console.log(`✅ Campaign ${doc.id} UPDATED!`);
        }
    }

    // 3. Repair DONATIONS
    console.log('\n--- Repairing Donations ---');
    const donationsSnap = await adminDb.collection('donations').get();
    for (const doc of donationsSnap.docs) {
        const data = doc.data();
        const caseIds = extractCaseIdsFromDonation(data);
        const folderName = getDonationStorageFolderName(caseIds, doc.id);
        const prefix = `donations/${folderName}/`;

        const [files] = await bucket.getFiles({ prefix });
        if (files.length === 0) continue;

        const updatePayload: Record<string, any> = {};
        let isUpdated = false;

        if (Array.isArray(data.transactions) && data.transactions.length > 0) {
            const newTxs = data.transactions.map((tx: any) => {
                if (!tx.screenshotUrl && !tx.id) return tx;
                const matchedFile = files.find(f => f.name.includes(tx.id) || (tx.screenshotUrl && f.name.endsWith(decodeURIComponent(tx.screenshotUrl.split('?')[0].split('/').pop()))));
                if (matchedFile) {
                    const correctUrl = `https://storage.googleapis.com/${bucket.name}/${matchedFile.name}`;
                    return { ...tx, screenshotUrl: correctUrl };
                }
                return tx;
            });

            if (JSON.stringify(newTxs) !== JSON.stringify(data.transactions)) {
                updatePayload.transactions = newTxs;
                isUpdated = true;
            }
        }

        if (isUpdated) {
            await doc.ref.update(updatePayload);
            updatedDonations++;
            console.log(`✅ Donation ${doc.id} UPDATED!`);
        }
    }

    console.log(`\n✅ Repair Finished! Updated ${updatedLeads} leads, ${updatedCampaigns} campaigns, and ${updatedDonations} donations.`);
    process.exit(0);
}

repairFirestoreUrls();
