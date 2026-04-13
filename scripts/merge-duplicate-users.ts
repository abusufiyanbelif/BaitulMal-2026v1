import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Sanitizes an object by removing all undefined values.
 */
function sanitizePayload(data: Record<string, any>) {
    const sanitized: Record<string, any> = {};
    Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
            sanitized[key] = data[key];
        }
    });
    return sanitized;
}

/**
 * UNIFIED IDENTITY CONSOLIDATION SCRIPT
 * Consolidates fragmented profiles into a primary "Golden Record".
 * Atomic update of financial records, management logs, and authorship audit trails.
 */
async function mergeDuplicateIdentities() {
    console.log('🔍 Starting Deep Identity Scan & Integration...');
    const { adminDb } = getAdminServices();
    if (!adminDb) throw new Error("Admin SDK Not Initialized.");

    try {
        const usersSnap = await adminDb.collection('users').get();
        const donationsSnap = await adminDb.collection('donations').get();

        const identityGroups: Record<string, any[]> = {};
        
        // Group by Phone and Email to find fragments
        usersSnap.forEach(doc => {
            const data = doc.data();
            const phone = data.phone?.replace(/\D/g, '');
            const email = data.email?.toLowerCase().trim();
            
            const keys = [phone, email].filter(Boolean) as string[];
            
            keys.forEach(key => {
                if (!identityGroups[key]) identityGroups[key] = [];
                if (!identityGroups[key].find((u: any) => u.id === doc.id)) {
                    identityGroups[key].push({ id: doc.id, ...data });
                }
            });
        });

        let mergedCount = 0;
        let recordsProcessed = 0;

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

            console.log(`\n💎 Consolidating Identity Cluster: ${primary.name} (${key})`);
            console.log(`   PRIMARY GOLDEN ID: ${primary.id} (Role: ${primary.role})`);

            const batch = adminDb.batch();
            const mergedPermissions = { ...(primary.permissions || {}) };
            let primaryLinkedDonorId = primary.linkedDonorId || primary.id;
            let primaryLinkedBeneficiaryId = primary.linkedBeneficiaryId;

            for (const redundant of redundants) {
                console.log(`   Merging Redundant Fragment: ${redundant.id} (Role: ${redundant.role})`);

                // 1. Merge Permissions
                if (redundant.permissions) {
                    Object.keys(redundant.permissions).forEach(mod => {
                        if (!mergedPermissions[mod]) mergedPermissions[mod] = {};
                        Object.assign(mergedPermissions[mod], redundant.permissions[mod]);
                    });
                }

                if (redundant.linkedDonorId) primaryLinkedDonorId = redundant.linkedDonorId;
                if (redundant.linkedBeneficiaryId) primaryLinkedBeneficiaryId = redundant.linkedBeneficiaryId;

                // 2. Re-assign all DONATIONS pointing to redundant UID
                const linkedDonations = donationsSnap.docs.filter(d => d.data().donorId === redundant.id);
                linkedDonations.forEach(d => {
                    batch.update(d.ref, { 
                        donorId: primary.id,
                        updatedAt: FieldValue.serverTimestamp(),
                        notes: (d.data().notes || '') + ` (Unified from identity ${redundant.id})`
                    });
                    recordsProcessed++;
                });

                // 3. Update AUDIT TRAILS (Everything created/updated by this redundant UID)
                const modules = ['campaigns', 'leads', 'beneficiaries', 'donations'];
                for (const col of modules) {
                    const createdSnap = await adminDb.collection(col).where('createdById', '==', redundant.id).get();
                    createdSnap.forEach(doc => {
                        batch.update(doc.ref, { 
                            createdById: primary.id, 
                            createdByName: primary.name 
                        });
                    });
                    const updatedSnap = await adminDb.collection(col).where('updatedById', '==', redundant.id).get();
                    updatedSnap.forEach(doc => {
                        batch.update(doc.ref, { 
                            updatedById: primary.id, 
                            updatedByName: primary.name 
                        });
                    });
                }

                // 4. Move Master Donor Data
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

                // 5. Purge Redundant records
                batch.delete(adminDb.collection('users').doc(redundant.id));
                if (redundant.loginId) batch.delete(adminDb.collection('user_lookups').doc(redundant.loginId));
                if (redundant.phone) batch.delete(adminDb.collection('user_lookups').doc(redundant.phone));
                
                mergedCount++;
            }

            // SAFE PAYLOAD GENERATOR (Prevents "undefined" crashes)
            const finalUpdate = sanitizePayload({
                permissions: mergedPermissions,
                updatedAt: FieldValue.serverTimestamp(),
                linkedDonorId: primaryLinkedDonorId || null,
                linkedBeneficiaryId: primaryLinkedBeneficiaryId || null
            });

            batch.update(adminDb.collection('users').doc(primary.id), finalUpdate);
            await batch.commit();
        }

        console.log(`\n✅ CONSOLIDATION COMPLETE.`);
        console.log(`   Identities Unified: ${mergedCount}`);
        console.log(`   Audit Trails Updated: ${recordsProcessed} Financial/Management Records.`);
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Consolidation Script Failed:", error);
        process.exit(1);
    }
}

mergeDuplicateIdentities();
