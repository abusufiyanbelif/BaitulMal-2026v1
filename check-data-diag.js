const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkData() {
  console.log('--- Checking Branding ---');
  const brandingDoc = await db.collection('settings').doc('branding').get();
  if (brandingDoc.exists) {
    console.log('Branding Data:', JSON.stringify(brandingDoc.data(), null, 2));
  } else {
    console.log('Branding document does NOT exist!');
  }

  console.log('\n--- Checking Public Campaigns ---');
  const campaigns = await db.collection('campaigns')
    .where('authenticityStatus', '==', 'Verified')
    .where('publicVisibility', '==', 'Published')
    .get();
  console.log('Count:', campaigns.size);
  campaigns.forEach(doc => {
    console.log(`- ${doc.id}: ${doc.data().name}`);
  });

  console.log('\n--- Checking Public Leads ---');
  const leads = await db.collection('leads')
    .where('authenticityStatus', '==', 'Verified')
    .where('publicVisibility', '==', 'Published')
    .get();
  console.log('Count:', leads.size);
  leads.forEach(doc => {
    console.log(`- ${doc.id}: ${doc.data().name}`);
  });
}

checkData().catch(console.error);
