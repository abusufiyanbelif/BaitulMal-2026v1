'use server';

import { getAdminServices } from '@/lib/firebase-admin-sdk';

export async function runPhoneMigrationAction() {
    const { adminDb } = getAdminServices();
    if (!adminDb) return { success: false, message: "Admin SDK Offline" };

    try {
        let totalUpdated = 0;
        let totalLookupsCreated = 0;
        let totalMirrorsCreated = 0;

        function cleanPhone(phone: any): string {
            if (!phone) return '';
            const str = String(phone).trim();
            const digits = str.replace(/\D/g, '');
            return digits.length >= 10 ? digits.slice(-10) : digits;
        }

        const collections = ['donors', 'beneficiaries', 'users'];
        
        for (const col of collections) {
            const snapshot = await adminDb.collection(col).get();
            let batch = adminDb.batch();
            let batchCount = 0;

            for (const doc of snapshot.docs) {
                const data = doc.data();
                const id = doc.id;
                const role = col === 'donors' ? 'Donor' : (col === 'beneficiaries' ? 'Beneficiary' : (data.role || 'User'));
                
                const rawPhone = data.phone || data.loginId || '';
                const cleaned = cleanPhone(rawPhone);
                
                const updates: any = {};
                let docModified = false;

                // 1. Standardize Password if missing
                if (!data.password) {
                    updates.password = 'password';
                    docModified = true;
                }

                // 2. Standardize Phone
                if (cleaned && cleaned.length === 10 && cleaned !== rawPhone) {
                    updates.phone = cleaned;
                    if (data.loginId) updates.loginId = cleaned;
                    docModified = true;
                }

                if (docModified) {
                    batch.update(doc.ref, updates);
                    totalUpdated++;
                    batchCount++;
                }

                // 3. Ensure Lookup Entry
                if (cleaned && cleaned.length === 10) {
                    const lookupRef = adminDb.collection('user_lookups').doc(cleaned);
                    batch.set(lookupRef, {
                        userKey: id,
                        role: role,
                        phone: cleaned,
                        name: data.name || 'User'
                    }, { merge: true });
                    totalLookupsCreated++;
                    batchCount++;
                }

                // 4. Ensure Mirrored User in 'users' collection
                if (col !== 'users') {
                    const userRef = adminDb.collection('users').doc(id);
                    batch.set(userRef, {
                        ...data,
                        ...updates,
                        id: id,
                        role: role,
                        loginId: cleaned || id,
                        userKey: id,
                        password: data.password || updates.password || 'password'
                    }, { merge: true });
                    totalMirrorsCreated++;
                    batchCount++;
                }

                if (batchCount >= 450) {
                    await batch.commit();
                    batch = adminDb.batch();
                    batchCount = 0;
                }
            }
            if (batchCount > 0) await batch.commit();
        }

        // Cleanup stale user_lookups (optional, but let's at least clean the IDs)
        const lookupsSnap = await adminDb.collection('user_lookups').get();
        let cleanupBatch = adminDb.batch();
        let cleanupCount = 0;
        for (const doc of lookupsSnap.docs) {
            const cleanedId = cleanPhone(doc.id);
            if (cleanedId !== doc.id && cleanedId.length === 10) {
                cleanupBatch.set(adminDb.collection('user_lookups').doc(cleanedId), doc.data());
                cleanupBatch.delete(doc.ref);
                cleanupCount++;
            }
            if (cleanupCount >= 450) {
                await cleanupBatch.commit();
                cleanupBatch = adminDb.batch();
                cleanupCount = 0;
            }
        }
        if (cleanupCount > 0) await cleanupBatch.commit();

        return { 
            success: true, 
            message: `Deep Repair Complete. Updated ${totalUpdated} profiles, ensured ${totalLookupsCreated} lookups, and ${totalMirrorsCreated} mirrors.` 
        };
    } catch (error: any) {
        console.error("Migration Error:", error);
        return { success: false, message: error.message };
    }
}

