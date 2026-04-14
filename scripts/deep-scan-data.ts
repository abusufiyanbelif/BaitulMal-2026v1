import { getAdminServices } from '../src/lib/firebase-admin-sdk';

/**
 * Validates integrity between users and their corresponding module profiles.
 */
async function scanProfiles() {
    console.log('🔍 Starting Deep Database Scan for Role & Profile Integrity...');
    const { adminDb } = getAdminServices();
    if (!adminDb) throw new Error("Admin SDK Not Initialized.");

    const usersSnap = await adminDb.collection('users').get();
    const donorsSnap = await adminDb.collection('donors').get();
    const beneficiariesSnap = await adminDb.collection('beneficiaries').get();

    console.log(`Total Users: ${usersSnap.size}`);
    console.log(`Total Donors: ${donorsSnap.size}`);
    console.log(`Total Beneficiaries: ${beneficiariesSnap.size}`);

    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const donors = donorsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const beneficiaries = beneficiariesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    let issues = 0;

    // Check Users
    for (const user of users) {
        // Validate Donor mappings
        if (user.role === 'Donor' || user.linkedDonorId) {
            const donorId = user.linkedDonorId || user.id;
            const donorExists = donors.find(d => d.id === donorId);
            if (!donorExists) {
                console.log(`❌ User ${user.name} (${user.id}) is a Donor but has NO donor profile (looked for ID: ${donorId}).`);
                issues++;
            }
        }
        
        // Validate Beneficiary mappings
        if (user.role === 'Beneficiary' || user.linkedBeneficiaryId) {
            const benId = user.linkedBeneficiaryId || user.id;
            const benExists = beneficiaries.find(b => b.id === benId);
            if (!benExists) {
                console.log(`❌ User ${user.name} (${user.id}) is a Beneficiary but has NO beneficiary profile (looked for ID: ${benId}).`);
                issues++;
            }
        }

        // Validate multiple roles/links mismatch
        if (user.role === 'Admin' || user.role === 'User') {
            if (!user.linkedDonorId) {
                // Should admins have a donor profile? If they don't, making a donation might fail or leave donorId missing.
                console.log(`⚠️ User ${user.name} (${user.id}) [${user.role}] has no linkedDonorId. If they donate, it might fragment.`);
            }
        }

        if(!user.email && !user.phone) {
             console.log(`❌ User ${user.name} (${user.id}) has neither phone nor email!`);
             issues++;
        }
    }

    // Check Donors for missing users
    for (const donor of donors) {
        const userExists = users.find(u => u.id === donor.id || u.linkedDonorId === donor.id);
        if (!userExists) {
            console.log(`⚠️ Orphan Donor: ${donor.name} (${donor.id}) has NO connected User record.`);
        }
    }

    // Check Beneficiaries for missing users
    for (const ben of beneficiaries) {
        const userExists = users.find(u => u.id === ben.id || u.linkedBeneficiaryId === ben.id);
        if (!userExists) {
            console.log(`⚠️ Orphan Beneficiary: ${ben.name} (${ben.id}) has NO connected User record. This might be fine if they haven't logged in.`);
        }
    }

    console.log(`\n✅ Scan Complete. Total severe issues found: ${issues}`);
}

scanProfiles();
