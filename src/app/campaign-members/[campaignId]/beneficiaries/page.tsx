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
import type { Beneficiary, Campaign, RationItem, ItemCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';
import Resizer from 'react-image-file-resizer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { 
    ArrowLeft, 
    Edit, 
    MoreHorizontal, 
    PlusCircle, 
    Trash2, 
    Loader2, 
    Eye, 
    ArrowUp, 
    ArrowDown, 
    CheckCircle2, 
    Hourglass, 
    XCircle, 
    Info, 
    ChevronsUpDown, 
    ChevronDown, 
    ChevronUp, 
    Users, 
    UserCheck, 
    FileUp, 
    Search,
    CopyPlus,
    ShieldAlert
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { BeneficiaryImportDialog } from '@/components/beneficiary-import-dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { updateMasterBeneficiaryAction } from '@/app/beneficiaries/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BrandedLoader } from '@/components/branded-loader';

type SortKey = keyof Beneficiary | 'srNo';
type BeneficiaryStatus = Beneficiary['status'];

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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zakatFilter, setZakatFilter] = useState('All');
  
  const [beneficiaryToDelete, setBeneficiaryToDelete] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.summary.read', false);
  const canReadRation = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.ration.read', false);
  const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.read', false);
  const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.donations.read', false);

  const canCreate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.create', false);
  const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.update', false);
  const canDelete = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.campaigns.beneficiaries.delete', false);

  const groupedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return {};
    
    let filtered = beneficiaries.filter(b => {
        const matchesSearch = (b.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               b.phone?.includes(searchTerm) || 
                               b.address?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
        const matchesZakat = zakatFilter === 'All' || (zakatFilter === 'Eligible' ? b.isEligibleForZakat : !b.isEligibleForZakat);
        return matchesSearch && matchesStatus && matchesZakat;
    });

    const groups: Record<string, Beneficiary[]> = {};
    filtered.forEach(b => {
        const catName = b.itemCategoryName || 'Uncategorized';
        if (!groups[catName]) groups[catName] = [];
        groups[catName].push(b);
    });
    return groups;
  }, [beneficiaries, searchTerm, statusFilter, zakatFilter]);

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
    const auth = useAuth();
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
        <h1 className="text-3xl font-bold">{campaign.name}</h1>
        
        <div className="border-b mb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2">
                    {canReadSummary && ( <Link href={`/campaign-members/${campaignId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Summary</Link> )}
                    {canReadRation && ( <Link href={`/campaign-members/${campaignId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Item Lists</Link> )}
                    {canReadBeneficiaries && ( <Link href={`/campaign-members/${campaignId}/beneficiaries`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "bg-primary text-primary-foreground shadow")}>Beneficiary List</Link> )}
                    {canReadDonations && ( <Link href={`/campaign-members/${campaignId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", "text-muted-foreground")}>Donations</Link> )}
                </div>
            </ScrollArea>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold">Beneficiary List ({beneficiaries?.length || 0})</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="Given">Given</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsSearchOpen(true)} className="gap-2"><CopyPlus className="h-4 w-4"/> Add Existing</Button>
                <Button size="sm" onClick={() => setIsFormOpen(true)} className="gap-2"><PlusCircle className="mr-2 h-4 w-4"/> Add New</Button>
            </div>
        </div>

        <Accordion type="multiple" defaultValue={Object.keys(groupedBeneficiaries)} className="space-y-4">
            {Object.entries(groupedBeneficiaries).map(([catName, list]) => (
                <AccordionItem key={catName} value={catName} className="border rounded-lg px-4 bg-card shadow-sm">
                    <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-3">
                            <span className="text-lg font-bold">{catName}</span>
                            <Badge variant="secondary" className="rounded-full">{list.length}</Badge>
                            <span className="text-sm text-muted-foreground font-normal">Total: ₹{list.reduce((sum, b) => sum + (b.kitAmount || 0), 0).toLocaleString()}</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-6">
                        <div className="w-full overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[60px]">#</TableHead>
                                        <TableHead>Name & Phone</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Zakat</TableHead>
                                        <TableHead className="text-right">Kit Amount</TableHead>
                                        <TableHead className="text-right pr-4">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {list.map((b, idx) => (
                                        <TableRow key={b.id}>
                                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{b.name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{b.phone || 'N/A'}</div>
                                            </TableCell>
                                            <TableCell><Badge variant={b.status === 'Given' ? 'success' : 'outline'}>{b.status}</Badge></TableCell>
                                            <TableCell><Badge variant={b.isEligibleForZakat ? 'success' : 'outline'}>{b.isEligibleForZakat ? 'Eligible' : 'No'}</Badge></TableCell>
                                            <TableCell className="text-right font-mono">₹{(b.kitAmount || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right pr-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => router.push(`/beneficiaries/${b.id}?redirect=${pathname}`)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                                        {canUpdate && (
                                                            <DropdownMenuSub>
                                                                <DropdownMenuSubTrigger><ChevronsUpDown className="mr-2 h-4 w-4" /> Status</DropdownMenuSubTrigger>
                                                                <DropdownMenuPortal>
                                                                    <DropdownMenuSubContent>
                                                                        <DropdownMenuRadioGroup value={b.status} onValueChange={(s) => handleStatusChange(b, s as any)}>
                                                                            <DropdownMenuRadioItem value="Pending">Pending</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Verified">Verified</DropdownMenuRadioItem>
                                                                            <DropdownMenuRadioItem value="Given">Given</DropdownMenuRadioItem>
                                                                        </DropdownMenuRadioGroup>
                                                                    </DropdownMenuSubContent>
                                                                </DropdownMenuPortal>
                                                            </DropdownMenuSub>
                                                        )}
                                                        {canUpdate && (
                                                            <DropdownMenuItem onClick={() => handleZakatToggle(b)}>{b.isEligibleForZakat ? <XCircle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} {b.isEligibleForZakat ? 'Mark Not Eligible' : 'Mark Zakat Eligible'}</DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add New Beneficiary</DialogTitle></DialogHeader>
                <BeneficiaryForm onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} itemCategories={campaign.itemCategories || []} />
            </DialogContent>
        </Dialog>

        <BeneficiarySearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} onSelectBeneficiary={(b) => handleFormSubmit(b as any, b.id)} currentLeadId={campaignId} initiativeType="campaign" />
    </main>
  );
}