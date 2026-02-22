
import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import { CollectionReference } from 'firebase-admin/firestore';

async function checkFirestoreStructure() {
  const { adminDb } = getAdminServices();
  if (!adminDb) {
    throw new Error("Admin SDK not initialized. Cannot check Firestore structure.");
  }

  console.log('\n--- Firestore Structure Check ---');
  try {
    const collections = await adminDb.listCollections();
    if (collections.length === 0) {
      console.log('  - No root collections found.');
    } else {
      console.log('Root Collections Found:');
      collections.forEach((col: CollectionReference) => console.log(`  - /${col.id}`));
    }
    console.log('\nExpected collections: users, campaigns, leads, donations, beneficiaries, settings, user_lookups.');
    console.log('Note: If any are missing, they will be created automatically when you first add data to them.');
  } catch (error: any) {
    console.error('❌ Error checking Firestore structure:', error.message);
    throw error; // Re-throw to be caught by the main handler
  }
}

async function checkStorageStructure() {
  const { adminStorage } = getAdminServices();
  if (!adminStorage) {
    throw new Error("Admin SDK not initialized. Cannot check Storage structure.");
  }

  console.log('\n--- Firebase Storage Structure Check ---');
  try {
    const bucket = adminStorage.bucket();
    const [files] = await bucket.getFiles({ delimiter: '/', autoPaginate: false });
    
    // The `apiResponse.prefixes` array contains what we perceive as root folders.
    const folders = (files as any).apiResponse?.prefixes || [];
    
    if (folders.length === 0) {
        console.log('  - No root folders found.');
    } else {
        console.log('Root Folders Found:');
        folders.forEach((folder: string) => console.log(`  - /${folder}`));
    }
    console.log('\nExpected folders: users, campaigns, leads, donations, beneficiaries, settings.');
    console.log('Note: These folders are created automatically when files are first uploaded to them.');
  } catch (error: any) {
    console.error('❌ Error checking Storage structure:', error.message);
    throw error; // Re-throw to be caught by the main handler
  }
}


async function runChecks() {
  try {
    console.log('🔍 Starting structure verification for Firestore and Storage...');
    await checkFirestoreStructure();
    await checkStorageStructure();
    console.log('\n✅ Check complete. This script is read-only and does not make any changes.');
    process.exit(0);
  } catch (error) {
    console.error('\nAn unhandled error occurred during the structure check. Please review the errors above.');
    process.exit(1);
  }
}

runChecks();
