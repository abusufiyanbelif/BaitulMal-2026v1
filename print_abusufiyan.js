const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function getUser() {
  try {
    const doc = await db.collection('users').doc('S5efNV5jpTPoxYNv6SnAlv3jNPO2').get();
    if (doc.exists) {
      console.log('User profile S5efNV5jpTPoxYNv6SnAlv3jNPO2 (Abusufiyan):');
      console.log(JSON.stringify(doc.data(), null, 2));
    } else {
      console.log('User document S5efNV5jpTPoxYNv6SnAlv3jNPO2 does not exist!');
    }
  } catch (error) {
    console.error('Error fetching user:', error);
  }
}

getUser();
