
import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import type { Beneficiary } from '../src/lib/types';

async function migrateZakatStatus() {
  console.log('🚀 Starting Zakat status synchronization across all beneficiaries...');
  
  const { adminDb } = getAdminServices();
  if (!adminDb) {
    throw new Error("Admin SDK not initialized. This script requires server-side admin privileges. Please ensure your 'serviceAccountKey.json' is configured correctly.");
  }

  const masterBeneficiariesRef = adminDb.collection('beneficiaries');
  const masterBeneficiariesSnap = await masterBeneficiariesRef.get();
  
  if (masterBeneficiariesSnap.empty) {
    console.log('✅ No master beneficiaries found. Nothing to migrate.');
    return;
  }

  let updatedCount = 0;
  const batch = adminDb.batch();

  for (const masterDoc of masterBeneficiariesSnap.docs) {
    const masterData = masterDoc.data() as Beneficiary;
    const beneficiaryId = masterDoc.id;

    // Data to be synced from the master record.
    const syncData: { isEligibleForZakat: boolean; zakatAllocation?: number } = {
        isEligibleForZakat: masterData.isEligibleForZakat || false,
    };
    // Only sync allocation if they are eligible.
    if (syncData.isEligibleForZakat) {
        syncData.zakatAllocation = masterData.zakatAllocation || 0;
    } else {
        syncData.zakatAllocation = 0;
    }

    // Find all instances of this beneficiary in subcollections
    const allInstancesQuery = adminDb.collectionGroup('beneficiaries').where('id', '==', beneficiaryId);
    const allInstancesSnap = await allInstancesQuery.get();

    let needsUpdate = false;
    allInstancesSnap.forEach(docSnap => {
        // Don't re-update the master document itself
        if (docSnap.ref.path !== masterDoc.ref.path) {
            const subCollectionData = docSnap.data() as Beneficiary;
            // Check if an update is actually needed to avoid unnecessary writes.
            if (subCollectionData.isEligibleForZakat !== syncData.isEligibleForZakat || subCollectionData.zakatAllocation !== syncData.zakatAllocation) {
                batch.set(docSnap.ref, syncData, { merge: true });
                needsUpdate = true;
            }
        }
    });
    if (needsUpdate) {
        updatedCount++;
    }
  }

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`\n✅ Migration complete. Successfully synced Zakat status for ${updatedCount} beneficiaries across all initiatives.`);
  } else {
    console.log('\n✅ All beneficiary records are already up to date. No migration was necessary.');
  }
}

migrateZakatStatus().then(() => {
  console.log('🏁 Zakat migration script finished successfully.');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Unhandled error in migration script:', error.message);
  process.exit(1);
});
