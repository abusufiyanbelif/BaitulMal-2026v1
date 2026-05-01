
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkBranding() {
  try {
    console.log('Checking settings/branding document...');
    const doc = await db.collection('settings').doc('branding').get();
    if (doc.exists) {
      console.log('✅ Branding document exists:');
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('❌ Branding document MISSING!');
    }

    console.log('\nChecking donations count...');
    const donations = await db.collection('donations').limit(5).get();
    console.log(`✅ Found ${donations.size} donations.`);

    console.log('\nChecking campaigns count...');
    const campaigns = await db.collection('campaigns').limit(5).get();
    console.log(`✅ Found ${campaigns.size} campaigns.`);

  } catch (error) {
    console.error('❌ Error connecting to Firestore:', error);
  } finally {
    process.exit(0);
  }
}

checkBranding();
