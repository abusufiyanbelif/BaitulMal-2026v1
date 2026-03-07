import { getAdminServices } from '../src/lib/firebase-admin-sdk';

async function migratePriority() {
  console.log('🚀 Starting deep scan of initiatives to normalize priority to Medium...');
  
  const { adminDb } = getAdminServices();
  if (!adminDb) {
    throw new Error("Admin SDK not initialized. This script requires server-side admin privileges. Please ensure your 'serviceAccountKey.json' is configured correctly.");
  }

  const batch = adminDb.batch();
  let updatedCount = 0;

  try {
    // 1. Scan Campaigns
    console.log('Scanning campaigns...');
    const campaignsSnap = await adminDb.collection('campaigns').get();
    campaignsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.priority) {
            batch.update(docSnap.ref, { priority: 'Medium' });
            updatedCount++;
        }
    });

    // 2. Scan Leads
    console.log('Scanning leads...');
    const leadsSnap = await adminDb.collection('leads').get();
    leadsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.priority) {
            batch.update(docSnap.ref, { priority: 'Medium' });
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`\n✅ Migration complete. Successfully defaulted ${updatedCount} records to 'Medium' priority.`);
    } else {
      console.log('\n✅ All records already have a priority level. No migration was necessary.');
    }
  } catch (error: any) {
    console.error('\n❌ An error occurred during migration:', error);
    throw error;
  }
}

migratePriority().then(() => {
  console.log('🏁 Migration script finished successfully.');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Unhandled error in migration script:', error.message);
  process.exit(1);
});
