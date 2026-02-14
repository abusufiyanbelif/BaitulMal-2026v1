
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';

export default function CreateBeneficiaryPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const canCreate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.beneficiaries?.create;

  const handleCreateBeneficiary = async (data: BeneficiaryFormData) => {
    if (!firestore || !canCreate || !userProfile) {
      toast({ title: 'Permission Denied', description: 'You do not have permission to create beneficiaries.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);

    try {
        const docRef = collection(firestore, 'beneficiaries');
        await addDoc(docRef, {
            ...data,
            createdAt: serverTimestamp(),
            createdById: userProfile.id,
            createdByName: userProfile.name,
        });

        toast({ title: 'Success', description: 'Beneficiary created successfully.', variant: 'success' });
        router.push(`/beneficiaries`);
    } catch (serverError) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'beneficiaries',
            operation: 'create',
            requestResourceData: data,
        }));
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isProfileLoading) {
    return (
      <main className="container mx-auto p-4 md:p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!canCreate) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="outline" asChild>
                    <Link href="/beneficiaries">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Beneficiaries
                    </Link>
                </Button>
            </div>
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                You do not have the required permissions to create a new beneficiary.
                </AlertDescription>
            </Alert>
        </main>
    )
  }

  return (
    <>
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
          <Button variant="outline" asChild>
            <Link href="/beneficiaries">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Beneficiaries
            </Link>
          </Button>
        </div>
        <Card className="max-w-2xl mx-auto animate-fade-in-zoom">
          <CardHeader>
            <CardTitle>Create New Master Beneficiary</CardTitle>
            <CardDescription>Enter the details for a new beneficiary to be added to the master list.</CardDescription>
          </CardHeader>
          <CardContent>
            <BeneficiaryForm 
                onSubmit={handleCreateBeneficiary}
                onCancel={() => router.push('/beneficiaries')}
                isSubmitting={isSubmitting}
                rationLists={[]}
                isLoading={false}
                hideZakatInfo={true}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
