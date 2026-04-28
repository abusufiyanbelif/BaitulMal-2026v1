const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function getUser() {
  try {
    const doc = await db.collection('users').doc('cyMl1lQME0Yur1YS3VCms1AvrOJ2').get();
    if (doc.exists) {
      console.log('User profile cyMl1lQME0Yur1YS3VCms1AvrOJ2:');
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('User document cyMl1lQME0Yur1YS3VCms1AvrOJ2 does not exist!');
    }
  } catch (error) {
    console.error('Error fetching user:', error);
  }
}

getUser();
