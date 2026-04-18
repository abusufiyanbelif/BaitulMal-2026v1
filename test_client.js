require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, writeBatch } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  try {
    console.log("Signing in...");
    await signInWithEmailAndPassword(auth, "baitulmalss.solapur@gmail.com", process.env.ADMIN_PASSWORD || "somepassword"); // wait, I don't know the password
    console.log("Logged in UID:", auth.currentUser.uid);
    
    const batch = writeBatch(db);
    const campRef = doc(db, 'campaigns', 'jYtOMADlHnAhGZGjmkrh');
    const benRef = doc(db, 'campaigns/jYtOMADlHnAhGZGjmkrh/beneficiaries/someBenId'); // wait, I need a real ben ID
    
    batch.update(campRef, { targetAmount: 200 });
    // batch.update(benRef, { kitAmount: 100 });
    
    await batch.commit();
    console.log("Batch commit SUCCESS");
  } catch (e) {
    console.error("Batch commit FAILED:", e);
  }
}
run();
