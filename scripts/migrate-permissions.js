const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

async function migrateUserPermissions() {
    if (getApps().length === 0) {
        const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            initializeApp({ credential: cert(serviceAccountPath) });
        } else {
            initializeApp();
        }
    }

    const adminDb = getFirestore();
    const usersSnap = await adminDb.collection('users').get();
    console.log(`Found ${usersSnap.size} users to check.`);

    const batch = adminDb.batch();
    let count = 0;

    usersSnap.forEach(doc => {
        const data = doc.data();
        
        // Check for old schema (canView)
        if (data.permissions && data.permissions.campaigns && data.permissions.campaigns.canView !== undefined) {
            const oldPerms = data.permissions;
            const newPerms = {};
            
            const mapPerms = (old) => ({
                create: old.canAdd || false,
                read: old.canView || false,
                update: old.canEdit || false,
                delete: old.canDelete || false
            });

            for (const [key, val] of Object.entries(oldPerms)) {
                if (typeof val === 'object' && val !== null) {
                    newPerms[key] = mapPerms(val);
                }
            }
            
            // For Admins, ensure they have full access including the new 'messages' module
            if (data.role === 'Admin') {
                newPerms.messages = { create: true, read: true, update: true, delete: true };
                newPerms.settings = { ...newPerms.settings, resources: { create: true, read: true, update: true, delete: true } };
            }

            batch.update(doc.ref, { permissions: newPerms });
            count++;
        } else if (data.role === 'Admin') {
            // Even if it's the new schema, ensure 'messages' is there for Admins
            const perms = data.permissions || {};
            if (!perms.messages) {
                perms.messages = { create: true, read: true, update: true, delete: true };
                batch.update(doc.ref, { permissions: perms });
                count++;
            }
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`Successfully migrated ${count} user permission profiles.`);
    } else {
        console.log('No migration needed.');
    }
}

migrateUserPermissions().catch(console.error);
