const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
    const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath)),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
}

const auth = admin.auth();

async function cleanupDummyUsers() {
    console.log('Fetching users to identify dummy accounts...');
    let nextPageToken;
    let count = 0;
    let deletedCount = 0;

    do {
        const listUsersResult = await auth.listUsers(1000, nextPageToken);
        for (const userRecord of listUsersResult.users) {
            count++;
            if (userRecord.email && userRecord.email.endsWith('@donor.demo.local')) {
                console.log(`Deleting dummy user: ${userRecord.email} (${userRecord.uid})`);
                await auth.deleteUser(userRecord.uid);
                deletedCount++;
            }
        }
        nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`Cleanup complete. Scanned ${count} users. Deleted ${deletedCount} dummy accounts.`);
}

cleanupDummyUsers().catch(console.error);
