

'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useFirestore, useStorage, useAuth, useMemoFirebase } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { getDocs, getDoc, doc, type QueryDocumentSnapshot, type DocumentData, type DocumentReference, collection } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';
import imageFileResizer from 'react-image-file-resizer';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Save, Edit, ShieldAlert, FolderKanban, Lightbulb, UserCheck, Check, Hourglass, Loader2, MoreHorizontal, ChevronsUpDown, BadgeCheck, Info, XCircle, CheckCircle2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { updateMasterBeneficiaryAction, updateBeneficiaryStatusInInitiativeAction } from '../actions';
import { useSession } from '@/hooks/use-session';

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
  const searchParams = useSearchParams();
  const beneficiaryId = String(params.beneficiaryId || '');
  const redirectUrl = searchParams.get('redirect');

  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const { userProfile: currentUserProfile, isLoading: isProfileLoading } = useSession();
  
  const beneficiaryDocRef = useMemoFirebase(() => {
    if (!firestore || !beneficiaryId) return null;
    return doc(firestore, 'beneficiaries', beneficiaryId) as DocumentReference<Beneficiary>;
  }, [firestore, beneficiaryId]);

  const { data: beneficiary, isLoading: isBeneficiaryLoading, error: beneficiaryError, forceRefetch } = useDoc<Beneficiary>(beneficiaryDocRef);
  
  const [linkedInitiatives, setLinkedInitiatives] = useState<LinkedInitiative[]>([]);
  const [isLinksLoading, setIsLinksLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchLinkedInitiatives = useCallback(async () => {
    if (!firestore || !beneficiary) return;
    setIsLinksLoading(true);
    setLinkedInitiatives([]);

    try {
        const initiatives: LinkedInitiative[] = [];
        const campaignsCollectionRef = collection(firestore, 'campaigns');
        const campaignsSnapshot = await getDocs(campaignsCollectionRef);

        for (const campaignDoc of campaignsSnapshot.docs) {
            const beneficiarySubDocRef = doc(firestore, `campaigns/${campaignDoc.id}/beneficiaries`, beneficiary.id);
            const beneficiarySnap = await getDoc(beneficiarySubDocRef);

            if (beneficiarySnap.exists()) {
                const campaignData = campaignDoc.data() as Campaign;
                const beneficiaryData = beneficiarySnap.data() as Beneficiary;
                initiatives.push({
                    id: campaignDoc.id,
                    name: campaignData.name,
                    type: 'Campaign',
                    status: campaignData.status,
                    kitAmount: beneficiaryData.kitAmount || 0,
                    beneficiaryStatus: beneficiaryData.status || 'Pending'
                });
            }
        }

        const leadsCollectionRef = collection(firestore, 'leads');
        const leadsSnapshot = await getDocs(leadsCollectionRef);

        for (const leadDoc of leadsSnapshot.docs) {
            const beneficiarySubDocRef = doc(firestore, `leads/${leadDoc.id}/beneficiaries`, beneficiary.id);
            const beneficiarySnap = await getDoc(beneficiarySubDocRef);
            
            if (beneficiarySnap.exists()) {
                const leadData = leadDoc.data() as Lead;
                const beneficiaryData = beneficiarySnap.data() as Beneficiary;
                 initiatives.push({
                    id: leadDoc.id,
                    name: leadData.name,
                    type: 'Lead',
                    status: leadData.status,
                    kitAmount: beneficiaryData.kitAmount || 0,
                    beneficiaryStatus: beneficiaryData.status || 'Pending'
                });
            }
        }

        setLinkedInitiatives(initiatives);

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
    if (!beneficiaryId || !canUpdate || !currentUserProfile || !storage || !auth) {
        toast({ title: 'Error', description: 'You do not have permission or services are unavailable.', variant: 'destructive' });
        return;
    };
    setIsSubmitting(true);
    
    let idProofUrl = beneficiary?.idProofUrl || '';
    const fileList = data.idProofFile as FileList | undefined;
    const hasFileToUpload = fileList && fileList.length > 0;

    if (hasFileToUpload && !auth.currentUser) {
        toast({
            title: "Authentication Error",
            description: "User not authenticated yet. Please wait and try again.",
            variant: "destructive",
        });
        setIsSubmitting(false);
        return;
    }

    try {
        if (data.idProofDeleted && idProofUrl) {
            const oldFileRef = storageRef(storage, idProofUrl);
            await deleteObject(oldFileRef).catch((err: any) => {
                if (err.code !== 'storage/object-not-found') console.warn("Failed to delete old ID proof:", err);
            });
            idProofUrl = '';
        }

        if (hasFileToUpload) {
            const file = fileList[0];
            let fileToUpload: Blob | File = file;
            let fileExtension = file.name.split('.').pop()?.toLowerCase() || 'bin';

            if(idProofUrl) {
                const oldFileRef = storageRef(storage, idProofUrl);
                await deleteObject(oldFileRef).catch((err: any) => {
                    if (err.code !== 'storage/object-not-found') console.warn("Failed to delete old ID proof:", err);
                });
            }
            
            await new Promise<void>((resolve) => {
                imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => {
                  fileToUpload = blob as Blob;
                  resolve();
                }, 'blob');
            });
            fileExtension = 'png';
            
            const filePath = `beneficiaries/${beneficiaryId}/id_proof.${fileExtension}`;
            const newFileRef = storageRef(storage, filePath);
            const uploadResult = await uploadBytes(newFileRef, fileToUpload);
            idProofUrl = await getDownloadURL(uploadResult.ref);
        }
    } catch (uploadError: any) {
        console.error("File handling error:", uploadError);
        toast({ title: 'File Error', description: `Could not process the ID proof file: ${uploadError.message}`, variant: 'destructive' });
        setIsSubmitting(false);
        return;
    }

    const { idProofFile, idProofDeleted, ...beneficiaryData } = data;
    
    const result = await updateMasterBeneficiaryAction(
        beneficiaryId, 
        { ...beneficiaryData, idProofUrl },
        { id: currentUserProfile.id, name: currentUserProfile.name }
    );
    
    if (result.success) {
        toast({ title: 'Success', description: result.message, variant: 'success' });
        if (redirectUrl) {
            router.push(redirectUrl);
        } else {
            forceRefetch();
            setIsEditMode(false);
        }
    } else {
        toast({ title: 'Update Failed', description: result.message, variant: 'destructive' });
    }

    setIsSubmitting(false);
  };

  const handleCancel = () => {
    setIsEditMode(false);
  };
  
  const handleInitiativeStatusChange = async (initiative: LinkedInitiative, newStatus: Beneficiary['status']) => {
    setIsUpdatingStatus(true);
    const result = await updateBeneficiaryStatusInInitiativeAction(
        initiative.type.toLowerCase() as 'campaign' | 'lead',
        initiative.id,
        beneficiaryId,
        newStatus
    );

    if (result.success) {
        toast({ title: "Status Updated", description: `Status for '${initiative.name}' set to ${newStatus}.`, variant: "success"});
        fetchLinkedInitiatives(); // refetch
    } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsUpdatingStatus(false);
  }

  const isLoading = isBeneficiaryLoading || isProfileLoading;
  const backHref = redirectUrl || '/beneficiaries';

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

  if (beneficiaryError) {
    return (
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4">
          <Button variant="outline" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Could not load beneficiary data.</AlertTitle>
              <AlertDescription>
                <p>This may be due to a network issue or you may not have permission to view this beneficiary.</p>
                <pre className="mt-2 whitespace-pre-wrap text-xs bg-destructive/10 p-2 rounded-md font-code">{beneficiaryError.message}</pre>
              </AlertDescription>
            </Alert>
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
                    <Link href={backHref}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
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
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
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
              {canUpdate && (
                  !isEditMode ? (
                    <Button onClick={() => setIsEditMode(true)}><Edit className="mr-2 h-4 w-4"/>Edit</Button>
                  ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={() => {
                            // We need to trigger the form validation before calling handleSave
                            const formElement = document.querySelector('form');
                            if (formElement) {
                                formElement.requestSubmit();
                            }
                        }} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Save
                        </Button>
                    </div>
                  )
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
              isReadOnly={!isEditMode}
              itemCategories={[]}
              kitAmountLabel="Kit Amount (₹)"
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
                                {canUpdate && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {linkedInitiatives.map((link) => (
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
                                    {canUpdate && (
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={isUpdatingStatus}>
                                                        {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuSub>
                                                        <DropdownMenuSubTrigger>
                                                            <ChevronsUpDown className="mr-2 h-4 w-4" />
                                                            <span>Change Status</span>
                                                        </DropdownMenuSubTrigger>
                                                        <DropdownMenuPortal>
                                                            <DropdownMenuSubContent>
                                                                <DropdownMenuRadioGroup
                                                                    value={link.beneficiaryStatus}
                                                                    onValueChange={(newStatus) => handleInitiativeStatusChange(link, newStatus as Beneficiary['status'])}
                                                                >
                                                                    <DropdownMenuRadioItem value="Pending"><Hourglass className="mr-2"/>Pending</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Verified"><BadgeCheck className="mr-2"/>Verified</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Given"><CheckCircle2 className="mr-2"/>Given</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Hold"><XCircle className="mr-2"/>Hold</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Need More Details"><Info className="mr-2"/>Need More Details</DropdownMenuRadioItem>
                                                                </DropdownMenuRadioGroup>
                                                            </DropdownMenuSubContent>
                                                        </DropdownMenuPortal>
                                                    </DropdownMenuSub>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    )}
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
