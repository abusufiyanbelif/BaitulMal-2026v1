import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, writeBatch } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  // We need to parse this from somewhere... wait! The app has a .env or something.
};
