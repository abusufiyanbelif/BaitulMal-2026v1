import { migrateUseCaseIdsAction, migrateStorageFoldersAction } from '../src/app/settings/data-health/actions';

async function runMigration() {
  console.log('🚀 Starting Case ID & Cloud Storage migration...');

  console.log('\n--- Step 1: Migrating Case IDs across Firestore Database ---');
  try {
    const caseIdRes = await migrateUseCaseIdsAction();
    console.log(`Result: ${caseIdRes.message}`);
    console.log(`Migrated Campaigns: ${caseIdRes.migratedCampaigns}`);
    console.log(`Migrated Leads: ${caseIdRes.migratedLeads}`);
    console.log(`Updated Linked Donations: ${caseIdRes.updatedDonations}`);
  } catch (e: any) {
    console.error('❌ Case ID database migration failed:', e.message);
  }

  console.log('\n--- Step 2: Migrating Cloud Storage Folders (Campaigns, Leads, Donations) ---');
  try {
    const storageRes = await migrateStorageFoldersAction();
    console.log(`Result: ${storageRes.message}`);
    console.log(`Migrated Campaign Folders: ${storageRes.migratedCampaignFolders}`);
    console.log(`Migrated Lead Folders: ${storageRes.migratedLeadFolders}`);
    console.log(`Migrated Donation Folders: ${storageRes.migratedDonationFolders}`);
    console.log(`Total Files Moved: ${storageRes.totalFilesMoved}`);
  } catch (e: any) {
    console.error('❌ Cloud Storage folder migration failed:', e.message);
  }

  console.log('\n✅ Case ID & Cloud Storage synchronization completed.');
  process.exit(0);
}

runMigration();
