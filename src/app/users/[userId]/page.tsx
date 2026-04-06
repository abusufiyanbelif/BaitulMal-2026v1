'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { 
    useFirestore, 
    useStorage, 
    useAuth, 
    useMemoFirebase,
    useDoc,
    doc,
    writeBatch,
    DocumentReference,
    errorEmitter,
    FirestorePermissionError,
    serverTimestamp,
} from '@/firebase';
import { useSession as useCurrentUserSession } from '@/hooks/use-session';
import type { UserProfile } from '@/lib/types';
import { createAdminPermissions } from '@/lib/modules';
import Resizer from 'react-image-file-resizer';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Loader2, Save, Edit, ShieldAlert } from 'lucide-react';
import { UserForm } from '@/components/user-form';
import type { UserFormData } from '@/lib/schemas';
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
  const auth = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const { userProfile: currentUserProfile, isLoading: isProfileLoading } = useCurrentUserSession();
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId) as DocumentReference<UserProfile>;
  }, [firestore, userId]);

  const { data: user, isLoading: isUserLoading, forceRefetch } = useDoc<UserProfile>(userDocRef);

  const canUpdate = currentUserProfile?.role === 'Admin' || !!currentUserProfile?.permissions?.users?.update;

  const handleSave = async (data: UserFormData) => {
    if (!firestore || !storage || !user || !canUpdate || !auth) {
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
            return;
        }
    }
    
    // Step 2: Handle file uploads
    let idProofUrl = user?.idProofUrl || '';
    const fileList = data.idProofFile as FileList | undefined;
    const hasFileToUpload = fileList && fileList.length > 0;

    if (hasFileToUpload && !auth.currentUser) {
        toast({
            title: "Authentication Error",
            description: "User not authenticated yet. Please wait.",
            variant: "destructive",
        });
        setIsSubmitting(false);
        return;
    }
    
    try {
        if (data.idProofDeleted && idProofUrl) {
            const fileRefToDelete = storageRef(storage, idProofUrl);
            await deleteObject(fileRefToDelete).catch((err: any) => {
                if (err.code !== 'storage/object-not-found') {
                    console.warn("Old ID proof deletion failed:", err);
                }
            });
            idProofUrl = '';
        }

        if (hasFileToUpload) {
            const file = fileList[0];
            let fileToUpload: Blob | File = file;
            
            if (idProofUrl) {
                const fileRefToDelete = storageRef(storage, idProofUrl);
                await deleteObject(fileRefToDelete).catch((err: any) => {
                    if ((err.code !== 'storage/object-not-found')) console.warn("Old ID proof deletion failed:", err);
                });
            }

            fileToUpload = await new Promise<Blob>((resolve) => {
                (Resizer as any).imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => {
                    resolve(blob as Blob);
                }, 'blob');
            });
            
            const filePath = `users/${userId}/id_proof.png`;
            const fileRef = storageRef(storage, filePath);
            const uploadResult = await uploadBytes(fileRef, fileToUpload);
            idProofUrl = await getDownloadURL(uploadResult.ref);
        }
    } catch (uploadError: any) {
         console.error("Error during file upload:", uploadError);
         toast({ 
             title: 'File Upload Error', 
             description: `Could not upload identification artifact: ${uploadError.message}.`, 
             variant: 'destructive',
        });
         setIsSubmitting(false);
         return;
    }

    // Step 3: Update Firestore documents in a batch (User + Linked Donor Profile)
    const batch = writeBatch(firestore);
    const docRef = doc(firestore, 'users', userId);
    const donorDocRef = doc(firestore, 'donors', userId);
    
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
        organizationGroup: data.organizationGroup === 'none' ? null : data.organizationGroup,
        organizationRole: data.organizationRole,
        updatedAt: serverTimestamp(),
    };

    // Mirror updates to Linked Donor Profile
    const donorUpdateData = {
        name: data.name,
        phone: data.phone || '',
        email: data.email || '',
        status: data.status === 'Active' ? 'Active' : 'Inactive',
        updatedAt: serverTimestamp(),
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
    batch.set(donorDocRef, donorUpdateData, { merge: true });

    // Handle lookup table updates
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
        toast({ title: 'Success', description: 'Member profile and linked donor record synchronized.', variant: 'success' });
        forceRefetch();
        setIsEditMode(false);
    } catch (serverError: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `users/${userId} and donors/${userId}`,
            operation: 'update',
            requestResourceData: updateData,
        }));
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
        <main className="container mx-auto p-4 md:p-8 text-primary">
            <Skeleton className="h-10 w-32 mb-4" />
            <Card className="max-w-4xl mx-auto"><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-64 w-full pt-4" /></CardContent></Card>
        </main>
    )
  }

  if (!user) {
     return (
        <main className="container mx-auto p-4 md:p-8 text-center">
            <Button variant="outline" asChild className="mb-4"><Link href="/users"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Users</Link></Button>
            <p className="font-bold opacity-60">User Record Not Found.</p>
        </main>
     )
  }

  return (
    <main className="container mx-auto p-4 md:p-8 text-primary">
      <div className="mb-4">
        <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
          <Link href="/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Link>
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto animate-fade-in-zoom border-primary/10 bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-primary/5 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div>
                      <CardTitle className="text-xl font-bold tracking-tight">Member: {user.name}</CardTitle>
                      <CardDescription className="font-normal text-primary/70">Maintain organizational profile and linked donor identity.</CardDescription>
                  </div>
                  {user.phone && (
                      <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-fit font-bold border-green-200 text-green-600 hover:bg-green-50 rounded-full px-4"
                          onClick={() => window.open(`https://wa.me/91${user.phone?.replace(/\D/g, '')}`, '_blank')}
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="mr-2">
                              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.06 3.973L0 16l4.204-1.102a7.923 7.923 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                          </svg>
                          WhatsApp
                      </Button>
                  )}
              </div>
              {canUpdate && !isEditMode && (
                  <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md active:scale-95 transition-transform shrink-0">
                      <Edit className="mr-2 h-4 w-4" /> Modify Profile
                  </Button>
              )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!canUpdate && (
              <Alert variant="destructive" className="mb-6"><ShieldAlert className="h-4 w-4" /><AlertTitle className="font-bold">Read-Only Mode</AlertTitle><AlertDescription className="font-normal opacity-80">Insufficient Permissions To Update This Account.</AlertDescription></Alert>
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