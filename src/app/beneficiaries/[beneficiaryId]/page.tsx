
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection, getDocs, getDoc, collectionGroup, query, where, doc, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Save, Edit, ShieldAlert, FolderKanban, Lightbulb, UserCheck, Check, Hourglass, Loader2 } from 'lucide-react';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { updateMasterBeneficiaryAction } from '../actions';

interface LinkedInitiative {
    id: string;
    name: string;
    type: 'Campaign' | 'Lead';
    status: Campaign['status'] | Lead['status'];
    kitAmount: number;
    beneficiaryStatus: 'Given' | 'Pending' | 'Hold' | 'Need More Details' | 'Verified';
}

export default function BeneficiaryDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const beneficiaryId = params.beneficiaryId as string;

  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const { userProfile: currentUserProfile, isLoading: isProfileLoading } = useSession();
  
  const beneficiaryDocRef = useMemoFirebase(() => {
    if (!firestore || !beneficiaryId) return null;
    return doc(firestore, 'beneficiaries', beneficiaryId);
  }, [firestore, beneficiaryId]);

  const { data: beneficiary, isLoading: isBeneficiaryLoading, forceRefetch } = useDoc<Beneficiary>(beneficiaryDocRef);
  
  const [linkedInitiatives, setLinkedInitiatives] = useState<LinkedInitiative[]>([]);
  const [isLinksLoading, setIsLinksLoading] = useState(true);

  const fetchLinkedInitiatives = useCallback(async () => {
    if (!firestore || !beneficiary) return;
    setIsLinksLoading(true);

    try {
        const beneficiarySubcollectionDocs = await getDocs(
            query(collectionGroup(firestore, 'beneficiaries'), where('id', '==', beneficiary.id))
        );

        if (beneficiarySubcollectionDocs.empty) {
            setLinkedInitiatives([]);
            setIsLinksLoading(false);
            return;
        }

        const initiativePromises = beneficiarySubcollectionDocs.docs.map(async (benDoc: QueryDocumentSnapshot<DocumentData>) => {
            if (benDoc.ref.path.startsWith('beneficiaries/')) return null;

            const parentRef = benDoc.ref.parent.parent;
            if (!parentRef) return null;

            const benData = benDoc.data() as Beneficiary;
            const parentSnap = await getDoc(parentRef);

            if (parentSnap.exists()) {
                const parentData = parentSnap.data() as (Campaign | Lead);
                const initiativeType = parentRef.path.startsWith('campaigns') ? 'Campaign' : 'Lead';
                
                return {
                    id: parentRef.id,
                    name: parentData.name,
                    type: initiativeType,
                    status: parentData.status,
                    kitAmount: benData.kitAmount || 0,
                    beneficiaryStatus: benData.status || 'Pending'
                } as LinkedInitiative;
            }
            return null;
        });

        const results = (await Promise.all(initiativePromises));
        setLinkedInitiatives(results.filter((link): link is LinkedInitiative => link !== null));
    } catch (e: any) {
        console.error("Error fetching linked initiatives:", e);
        toast({ title: "Error", description: "Could not fetch linked initiatives for this beneficiary.", variant: 'destructive'});
    } finally {
        setIsLinksLoading(false);
    }
  }, [firestore, beneficiary, toast]);

  useEffect(() => {
    if (beneficiary) {
        fetchLinkedInitiatives();
    }
  }, [beneficiary, fetchLinkedInitiatives]);

  const canUpdate = currentUserProfile?.role === 'Admin' || !!currentUserProfile?.permissions?.beneficiaries?.update;

  const handleSave = async (data: BeneficiaryFormData) => {
    if (!beneficiaryId || !canUpdate || !currentUserProfile) {
        toast({ title: 'Error', description: 'You do not have permission or services are unavailable.', variant: 'destructive' });
        return;
    };
    setIsSubmitting(true);
    
    const result = await updateMasterBeneficiaryAction(
        beneficiaryId, 
        data,
        { id: currentUserProfile.id, name: currentUserProfile.name }
    );
    
    if (result.success) {
        toast({ title: 'Success', description: result.message, variant: 'success' });
        forceRefetch();
        setIsEditMode(false);
    } else {
        toast({ title: 'Update Failed', description: result.message, variant: 'destructive' });
    }

    setIsSubmitting(false);
  };

  const handleCancel = () => {
    setIsEditMode(false);
  };

  const isLoading = isBeneficiaryLoading || isProfileLoading;

  if (isLoading) {
    return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Skeleton className="h-10 w-32" />
            </div>
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-6 pt-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </CardContent>
            </Card>
        </main>
    )
  }

  if (!beneficiary) {
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
             <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>Beneficiary Not Found</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>The beneficiary you are trying to edit does not exist.</p>
                </CardContent>
            </Card>
        </main>
     )
  }

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                  <CardTitle>Beneficiary: {beneficiary.name}</CardTitle>
                  <CardDescription>View beneficiary details or switch to edit mode.</CardDescription>
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
                      You have permission to view this beneficiary, but not to edit.
                  </AlertDescription>
              </Alert>
          )}
          <BeneficiaryForm
              beneficiary={beneficiary}
              onSubmit={handleSave}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
              isLoading={isBeneficiaryLoading}
              initialReadOnly={!isEditMode && canUpdate}
              itemCategories={[]}
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto animate-fade-in-zoom" style={{ animationDelay: '200ms'}}>
        <CardHeader>
            <CardTitle>Linked To</CardTitle>
            <CardDescription>This beneficiary is linked to the following initiatives.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLinksLoading ? (
                <div className="flex justify-center items-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2">Scanning initiatives...</span>
                </div>
            ) : linkedInitiatives.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Initiative Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Kit Amount (₹)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {linkedInitiatives.map((link: LinkedInitiative) => (
                                <TableRow key={link.id}>
                                    <TableCell>
                                        <Link href={link.type === 'Campaign' ? `/campaign-members/${link.id}/beneficiaries` : `/leads-members/${link.id}/beneficiaries`} className="font-medium text-primary hover:underline flex items-center gap-2">
                                            {link.type === 'Campaign' ? <FolderKanban className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
                                            {link.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{link.type}</Badge></TableCell>
                                    <TableCell>
                                      <Badge variant={link.beneficiaryStatus === 'Given' || link.beneficiaryStatus === 'Verified' ? 'success' : link.beneficiaryStatus === 'Pending' ? 'secondary' : 'destructive'}>
                                        {link.beneficiaryStatus === 'Verified' ? <UserCheck className="mr-1 h-3 w-3" /> : link.beneficiaryStatus === 'Given' ? <Check className="mr-1 h-3 w-3"/> : <Hourglass className="mr-1 h-3 w-3" />}
                                        {link.beneficiaryStatus}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">₹{link.kitAmount.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-4">This beneficiary is not yet linked to any campaigns or leads.</p>
            )}
        </CardContent>
      </Card>
    </main>
  );
}
