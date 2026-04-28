const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function getBranding() {
  try {
    const doc = await db.collection('settings').doc('branding').get();
    if (doc.exists) {
      console.log('Branding settings:');
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('Branding document does not exist!');
    }
  } catch (error) {
    console.error('Error fetching branding:', error);
  }
}

getBranding();
