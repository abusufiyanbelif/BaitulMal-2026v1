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
import { useAuth } from '@/firebase/provider';
import { BrandedLoader } from '@/components/branded-loader';

export default function CreateBeneficiaryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const canCreate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.beneficiaries?.create;

  const handleCreateBeneficiary = async (data: BeneficiaryFormData) => {
    if (!canCreate || !userProfile) {
      toast({ title: 'Permission Denied', description: 'You Do Not Have Permission To Create Beneficiaries.', variant: 'destructive' });
      return;
    }
    
    const fileList = data.idProofFile as FileList | undefined;
    if (fileList && fileList.length > 0) {
      if (isProfileLoading) {
        toast({ title: 'Please Wait', description: 'Authentication Is Still Loading. Please Try Again In A Moment.' });
        return;
      }
      if (!auth?.currentUser) {
          toast({
              title: "Authentication Error",
              description: "User Not Authenticated Yet. Please Wait.",
              variant: "destructive",
          });
          return;
      }
    }

    setIsSubmitting(true);
    try {
        const { idProofFile, idProofDeleted, ...beneficiaryData } = data;

        const newBeneficiary: Partial<Beneficiary> = {
            ...beneficiaryData,
            addedDate: new Date().toISOString().split('T')[0],
        };

        const result = await createMasterBeneficiaryAction(
            newBeneficiary as any,
            { id: userProfile.id, name: userProfile.name }
        );
        
        if (result.success) {
            toast({ title: 'Success', description: result.message, variant: 'success' });
            router.push(`/beneficiaries`);
        } else {
            toast({ title: 'Creation Failed', description: result.message, variant: 'destructive' });
        }
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
                        Back To Beneficiaries
                    </Link>
                </Button>
            </div>
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle className="font-bold">Access Denied</AlertTitle>
                <AlertDescription className="font-normal text-primary/70">
                You Do Not Have The Required Permissions To Create A New Beneficiary.
                </AlertDescription>
            </Alert>
        </main>
    )
  }

  return (
    <>
      {isSubmitting && <BrandedLoader message="Registering New Beneficiary Profile..." />}
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
          <Button variant="outline" asChild className="font-bold border-primary/20 text-primary">
            <Link href="/beneficiaries">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back To Beneficiaries
            </Link>
          </Button>
        </div>
        <Card className="max-w-2xl mx-auto animate-fade-in-zoom border-primary/10 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="font-bold text-primary tracking-tight">Create New Master Beneficiary</CardTitle>
            <CardDescription className="font-normal text-primary/70">Enter the details for a new beneficiary to be added to the master list.</CardDescription>
          </CardHeader>
          <CardContent>
            <BeneficiaryForm 
                onSubmit={handleCreateBeneficiary}
                onCancel={() => router.push('/beneficiaries')}
                isSubmitting={isSubmitting}
                itemCategories={[]}
                isLoading={false}
                hideZakatInfo={false}
                hideZakatAllocation={true}
                kitAmountLabel="Kit Amount (₹)"
                isSessionLoading={isProfileLoading}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
