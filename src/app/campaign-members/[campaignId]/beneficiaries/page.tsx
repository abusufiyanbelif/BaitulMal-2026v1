'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { 
    useFirestore, 
    useStorage, 
    useAuth, 
    useMemoFirebase, 
    useCollection, 
    useDoc, 
    collection, 
    doc, 
    serverTimestamp, 
    writeBatch, 
    setDoc, 
    DocumentReference 
} from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Beneficiary, Campaign, ItemCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { 
    ArrowLeft, 
    PlusCircle, 
    Loader2, 
    Eye, 
    CheckCircle2, 
    Hourglass, 
    XCircle, 
    Info, 
    ChevronsUpDown, 
    Users, 
    UserCheck, 
    FileUp, 
    Search,
    CopyPlus,
    MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BeneficiaryForm, type BeneficiaryFormData } from '@/components/beneficiary-form';
import { BeneficiarySearchDialog } from '@/components/beneficiary-search-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { updateMasterBeneficiaryAction } from '@/app/beneficiaries/actions';
import { BrandedLoader } from '@/components/branded-loader';

type BeneficiaryStatus = Beneficiary['status'];

const StatCard = ({ title, count, description, icon: Icon, colorClass }: { title: string, count: number, description: string, icon: any, colorClass?: string }) => (
    <Card className="flex-1 min-w-[150px]">
        <CardContent className="p-4 flex items-start justify-between">
            <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
                <p className="text-2xl font-black">{count}</p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">{description}</p>
            </div>
            <Icon className={cn("h-4 w-4", colorClass || "text-muted-foreground/40")} />
        </CardContent>
    </Card>
);

export default function BeneficiariesPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const campaignId = typeof params?.campaignId === "string" ? params.campaignId : "";
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const { userProfile, isLoading: isProfileLoading } = useSession();
  
  const campaignDocRef = useMemoFirebase(() => (firestore && campaignId) ? doc(firestore, 'campaigns', campaignId) as DocumentReference<Campaign> : null, [firestore, campaignId]);
  const { data: campaign, isLoading: isCampaignLoading } = useDoc<Campaign>(campaignDocRef);
  const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && campaignId) ? collection(firestore, 'campaigns', campaignId, 'beneficiaries') : null, [firestore, campaignId]);
  const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zakatFilter, setZakatFilter] = useState('All');
  const [referralFilter, setReferralFilter] = useState('All');

  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);

  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.update', false);

  const filteredBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    return beneficiaries.filter(b => {
        const matchesSearch = (b.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               b.phone?.includes(searchTerm) || 
                               b.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                               b.referralBy?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
        const matchesZakat = zakatFilter === 'All' || (zakatFilter === 'Eligible' ? b.isEligibleForZakat : !b.isEligibleForZakat);
        const matchesReferral = referralFilter === 'All' || b.referralBy === referralFilter;
        return matchesSearch && matchesStatus && matchesZakat && matchesReferral;
    });
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter, referralFilter]);

  const stats = useMemo(() => {
    if (!beneficiaries) return { total: 0, pending: 0, verified: 0, given: 0, hold: 0, needDetails: 0, totalAmount: 0 };
    return beneficiaries.reduce((acc, b) => {
        acc.total++;
        if (b.status === 'Pending') acc.pending++;
        else if (b.status === 'Verified') acc.verified++;
        else if (b.status === 'Given') acc.given++;
        else if (b.status === 'Hold') acc.hold++;
        else if (b.status === 'Need More Details') acc.needDetails++;
        acc.totalAmount += (b.kitAmount || 0);
        return acc;
    }, { total: 0, pending: 0, verified: 0, given: 0, hold: 0, needDetails: 0, totalAmount: 0 });
  }, [beneficiaries]);

  const uniqueReferrals = useMemo(() => {
    if (!beneficiaries) return [];
    return Array.from(new Set(beneficiaries.map(b => b.referralBy).filter(Boolean))).sort();
  }, [beneficiaries]);

  const groupedBeneficiaries = useMemo(() => {
    const groups: Record<string, Beneficiary[]> = {};
    filteredBeneficiaries.forEach(b => {
        const catName = b.itemCategoryName || 'Uncategorized';
        if (!groups[catName]) groups[catName] = [];
        groups[catName].push(b);
    });
    return groups;
  }, [filteredBeneficiaries]);

  const handleStatusChange = (beneficiary: Beneficiary, newStatus: BeneficiaryStatus) => {
    if (!firestore || !campaignId || !canUpdate) return;
    const ref = doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiary.id);
    const updateData = { status: newStatus };
    setDoc(ref, updateData, { merge: true }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: updateData })));
  };

  const handleZakatToggle = (beneficiary: Beneficiary) => {
    if (!canUpdate || !userProfile || !firestore || !campaignId) return;
    const newZakatStatus = !beneficiary.isEligibleForZakat;
    const ref = doc(firestore, 'campaigns', campaignId, 'beneficiaries', beneficiary.id);
    setDoc(ref, { isEligibleForZakat: newZakatStatus }, { merge: true }).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: { isEligibleForZakat: newZakatStatus } })));
    updateMasterBeneficiaryAction(beneficiary.id, { isEligibleForZakat: newZakatStatus }, { id: userProfile.id, name: userProfile.name });
  };

  const handleFormSubmit = async (data: BeneficiaryFormData, masterIdOrEvent?: string | React.BaseSyntheticEvent) => {
    setIsSubmitting(true);
    if (!firestore || !storage || !campaignId || !userProfile || !campaign) { setIsSubmitting(false); return; }
    const masterId = typeof masterIdOrEvent === 'string' ? masterIdOrEvent : undefined;
    const batch = writeBatch(firestore);
    const masterRef = masterId ? doc(firestore, 'beneficiaries', masterId) : doc(collection(firestore, 'beneficiaries'));
    const campRef = doc(firestore, 'campaigns', campaignId, 'beneficiaries', masterRef.id);
    
    let idProofUrl = '';
    const fileList = data.idProofFile as FileList | undefined;
    if (fileList && fileList.length > 0) {
        const file = fileList[0];
        const resized = await new Promise<Blob>((resolve) => { Resizer.imageFileResizer(file, 1024, 1024, 'PNG', 100, 0, (b: any) => resolve(b as Blob), 'blob'); });
        const fRef = storageRef(storage, `beneficiaries/${masterRef.id}/id_proof.png`);
        await uploadBytes(fRef, resized);
        idProofUrl = await getDownloadURL(fRef);
    }

    const { idProofFile, idProofDeleted, ...rest } = data;
    const fullData = { ...rest, id: masterRef.id, idProofUrl, addedDate: new Date().toISOString().split('T')[0], createdAt: serverTimestamp(), createdById: userProfile.id, createdByName: userProfile.name };
    const { status, kitAmount, zakatAllocation, ...masterData } = fullData;
    
    batch.set(masterRef, masterData, { merge: true });
    batch.set(campRef, fullData, { merge: true });
    batch.update(doc(firestore, 'campaigns', campaignId), { targetAmount: (campaign.targetAmount || 0) + (data.kitAmount || 0) });
    
    await batch.commit().then(() => { toast({ title: 'Success', description: 'Beneficiary added.' }); setIsFormOpen(false); }).catch(e => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: campRef.path, operation: 'create' })));
    setIsSubmitting(false);
  };

  if (isCampaignLoading || areBeneficiariesLoading || isProfileLoading) return <BrandedLoader />;
  if (!campaign) return <p className="text-center mt-20">Campaign not found.</p>;

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="mb-4"><Button variant="outline" asChild><Link href="/campaign-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button></div>
        <h1 className="text-3xl font-black tracking-tight text-primary uppercase">{campaign.name}</h1>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 pb-2">
                    {canReadSummary && ( <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground uppercase tracking-wider")}>Summary</Link> )}
                    {canReadRation && ( <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground uppercase tracking-wider")}>Item Lists</Link> )}
                    {canReadBeneficiaries && ( <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "bg-primary text-primary-foreground shadow uppercase tracking-wider")}>Beneficiary List</Link> )}
                    {canReadDonations && ( <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground uppercase tracking-wider")}>Donations</Link> )}
                </div>
            </ScrollArea>
        </div>

        <Card className="animate-fade-in-zoom shadow-md border-primary/10">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black text-primary">Beneficiary List ({stats.total})</CardTitle>
                        <CardDescription className="font-bold text-foreground">Total amount for filtered beneficiaries: <span className="text-primary font-mono">₹{filteredBeneficiaries.reduce((sum, b) => sum + (b.kitAmount || 0), 0).toFixed(2)}</span></CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => {}} className="gap-2 font-bold"><FileUp className="h-4 w-4"/> Import Data</Button>
                        <Button variant="outline" size="sm" onClick={() => setIsSearchOpen(true)} className="gap-2 font-bold"><CopyPlus className="h-4 w-4"/> Add from Existing</Button>
                        <Button size="sm" onClick={() => setIsFormOpen(true)} className="gap-2 font-bold"><PlusCircle className="h-4 w-4"/> Add New Beneficiary</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard title="Total" count={stats.total} description="All beneficiaries" icon={Users} />
                    <StatCard title="Pending" count={stats.pending} description="Awaiting verification" icon={Hourglass} colorClass="text-amber-500" />
                    <StatCard title="Verified" count={stats.verified} description="Need confirmed" icon={CheckCircle2} colorClass="text-blue-500" />
                    <StatCard title="Given" count={stats.given} description="Kits distributed" icon={UserCheck} colorClass="text-green-600" />
                    <StatCard title="Hold" count={stats.hold} description="Temporarily on hold" icon={XCircle} colorClass="text-destructive" />
                    <StatCard title="Need Details" count={stats.needDetails} description="More info needed" icon={Info} colorClass="text-muted-foreground" />
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-lg border">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by name, phone, address, referral..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 text-xs" />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-9 text-xs font-bold"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                        <SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Verified">Verified</SelectItem><SelectItem value="Given">Given</SelectItem><SelectItem value="Hold">Hold</SelectItem><SelectItem value="Need More Details">Need Details</SelectItem></SelectContent>
                    </Select>
                    <Select value={zakatFilter} onValueChange={setZakatFilter}>
                        <SelectTrigger className="w-[140px] h-9 text-xs font-bold"><SelectValue placeholder="All Zakat Status" /></SelectTrigger>
                        <SelectContent><SelectItem value="All">All Zakat Status</SelectItem><SelectItem value="Eligible">Eligible</SelectItem><SelectItem value="Not Eligible">Not Eligible</SelectItem></SelectContent>
                    </Select>
                    <Select value={referralFilter} onValueChange={setReferralFilter}>
                        <SelectTrigger className="w-[180px] h-9 text-xs font-bold"><SelectValue placeholder="Filter by referral..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Referrals</SelectItem>
                            {uniqueReferrals.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="border rounded-lg overflow-hidden bg-card">
                    <div className="grid grid-cols-[60px_1fr_100px_80px_120px_140px_140px_80px] bg-muted/50 border-b py-3 px-4 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                        <div>#</div>
                        <div>Name & Phone</div>
                        <div className="text-center">Status</div>
                        <div className="text-center">Zakat</div>
                        <div className="text-right">Kit Amount (₹)</div>
                        <div className="text-right">Zakat Allocation (₹)</div>
                        <div className="text-right">Referred By</div>
                        <div className="text-right">Actions</div>
                    </div>
                    
                    <Accordion type="multiple" defaultValue={Object.keys(groupedBeneficiaries)} className="w-full">
                        {Object.entries(groupedBeneficiaries).map(([catName, list]) => (
                            <AccordionItem key={catName} value={catName} className="border-none">
                                <AccordionTrigger className="hover:no-underline bg-muted/10 px-4 py-3 border-b [&[data-state=open]]:bg-primary/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-primary uppercase tracking-tight">{catName} ({list.length} beneficiaries)</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="p-0">
                                    {list.map((b, idx) => (
                                        <div key={b.id} className="grid grid-cols-[60px_1fr_100px_80px_120px_140px_140px_80px] items-center py-3 px-4 border-b last:border-0 hover:bg-muted/20 transition-colors text-sm">
                                            <div className="text-muted-foreground font-mono text-xs">{idx + 1}</div>
                                            <div>
                                                <div className="font-black text-foreground">{b.name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{b.phone || 'N/A'}</div>
                                            </div>
                                            <div className="flex justify-center">
                                                <Badge variant={b.status === 'Given' ? 'success' : 'outline'} className="text-[10px] px-2 py-0 h-5 font-bold uppercase">{b.status}</Badge>
                                            </div>
                                            <div className="flex justify-center">
                                                <Badge variant={b.isEligibleForZakat ? 'success' : 'outline'} className="text-[10px] px-2 py-0 h-5 font-bold uppercase">{b.isEligibleForZakat ? 'YES' : 'NO'}</Badge>
                                            </div>
                                            <div className="text-right font-mono font-bold">₹{(b.kitAmount || 0).toLocaleString()}</div>
                                            <div className="text-right font-mono text-muted-foreground">₹{(b.zakatAllocation || 0).toLocaleString()}</div>
                                            <div className="text-right text-xs font-medium truncate">{b.referralBy}</div>
                                            <div className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}?redirect=${pathname}`)} className="font-bold"><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                                        {canUpdate && (
                                                            <DropdownMenuSub>
                                                                <DropdownMenuSubTrigger className="font-bold"><ChevronsUpDown className="mr-2 h-4 w-4" /> Change Status</DropdownMenuSubTrigger>
                                                                <DropdownMenuPortal>
                                                                    <DropdownMenuSubContent>
                                                                        <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s as any)}>
                                                                            <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Given">Given</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Hold">Hold</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Need More Details">Need Details</DropdownMenuRadioItem>
                                                                        </DropdownMenuRadioGroup>
                                                                    </DropdownMenuSubContent>
                                                                </DropdownMenuPortal>
                                                            </DropdownMenuSub>
                                                        )}
                                                        {canUpdate && (
                                                            <DropdownMenuItem onClick={() => handleZakatToggle(b)} className="font-bold">{b.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4 text-destructive" /> : <CheckCircle2 className="mr-2 h-4 w-4 text-success" />} {b.isEligibleForZakat ? 'Mark Not Eligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    ))}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                    {filteredBeneficiaries.length === 0 && (
                        <div className="text-center py-20 text-muted-foreground font-bold uppercase tracking-widest bg-muted/5">No beneficiaries found matching your filters.</div>
                    )}
                </div>
            </CardContent>
        </Card>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle className="text-xl font-black text-primary uppercase">Add New Beneficiary</DialogTitle></DialogHeader>
                <BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={campaign.itemCategories || []} />
            </DialogContent>
        </Dialog>

        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={(b) => handleFormSubmit(b as any, b.id)} currentLeadId={campaignId} initiativeType="campaign" />
    </main>
  );
}
