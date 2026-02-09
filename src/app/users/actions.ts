
'use server';

import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin-sdk';
import type { UserProfile } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import type { UserFormData } from '@/components/user-form';

export async function createUserAuthAction(data: UserFormData): Promise<{ success: boolean; message: string; uid?: string; }> {
  if (!adminAuth) {
    return { success: false, message: 'Firebase Admin SDK is not initialized.' };
  }
  try {
    const userRecord = await adminAuth.createUser({
      email: data.email,
      emailVerified: true,
      password: data.password,
      displayName: data.name,
      phoneNumber: data.phone ? `+91${data.phone}` : undefined,
    });
    return { success: true, message: 'User created in Firebase Auth.', uid: userRecord.uid };
  } catch (error: any) {
    let message = 'An unexpected error occurred during user creation.';
    if (error.code === 'auth/email-already-exists') {
      message = 'This email address is already in use by another account.';
    } else if (error.code === 'auth/phone-number-already-exists') {
      message = 'This phone number is already in use by another account.';
    } else if (error.code === 'auth/invalid-password') {
      message = 'The password must be a string with at least six characters.';
    }
    console.error('createUserAuthAction Error:', error);
    return { success: false, message };
  }
}

export async function deleteUserAction(uidToDelete: string): Promise<{ success: boolean; message: string }> {
  if (!adminAuth || !adminDb || !adminStorage) {
    const errorMessage = 'Firebase Admin SDK is not initialized. User deletion cannot proceed.';
    console.error(errorMessage);
    return { success: false, message: errorMessage };
  }

  try {
    // In a production app, you would add robust auth checks here to ensure
    // the calling user is an administrator. For this starter, we rely on the
    // client-side checks that prevent non-admins from even seeing the delete button.

    const userRecord = await adminAuth.getUser(uidToDelete);
    const userProfileRef = adminDb.collection('users').doc(uidToDelete);
    const userProfileSnap = await userProfileRef.get();
    const userProfile = userProfileSnap.data() as UserProfile | undefined;

    // 1. Delete from Firebase Auth
    await adminAuth.deleteUser(uidToDelete);
    
    // 2. Delete from Firestore (user profile and lookups)
    const batch = adminDb.batch();
    batch.delete(userProfileRef);
    if (userProfile?.loginId) {
        batch.delete(adminDb.collection('user_lookups').doc(userProfile.loginId));
    }
    if (userProfile?.phone) {
        batch.delete(adminDb.collection('user_lookups').doc(userProfile.phone));
    }
    if (userProfile?.userKey) {
        batch.delete(adminDb.collection('user_lookups').doc(userProfile.userKey));
    }
    await batch.commit();

    // 3. Delete from Storage
    if (userProfile?.idProofUrl) {
      try {
        const url = new URL(userProfile.idProofUrl);
        const filePath = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
        await adminStorage.bucket().file(filePath).delete();
      } catch (storageError) {
        console.error(`Could not delete storage file for user ${uidToDelete}. It may not exist.`, storageError);
      }
    }

    revalidatePath('/users');
    return { success: true, message: `User '${userRecord.displayName || userRecord.email}' has been completely deleted.` };

  } catch (error: any) {
    console.error('Error in deleteUserAction:', error);
    let message = 'An unexpected error occurred during user deletion.';
    if (error.code === 'auth/user-not-found') {
        // This can happen if the user was already deleted from auth but not from the db.
        // In this case, we can proceed to clean up the DB records.
        message = 'User not found in Firebase Authentication, but proceeding with database cleanup.';
        console.warn(message);
        try {
            const userProfileRef = adminDb.collection('users').doc(uidToDelete);
            await userProfileRef.delete();
            revalidatePath('/users');
            return { success: true, message: 'User was already deleted from Auth. Database records cleaned up.' };
        } catch (dbError) {
            return { success: false, message: 'User not found in Auth, and failed to clean up database records.' };
        }
    } else if (error.code === 'permission-denied') {
        message = 'You do not have permission to perform this action.';
    }
    return { success: false, message: message };
  }
}

export async function updateUserAuthAction(uid: string, updates: { email?: string; password?: string }): Promise<{ success: boolean, message: string }> {
    if (!adminAuth) {
        const errorMessage = 'Firebase Admin SDK is not initialized. User update cannot proceed.';
        console.error(errorMessage);
        return { success: false, message: errorMessage };
    }
    try {
        await adminAuth.updateUser(uid, updates);
        revalidatePath('/users');
        revalidatePath(`/users/edit/${uid}`);
        return { success: true, message: 'User authentication details updated successfully.'};
    } catch (error: any) {
        console.error('Error in updateUserAuthAction:', error);
        let message = 'An unexpected error occurred during user auth update.';
         if (error.code === 'auth/email-already-exists') {
            message = 'The email address is already in use by another account.';
        } else if (error.code === 'auth/user-not-found') {
            message = 'User not found in Firebase Authentication.';
        }
        return { success: false, message: message };
    }
}
