'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useFirestore, useStorage, useAuth, useMemoFirebase, useDoc, getDocs, getDoc, doc, type DocumentReference, collection, storageRef, uploadBytes, getDownloadURL } from '@/firebase';
import Resizer from 'react-image-file-resizer';
import type { Beneficiary, Campaign, Lead } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Edit, MoreHorizontal, Eye, Loader2, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { useToast } from '@/hooks/use-toast';
import { updateMasterBeneficiaryAction, updateInitiativeBeneficiaryDetailsAction, updateBeneficiaryStatusInInitiativeAction } from '../actions';
import { useSession } from '@/hooks/use-session';
import { BrandedLoader } from '@/components/branded-loader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
        const camps = await getDocs(collection(firestore, 'campaigns'));
        for (const c of camps.docs) {
            const bRef = doc(firestore, `campaigns/${c.id}/beneficiaries`, beneficiary.id);
            const bSnap = await getDoc(bRef);
            if (bSnap.exists()) {
                const bData = bSnap.data() as Beneficiary;
                initiatives.push({ id: c.id, name: c.data().name, type: 'Campaign', status: c.data().status, kitAmount: bData.kitAmount || 0, beneficiaryStatus: bData.status || 'Pending' });
            }
        }
        const lds = await getDocs(collection(firestore, 'leads'));
        for (const l of lds.docs) {
            const bRef = doc(firestore, `leads/${l.id}/beneficiaries`, beneficiary.id);
            const bSnap = await getDoc(bRef);
            if (bSnap.exists()) {
                const bData = bSnap.data() as Beneficiary;
                initiatives.push({ id: l.id, name: l.data().name, type: 'Lead', status: l.data().status, kitAmount: bData.kitAmount || 0, beneficiaryStatus: bData.status || 'Pending' });
            }
        }
        setLinkedInitiatives(initiatives);
    } finally { setIsLinksLoading(false); }
  }, [firestore, beneficiary]);

  useEffect(() => { if (beneficiary) fetchLinkedInitiatives(); }, [beneficiary, fetchLinkedInitiatives]);

  const canUpdate = currentUserProfile?.role === 'Admin' || !!getNestedValue(currentUserProfile, 'permissions.beneficiaries.update', false);

  const handleSave = async (data: BeneficiaryFormData) => {
    if (!beneficiaryId || !canUpdate || !currentUserProfile || !storage) return;
    setIsSubmitting(true);
    
    let idProofUrl = beneficiary?.idProofUrl || '';
    const fileList = data.idProofFile as FileList | undefined;
    if (fileList && fileList.length > 0) {
        const file = fileList[0];
        const resized = await new Promise<Blob>((res) => { Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (b: any) => res(b as Blob), 'blob'); });
        const fRef = storageRef(storage, `beneficiaries/${beneficiaryId}/id_proof.png`);
        await uploadBytes(fRef, resized);
        idProofUrl = await getDownloadURL(fRef);
    }

    const { idProofFile, idProofDeleted, ...formData } = data;
    const { status, kitAmount, zakatAllocation, ...masterData } = formData;
    
    await updateMasterBeneficiaryAction(beneficiaryId, { ...masterData, idProofUrl, addedDate: beneficiary?.addedDate || new Date().toISOString().split('T')[0] }, { id: currentUserProfile.id, name: currentUserProfile.name });
    
    if (initiativeContext) {
        await updateInitiativeBeneficiaryDetailsAction(initiativeContext.type, initiativeContext.id, beneficiaryId, { ...formData, idProofUrl, id: beneficiaryId });
    }

    toast({ title: 'Success', description: 'Beneficiary Updated.' });
    if (redirectUrl) router.push(redirectUrl);
    else { forceRefetchMaster(); setIsEditMode(false); }
    setIsSubmitting(false);
  };

  const handleInitiativeStatusChange = async (initiative: LinkedInitiative, newStatus: Beneficiary['status']) => {
    const res = await updateBeneficiaryStatusInInitiativeAction(initiative.type.toLowerCase() as any, initiative.id, beneficiaryId, newStatus);
    if (res.success) { fetchLinkedInitiatives(); toast({ title: "Updated" }); }
  };

  const isLoading = isBeneficiaryLoading || isProfileLoading || isInitiativeDataLoading;
  const backHref = redirectUrl || '/beneficiaries';

  if (isLoading && !formBeneficiaryData) return <BrandedLoader />;
  if (!beneficiary) return <p className="text-center mt-20">Not Found.</p>;

  const initiativeName = campaign?.name || lead?.name;
  const initiativeType = campaign ? 'Campaign' : lead ? 'Lead' : null;
  const initiativeId = initiativeContext?.id;

  const canReadSummary = currentUserProfile?.role === 'Admin' || (initiativeType === 'Campaign' ? !!getNestedValue(currentUserProfile, 'permissions.campaigns.summary.read', false) : !!getNestedValue(currentUserProfile, 'permissions.leads-members.summary.read', false));
  const canReadRation = initiativeType === 'Campaign' && (currentUserProfile?.role === 'Admin' || !!getNestedValue(currentUserProfile, 'permissions.campaigns.ration.read', false));
  const canReadBeneficiaries = currentUserProfile?.role === 'Admin' || (initiativeType === 'Campaign' ? !!getNestedValue(currentUserProfile, 'permissions.campaigns.beneficiaries.read', false) : !!getNestedValue(currentUserProfile, 'permissions.leads-members.beneficiaries.read', false));
  const canReadDonations = currentUserProfile?.role === 'Admin' || (initiativeType === 'Campaign' ? !!getNestedValue(currentUserProfile, 'permissions.campaigns.donations.read', false) : !!getNestedValue(currentUserProfile, 'permissions.leads-members.donations.read', false));

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
      <div className="mb-4"><Button variant="outline" asChild className="font-bold border-primary/20 text-primary"><Link href={backHref}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>

      {initiativeName && initiativeId && initiativeType && (
          <div className="space-y-4">
              <h1 className="text-3xl font-bold">{initiativeName}</h1>
              <div className="border-b">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2">
                        {canReadSummary && ( <Link href={`/${initiativeType.toLowerCase()}-members/${initiativeId}/summary`} className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 rounded-md">Summary</Link> )}
                        {canReadRation && ( <Link href={`/campaign-members/${initiativeId}`} className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 rounded-md">Item Lists</Link> )}
                        {initiativeType === 'Lead' && ( <Link href={`/leads-members/${initiativeId}`} className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 rounded-md">Item List</Link> )}
                        {canReadBeneficiaries && ( <Link href={`/${initiativeType.toLowerCase()}-members/${initiativeId}/beneficiaries`} className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md shadow">Beneficiary List</Link> )}
                        {canReadDonations && ( <Link href={`/${initiativeType.toLowerCase()}-members/${initiativeId}/donations`} className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 rounded-md">Donations</Link> )}
                    </div>
                </ScrollArea>
            </div>
          </div>
      )}

      <Card className="max-w-2xl mx-auto animate-fade-in-zoom border-primary/10 shadow-sm bg-white">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-primary/5">
          <CardTitle className="font-bold text-primary tracking-tight">Beneficiary: {beneficiary.name}</CardTitle>
          {canUpdate && !isEditMode && ( <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md"><Edit className="mr-2 h-4 w-4"/>Edit Details</Button> )}
        </CardHeader>
        <CardContent className="pt-6">
          <BeneficiaryForm beneficiary={formBeneficiaryData} onSubmit={handleSave} onCancel={() => setIsEditMode(false)} isSubmitting={isSubmitting} isLoading={isInitiativeDataLoading} isReadOnly={!isEditMode} itemCategories={[]} hideKitAmount={true} hideZakatAllocation={!initiativeContext} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl mx-auto animate-fade-in-up border-primary/10 shadow-sm bg-white">
        <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary tracking-tight">Linked Initiatives</CardTitle></CardHeader>
        <CardContent className="pt-6">
            {isLinksLoading ? ( <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /> ) : linkedInitiatives.length > 0 ? (
                <div className="border border-primary/10 rounded-lg overflow-x-auto shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#ECFDF5] text-[#14532D] font-bold border-b">
                            <tr>
                                <th className="px-4 py-3">Initiative Name</th>
                                <th className="px-4 py-3">Current Status</th>
                                <th className="px-4 py-3 text-right">Requirement (₹)</th>
                                {canUpdate && <th className="px-4 py-3 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {linkedInitiatives.map((link) => (
                                <tr key={link.id} className="border-b last:border-0 hover:bg-[#F0FDF4] transition-colors bg-white">
                                    <td className="px-4 py-3 align-middle"><Link href={link.type === 'Campaign' ? `/campaign-members/${link.id}/beneficiaries` : `/leads-members/${link.id}/beneficiaries`} className="font-bold text-primary hover:underline">{link.name}</Link></td>
                                    <td className="px-4 py-3 align-middle"><Badge variant="outline" className="font-bold uppercase text-[10px]">{link.beneficiaryStatus}</Badge></td>
                                    <td className="px-4 py-3 align-middle text-right font-mono font-bold text-primary">₹{link.kitAmount.toFixed(2)}</td>
                                    {canUpdate && (
                                        <td className="px-4 py-3 align-middle text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="rounded-[12px] border-primary/10 shadow-dropdown">
                                                    <DropdownMenuSub>
                                                        <DropdownMenuSubTrigger className="font-bold text-primary">Status</DropdownMenuSubTrigger>
                                                        <DropdownMenuPortal>
                                                            <DropdownMenuSubContent>
                                                                <DropdownMenuRadioGroup value={link.beneficiaryStatus} onValueChange={(s) => handleInitiativeStatusChange(link, s as any)}>
                                                                    <DropdownMenuRadioItem value="Pending" className="font-bold">Pending</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Verified" className="font-bold">Verified</DropdownMenuRadioItem>
                                                                    <DropdownMenuRadioItem value="Given" className="font-bold">Given</DropdownMenuRadioItem>
                                                                </DropdownMenuRadioGroup>
                                                            </DropdownMenuSubContent>
                                                        </DropdownMenuPortal>
                                                    </DropdownMenuSub>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : ( <p className="text-sm text-muted-foreground text-center py-8 italic font-normal">No Linked Initiatives Found.</p> )}
        </CardContent>
      </Card>
    </main>
  );
}