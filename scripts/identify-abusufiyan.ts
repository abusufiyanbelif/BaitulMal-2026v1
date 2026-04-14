import { getAdminServices } from '../src/lib/firebase-admin-sdk';

async function identifyAbusufiyan() {
    const { adminDb } = getAdminServices();
    if (!adminDb) return;

    const usersSnap = await adminDb.collection('users').get();
    
    console.log("Searching for Abusufiyan variations...");
    const targets = [
        "abusufiyan.belif@gmail.com", "7887646583", "abusufiyan.belief", 
        "abusufiyan.belif", "Abusufiyan Belief"
    ].map(s => s.toLowerCase());

    const foundUsers: any[] = [];

    usersSnap.forEach(doc => {
        const data = doc.data();
        let matched = false;
        
        const fields = [
            data.email, data.phone, data.loginId, data.name, data.id
        ];

        for (const field of fields) {
            if (!field) continue;
            const str = String(field).toLowerCase();
            if (targets.some(t => str.includes(t) || t.includes(str))) {
                matched = true;
                break;
            }
        }

        if (matched) {
            foundUsers.push({
                id: doc.id,
                name: data.name,
                email: data.email,
                phone: data.phone,
                loginId: data.loginId,
                role: data.role,
                linkedDonorId: data.linkedDonorId,
                linkedBeneficiaryId: data.linkedBeneficiaryId
            });
        }
    });

    console.log(`Found ${foundUsers.length} matching user records:`);
    console.log(JSON.stringify(foundUsers, null, 2));

    // Also look in donors collection directly just in case there are orphan donors
    const donorsSnap = await adminDb.collection('donors').get();
    const foundDonors: any[] = [];
    donorsSnap.forEach(doc => {
        const data = doc.data();
        let matched = false;
        const fields = [data.email, data.phone, data.name, data.id];
        for (const field of fields) {
            if (!field) continue;
            const str = String(field).toLowerCase();
            if (targets.some(t => str.includes(t) || t.includes(str))) {
                matched = true;
                break;
            }
        }
        if (matched) foundDonors.push({ id: doc.id, name: data.name, phone: data.phone, email: data.email });
    });

    console.log(`\nFound ${foundDonors.length} matching donor records:`);
    console.log(JSON.stringify(foundDonors, null, 2));
}

identifyAbusufiyan().then(() => process.exit(0));
