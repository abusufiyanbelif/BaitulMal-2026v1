
import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import type { Beneficiary } from '../src/lib/types';
import { type DocumentData } from 'firebase-admin/firestore';

function sanitizeBeneficiaryForMasterList(data: DocumentData): Partial<Beneficiary> {
    const { status, kitAmount, itemCategoryId, itemCategoryName, ...masterData } = data;
    return masterData;
}

async function migrateBeneficiaries() {
    console.log('🚀 Starting beneficiary sync. This will find beneficiaries in campaigns/leads that are not in the master list and add them.');
    const { adminDb } = getAdminServices();
    if (!adminDb) {
        throw new Error("Admin SDK not initialized.");
    }
    
    try {
        const batch = adminDb.batch();
        let addedCount = 0;
        
        const masterBeneficiariesSnap = await adminDb.collection('beneficiaries').get();
        const masterIds = new Set(masterBeneficiariesSnap.docs.map(d => d.id));

        console.log('Scanning campaigns...');
        const campaignsSnap = await adminDb.collection('campaigns').get();
        for (const campaignDoc of campaignsSnap.docs) {
            const campaignBeneficiariesSnap = await adminDb.collection(`campaigns/${campaignDoc.id}/beneficiaries`).get();
            for (const benDoc of campaignBeneficiariesSnap.docs) {
                if (!masterIds.has(benDoc.id)) {
                    console.log(`  - Found new beneficiary '${benDoc.data().name}' in campaign '${campaignDoc.data().name}'. Staging for master list.`);
                    const masterRef = adminDb.collection('beneficiaries').doc(benDoc.id);
                    const sanitizedData = sanitizeBeneficiaryForMasterList(benDoc.data());
                    batch.set(masterRef, sanitizedData, { merge: true });
                    masterIds.add(benDoc.id);
                    addedCount++;
                }
            }
        }
        
        console.log('Scanning leads...');
        const leadsSnap = await adminDb.collection('leads').get();
        for (const leadDoc of leadsSnap.docs) {
            const leadBeneficiariesSnap = await adminDb.collection(`leads/${leadDoc.id}/beneficiaries`).get();
            for (const benDoc of leadBeneficiariesSnap.docs) {
                if (!masterIds.has(benDoc.id)) {
                    console.log(`  - Found new beneficiary '${benDoc.data().name}' in lead '${leadDoc.data().name}'. Staging for master list.`);
                    const masterRef = adminDb.collection('beneficiaries').doc(benDoc.id);
                    const sanitizedData = sanitizeBeneficiaryForMasterList(benDoc.data());
                    batch.set(masterRef, sanitizedData, { merge: true });
                    masterIds.add(benDoc.id);
                    addedCount++;
                }
            }
        }

        if (addedCount > 0) {
            console.log(`\nCommitting ${addedCount} new beneficiaries to the master list...`);
            await batch.commit();
            console.log('✅ Batch commit successful.');
        }

        return { success: true, message: `Sync complete. Added ${addedCount} new beneficiaries to the master list.`, addedCount };

    } catch (error: any) {
        console.error("Error syncing master beneficiary list:", error);
        return { success: false, message: `Sync failed: ${error.message}`, addedCount: 0 };
    }
}

migrateBeneficiaries().then(result => {
    if (result.success) {
        console.log(`\n🏁 ${result.message}`);
    } else {
        console.error(`\n❌ ${result.message}`);
    }
    process.exit(result.success ? 0 : 1);
});
