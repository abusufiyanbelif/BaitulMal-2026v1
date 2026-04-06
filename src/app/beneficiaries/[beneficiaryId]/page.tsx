'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { 
    useFirestore, 
    useStorage, 
    useMemoFirebase, 
    useDoc, 
    doc, 
    getDocs, 
    getDoc, 
    collection, 
    storageRef, 
    uploadBytes, 
    getDownloadURL,
    type DocumentReference 
} from '@/firebase';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';
import Resizer from 'react-image-file-resizer';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Edit, MoreHorizontal, Loader2, ChevronDown, User, History, IndianRupee, Landmark, Lightbulb, FolderKanban, ShieldCheck, Calendar, Info, HeartHandshake, CheckCircle2, Target, Hourglass, ChevronsUpDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSubContent, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { useToast } from '@/hooks/use-toast';
import { updateMasterBeneficiaryAction, updateInitiativeBeneficiaryDetailsAction, updateBeneficiaryStatusInInitiativeAction } from '../actions';
import { useSession } from '@/hooks/use-session';
import { BrandedLoader } from '@/components/branded-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

interface LinkedInitiative {
    id: string;
    name: string;
    type: 'Campaign' | 'Lead';
    initiativeStatus: Campaign['status'] | Lead['status'];
    purpose: string;
    category?: string;
    kitAmount: number;
    zakatAllocation: number;
    beneficiaryStatus: Beneficiary['status'];
    addedDate: string;
}

export default function BeneficiaryDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const beneficiaryId = String(params.beneficiaryId || '');
  const redirectUrl = searchParams.get('redirect');

  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const { userProfile: currentUserProfile, isLoading: isProfileLoading } = useSession();
  
  const [initiativeContext, setInitiativeContext] = useState<{ type: 'campaign' | 'lead', id: string } | null>(null);
  const [initiativeBeneficiaryData, setInitiativeBeneficiaryData] = useState<Partial<Beneficiary> | null>(null);
  const [isInitiativeDataLoading, setIsInitiativeDataLoading] = useState(false);

  useEffect(() => {
    if (redirectUrl) {
      if (redirectUrl.includes('campaign-members/') && redirectUrl.split('/')[2]) {
        setInitiativeContext({ type: 'campaign', id: redirectUrl.split('/')[2] });
      } else if (redirectUrl.includes('leads-members/') && redirectUrl.split('/')[2]) {
        setInitiativeContext({ type: 'lead', id: redirectUrl.split('/')[2] });
      }
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
            if (docSnap.exists()) setInitiativeBeneficiaryData(docSnap.data() as Beneficiary);
        }).finally(() => setIsInitiativeDataLoading(false));
    }
  }, [initiativeContext, firestore, beneficiaryId]);

  const { data: beneficiary, isLoading: isBeneficiaryLoading, forceRefetch: forceRefetchMaster } = useDoc<Beneficiary>(beneficiaryDocRef);
  
  const formBeneficiaryData = useMemo(() => {
      if (!beneficiary) return null;
      return { ...beneficiary, ...initiativeBeneficiaryData };
  }, [beneficiary, initiativeBeneficiaryData]);

  const [linkedInitiatives, setLinkedInitiatives] = useState<LinkedInitiative[]>([]);
  const [isLinksLoading, setIsLinksLoading] = useState(true);

  const fetchLinkedInitiatives = useCallback(async () => {
    if (!firestore || !beneficiary) return;
    setIsLinksLoading(true);
    try {
        const initiatives: LinkedInitiative[] = [];
        
        // Fetch from Campaigns
        const camps = await getDocs(collection(firestore, 'campaigns'));
        for (const c of camps.docs) {
            const bRef = doc(firestore, `campaigns/${c.id}/beneficiaries`, beneficiary.id);
            const bSnap = await getDoc(bRef);
            if (bSnap.exists()) {
                const bData = bSnap.data() as Beneficiary;
                const cData = c.data() as Campaign;
                initiatives.push({ 
                    id: c.id, 
                    name: cData.name, 
                    type: 'Campaign', 
                    initiativeStatus: cData.status, 
                    purpose: cData.category || 'General',
                    category: bData.itemCategoryName || 'N/A',
                    kitAmount: bData.kitAmount || 0, 
                    zakatAllocation: bData.zakatAllocation || 0,
                    beneficiaryStatus: bData.status || 'Pending',
                    addedDate: bData.addedDate || 'N/A'
                });
            }
        }

        // Fetch from Leads
        const lds = await getDocs(collection(firestore, 'leads'));
        for (const l of lds.docs) {
            const bRef = doc(firestore, `leads/${l.id}/beneficiaries`, beneficiary.id);
            const bSnap = await getDoc(bRef);
            if (bSnap.exists()) {
                const bData = bSnap.data() as Beneficiary;
                const lData = l.data() as Lead;
                initiatives.push({ 
                    id: l.id, 
                    name: lData.name, 
                    type: 'Lead', 
                    initiativeStatus: lData.status, 
                    purpose: lData.purpose || 'Other',
                    category: lData.category || 'N/A',
                    kitAmount: bData.kitAmount || 0, 
                    zakatAllocation: bData.zakatAllocation || 0,
                    beneficiaryStatus: bData.status || 'Pending',
                    addedDate: bData.addedDate || 'N/A'
                });
            }
        }
        setLinkedInitiatives(initiatives);
    } catch (e) {
        console.error("Link fetch failed:", e);
    } finally { setIsLinksLoading(false); }
  }, [firestore, beneficiary]);

  useEffect(() => { if (beneficiary) fetchLinkedInitiatives(); }, [beneficiary, fetchLinkedInitiatives]);

  const canUpdate = currentUserProfile?.role === 'Admin' || !!getNestedValue(currentUserProfile, 'permissions.beneficiaries.update', false);

  const handleSave = async (data: BeneficiaryFormData) => {
    if (!beneficiaryId || !canUpdate || !currentUserProfile || !storage) return;
    setIsSubmitting(true);
    
    try {
        let idProofUrl = beneficiary?.idProofUrl || '';
        const fileList = data.idProofFile as FileList | undefined;
        if (fileList && fileList.length > 0) {
            const file = fileList[0];
            const resized = await new Promise<Blob>((res) => { (Resizer as any).imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (b: any) => res(b as Blob), 'blob'); });
            const fRef = storageRef(storage, `beneficiaries/${beneficiaryId}/id_proof.png`);
            await uploadBytes(fRef, resized);
            idProofUrl = await getDownloadURL(fRef);
        }

        const { idProofFile, idProofDeleted, ...formData } = data;
        const { status, kitAmount, zakatAllocation, ...masterData } = formData;
        
        const masterRes = await updateMasterBeneficiaryAction(beneficiaryId, { ...masterData, idProofUrl, addedDate: beneficiary?.addedDate || new Date().toISOString().split('T')[0] }, { id: currentUserProfile.id, name: currentUserProfile.name });
        
        if (!masterRes.success) throw new Error(masterRes.message);

        if (initiativeContext) {
            const initRes = await updateInitiativeBeneficiaryDetailsAction(initiativeContext.type, initiativeContext.id, beneficiaryId, { ...formData, idProofUrl, id: beneficiaryId });
            if (!initRes.success) throw new Error(initRes.message);
        }

        toast({ title: 'Success', description: 'Beneficiary record updated successfully.', variant: 'success' });
        if (redirectUrl) router.push(redirectUrl);
        else { forceRefetchMaster(); setIsEditMode(false); }
    } catch (error: any) {
        toast({ title: 'Update Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleInitiativeStatusChange = async (initiative: LinkedInitiative, newStatus: Beneficiary['status']) => {
    setIsSubmitting(true);
    try {
        const res = await updateBeneficiaryStatusInInitiativeAction(initiative.type.toLowerCase() as any, initiative.id, beneficiaryId, newStatus);
        if (res && res.success) { 
            fetchLinkedInitiatives(); 
            toast({ title: "Status Updated", description: `Disbursement status set to ${newStatus}.`, variant: "success" }); 
        } else {
            throw new Error(res.message);
        }
    } catch (error: any) {
        toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const isLoading = isBeneficiaryLoading || isProfileLoading || isInitiativeDataLoading;
  const backHref = redirectUrl || '/beneficiaries';

  const financialSummary = useMemo(() => {
      return linkedInitiatives.reduce((acc, curr) => {
          acc.requested += curr.kitAmount;
          if (curr.beneficiaryStatus === 'Given') {
              acc.disbursed += curr.kitAmount;
              acc.zakatDisbursed += curr.zakatAllocation;
          } else if (curr.beneficiaryStatus === 'Verified') {
              acc.verified += curr.kitAmount;
              acc.zakatVerified += curr.zakatAllocation;
          } else {
              acc.pending += curr.kitAmount;
          }
          return acc;
      }, { requested: 0, disbursed: 0, verified: 0, pending: 0, zakatDisbursed: 0, zakatVerified: 0 });
  }, [linkedInitiatives]);

  if (isLoading && !formBeneficiaryData) return <BrandedLoader message="Syncing Profile Hub..." />;
  if (!beneficiary) return <p className="text-center mt-20 text-primary font-bold">Beneficiary Profile Not Found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal">
      {isSubmitting && <BrandedLoader message="Updating Beneficiary Records..." />}
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
            <Link href={backHref}><ArrowLeft className="mr-2 h-4 w-4" /> Back To List</Link>
        </Button>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-bold border-primary/10 text-primary/60 capitalize">ID: {beneficiary.idNumber || 'N/A'}</Badge>
            <Badge variant={beneficiary.status === 'Verified' ? 'eligible' : 'outline'} className="font-bold text-[10px] capitalize">{beneficiary.status}</Badge>
        </div>
      </div>

      <div className="space-y-4 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h1 className="text-4xl font-bold tracking-tight text-primary">{beneficiary.name}</h1>
              {beneficiary.phone && (
                  <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-fit font-bold border-green-200 text-green-600 hover:bg-green-50 rounded-full px-4"
                      onClick={() => window.open(`https://wa.me/91${beneficiary.phone?.replace(/\D/g, '')}`, '_blank')}
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="mr-2">
                          <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.06 3.973L0 16l4.204-1.102a7.923 7.923 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                      </svg>
                      Message on WhatsApp
                  </Button>
              )}
          </div>
          <p className="text-sm text-muted-foreground font-normal">System Entry Recorded On: {beneficiary.addedDate}</p>
      </div>

      <Tabs defaultValue="profile" className="w-full space-y-6">
        <ScrollArea className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:w-[600px] h-12 bg-primary/5 p-1 rounded-xl">
                <TabsTrigger value="profile" className="font-bold data-[state=active]:shadow-sm"><User className="mr-2 h-4 w-4"/>Core Profile</TabsTrigger>
                <TabsTrigger value="history" className="font-bold data-[state=active]:shadow-sm"><History className="mr-2 h-4 w-4"/>History</TabsTrigger>
                <TabsTrigger value="financials" className="font-bold data-[state=active]:shadow-sm"><Landmark className="mr-2 h-4 w-4"/>Financial Impact</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>

        <TabsContent value="profile" className="animate-fade-in-up mt-0">
            <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between border-b bg-primary/5 px-6 py-4">
                    <div className="space-y-0.5">
                        <CardTitle className="text-lg font-bold text-primary tracking-tight">Beneficiary Master Record</CardTitle>
                        <CardDescription className="text-xs font-normal">Personal Details and Identification Evidence.</CardDescription>
                    </div>
                    {canUpdate && !isEditMode && ( 
                        <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md active:scale-95 transition-transform">
                            <Edit className="mr-2 h-4 w-4"/>Edit Profile
                        </Button> 
                    )}
                </CardHeader>
                <CardContent className="p-6 sm:p-10">
                    <BeneficiaryForm 
                        beneficiary={formBeneficiaryData} 
                        onSubmit={handleSave} 
                        onCancel={() => setIsEditMode(false)} 
                        isSubmitting={isSubmitting} 
                        isLoading={isInitiativeDataLoading} 
                        isReadOnly={!isEditMode} 
                        itemCategories={[]} 
                        hideKitAmount={true} 
                        hideZakatAllocation={!initiativeContext} 
                    />
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="history" className="animate-fade-in-up mt-0">
            <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-primary/5 border-b px-6 py-4">
                    <CardTitle className="text-lg font-bold text-primary tracking-tight">Assistance Registry</CardTitle>
                    <CardDescription className="text-xs font-normal">A Chronological Log Of All Support Initiatives Linked To This Recipient.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLinksLoading ? ( 
                        <div className="py-20 flex flex-col items-center gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-[10px] font-bold text-primary/60 tracking-tight capitalize">Scanning Databases...</p>
                        </div>
                    ) : linkedInitiatives.length > 0 ? (
                        <ScrollArea className="w-full">
                            <div className="min-w-[1000px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-6 font-bold text-primary text-[10px] capitalize tracking-tight">Initiative Name</TableHead>
                                            <TableHead className="font-bold text-primary text-[10px] capitalize tracking-tight">Purpose / Type</TableHead>
                                            <TableHead className="font-bold text-primary text-[10px] capitalize tracking-tight">Category</TableHead>
                                            <TableHead className="text-center font-bold text-primary text-[10px] capitalize tracking-tight">Verification</TableHead>
                                            <TableHead className="text-right font-bold text-primary text-[10px] capitalize tracking-tight">Added Date</TableHead>
                                            <TableHead className="text-right font-bold text-primary text-[10px] capitalize tracking-tight">Allocation (₹)</TableHead>
                                            <TableHead className="text-right pr-6 font-bold text-primary text-[10px] capitalize tracking-tight">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {linkedInitiatives.map((link) => (
                                            <TableRow key={`${link.type}_${link.id}`} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors border-b border-primary/5 bg-white">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                            {link.type === 'Campaign' ? <FolderKanban className="h-4 w-4"/> : <Lightbulb className="h-4 w-4"/>}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-sm text-primary truncate hover:underline underline-offset-4">
                                                                <Link href={link.type === 'Campaign' ? `/campaign-members/${link.id}/beneficiaries` : `/leads-members/${link.id}/beneficiaries`}>
                                                                    {link.name}
                                                                </Link>
                                                            </p>
                                                            <p className="text-[10px] font-normal text-muted-foreground tracking-tight capitalize">{link.type} • {link.initiativeStatus}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant="outline" className="text-[10px] font-bold border-primary/10 text-primary/70 capitalize">{link.purpose}</Badge></TableCell>
                                                <TableCell><p className="text-xs font-bold text-primary/80 capitalize">{link.category}</p></TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={link.beneficiaryStatus === 'Given' ? 'given' : 'outline'} className="font-bold text-[9px] capitalize">
                                                        {link.beneficiaryStatus}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right"><p className="text-xs font-mono opacity-60">{link.addedDate}</p></TableCell>
                                                <TableCell className="text-right">
                                                    <p className="font-bold font-mono text-sm text-primary">₹{link.kitAmount.toLocaleString('en-IN')}</p>
                                                    {link.zakatAllocation > 0 && <p className="text-[9px] font-bold text-primary/60 tracking-tight capitalize">Zakat: ₹{link.zakatAllocation.toLocaleString('en-IN')}</p>}
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div onClick={e => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                                                                <DropdownMenuSub>
                                                                    <DropdownMenuSubTrigger className="font-normal text-primary">Disbursement status</DropdownMenuSubTrigger>
                                                                    <DropdownMenuPortal>
                                                                        <DropdownMenuSubContent>
                                                                            <DropdownMenuRadioGroup value={link.beneficiaryStatus} onValueChange={(s) => handleInitiativeStatusChange(link, s as any)}>
                                                                                <DropdownMenuRadioItem value="Pending" className="text-xs font-normal">Pending</DropdownMenuRadioItem>
                                                                                <DropdownMenuRadioItem value="Verified" className="text-xs font-normal">Verified</DropdownMenuRadioItem>
                                                                                <DropdownMenuRadioItem value="Given" className="text-xs font-normal">Given (Completed)</DropdownMenuRadioItem>
                                                                            </DropdownMenuRadioGroup>
                                                                        </DropdownMenuSubContent>
                                                                    </DropdownMenuPortal>
                                                                </DropdownMenuSub>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem asChild className="text-primary font-normal">
                                                                    <Link href={link.type === 'Campaign' ? `/campaign-members/${link.id}/beneficiaries` : `/leads-members/${link.id}/beneficiaries`}>
                                                                        <ArrowLeft className="mr-2 h-4 w-4" /> View In Context
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <ScrollBar orientation="horizontal" className="h-1.5" />
                        </ScrollArea>
                    ) : ( 
                        <div className="flex flex-col items-center justify-center py-20 opacity-40">
                            <Info className="h-12 w-12 mb-2" />
                            <p className="text-sm font-bold italic">No Assistance Records Linked To This Profile.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="financials" className="animate-fade-in-up mt-0">
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="border-primary/10 bg-white transition-all hover:shadow-lg">
                    <CardHeader className="p-4 flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-bold tracking-tight text-primary capitalize">Total Assistance Value</CardTitle>
                        <Target className="h-4 w-4 text-primary opacity-40" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-3xl font-bold text-primary font-mono">₹{financialSummary.requested.toLocaleString('en-IN')}</div>
                        <p className="text-[10px] font-normal text-muted-foreground mt-1">Combined Value Of All Linked Requirements</p>
                    </CardContent>
                </Card>
                <Card className="border-primary/10 bg-white transition-all hover:shadow-lg">
                    <CardHeader className="p-4 flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-bold tracking-tight text-primary capitalize">Verified (Secured)</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-primary opacity-40" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-3xl font-bold text-primary font-mono">₹{financialSummary.verified.toLocaleString('en-IN')}</div>
                        <p className="text-[10px] font-normal text-muted-foreground mt-1">Reserved Funds For This Member</p>
                    </CardContent>
                </Card>
                <Card className="border-primary/10 bg-white transition-all hover:shadow-lg">
                    <CardHeader className="p-4 flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-bold tracking-tight text-primary capitalize">Disbursed (Given)</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-primary opacity-40" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-3xl font-bold text-primary font-mono">₹{financialSummary.disbursed.toLocaleString('en-IN')}</div>
                        <p className="text-[10px] font-normal text-muted-foreground mt-1">Confirmed Value Successfully Provided</p>
                    </CardContent>
                </Card>

                <Card className="md:col-span-3 border-primary/10 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b px-6 py-4">
                        <CardTitle className="text-lg font-bold text-primary tracking-tight">Allocation Breakdown</CardTitle>
                        <CardDescription className="text-xs font-normal text-primary/60">Detailed Split Of Aid Across Initiatives, Identifying Source Funds And Current Disbursement Status.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="w-full">
                            <div className="min-w-[1000px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="pl-6 font-bold text-[10px] tracking-tight capitalize text-primary">Initiative Source</TableHead>
                                            <TableHead className="text-right font-bold text-[10px] tracking-tight capitalize text-primary">Requirement (₹)</TableHead>
                                            <TableHead className="text-right font-bold text-[10px] tracking-tight capitalize text-primary">Zakat Allocation (₹)</TableHead>
                                            <TableHead className="text-right font-bold text-[10px] tracking-tight capitalize text-primary">Community Fund (₹)</TableHead>
                                            <TableHead className="text-center font-bold text-[10px] tracking-tight capitalize text-primary">Financial Status</TableHead>
                                            <TableHead className="text-right pr-6 font-bold text-[10px] tracking-tight capitalize text-primary">Net Provision (₹)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {linkedInitiatives.map((link) => (
                                            <TableRow key={`fin_${link.type}_${link.id}`} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors border-b border-primary/5 bg-white">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 rounded-md bg-primary/5 text-primary">
                                                            {link.type === 'Campaign' ? <FolderKanban className="h-3.5 w-3.5"/> : <Lightbulb className="h-3.5 w-3.5"/>}
                                                        </div>
                                                        <p className="font-bold text-sm text-primary">{link.name}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-xs opacity-60">₹{link.kitAmount.toLocaleString('en-IN')}</TableCell>
                                                <TableCell className="text-right">
                                                    <p className="font-bold font-mono text-sm text-primary">₹{link.zakatAllocation.toLocaleString('en-IN')}</p>
                                                    <p className="text-[8px] font-bold text-muted-foreground tracking-tight capitalize">Reserved</p>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <p className="font-bold font-mono text-sm text-primary">₹{(link.kitAmount - link.zakatAllocation).toLocaleString('en-IN')}</p>
                                                    <p className="text-[8px] font-bold text-muted-foreground tracking-tight capitalize">Lillah / Sadaqah</p>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge 
                                                        variant={link.beneficiaryStatus === 'Given' ? 'given' : link.beneficiaryStatus === 'Verified' ? 'eligible' : 'outline'} 
                                                        className="font-bold text-[9px] capitalize"
                                                    >
                                                        {link.beneficiaryStatus === 'Given' ? 'Disbursed' : link.beneficiaryStatus === 'Verified' ? 'Secured' : 'Evaluation'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex flex-col items-end">
                                                        <span className={cn("font-bold font-mono text-sm text-primary")}>
                                                            ₹{link.kitAmount.toLocaleString('en-IN')}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-muted-foreground tracking-tight capitalize">Net Value</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {linkedInitiatives.length === 0 && (
                                            <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic font-normal">No Financial Records Available.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                    <TableFooter className="bg-primary/5 border-t">
                                        <TableRow>
                                            <TableCell className="pl-6 py-4 font-bold text-primary text-xs tracking-tight capitalize">Aggregate Totals</TableCell>
                                            <TableCell className="text-right font-bold font-mono text-primary text-xs">₹{financialSummary.requested.toLocaleString('en-IN')}</TableCell>
                                            <TableCell className="text-right font-bold font-mono text-primary text-xs">₹{(financialSummary.zakatDisbursed + financialSummary.zakatVerified).toLocaleString('en-IN')}</TableCell>
                                            <TableCell className="text-right font-bold font-mono text-primary text-xs">₹{(financialSummary.requested - (financialSummary.zakatDisbursed + financialSummary.zakatVerified)).toLocaleString('en-IN')}</TableCell>
                                            <TableCell colSpan={2} className="text-right pr-6 font-bold text-primary text-sm tracking-tighter">
                                                Net Assistance: ₹{financialSummary.requested.toLocaleString('en-IN')}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                            <ScrollBar orientation="horizontal" className="h-1.5" />
                        </ScrollArea>
                    </CardContent>
                </Card>

                <div className="md:col-span-3 space-y-6">
                    <Card className="border-primary/10 bg-white shadow-sm overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b px-6 py-4">
                            <CardTitle className="text-lg font-bold text-primary tracking-tight">Impact Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 sm:p-10 space-y-8 font-normal">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6 rounded-2xl bg-primary/[0.02] border border-primary/10">
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-primary tracking-tight capitalize">Religious Compliance Tracking</h4>
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] font-bold text-muted-foreground tracking-tight capitalize">Zakat Eligible</p>
                                            <Badge variant={beneficiary.isEligibleForZakat ? 'eligible' : 'outline'} className="font-bold capitalize">
                                                {beneficiary.isEligibleForZakat ? 'Confirmed' : 'Not Eligible'}
                                            </Badge>
                                        </div>
                                        <Separator orientation="vertical" className="h-8 hidden sm:block opacity-20" />
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] font-bold text-muted-foreground tracking-tight capitalize">Total Zakat Provision</p>
                                            <p className="text-sm font-bold text-primary font-mono">₹{(financialSummary.zakatDisbursed + financialSummary.zakatVerified).toLocaleString('en-IN')}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-primary bg-white p-4 rounded-xl border border-primary/5 shadow-sm">
                                    <CheckCircle2 className="h-5 w-5 text-primary" />
                                    <p className="text-sm font-bold tracking-tight capitalize">Audit Synchronized Site-Wide</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-primary tracking-tight flex items-center gap-2">
                                    <span className="font-normal"><Info className="h-4 w-4"/></span> Impact Analysis
                                </h4>
                                <p className="text-sm leading-relaxed text-muted-foreground font-normal">
                                    This Recipient Has Been Supported Across <span className="font-bold text-primary">{linkedInitiatives.length} Initiative(s)</span>. 
                                    Out Of The Total Requirement Of <span className="font-bold text-primary font-mono">₹{financialSummary.requested.toLocaleString('en-IN')}</span>, 
                                    The Organization Has Successfully Disbursed <span className="font-bold text-primary font-mono">₹{financialSummary.disbursed.toLocaleString('en-IN')}</span>. 
                                    {financialSummary.verified > 0 && ` An Additional ₹${financialSummary.verified.toLocaleString('en-IN')} Has Been Verified And Reserved For Future Provision.`}
                                    {financialSummary.zakatDisbursed > 0 && ` A Significant Portion (₹${financialSummary.zakatDisbursed.toLocaleString('en-IN')}) Was Provided From The Zakat Fund, Adhering Strictly To Religious Compliance For Poverty Alleviation.`}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
