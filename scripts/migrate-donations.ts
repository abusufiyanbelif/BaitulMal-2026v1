
import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import type { Donation, Campaign } from '../src/lib/types';

async function migrateDonations() {
  console.log('🚀 Starting donation data migration to the modern `linkSplit` format...');
  
  const { adminDb } = getAdminServices();
  if (!adminDb) {
    throw new Error("Admin SDK not initialized. This script requires server-side admin privileges. Please ensure your 'serviceAccountKey.json' is configured correctly.");
  }

  const donationsRef = adminDb.collection('donations');
  const campaignsRef = adminDb.collection('campaigns');
  
  try {
    const [donationsSnap, campaignsSnap] = await Promise.all([donationsRef.get(), campaignsRef.get()]);
    
    if (donationsSnap.empty) {
      console.log('✅ No donations found in the database. Nothing to migrate.');
      return;
    }
    
    const campaignsMap = new Map(campaignsSnap.docs.map(doc => [doc.id, (doc.data() as Campaign).name]));

    const batch = adminDb.batch();
    let updatedCount = 0;

    for (const docSnap of donationsSnap.docs) {
      const donation = docSnap.data() as any; // Use 'any' to access potential legacy fields

      // This script targets donations with the old `campaignId` field that haven't been migrated yet.
      if (donation.campaignId && (!donation.linkSplit || donation.linkSplit.length === 0)) {
        
        const campaignName = campaignsMap.get(donation.campaignId) || donation.campaignName || 'Unknown Campaign';
        
        const newLinkSplit = [{
            linkId: donation.campaignId,
            linkName: campaignName,
            linkType: 'campaign',
            amount: donation.amount
        }];
        
        // Stage the update: add linkSplit and remove the old fields
        batch.update(docSnap.ref, { 
            linkSplit: newLinkSplit,
            campaignId: FieldValue.delete(),
            campaignName: FieldValue.delete()
        });
        updatedCount++;
        console.log(`  - Staged update for donation ID: ${docSnap.id} to link to campaign '${campaignName}'`);
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`\n✅ Migration complete. Successfully updated ${updatedCount} legacy donation records.`);
    } else {
      console.log('\n✅ All donation records are already up to date. No migration was necessary.');
    }
  } catch (error: any) {
    console.error('\n❌ An error occurred during migration:', error);
    // Re-throw to ensure the process exits with a non-zero code
    throw error;
  }
}

migrateDonations().then(() => {
  console.log('🏁 Migration script finished successfully.');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Unhandled error in migration script:', error.message);
  process.exit(1);
});
