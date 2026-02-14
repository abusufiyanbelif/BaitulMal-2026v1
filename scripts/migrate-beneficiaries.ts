
import { adminDb } from '../src/lib/firebase-admin-sdk';
import type { Beneficiary } from '../src/lib/types';
import * as admin from 'firebase-admin';

const log = {
  info: (msg: string) => console.log(`\x1b[34mℹ️ ${msg}\x1b[0m`),
  success: (msg: string) => console.log(`\x1b[32m✅ ${msg}\x1b[0m`),
  warn: (msg: string) => console.warn(`\x1b[33m⚠️ ${msg}\x1b[0m`),
  step: (title: string) => console.log(`\n\x1b[36m--- ${title} ---\x1b[0m`),
  dim: (msg: string) => console.log(`\x1b[90m${msg}\x1b[0m`),
};

const BATCH_SIZE = 400;

async function main() {
    console.log('\n\x1b[1m\x1b[35m🚀 Starting Beneficiary Migration Script...\x1b[0m');

    if (!adminDb) {
        log.error('Firebase Admin SDK not initialized. Is `serviceAccountKey.json` present? Aborting.');
        process.exit(1);
    }
    
    log.info('This script will sync beneficiaries from all campaigns and leads to the master /beneficiaries collection.');

    try {
        let addedCount = 0;
        const masterBeneficiarySnaps = await adminDb.collection('beneficiaries').get();
        const masterBeneficiaryIds = new Set(masterBeneficiarySnaps.docs.map(doc => doc.id));
        const beneficiariesToSync: Map<string, any> = new Map();
        
        const processSubcollection = async (parentCollection: 'campaigns' | 'leads') => {
            const parentSnaps = await adminDb.collection(parentCollection).get();
            log.dim(`Checking ${parentSnaps.size} document(s) in '${parentCollection}'...`);
            for (const parentDoc of parentSnaps.docs) {
                const beneficiariesSnap = await parentDoc.ref.collection('beneficiaries').get();
                if (!beneficiariesSnap.empty) {
                    log.dim(`  - Found ${beneficiariesSnap.size} beneficiaries in '${parentDoc.data().name || parentDoc.id}'.`);
                }
                beneficiariesSnap.forEach(doc => {
                    if (!masterBeneficiaryIds.has(doc.id)) {
                        if (!beneficiariesToSync.has(doc.id)) {
                             beneficiariesToSync.set(doc.id, doc.data());
                        }
                    }
                });
            }
        };

        log.step('Scanning subcollections');
        await processSubcollection('campaigns');
        await processSubcollection('leads');
        
        if (beneficiariesToSync.size > 0) {
            log.step(`Found ${beneficiariesToSync.size} new beneficiaries to migrate. Committing to master list...`);
            let batch = adminDb.batch();
            let count = 0;
            
            for (const [id, data] of beneficiariesToSync.entries()) {
                const masterRef = adminDb.collection('beneficiaries').doc(id);
                const dataWithId = { ...data, id }; // Ensure 'id' field is present
                batch.set(masterRef, dataWithId, { merge: true });
                addedCount++;
                count++;

                if (count === BATCH_SIZE) {
                    await batch.commit();
                    log.dim(`   - Committed a batch of ${BATCH_SIZE} beneficiaries.`);
                    batch = adminDb.batch();
                    count = 0;
                }
            }

            if (count > 0) {
                await batch.commit();
                log.dim(`   - Committed final batch of ${count} beneficiaries.`);
            }

            log.success(`\nSuccessfully synced ${addedCount} beneficiaries to the master list.`);
        } else {
            log.success('\nMaster beneficiary list is already up to date. No migration needed.');
        }

    } catch (error: any) {
        console.error('Error during beneficiary migration:', error);
        log.error(`An unexpected error occurred: ${error.message}`);
        process.exit(1);
    }
}

main().catch(console.error);
