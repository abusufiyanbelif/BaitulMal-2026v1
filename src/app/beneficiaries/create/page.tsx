

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { createMasterBeneficiaryAction } from '../actions';
import type { Beneficiary } from '@/lib/types';

export default function CreateBeneficiaryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const canCreate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.beneficiaries?.create;

  const handleCreateBeneficiary = async (data: BeneficiaryFormData) => {
    if (!canCreate || !userProfile) {
      toast({ title: 'Permission Denied', description: 'You do not have permission to create beneficiaries.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    
    const { idProofFile, idProofDeleted, ...beneficiaryData } = data;

    const result = await createMasterBeneficiaryAction(
        beneficiaryData,
        { id: userProfile.id, name: userProfile.name }
    );
    
    if (result.success) {
        toast({ title: 'Success', description: result.message, variant: 'success' });
        router.push(`/beneficiaries`);
    } else {
        toast({ title: 'Creation Failed', description: result.message, variant: 'destructive' });
    }

    setIsSubmitting(false);
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
                itemCategories={[]}
                isLoading={false}
                hideZakatInfo={true}
                kitAmountLabel="Kit Amount (₹)"
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
