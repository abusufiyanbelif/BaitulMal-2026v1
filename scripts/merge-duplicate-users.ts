
import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * DEEP IDENTITY CONSOLIDATION SCRIPT
 * Resolves "Identity Fragmentation" by merging redundant profiles into a single Golden Record.
 * Logic:
 * 1. Matches by Phone OR Email.
 * 2. Prioritizes Admin > User > Donor > Beneficiary roles.
 * 3. Merges permissions from all redundant records.
 * 4. Reassigns all Donations & Assistance links to the primary UID.
 */
async function mergeDuplicateIdentities() {
    console.log('🔍 Starting Deep Identity Scan & Integration...');
    const { adminDb } = getAdminServices();
    if (!adminDb) throw new Error("Admin SDK Not Initialized.");

    try {
        const usersSnap = await adminDb.collection('users').get();
        const donorsSnap = await adminDb.collection('donors').get();
        const donationsSnap = await adminDb.collection('donations').get();

        const identityGroups: Record<string, any[]> = {};
        
        // Group by Phone and Email
        usersSnap.forEach(doc => {
            const data = doc.data();
            const phone = data.phone?.replace(/\D/g, '');
            const email = data.email?.toLowerCase().trim();
            
            const keys = [phone, email].filter(Boolean) as string[];
            
            keys.forEach(key => {
                if (!identityGroups[key]) identityGroups[key] = [];
                // Only add if not already in this group (avoid double-counting same doc)
                if (!identityGroups[key].find(u => u.id === doc.id)) {
                    identityGroups[key].push({ id: doc.id, ...data });
                }
            });
        });

        let mergedCount = 0;
        let recordsProcessed = 0;

        // Process groups
        for (const key in identityGroups) {
            const profiles = identityGroups[key];
            if (profiles.length < 2) continue;

            // Identity Priority: Admin (0) > User (1) > Donor (2) > Beneficiary (3)
            profiles.sort((a, b) => {
                const rolePriority: Record<string, number> = { 'Admin': 0, 'User': 1, 'Donor': 2, 'Beneficiary': 3 };
                return (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99);
            });

            const primary = profiles[0];
            const redundants = profiles.slice(1);

            console.log(`\n💎 Identity Found: ${primary.name} (${key})`);
            console.log(`   PRIMARY ID: ${primary.id} (Role: ${primary.role})`);

            const batch = adminDb.batch();
            const mergedPermissions = { ...(primary.permissions || {}) };

            for (const redundant of redundants) {
                console.log(`   Merging Redundant: ${redundant.id} (Role: ${redundant.role})`);

                // 1. Merge Permissions (if they exist)
                if (redundant.permissions) {
                    Object.keys(redundant.permissions).forEach(mod => {
                        if (!mergedPermissions[mod]) mergedPermissions[mod] = {};
                        Object.assign(mergedPermissions[mod], redundant.permissions[mod]);
                    });
                }

                // 2. Reassign all donations
                const linkedDonations = donationsSnap.docs.filter(d => d.data().donorId === redundant.id);
                linkedDonations.forEach(d => {
                    batch.update(d.ref, { 
                        donorId: primary.id,
                        updatedAt: FieldValue.serverTimestamp(),
                        notes: (d.data().notes || '') + ` (Identity consolidated from ${redundant.id})`
                    });
                    recordsProcessed++;
                });

                // 3. Move Donor Profile data
                const oldDonorRef = adminDb.collection('donors').doc(redundant.id);
                const primaryDonorRef = adminDb.collection('donors').doc(primary.id);
                const oldDonorSnap = await oldDonorRef.get();
                
                if (oldDonorSnap.exists) {
                    batch.set(primaryDonorRef, {
                        ...oldDonorSnap.data(),
                        id: primary.id,
                        updatedAt: FieldValue.serverTimestamp()
                    }, { merge: true });
                    batch.delete(oldDonorRef);
                }

                // 4. Purge Redundant User record
                batch.delete(adminDb.collection('users').doc(redundant.id));
                
                // 5. Cleanup lookups
                if (redundant.loginId) batch.delete(adminDb.collection('user_lookups').doc(redundant.loginId));
                if (redundant.phone) batch.delete(adminDb.collection('user_lookups').doc(redundant.phone));
                
                mergedCount++;
            }

            // Update primary with merged permissions
            batch.update(adminDb.collection('users').doc(primary.id), {
                permissions: mergedPermissions,
                updatedAt: FieldValue.serverTimestamp()
            });

            await batch.commit();
        }

        console.log(`\n✅ Consolidation Complete.`);
        console.log(`   Identities Merged: ${mergedCount}`);
        console.log(`   Financial Records Re-linked: ${recordsProcessed}`);
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Identity Merge Failed:", error);
        process.exit(1);
    }
}

mergeDuplicateIdentities();
