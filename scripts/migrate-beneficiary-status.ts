import { getAdminServices } from '../src/lib/firebase-admin-sdk';

async function migrateBeneficiaryStatus() {
  console.log('🚀 Starting deep scan of beneficiaries to normalize status...');
  
  const { adminDb } = getAdminServices();
  if (!adminDb) {
    throw new Error("Admin SDK not initialized. This script requires server-side admin privileges. Please ensure your 'serviceAccountKey.json' is configured correctly.");
  }

  const batch = adminDb.batch();
  let updatedCount = 0;

  try {
    // 1. Scan Master List
    const masterSnap = await adminDb.collection('beneficiaries').get();
    console.log(`Scanning ${masterSnap.size} master records...`);
    
    masterSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.status) {
            batch.update(docSnap.ref, { status: 'Pending' });
            updatedCount++;
        }
    });

    // 2. Scan all subcollections using collectionGroup
    const subSnap = await adminDb.collectionGroup('beneficiaries').get();
    console.log(`Scanning ${subSnap.size} initiative-linked records...`);
    
    subSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.status) {
            batch.update(docSnap.ref, { status: 'Pending' });
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`\n✅ Migration complete. Successfully defaulted ${updatedCount} records to 'Pending'.`);
    } else {
      console.log('\n✅ All records have a valid status. No migration was necessary.');
    }
  } catch (error: any) {
    console.error('\n❌ An error occurred during migration:', error);
    throw error;
  }
}

migrateBeneficiaryStatus().then(() => {
  console.log('🏁 Migration script finished successfully.');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Unhandled error in migration script:', error.message);
  process.exit(1);
});