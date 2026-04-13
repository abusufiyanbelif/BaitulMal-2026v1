import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Sanitizes an object by removing all undefined values.
 * Essential to prevent Firestore WriteBatch crashes.
 */
function sanitizePayload(data: Record<string, any>) {
    const sanitized: Record<string, any> = {};
    Object.keys(data).forEach(key => {
        if (data[key] !== undefined && data[key] !== null) {
            sanitized[key] = data[key];
        } else if (data[key] === null) {
            sanitized[key] = null;
        }
    });
    return sanitized;
}

/**
 * SYSTEM-WIDE IDENTITY CONSOLIDATION SCRIPT
 * Unifies fragmented identities and rewrites historical authorship across all modules.
 */
async function mergeDuplicateIdentities() {
    console.log('🔍 Starting Deep Identity Scan & Systemic Integration...');
    const { adminDb } = getAdminServices();
    if (!adminDb) throw new Error("Admin SDK Not Initialized.");

    try {
        const usersSnap = await adminDb.collection('users').get();
        const donationsSnap = await adminDb.collection('donations').get();

        const identityGroups: Record<string, any[]> = {};
        
        // Group by Phone and Email to discover all fragments
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
        let auditRecordsUpdated = 0;

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

            console.log(`\n💎 Unifying Identity Cluster: ${primary.name} (${key})`);
            console.log(`   PRIMARY GOLDEN ID: ${primary.id} (Role: ${primary.role})`);

            const batch = adminDb.batch();
            const mergedPermissions = { ...(primary.permissions || {}) };

            for (const redundant of redundants) {
                console.log(`   Consolidating Redundant Fragment: ${redundant.id} (Role: ${redundant.role})`);

                // 1. Merge Permissions
                if (redundant.permissions) {
                    Object.keys(redundant.permissions).forEach(mod => {
                        if (!mergedPermissions[mod]) mergedPermissions[mod] = {};
                        Object.assign(mergedPermissions[mod], redundant.permissions[mod]);
                    });
                }

                // 2. Re-assign all DONATIONS pointing to redundant UID
                const linkedDonations = donationsSnap.docs.filter(d => d.data().donorId === redundant.id || d.data().uploadedById === redundant.id);
                linkedDonations.forEach(d => {
                    const updates: any = { updatedAt: FieldValue.serverTimestamp() };
                    if (d.data().donorId === redundant.id) {
                        updates.donorId = primary.id;
                        updates.donorName = primary.name;
                    }
                    if (d.data().uploadedById === redundant.id) {
                        updates.uploadedById = primary.id;
                        updates.uploadedBy = primary.name;
                    }
                    batch.update(d.ref, updates);
                    auditRecordsUpdated++;
                });

                // 3. Update SYSTEMIC AUDIT TRAILS (Campaigns, Leads, Beneficiaries)
                const modules = ['campaigns', 'leads', 'beneficiaries'];
                for (const col of modules) {
                    const createdSnap = await adminDb.collection(col).where('createdById', '==', redundant.id).get();
                    createdSnap.forEach(doc => {
                        batch.update(doc.ref, { 
                            createdById: primary.id, 
                            createdByName: primary.name 
                        });
                        auditRecordsUpdated++;
                    });
                    const updatedSnap = await adminDb.collection(col).where('updatedById', '==', redundant.id).get();
                    updatedSnap.forEach(doc => {
                        batch.update(doc.ref, { 
                            updatedById: primary.id, 
                            updatedByName: primary.name 
                        });
                        auditRecordsUpdated++;
                    });
                }

                // 4. Migrate Master Role Profiles
                const oldDonorRef = adminDb.collection('donors').doc(redundant.id);
                const primaryDonorRef = adminDb.collection('donors').doc(primary.id);
                const oldDonorSnap = await oldDonorRef.get();
                if (oldDonorSnap.exists) {
                    batch.set(primaryDonorRef, sanitizePayload({
                        ...oldDonorSnap.data(),
                        id: primary.id,
                        updatedAt: FieldValue.serverTimestamp()
                    }), { merge: true });
                    batch.delete(oldDonorRef);
                }

                // 5. Purge Redundant Identity Records
                batch.delete(adminDb.collection('users').doc(redundant.id));
                if (redundant.loginId) batch.delete(adminDb.collection('user_lookups').doc(redundant.loginId));
                if (redundant.phone) batch.delete(adminDb.collection('user_lookups').doc(redundant.phone));
                
                mergedCount++;
            }

            // 6. Finalize Primary "Golden Record"
            const finalUpdate = sanitizePayload({
                permissions: mergedPermissions,
                updatedAt: FieldValue.serverTimestamp(),
                linkedDonorId: primary.id,
                linkedBeneficiaryId: primary.linkedBeneficiaryId || null
            });

            batch.update(adminDb.collection('users').doc(primary.id), finalUpdate);
            await batch.commit();
        }

        console.log(`\n✅ CONSOLIDATION COMPLETE.`);
        console.log(`   Identities Unified: ${mergedCount}`);
        console.log(`   Audit Records Re-attributed: ${auditRecordsUpdated}`);
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Consolidation Script Failed:", error);
        process.exit(1);
    }
}

mergeDuplicateIdentities();