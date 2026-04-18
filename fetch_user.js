const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // wait, do we have credentials?

// Try default credentials first
admin.initializeApp({ projectId: "docuextract-q8vaa" });
const db = admin.firestore();
async function run() {
  try {
    const doc = await db.collection('users').doc('cyMl1lQME0Yur1YS3VCms1AvrOJ2').get();
    console.log(doc.data());
  } catch (e) {
    console.error(e);
  }
}
run();
