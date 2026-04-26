import { getAdminServices } from './src/lib/firebase-admin-sdk';
import { createAdminPermissions } from './src/lib/modules';

async function migrateUserPermissions() {
    const { adminDb } = getAdminServices();
    if (!adminDb) return;

    const usersSnap = await adminDb.collection('users').get();
    console.log(`Found ${usersSnap.size} users to check.`);

    const batch = adminDb.batch();
    let count = 0;

    usersSnap.forEach(doc => {
        const data = doc.data();
        
        // If it's an Admin, ensure they have full permissions in the new schema
        if (data.role === 'Admin') {
            const newPerms = createAdminPermissions();
            batch.update(doc.ref, { permissions: newPerms });
            count++;
        } 
        // For regular users, we might need a more complex mapping from canView -> read, etc.
        else if (data.permissions && data.permissions.campaigns && data.permissions.campaigns.canView !== undefined) {
            const oldPerms = data.permissions;
            const newPerms: any = {};
            
            // Mapping helper
            const mapPerms = (old: any) => ({
                create: old.canAdd || false,
                read: old.canView || false,
                update: old.canEdit || false,
                delete: old.canDelete || false
            });

            // Map top-level modules
            for (const [key, val] of Object.entries(oldPerms)) {
                if (typeof val === 'object' && val !== null) {
                    newPerms[key] = mapPerms(val);
                }
            }
            
            batch.update(doc.ref, { permissions: newPerms });
            count++;
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
