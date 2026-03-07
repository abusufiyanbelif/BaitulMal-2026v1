'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, errorEmitter, FirestorePermissionError, useStorage, useAuth, useMemoFirebase } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import Resizer from 'react-image-file-resizer';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, ShieldAlert, UploadCloud, Trash2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type { UserFormData } from '@/lib/schemas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UserForm } from '@/components/user-form';
import { createUserAuthAction } from '../actions';
import { useCollection } from '@/firebase';
import { BrandedLoader } from '@/components/branded-loader';

export default function CreateUserPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const canCreate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.users?.create;

  const handleCreateUser = async (data: UserFormData) => {
    if (!firestore || !storage || !canCreate) {
      toast({ title: 'Permission Denied', description: 'You do not have permission to create users.', variant: 'destructive' });
      return;
    }
    
    const fileList = data.idProofFile as FileList | undefined;
    const hasFilesToUpload = fileList && fileList.length > 0;

    if (hasFilesToUpload && !auth?.currentUser) {
        toast({
            title: "Authentication Error",
            description: "User not authenticated yet. Please wait.",
            variant: "destructive",
        });
        return;
    }

    setIsSubmitting(true);
    setProgress(10);
    setLoadingMessage('Registering authentication account...');
    
    // Step 1: Create user in Firebase Auth
    const authResult = await createUserAuthAction(data);
    if (!authResult.success || !authResult.uid) {
        toast({ title: 'User Creation Failed', description: authResult.message, variant: 'destructive'});
        setIsSubmitting(false);
        return;
    }

    const newUserUid = authResult.uid;
    setProgress(40);
    setLoadingMessage('Optimizing identification artifacts...');
    
    // Step 2: Handle File Upload
    let idProofUrl = '';
    if (hasFilesToUpload && storage) {
        try {
            const file = fileList[0];
            let fileToUpload: Blob | File = file;
            let fileExtension = file.name.split('.').pop()?.toLowerCase() || 'bin';

            if (file.type.startsWith('image/')) {
                fileToUpload = await new Promise<Blob>((resolve) => {
                     (Resizer as any).imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => resolve(blob as Blob), 'blob');
                });
                fileExtension = 'png';
            }
            
            setProgress(65);
            setLoadingMessage('Securing proof in institutional storage...');
            if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                const filePath = `users/${newUserUid}/id_proof.${fileExtension}`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, fileToUpload);
                idProofUrl = await getDownloadURL(fileRef);
            }

        } catch (uploadError: any) {
            console.error("Error during file upload on create:", uploadError);
            let description = `User account was created, but ID proof failed to upload: ${uploadError.message}. Please edit the user later to add it.`;
            toast({ 
                title: 'File Upload Error', 
                description: description,
                variant: 'destructive', 
                duration: 9000 
            });
        }
    }

    setProgress(85);
    setLoadingMessage('Synchronizing permissions & lookup maps...');

    // Step 3: Create documents in Firestore
    const batch = writeBatch(firestore);
    const userDocRef = doc(firestore, 'users', newUserUid);

    const newUserProfile = {
        id: newUserUid,
        name: data.name,
        email: data.email,
        phone: data.phone,
        loginId: data.loginId,
        userKey: data.userKey,
        role: data.role,
        status: data.status,
        permissions: data.permissions,
        idProofType: data.idProofType,
        idNumber: data.idNumber,
        idProofUrl,
        organizationGroup: data.organizationGroup === 'none' ? null : data.organizationGroup,
        organizationRole: data.organizationRole,
        createdAt: serverTimestamp(),
        createdById: userProfile?.id || 'system',
        createdByName: userProfile?.name || 'System',
    };
    
    batch.set(userDocRef, newUserProfile);

    // Create lookup documents
    if (data.loginId) batch.set(doc(firestore, 'user_lookups', data.loginId), { email: data.email, userKey: data.userKey });
    if (data.phone) batch.set(doc(firestore, 'user_lookups', data.phone), { email: data.email, userKey: data.userKey });
    if (data.userKey) batch.set(doc(firestore, 'user_lookups', data.userKey), { email: data.email, userKey: data.userKey });

    try {
        await batch.commit();
        setProgress(100);
        setLoadingMessage('Member registration finalized.');
        toast({ title: 'Success', description: 'User created successfully.', variant: 'success' });
        router.push(`/users`);
    } catch (dbError: any) {
        console.error("Firestore batch failed after Auth user creation:", dbError);
        const serializableData = { ...newUserProfile, createdAt: 'FieldValue.serverTimestamp()' };
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `users/${newUserUid} and lookups`,
            operation: 'create',
            requestResourceData: serializableData,
        }));
        toast({
            title: "Database Error",
            description: "Auth user was created, but database records failed.",
            variant: 'destructive',
            duration: 10000,
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isProfileLoading) {
    return (
      <main className="container mx-auto p-4 md:p-8">
          <BrandedLoader message="Syncing with authorization server..." />
      </main>
    );
  }

  if (!canCreate) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-primary">
            <div className="mb-4">
                <Button variant="outline" asChild className="font-bold border-primary/20 text-primary">
                    <Link href="/users">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Users
                    </Link>
                </Button>
            </div>
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle className="font-bold">Access denied</AlertTitle>
                <AlertDescription className="font-normal text-primary/70">
                You do not have the required permissions to create a new organization user.
                </AlertDescription>
            </Alert>
        </main>
    )
  }

  return (
    <>
      {isSubmitting && <BrandedLoader message={loadingMessage} progress={progress} />}
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
          <Button variant="outline" asChild className="font-bold border-primary/20 text-primary">
            <Link href="/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Users
            </Link>
          </Button>
        </div>
        <Card className="max-w-4xl mx-auto animate-fade-in-zoom border-primary/10 bg-white">
          <CardHeader>
            <CardTitle className="font-bold text-primary">Create new user</CardTitle>
            <CardDescription className="font-normal">Assign organizational roles and module-level permissions.</CardDescription>
          </CardHeader>
          <CardContent>
            <UserForm 
                onSubmit={handleCreateUser}
                onCancel={() => router.push('/users')}
                isSubmitting={isSubmitting}
                isLoading={false}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
