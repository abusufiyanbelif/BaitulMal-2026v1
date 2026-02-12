import { adminDb } from '../src/lib/firebase-admin-sdk';
import type { Campaign, Lead, RationCategory, RationItem } from '../src/lib/types';
import * as admin from 'firebase-admin';

const log = {
  info: (msg: string) => console.log(`\x1b[34mℹ️ ${msg}\x1b[0m`),
  success: (msg: string) => console.log(`\x1b[32m✅ ${msg}\x1b[0m`),
  error: (msg: string) => console.error(`\x1b[31m❌ ${msg}\x1b[0m`),
  warn: (msg: string) => console.warn(`\x1b[33m⚠️ ${msg}\x1b[0m`),
  step: (title: string) => console.log(`\n\x1b[36m--- ${title} ---\x1b[0m`),
};

async function migrateCollection(collectionName: 'campaigns' | 'leads') {
    log.step(`Checking '${collectionName}' collection for migration...`);

    if (!adminDb) {
        log.error('Firebase Admin SDK not initialized. Aborting.');
        process.exit(1);
    }
    
    const collectionRef = adminDb.collection(collectionName);
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
        log.info(`No documents found in '${collectionName}'. Nothing to migrate.`);
        return;
    }

    const batch = adminDb.batch();
    let migratedCount = 0;
    let docsToMigrate: admin.firestore.QueryDocumentSnapshot[] = [];

    // First, identify all documents that need migration
    for (const doc of snapshot.docs) {
        const data = doc.data() as Campaign | Lead;
        // @ts-ignore - checking for legacy field
        if (data.rationLists && !data.itemCategories) {
            docsToMigrate.push(doc);
        }
    }
    
    if (docsToMigrate.length === 0) {
        log.info(`All documents in '${collectionName}' are already up to date.`);
        return;
    }

    log.warn(`Found ${docsToMigrate.length} documents in '${collectionName}' that need to be migrated.`);

    for (const doc of docsToMigrate) {
        const data = doc.data() as Campaign | Lead;
        migratedCount++;
        log.info(`  (${migratedCount}/${docsToMigrate.length}) Migrating '${data.name || doc.id}'...`);
        
        // @ts-ignore
        const oldRationLists = data.rationLists;
        const newItemCategories: RationCategory[] = [];
        
        // Handle old object format from early development
        if (typeof oldRationLists === 'object' && !Array.isArray(oldRationLists)) {
            for (const key in (oldRationLists as any)) {
                if (Object.prototype.hasOwnProperty.call(oldRationLists, key)) {
                    const items = (oldRationLists as any)[key] as RationItem[];
                    if (Array.isArray(items)) {
                        newItemCategories.push({
                            id: key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                            name: key,
                            minMembers: 0,
                            maxMembers: key === 'General Item List' ? 0 : 99,
                            items: items,
                        });
                    }
                }
            }
        }
        // Handle intermediate array format if it exists
        else if (Array.isArray(oldRationLists)) {
            newItemCategories.push(...oldRationLists);
        }

        batch.update(doc.ref, {
            itemCategories: newItemCategories,
            rationLists: admin.firestore.FieldValue.delete()
        });

        if (migratedCount > 0 && migratedCount % 400 === 0) {
            log.info('Committing a batch of 400 updates...');
            await batch.commit();
        }
    }

    if (migratedCount > 0) {
        await batch.commit();
        log.success(`\nSuccessfully migrated ${migratedCount} documents in '${collectionName}'.`);
    }
}

async function main() {
    console.log('\n\x1b[1m\x1b[35m🚀 Starting Data Structure Migration Script...\x1b[0m');
    await migrateCollection('campaigns');
    await migrateCollection('leads');
    log.success('\n🎉 Migration complete!');
}

main().catch((e) => {
  log.error('\nAn unexpected error occurred during migration:');
  console.error(e);
  process.exit(1);
});
