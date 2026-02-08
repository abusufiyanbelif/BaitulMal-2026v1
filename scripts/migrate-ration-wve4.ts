import { adminDb } from '../src/lib/firebase-admin-sdk';
import type { Campaign, RationCategory, RationItem } from '../src/lib/types';

const CAMPAIGN_ID = 'WVe4ci8nBcxCZ0b2SIBn';

const log = {
  info: (msg: string) => console.log(`\x1b[34mℹ️ ${msg}\x1b[0m`),
  success: (msg: string) => console.log(`\x1b[32m✅ ${msg}\x1b[0m`),
  error: (msg: string) => console.error(`\x1b[31m❌ ${msg}\x1b[0m`),
  warn: (msg: string) => console.warn(`\x1b[33m⚠️ ${msg}\x1b[0m`),
};

async function migrateCampaign() {
  if (!adminDb) {
    log.error('Firebase Admin SDK not initialized. Aborting. Make sure serviceAccountKey.json is present.');
    process.exit(1);
  }

  log.info(`Targeting campaign with ID: ${CAMPAIGN_ID}`);
  const campaignRef = adminDb.collection('campaigns').doc(CAMPAIGN_ID);
  const campaignSnap = await campaignRef.get();

  if (!campaignSnap.exists) {
    log.error(`Campaign with ID ${CAMPAIGN_ID} not found.`);
    return;
  }

  const campaignData = campaignSnap.data() as Campaign;
  const rationLists = campaignData.rationLists;

  if (Array.isArray(rationLists)) {
    log.success('Campaign ration list is already in the new array format. No migration needed.');
    return;
  }

  if (typeof rationLists === 'object' && rationLists !== null && !Array.isArray(rationLists)) {
    log.warn('Old object format detected. Migrating to new array format...');

    const newRationLists: RationCategory[] = [];
    
    for (const key in rationLists) {
        if (Object.prototype.hasOwnProperty.call(rationLists, key)) {
            const items = (rationLists as any)[key] as RationItem[];
            if (Array.isArray(items)) {
                log.info(`Found category "${key}" with ${items.length} items.`);
                newRationLists.push({
                    id: key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    name: key,
                    minMembers: 0, 
                    maxMembers: key === 'General Item List' ? 0 : 99, // Set a wide range for non-general lists
                    items: items,
                });
            }
        }
    }
    
    if (newRationLists.length === 0) {
        log.error('Could not find any valid item lists in the old format to migrate.');
        return;
    }

    try {
      await campaignRef.update({
        rationLists: newRationLists,
      });
      log.success(`Successfully migrated ration list for campaign "${campaignData.name}".`);
      log.warn('Please review the campaign details in the app to set correct member ranges for the new categories.');
    } catch (e: any) {
      log.error(`Failed to update campaign document: ${e.message}`);
    }
  } else {
    log.error('The `rationLists` field is in an unknown or invalid format. Manual inspection required.');
  }
}

migrateCampaign().catch((e) => {
    log.error('An unexpected error occurred during migration:');
    console.error(e);
});
