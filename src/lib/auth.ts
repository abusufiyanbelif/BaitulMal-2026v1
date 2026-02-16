'use client';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  Auth,
} from 'firebase/auth';
import { 
    Firestore, 
    doc,
    getDoc
} from 'firebase/firestore';

export const signInWithLoginId = async (auth: Auth, firestore: Firestore, loginId: string, password?: string) => {
    
    // This could be a loginId or a phone number
    const lookupDocRef = doc(firestore, 'user_lookups', loginId);
    
    try {
        const lookupDoc = await getDoc(lookupDocRef);

        if (!lookupDoc.exists()) {
            throw new Error('User not found. Please check your Login ID or Phone Number.');
        }
        
        const email = lookupDoc.data()?.email;
        if (!email) {
            throw new Error('Authentication configuration error for this user. Email is missing from lookup.');
        }
        
        if (!password) {
            throw new Error('Password is required.');
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Post-login check to ensure the user is active.
        const userDocRef = doc(firestore, 'users', userCredential.user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().status === 'Inactive') {
            await firebaseSignOut(auth); // Sign the user out immediately
            throw new Error('This account has been deactivated. Please contact an administrator.');
        } else if (!userDocSnap.exists()) {
            await firebaseSignOut(auth);
            throw new Error('User profile not found in database. Please contact an administrator.');
        }
        
        return userCredential;

    } catch (error: any) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
             throw new Error("Invalid credentials. Please check your Login ID, Phone Number, or Password.");
        }
        if (error.code === 'auth/configuration-not-found') {
             throw error; // Re-throw to be handled by the UI
        }
        if (error.code === 'auth/too-many-requests') {
            throw new Error("Access temporarily disabled due to too many failed login attempts. Please reset your password or try again later.");
        }
        // Re-throw our custom errors
        if (error.message.includes('deactivated') || error.message.includes('User not found') || error.message.includes('configuration error')) {
            throw error;
        }
        console.error("signInWithLoginId unexpected error:", error);
        throw new Error('An unexpected error occurred during sign-in.');
    }
};

export const signOut = async (auth: Auth) => {
  return firebaseSignOut(auth);
};