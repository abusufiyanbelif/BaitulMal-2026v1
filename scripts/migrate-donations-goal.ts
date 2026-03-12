import { getAdminServices } from '../src/lib/firebase-admin-sdk';

/**
 * Normalizes 'forFundraising' flags across all donation records.
 * Defaults all missing or null values to 'false' to satisfy strict type checking.
 */
async function migrateDonationsGoal() {
  console.log('🚀 Starting deep scan of donations to normalize fundraising flags...');
  
  const { adminDb } = getAdminServices();
  if (!adminDb) {
    throw new Error("Admin SDK not initialized. This script requires server-side admin privileges.");
  }

  try {
    const donationsSnap = await adminDb.collection('donations').get();
    console.log(`Scanning ${donationsSnap.size} total donation records...`);
    
    let updatedCount = 0;
    const batch = adminDb.batch();

    donationsSnap.forEach(docSnap => {
        const data = docSnap.data();
        let needsUpdate = false;
        
        // Normalize typeSplit array
        if (Array.isArray(data.typeSplit)) {
            const updatedTypeSplit = data.typeSplit.map((split: any) => {
                if (split.forFundraising === undefined || split.forFundraising === null) {
                    needsUpdate = true;
                    return { ...split, forFundraising: false };
                }
                return split;
            });

            if (needsUpdate) {
                batch.update(docSnap.ref, { typeSplit: updatedTypeSplit });
                updatedCount++;
            }
        }

        // If batch reaches limit (approx 450 to be safe), commit and start new
        if (updatedCount > 0 && updatedCount % 450 === 0) {
            console.log(`- Committing batch of ${updatedCount} updates...`);
        }
    });

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`\n✅ Migration complete. Successfully normalized ${updatedCount} records to false defaults.`);
    } else {
      console.log('\n✅ All records are already consistent. No changes necessary.');
    }
  } catch (error: any) {
    console.error('\n❌ An error occurred during deep scan:', error);
    throw error;
  }
}

migrateDonationsGoal().then(() => {
  console.log('🏁 Script finished.');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Unhandled error:', error.message);
  process.exit(1);
});
