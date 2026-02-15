

'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError, useStorage, useMemoFirebase } from '@/firebase';
import { useSession as useCurrentUserSession } from '@/hooks/use-session';
import { updateDoc, doc, writeBatch, DocumentReference } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { createAdminPermissions } from '@/lib/modules';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save, Edit, ShieldAlert } from 'lucide-react';
import { UserForm, type UserFormData } from '@/components/user-form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { updateUserAuthAction } from '../actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function UserDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const { userProfile: currentUserProfile, isLoading: isProfileLoading } = useCurrentUserSession();
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId) as DocumentReference<UserProfile>;
  }, [firestore, userId]);

  const { data: user, isLoading: isUserLoading } = useDoc<UserProfile>(userDocRef);

  const canUpdate = currentUserProfile?.role === 'Admin' || !!currentUserProfile?.permissions?.users?.update;

  const handleSave = async (data: UserFormData) => {
    if (!firestore || !storage || !user || !canUpdate) {
        toast({ title: 'Error', description: 'You do not have permission or services are unavailable.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
    };
    setIsSubmitting(true);

    const isCurrentUserAdmin = currentUserProfile?.role === 'Admin';
    
    // Step 1: Update Firebase Auth if necessary
    let authUpdates: { email?: string } = {};
    if (isCurrentUserAdmin && data.email && data.email !== user.email) {
        authUpdates.email = data.email;
    }

    if (Object.keys(authUpdates).length > 0) {
        const authResult = await updateUserAuthAction(userId, authUpdates);
        if (!authResult.success) {
            toast({
                title: 'Authentication Update Failed',
                description: authResult.message,
                variant: 'destructive',
            });
            setIsSubmitting(false);
            return; // Stop if auth update fails
        }
    }
    
    // Step 2: Handle file uploads
    let idProofUrl = user?.idProofUrl || '';
    try {
        if (data.idProofDeleted && idProofUrl) {
            await deleteObject(storageRef(storage, idProofUrl)).catch((err: any) => {
                if (err.code !== 'storage/object-not-found') {
                    console.warn("Failed to delete old ID proof:", err);
                }
            });
            idProofUrl = '';
        }

        const fileList = data.idProofFile as FileList | undefined;
        if (fileList && fileList.length > 0) {
            const file = fileList[0];
            const { default: Resizer } = await import('react-image-file-resizer');
            const resizedBlob = await new Promise<Blob>((resolve) => {
                 Resizer.imageFileResizer(
                    file, 1024, 1024, 'PNG', 100, 0,
                    (blob: any) => {
                        resolve(blob as Blob);
                    }, 'blob'
                );
            });
            
            const fileExtension = 'png';
            const finalFileName = `id_proof.${fileExtension}`; // Consistent filename
            const filePath = `users/${userId}/${finalFileName}`;
            const fileRef = storageRef(storage, filePath);

            const uploadResult = await uploadBytes(fileRef, resizedBlob);
            idProofUrl = await getDownloadURL(uploadResult.ref);
        }
    } catch (uploadError: any) {
         console.error("Error during file upload:", uploadError);
         toast({ title: 'File Upload Error', description: 'Could not upload ID proof file. Other details were not saved.', variant: 'destructive' });
         setIsSubmitting(false);
         return;
    }

    // Step 3: Update Firestore documents in a batch
    const batch = writeBatch(firestore);
    const docRef = doc(firestore, 'users', userId);
    
    const permissionsToSave = data.role === 'Admin' ? createAdminPermissions() : data.permissions;
    const updateData: Partial<UserProfile> = {
        name: data.name,
        phone: data.phone,
        role: data.role,
        status: data.status,
        permissions: permissionsToSave,
        idProofType: data.idProofType,
        idNumber: data.idNumber,
        idProofUrl,
    };
    
    let newEmail = user.email;
    let newLoginId = user.loginId;

    if (isCurrentUserAdmin) {
        if (data.email && data.email !== user.email) {
            updateData.email = data.email;
            newEmail = data.email;
        }
        if (data.loginId && data.loginId !== user.loginId) {
            updateData.loginId = data.loginId;
            newLoginId = data.loginId;
        }
    }
    
    batch.update(docRef, updateData as any);

    // --- Handle lookup table updates ---
    if (user.loginId !== newLoginId) {
        if (user.loginId) batch.delete(doc(firestore, 'user_lookups', user.loginId));
        if (newLoginId) batch.set(doc(firestore, 'user_lookups', newLoginId), { email: newEmail, userKey: user.userKey });
    } else if (user.email !== newEmail && newLoginId) {
        batch.update(doc(firestore, 'user_lookups', newLoginId), { email: newEmail });
    }
    
    if (user.phone !== data.phone) {
        if (user.phone) batch.delete(doc(firestore, 'user_lookups', user.phone));
        if (data.phone) batch.set(doc(firestore, 'user_lookups', data.phone), { email: newEmail, userKey: user.userKey });
    } else if (user.email !== newEmail && data.phone) {
        batch.update(doc(firestore, 'user_lookups', data.phone), { email: newEmail });
    }

    if (user.email !== newEmail && user.userKey) {
        batch.update(doc(firestore, 'user_lookups', user.userKey), { email: newEmail });
    }

    try {
        await batch.commit();
        toast({ title: 'Success', description: 'User details have been successfully updated.', variant: 'success' });
        setIsEditMode(false);
    } catch (serverError: any) {
        if (serverError.code === 'permission-denied') {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `users/${userId} or associated lookups`,
                operation: 'update',
                requestResourceData: updateData,
            }));
        } else {
            toast({
                title: 'Update Failed',
                description: `An unexpected error occurred: ${serverError.message}`,
                variant: 'destructive',
            });
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
  };

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Skeleton className="h-10 w-32" />
            </div>
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-6 pt-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                </CardContent>
            </Card>
        </main>
    )
  }

  if (!user) {
     return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/users">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Users
                    </Link>
                </Button>
            </div>
             <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>User Not Found</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>The user you are trying to edit does not exist.</p>
                </CardContent>
            </Card>
        </main>
     )
  }

  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Link>
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto animate-fade-in-zoom">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                  <CardTitle>User: {user.name}</CardTitle>
                  <CardDescription>View user details or switch to edit mode.</CardDescription>
              </div>
              {canUpdate && !isEditMode && (
                  <Button onClick={() => setIsEditMode(true)}>
                      <Edit className="mr-2 h-4 w-4" /> Edit
                  </Button>
              )}
          </div>
        </CardHeader>
        <CardContent>
          {!canUpdate && (
              <Alert>
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Read-Only</AlertTitle>
                  <AlertDescription>
                      You have permission to view this user, but not to edit.
                  </AlertDescription>
              </Alert>
          )}
          <UserForm
              user={user}
              onSubmit={handleSave}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
              isLoading={isUserLoading}
              isReadOnly={!isEditMode || !canUpdate}
          />
        </CardContent>
      </Card>
    </main>
  );
}
