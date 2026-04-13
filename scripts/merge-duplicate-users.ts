
import { getAdminServices } from '../src/lib/firebase-admin-sdk';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * DEEP SCAN & MERGE SCRIPT
 * Resolves "Split Person Syndrome" where one individual has multiple user profiles.
 * Prioritizes Admin/Member accounts and merges redundant "Donor Only" user docs.
 */
async function mergeDuplicateUsers() {
    console.log('🔍 Starting Deep Identity Scan & Merge...');
    const { adminDb } = getAdminServices();
    if (!adminDb) throw new Error("Admin SDK Not Initialized.");

    try {
        const usersSnap = await adminDb.collection('users').get();
        const donorsSnap = await adminDb.collection('donors').get();
        const donationsSnap = await adminDb.collection('donations').get();

        const usersByPhone: Record<string, any[]> = {};
        
        usersSnap.forEach(doc => {
            const data = doc.data();
            const phone = data.phone?.replace(/\D/g, '');
            if (phone && phone.length >= 10) {
                if (!usersByPhone[phone]) usersByPhone[phone] = [];
                usersByPhone[phone].push({ id: doc.id, ...data });
            }
        });

        let mergedCount = 0;
        let donationReassignedCount = 0;

        for (const phone in usersByPhone) {
            const profiles = usersByPhone[phone];
            if (profiles.length < 2) continue;

            // Sort: Admin first, then User, then Donor/Beneficiary roles
            profiles.sort((a, b) => {
                const rolePriority: Record<string, number> = { 'Admin': 0, 'User': 1, 'Donor': 2, 'Beneficiary': 3 };
                return (rolePriority[a.role] ?? 99) - (rolePriority[b.role] ?? 99);
            });

            const primary = profiles[0];
            const redundants = profiles.slice(1);

            console.log(`\n💎 Person identified at ${phone}:`);
            console.log(`   KEEPING Primary ID: ${primary.id} (Role: ${primary.role})`);

            const batch = adminDb.batch();

            for (const redundant of redundants) {
                console.log(`   MERGING Redundant ID: ${redundant.id} (Role: ${redundant.role})`);

                // 1. Reassign all donations pointing to redundant ID
                const badDonations = donationsSnap.docs.filter(d => d.data().donorId === redundant.id);
                badDonations.forEach(d => {
                    batch.update(d.ref, { 
                        donorId: primary.id,
                        updatedAt: FieldValue.serverTimestamp(),
                        notes: (d.data().notes || '') + ` (Identity reassigned from ${redundant.id})`
                    });
                    donationReassignedCount++;
                });

                // 2. Ensure Donor profile points to Primary ID
                const donorRef = adminDb.collection('donors').doc(primary.id);
                const oldDonorRef = adminDb.collection('donors').doc(redundant.id);
                
                // If a donor record existed for the redundant ID, we check if one exists for primary
                const oldDonorSnap = await oldDonorRef.get();
                if (oldDonorSnap.exists) {
                    batch.set(donorRef, {
                        ...oldDonorSnap.data(),
                        id: primary.id,
                        updatedAt: FieldValue.serverTimestamp()
                    }, { merge: true });
                    batch.delete(oldDonorRef);
                }

                // 3. Delete the redundant user document
                batch.delete(adminDb.collection('users').doc(redundant.id));
                
                // 4. Cleanup user lookups
                if (redundant.loginId) batch.delete(adminDb.collection('user_lookups').doc(redundant.loginId));
                if (redundant.phone) batch.delete(adminDb.collection('user_lookups').doc(redundant.phone));
                
                mergedCount++;
            }

            await batch.commit();
        }

        console.log(`\n✅ Audit Complete.`);
        console.log(`   Merged Profiles: ${mergedCount}`);
        console.log(`   Reassigned Donations: ${donationReassignedCount}`);
        process.exit(0);
    } catch (error: any) {
        console.error("❌ Merge Script Failed:", error);
        process.exit(1);
    }
}

mergeDuplicateUsers();
