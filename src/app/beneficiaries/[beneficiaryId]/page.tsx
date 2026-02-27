'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams, usePathname } from 'next/navigation';
import { useFirestore, useStorage, useAuth, useMemoFirebase, useDoc, getDocs, getDoc, doc, type DocumentReference, collection, query, type CollectionReference, uploadBytes, getDownloadURL, deleteObject, storageRef } from '@/firebase';
import Resizer from 'react-image-file-resizer';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Save, Edit, ShieldAlert, FolderKanban, Lightbulb, UserCheck, Check, Hourglass, Loader2, MoreHorizontal, ChevronsUpDown, BadgeCheck, Info, XCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { updateMasterBeneficiaryAction, updateInitiativeBeneficiaryDetailsAction, updateBeneficiaryStatusInInitiativeAction } from '../actions';
import { useSession } from '@/hooks/use-session';
import { BrandedLoader } from '@/components/branded-loader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';

interface LinkedInitiative {
    id: string;
    name: string;
    type: 'Campaign' | 'Lead';
    status: Campaign['status'] | Lead['status'];
    kitAmount: number;
    beneficiaryStatus: Beneficiary['status'];
}

export default function BeneficiaryDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const beneficiaryId = String(params.beneficiaryId || '');
  const redirectUrl = searchParams.get('redirect');

  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const { userProfile: currentUserProfile, isLoading: isProfileLoading } = useSession();
  
  const [initiativeContext, setInitiativeContext] = useState<{ type: 'campaign' | 'lead', id: string } | null>(null);
  const [initiativeBeneficiaryData, setInitiativeBeneficiaryData] = useState<Partial<Beneficiary> | null>(null);
  const [isInitiativeDataLoading, setIsInitiativeDataLoading] = useState(false);

  useEffect(() => {
    if (redirectUrl) {
      const parts = redirectUrl.split('/');
      if (parts.includes('campaign-members') && parts[2]) {
        setInitiativeContext({ type: 'campaign', id: parts[2] });
      } else if (parts.includes('leads-members') && parts[2]) {
        setInitiativeContext({ type: 'lead', id: parts[2] });
      } else {
        setInitiativeContext(null);
      }
    } else {
        setInitiativeContext(null);
    }
  }, [redirectUrl]);

  const campaignDocRef = useMemoFirebase(() => (firestore && initiativeContext?.type === 'campaign') ? doc(firestore, 'campaigns', initiativeContext.id) as DocumentReference<Campaign> : null, [firestore, initiativeContext]);
  const { data: campaign } = useDoc<Campaign>(campaignDocRef);

  const leadDocRef = useMemoFirebase(() => (firestore && initiativeContext?.type === 'lead') ? doc(firestore, 'leads', initiativeContext.id) as DocumentReference<Lead> : null, [firestore, initiativeContext]);
  const { data: lead } = useDoc<Lead>(leadDocRef);

  const beneficiaryDocRef = useMemoFirebase(() => {
    if (!firestore || !beneficiaryId) return null;
    return doc(firestore, 'beneficiaries', beneficiaryId) as DocumentReference<Beneficiary>;
  }, [firestore, beneficiaryId]);

  useEffect(() => {
    if (initiativeContext && firestore && beneficiaryId) {
        setIsInitiativeDataLoading(true);
        const collectionName = initiativeContext.type === 'campaign' ? 'campaigns' : 'leads';
        const initiativeDocRef = doc(firestore, `${collectionName}/${initiativeContext.id}/beneficiaries/${beneficiaryId}`);
        getDoc(initiativeDocRef).then(docSnap => {
            if (docSnap.exists()) {
                setInitiativeBeneficiaryData(docSnap.data() as Beneficiary);
            }
        }).catch((err: any) => {
            console.error("Error fetching initiative-specific beneficiary data:", err);
            toast({ title: "Error", description: "Could not load context-specific data.", variant: 'destructive'});
        }).finally(() => {
            setIsInitiativeDataLoading(false);
        });
    } else {
        setInitiativeBeneficiaryData(null);
    }
  }, [initiativeContext, firestore, beneficiaryId, toast]);

  const { data: beneficiary, isLoading: isBeneficiaryLoading, error: beneficiaryError, forceRefetch } = useDoc<Beneficiary>(beneficiaryDocRef);
  
  const formBeneficiaryData = useMemo(() => {
      if (!beneficiary) return null;
      return {
        ...beneficiary,
        ...initiativeBeneficiaryData,
      };
  }, [beneficiary, initiativeBeneficiaryData]);

  const [linkedInitiatives, setLinkedInitiatives] = useState<LinkedInitiative[]>([]);
  const [isLinksLoading, setIsLinksLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchLinkedInitiatives = useCallback(async () => {
    if (!firestore || !beneficiary) return;
    setIsLinksLoading(true);
    setLinkedInitiatives([]);

    try {
        const initiatives: LinkedInitiative[] = [];
        const campaignsQuery = query(collection(firestore, 'campaigns') as CollectionReference<Campaign>);
        const campaignsSnapshot = await getDocs(campaignsQuery);

        for (const campaignDoc of campaignsSnapshot.docs) {
            const beneficiarySubDocRef = doc(firestore, `campaigns/${campaignDoc.id}/beneficiaries`, beneficiary.id);
            const beneficiarySnap = await getDoc(beneficiarySubDocRef);

            if (beneficiarySnap.exists()) {
                const campaignData = campaignDoc.data();
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

        const leadsQuery = query(collection(firestore, 'leads') as CollectionReference<Lead>);
        const leadsSnapshot = await getDocs(leadsQuery);

        for (const leadDoc of leadsSnapshot.docs) {
            const beneficiarySubDocRef = doc(firestore, `leads/${leadDoc.id}/beneficiaries`, beneficiary.id);
            const beneficiarySnap = await getDoc(beneficiarySubDocRef);
            
            if (beneficiarySnap.exists()) {
                const leadData = leadDoc.data();
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
        toast({ title: "Error", description: "Could not fetch linked initiatives.", variant: 'destructive'});
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
        toast({ title: 'Error', description: 'Permission denied or services unavailable.', variant: 'destructive' });
        return;
    };
    setIsSubmitting(true);
    
    let idProofUrl = beneficiary?.idProofUrl || '';
    const fileList = data.idProofFile as FileList | undefined;
    const hasFileToUpload = fileList && fileList.length > 0;

    if (hasFileToUpload && !auth.currentUser) {
        toast({ title: "Authentication Error", description: "User not authenticated yet.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    try {
        if (data.idProofDeleted && idProofUrl) {
            const oldFileRef = storageRef(storage, idProofUrl);
            await deleteObject(oldFileRef).catch((err: any) => {
                if (err.code !== 'storage/object-not-found') console.warn("Old ID proof deletion failed:", err);
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
                    if (err.code !== 'storage/object-not-found') console.warn("Old ID proof deletion failed:", err);
                });
            }
            
            await new Promise<void>((resolve) => {
                Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (blob: any) => {
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
        toast({ title: 'File Error', description: `Could not process ID proof: ${uploadError.message}`, variant: 'destructive' });
        setIsSubmitting(false);
        return;
    }

    const { idProofFile, idProofDeleted, ...beneficiaryDataFromForm } = data;
    
    const { status, kitAmount, zakatAllocation, ...masterData } = beneficiaryDataFromForm;
    const finalMasterData: Partial<Beneficiary> = {
        ...masterData,
        idProofUrl,
    };
    
    const initiativeData: Partial<Beneficiary> = {
        ...beneficiaryDataFromForm,
        idProofUrl,
        id: beneficiaryId
    };

    const masterUpdateResult = await updateMasterBeneficiaryAction(
        beneficiaryId, 
        finalMasterData,
        { id: currentUserProfile.id, name: currentUserProfile.name }
    );
    
    if (!masterUpdateResult.success) {
        toast({ title: 'Update Failed', description: masterUpdateResult.message, variant: 'destructive' });
        setIsSubmitting(false);
        return;
    }

    if (initiativeContext) {
        const initiativeUpdateResult = await updateInitiativeBeneficiaryDetailsAction(
            initiativeContext.type,
            initiativeContext.id,
            beneficiaryId,
            initiativeData
        );
        if (!initiativeUpdateResult.success) {
            toast({ title: 'Partial Success', description: `Master details saved, but failed to update initiative-specific data: ${initiativeUpdateResult.message}`, variant: 'destructive'});
            setIsSubmitting(false);
            return;
        }
    }

    toast({ title: 'Success', description: 'Beneficiary updated successfully.', variant: 'success' });
    if (redirectUrl) {
        router.push(redirectUrl);
    } else {
        forceRefetch();
        setIsEditMode(false);
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
        toast({ title: "Status Updated", description: `Status set to ${newStatus}.`, variant: "success"});
        fetchLinkedInitiatives();
    } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
    setIsUpdatingStatus(false);
  }

  const isLoading = isBeneficiaryLoading || isProfileLoading || isInitiativeDataLoading;
  const backHref = redirectUrl || '/beneficiaries';

  if (isLoading && !formBeneficiaryData) {
    return <BrandedLoader />;
  }

  if (beneficiaryError) {
    return (
      <main className="container mx-auto p-4 md:p-8">
        <div className="mb-4"><Button variant="outline" asChild><Link href={backHref}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
        <Card className="max-w-2xl mx-auto">
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Could not load data.</AlertTitle>
              <AlertDescription><p>{beneficiaryError.message}</p></AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (!beneficiary) {
     return (
        <main className="container mx-auto p-4 md:p-8">
            <div className="mb-4"><Button variant="outline" asChild><Link href={backHref}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
             <Card className="max-w-2xl mx-auto"><CardHeader><CardTitle>Not Found</CardTitle></CardHeader><CardContent><p>The beneficiary does not exist.</p></CardContent></Card>
        </main>
     )
  }

  const initiativeName = campaign?.name || lead?.name;
  const initiativeType = campaign ? 'Campaign' : lead ? 'Lead' : null;
  const initiativeId = initiativeContext?.id;

  const canReadSummary = currentUserProfile?.role === 'Admin' || (initiativeType === 'Campaign' ? !!getNestedValue(currentUserProfile, 'permissions.campaigns.summary.read', false) : !!getNestedValue(currentUserProfile, 'permissions.leads-members.summary.read', false));
  const canReadRation = initiativeType === 'Campaign' && (currentUserProfile?.role === 'Admin' || !!getNestedValue(currentUserProfile, 'permissions.campaigns.ration.read', false));
  const canReadBeneficiaries = currentUserProfile?.role === 'Admin' || (initiativeType === 'Campaign' ? !!getNestedValue(currentUserProfile, 'permissions.campaigns.beneficiaries.read', false) : !!getNestedValue(currentUserProfile, 'permissions.leads-members.beneficiaries.read', false));
  const canReadDonations = currentUserProfile?.role === 'Admin' || (initiativeType === 'Campaign' ? !!getNestedValue(currentUserProfile, 'permissions.campaigns.donations.read', false) : !!getNestedValue(currentUserProfile, 'permissions.leads-members.donations.read', false));

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to {initiativeName || 'Beneficiaries'}
          </Link>
        </Button>
      </div>

      {initiativeName && initiativeId && initiativeType && (
          <div className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="space-y-1">
                      <h1 className="text-3xl font-bold">{initiativeName}</h1>
                      <p className="text-muted-foreground">{initiativeType}</p>
                  </div>
              </div>
              <div className="border-b mb-4">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2">
                        {canReadSummary && (
                            <Link href={`/${initiativeType.toLowerCase()}-members/${initiativeId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Summary</Link>
                        )}
                        {canReadRation && (
                            <Link href={`/campaign-members/${initiativeId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Item Lists</Link>
                        )}
                        {initiativeType === 'Lead' && (
                             <Link href={`/leads-members/${initiativeId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Item List</Link>
                        )}
                        {canReadBeneficiaries && (
                            <Link href={`/${initiativeType.toLowerCase()}-members/${initiativeId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "bg-primary text-primary-foreground shadow")}>Beneficiary Details</Link>
                        )}
                        {canReadDonations && (
                            <Link href={`/${initiativeType.toLowerCase()}-members/${initiativeId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Donations</Link>
                        )}
                    </div>
                </ScrollArea>
            </div>
          </div>
      )}

      <Card className="max-w-2xl mx-auto animate-fade-in-zoom">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                  <CardTitle>Beneficiary: {beneficiary.name}</CardTitle>
                  <CardDescription>View or edit beneficiary details.</CardDescription>
              </div>
              {canUpdate && !isEditMode && (
                  <Button onClick={() => setIsEditMode(true)}><Edit className="mr-2 h-4 w-4"/>Edit</Button>
              )}
          </div>
        </CardHeader>
        <CardContent>
          {!canUpdate && (
              <Alert><ShieldAlert className="h-4 w-4" /><AlertTitle>Read-Only</AlertTitle><AlertDescription>You do not have permission to edit.</AlertDescription></Alert>
          )}
          <BeneficiaryForm
              beneficiary={formBeneficiaryData}
              onSubmit={handleSave}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
              isLoading={isBeneficiaryLoading || isInitiativeDataLoading}
              isReadOnly={!isEditMode}
              itemCategories={[]}
              kitAmountLabel="Kit Amount (₹)"
              isSessionLoading={isProfileLoading}
              hideKitAmount={true}
              hideZakatAllocation={!initiativeContext}
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '200ms'}}>
        <CardHeader><CardTitle>Linked Initiatives</CardTitle></CardHeader>
        <CardContent>
            {isLinksLoading ? (
                <div className="flex justify-center items-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2">Scanning...</span></div>
            ) : linkedInitiatives.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount (₹)</TableHead>{canUpdate && <TableHead className="w-[100px] text-right">Actions</TableHead>}</TableRow></TableHeader>
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
                                    <TableCell><Badge variant={link.beneficiaryStatus === 'Given' || link.beneficiaryStatus === 'Verified' ? 'success' : 'secondary'}>{link.beneficiaryStatus}</Badge></TableCell>
                                    <TableCell className="text-right font-mono">₹{link.kitAmount.toFixed(2)}</TableCell>
                                    {canUpdate && (
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isUpdatingStatus}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuSub>
                                                        <DropdownMenuSubTrigger><ChevronsUpDown className="mr-2 h-4 w-4" />Status</DropdownMenuSubTrigger>
                                                        <DropdownMenuPortal>
                                                            <DropdownMenuSubContent>
                                                                <DropdownMenuRadioGroup value={link.beneficiaryStatus} onValueChange={(s) => handleInitiativeStatusChange(link, s as any)}>
                                                                    <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Given">Given</DropdownMenuRadioItem>
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
                <p className="text-sm text-muted-foreground text-center py-4">Not linked to any initiatives.</p>
            )}
        </CardContent>
      </Card>
    </main>
  );
}