import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import type { Donation, Campaign } from '../src/lib/types';

async function migrateDonations() {
  const { adminDb } = getAdminServices();
  if (!adminDb) {
    console.error("Admin SDK not initialized. This is a server-side script. Please ensure your environment is configured correctly (e.g., serviceAccountKey.json). Exiting.");
    process.exit(1);
  }

  console.log('Starting donation data migration to linkSplit format...');

  const donationsRef = adminDb.collection('donations');
  const allCampaignsRef = adminDb.collection('campaigns');
  
  try {
    const donationsSnap = await donationsRef.get();
    const campaignsSnap = await allCampaignsRef.get();
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
        console.log(`- Staged update for donation ID: ${docSnap.id} to link to campaign '${campaignName}'`);
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`\nMigration complete. Successfully updated ${updatedCount} legacy donation records.`);
    } else {
      console.log('\nNo legacy donations found that required migration.');
    }
  } catch (error: any) {
    console.error('\nAn error occurred during migration:', error);
  }
}

migrateDonations().then(() => {
  console.log('Migration script finished.');
  process.exit(0);
}).catch((error) => {
  console.error('Unhandled error in migration script:', error);
  process.exit(1);
});
