
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useDoc, errorEmitter, FirestorePermissionError, useCollection } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { updateDoc, doc, collection, getDoc } from 'firebase/firestore';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Save, Edit, ShieldAlert, FolderKanban, Lightbulb, UserCheck, Check, Hourglass } from 'lucide-react';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface LinkedInitiative {
    id: string;
    name: string;
    type: 'Campaign' | 'Lead';
    status: string;
    kitAmount: number;
    beneficiaryStatus: string;
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
  
  const beneficiaryDocRef = useMemo(() => {
    if (!firestore || !beneficiaryId) return null;
    return doc(firestore, 'beneficiaries', beneficiaryId);
  }, [firestore, beneficiaryId]);

  const { data: beneficiary, isLoading: isBeneficiaryLoading } = useDoc<Beneficiary>(beneficiaryDocRef);
  
  const campaignsCollectionRef = useMemo(() => firestore ? collection(firestore, 'campaigns') : null, [firestore]);
  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<Campaign>(campaignsCollectionRef);

  const leadsCollectionRef = useMemo(() => firestore ? collection(firestore, 'leads') : null, [firestore]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);
  
  const [linkedInitiatives, setLinkedInitiatives] = useState<LinkedInitiative[]>([]);
  const [isLinksLoading, setIsLinksLoading] = useState(true);

  useEffect(() => {
      if (!firestore || !beneficiary || (!campaigns && !leads)) {
          if (!areCampaignsLoading && !areLeadsLoading) {
              setIsLinksLoading(false);
          }
          return;
      }

      const findLinks = async () => {
          setIsLinksLoading(true);
          const foundLinks: LinkedInitiative[] = [];
          const allItems = [
              ...(campaigns || []).map(c => ({ ...c, itemType: 'Campaign' as const })),
              ...(leads || []).map(l => ({ ...l, itemType: 'Lead' as const }))
          ];

          for (const item of allItems) {
              const subcollectionPath = item.itemType === 'Campaign' ? 'campaigns' : 'leads';
              const benRef = doc(firestore, subcollectionPath, item.id, 'beneficiaries', beneficiary.id);
              try {
                const benSnap = await getDoc(benRef);
                if (benSnap.exists()) {
                    const benData = benSnap.data() as Beneficiary;
                    foundLinks.push({
                        id: item.id,
                        name: item.name,
                        type: item.itemType,
                        status: item.status,
                        kitAmount: benData.kitAmount || 0,
                        beneficiaryStatus: benData.status || 'Pending'
                    });
                }
              } catch (e) {
                // This can happen if rules prevent reading from a subcollection the user has no access to.
                // We'll just skip it.
                console.warn(`Could not check link for beneficiary in ${subcollectionPath}/${item.id}:`, e);
              }
          }
          setLinkedInitiatives(foundLinks);
          setIsLinksLoading(false);
      };

      findLinks();
  }, [firestore, beneficiary, campaigns, leads, areCampaignsLoading, areLeadsLoading]);

  const canUpdate = currentUserProfile?.role === 'Admin' || !!currentUserProfile?.permissions?.beneficiaries?.update;

  const handleSave = async (data: BeneficiaryFormData) => {
    if (!firestore || !beneficiary || !canUpdate) {
        toast({ title: 'Error', description: 'You do not have permission or services are unavailable.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
    };
    setIsSubmitting(true);
    
    try {
        const docRef = doc(firestore, 'beneficiaries', beneficiaryId);
        await updateDoc(docRef, { ...data });
        toast({ title: 'Success', description: 'Beneficiary details have been successfully updated.', variant: 'success' });
        setIsEditMode(false);
    } catch (serverError: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `beneficiaries/${beneficiaryId}`,
            operation: 'update',
            requestResourceData: data,
        }));
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
  };

  const isLoading = isBeneficiaryLoading || isProfileLoading || areCampaignsLoading || areLeadsLoading;

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
              rationLists={[]}
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto animate-fade-in-zoom" style={{animationDelay: '200ms'}}>
        <CardHeader>
            <CardTitle>Linked To</CardTitle>
            <CardDescription>This beneficiary is linked to the following initiatives.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLinksLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
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
                            {linkedInitiatives.map(link => (
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
