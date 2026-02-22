import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import { CollectionReference } from 'firebase-admin/firestore';

async function checkFirestoreStructure() {
  const { adminDb } = getAdminServices();
  if (!adminDb) {
    console.error("Admin SDK not initialized. Cannot check Firestore structure.");
    return;
  }

  console.log('\n--- Firestore Structure Check ---');
  try {
    const collections = await adminDb.listCollections();
    console.log('Root Collections Found:');
    if (collections.length === 0) {
      console.log('  - No collections found.');
    } else {
      collections.forEach((col: CollectionReference) => console.log(`  - /${col.id}`));
    }
    console.log('\nExpected root collections: users, campaigns, leads, donations, beneficiaries, settings, user_lookups.');
    console.log('If any are missing, they will be created automatically when you first add data to them.');

  } catch (error: any) {
    console.error('Error checking Firestore structure:', error.message);
  }
}

async function checkStorageStructure() {
  const { adminStorage } = getAdminServices();
  if (!adminStorage) {
    console.error("Admin SDK not initialized. Cannot check Storage structure.");
    return;
  }

  console.log('\n--- Firebase Storage Structure Check ---');
  try {
    const bucket = adminStorage.bucket();
    const [files] = await bucket.getFiles({ delimiter: '/', autoPaginate: false });

    // The `getFiles` response with a delimiter gives us prefixes (folders)
    // in the `apiResponse.prefixes` array.
    const folders = (files as any).apiResponse.prefixes || [];
    
    console.log('Root Folders Found:');
    if (folders.length === 0) {
        console.log('  - No root folders found.');
    } else {
        folders.forEach((folder: string) => console.log(`  - /${folder}`));
    }
    console.log('\nExpected root folders: users, campaigns, leads, donations, beneficiaries, settings.');
    console.log('These folders are created automatically when files are uploaded to them.');
    
  } catch (error: any) {
    console.error('Error checking Storage structure:', error.message);
  }
}


async function runChecks() {
  console.log('Starting structure verification for Firestore and Storage...');
  await checkFirestoreStructure();
  await checkStorageStructure();
  console.log('\nCheck complete. This script only reads and reports on the existing structure; it does not make any changes.');
  process.exit(0);
}

runChecks().catch((error) => {
  console.error('An unhandled error occurred during the check:', error);
  process.exit(1);
});
