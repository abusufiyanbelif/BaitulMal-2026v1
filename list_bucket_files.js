const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'docuextract-q8vaa.firebasestorage.app'
});

const bucket = admin.storage().bucket();

async function listFiles() {
  try {
    const [files] = await bucket.getFiles();
    console.log('Files in bucket:');
    files.forEach(file => {
      console.log(`- ${file.name}`);
    });
  } catch (error) {
    console.error('Error listing files:', error);
  }
}

listFiles();
