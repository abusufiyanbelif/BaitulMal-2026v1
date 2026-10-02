
'use client';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  type Firestore,
} from 'firebase/firestore';

// Helper to set cookie
const setAuthCookie = async (user: any) => {
    if (!user) {
        document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        return;
    }
    const token = await user.getIdToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `auth-token=${token}; path=/; expires=${expires}; SameSite=Strict`;
};

export const signInWithLoginId = async (auth: Auth, firestore: Firestore, loginId: string, password?: string) => {
    let sanitizedLoginId = loginId.trim();
    if (!sanitizedLoginId) {
        throw new Error('Login ID, Phone Number, or Email is required.');
    }
    if (!password) {
        throw new Error('Password is required.');
    }

    let targetEmail: string | null = null;

    // Case 1: Direct email address input
    if (sanitizedLoginId.includes('@')) {
        targetEmail = sanitizedLoginId;
    } else {
        // Case 2: Phone or Login ID
        const numericOnly = sanitizedLoginId.replace(/\D/g, '');
        let alternativeLoginId: string | null = null;
        
        if (numericOnly.length === 10) {
            if (!sanitizedLoginId.startsWith('+')) {
                alternativeLoginId = sanitizedLoginId;
                sanitizedLoginId = '+91' + numericOnly;
            } else {
                alternativeLoginId = numericOnly;
            }
        }

        // Try exact match in user_lookups
        let lookupDocRef = doc(firestore, 'user_lookups', sanitizedLoginId);
        try {
            let lookupDoc = await getDoc(lookupDocRef);

            if (!lookupDoc.exists() && alternativeLoginId) {
                lookupDocRef = doc(firestore, 'user_lookups', alternativeLoginId);
                lookupDoc = await getDoc(lookupDocRef);
            }

            if (!lookupDoc.exists()) {
                lookupDocRef = doc(firestore, 'user_lookups', sanitizedLoginId.toLowerCase());
                lookupDoc = await getDoc(lookupDocRef);
            }

            if (lookupDoc.exists()) {
                targetEmail = lookupDoc.data()?.email || null;
            }

            // Fallback: Query users collection if lookupDoc wasn't found
            if (!targetEmail) {
                const usersRef = collection(firestore, 'users');
                const queriesToTry = [
                    query(usersRef, where('loginId', '==', sanitizedLoginId), limit(1)),
                    query(usersRef, where('loginId', '==', sanitizedLoginId.toLowerCase()), limit(1)),
                ];
                if (alternativeLoginId) {
                    queriesToTry.push(query(usersRef, where('phone', '==', alternativeLoginId), limit(1)));
                    queriesToTry.push(query(usersRef, where('phone', '==', `+91${alternativeLoginId}`), limit(1)));
                }

                for (const q of queriesToTry) {
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        targetEmail = snap.docs[0].data()?.email || null;
                        if (targetEmail) break;
                    }
                }
            }
        } catch (e) {
            console.warn("Lookup resolution error:", e);
        }
    }

    if (!targetEmail) {
        throw new Error('User not found. Please check your Login ID, Phone Number, or Email.');
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
        await setAuthCookie(userCredential.user);

        // Post-login check to ensure the user is active with latency retry mechanism.
        const userDocRef = doc(firestore, 'users', userCredential.user.uid);
        let userDocSnap = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                userDocSnap = await getDoc(userDocRef);
                break;
            } catch (err: any) {
                attempts++;
                if (attempts >= maxAttempts) {
                    console.warn("Firestore Auth token latency detected. Bypassing frontend status check.", err);
                    return userCredential;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        if (userDocSnap && userDocSnap.exists() && userDocSnap.data().status === 'Inactive') {
            await firebaseSignOut(auth); // Sign the user out immediately
            throw new Error('This account has been deactivated. Please contact an administrator.');
        } else if (userDocSnap && !userDocSnap.exists()) {
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
        // Re-throw custom errors
        if (error.message.includes('deactivated') || error.message.includes('User not found') || error.message.includes('configuration error')) {
            throw error;
        }
        console.error("signInWithLoginId unexpected error:", error);
        throw new Error(error.message || 'An unexpected error occurred during sign-in.');
    }
};

export const signOut = async (auth: Auth) => {
  await setAuthCookie(null);
  return firebaseSignOut(auth);
};
