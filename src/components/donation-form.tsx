'use client';

import { z } from 'zod';
import { useForm, useFieldArray, useWatch, type Control, type UseFormRegister, type UseFormSetValue, type UseFormGetValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Resizer from 'react-image-file-resizer';
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  FormField,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Donation, DonationCategory, Campaign, Lead, TransactionDetail as TransactionDetailType, DonationLink, Donor } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { 
    Loader2, 
    ScanLine, 
    Replace, 
    Trash2, 
    Plus, 
    IndianRupee, 
    ZoomIn, 
    ZoomOut, 
    RotateCw, 
    RefreshCw, 
    ImageIcon, 
    Save, 
    X, 
    Search, 
    ShieldCheck, 
    CheckCircle2, 
    AlertCircle,
    Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/hooks/use-session';
import { useAuth, useFirestore, useMemoFirebase, useDoc, doc, collection, getDocs, query, where, limit } from '@/firebase';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { createDonorAction } from '@/app/donors/actions';
import { DonorSearchDialog } from './donor-search-dialog';

const linkSplitSchema = z.array(z.object({
    linkId: z.string(),
    amount: z.coerce.number().min(0, { message: "Allocation Amount Cannot Be Negative." }),
})).optional();

const formSchema = z.object({
  donorName: z.string().min(2, { message: "Name Must Be At Least 2 Characters." }),
  donorPhone: z.string().optional().or(z.literal('')),
  donorId: z.string().optional(),
  receiverName: z.string().optional(),
  referral: z.string().optional(),
  amount: z.coerce.number(),
  typeSplit: z.array(z.object({
    category: z.enum(donationCategories),
    amount: z.coerce.number().min(0, { message: 'Amount Cannot Be Negative.' }),
    forFundraising: z.boolean().default(false),
  })).min(1, { message: 'At Least One Category Is Required.'}),
  donationType: z.enum(['Cash', 'Online Payment', 'Check', 'Other']),
  donationDate: z.string().min(1, { message: "Date Is Required."}),
  contributionFromDate: z.string().optional(),
  contributionToDate: z.string().optional(),
  status: z.enum(['Verified', 'Pending', 'Canceled']),
  comments: z.string().optional(),
  suggestions: z.string().optional(),
  isTypeSplit: z.boolean().default(false),
  transactions: z.array(z.object({
      id: z.string(),
      amount: z.coerce.number().min(0, "Amount Can't Be Negative."),
      transactionId: z.string().optional(),
      date: z.string().optional(),
      upiId: z.string().optional(),
      screenshotUrl: z.string().optional(),
      screenshotIsPublic: z.boolean().optional(),
      screenshotFile: z.any().optional(),
  })).min(1, "At Least One Transaction Is Required."),
  isSplit: z.boolean().default(false),
  linkSplit: linkSplitSchema,
});

export type DonationFormData = z.infer<typeof formSchema>;

interface DonationFormProps {
  donation?: Donation | null;
  onSubmit: (data: DonationFormData) => void;
  onCancel: () => void;
  campaigns?: Campaign[];
  leads?: Lead[];
  defaultLinkId?: string;
  isReadOnly?: boolean;
}

const TransactionItem = ({ control, index, remove, register, setValue, getValues, canRemove, isReadOnly, mandatoryFields }: { control: Control<DonationFormData>, index: number, remove: (index: number) => void, register: UseFormRegister<DonationFormData>, setValue: UseFormSetValue<DonationFormData>, getValues: UseFormGetValues<DonationFormData>, canRemove: boolean, isReadOnly: boolean, mandatoryFields: any }) => {
    const { toast } = useToast();
    const [preview, setPreview] = useState<string | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const fileList = useWatch({ control, name: `transactions.${index}.screenshotFile` });
    const existingUrl = useWatch({ control, name: `transactions.${index}.screenshotUrl` });

    useEffect(() => {
        if (fileList && fileList.length > 0) {
            const file = fileList[0];
            const reader = new FileReader();
            reader.onloadend = () => { setPreview(reader.result as string); };
            reader.readAsDataURL(file);
        } else if (existingUrl) {
            setPreview(existingUrl);
        } else {
            setPreview(null);
        }
    }, [fileList, existingUrl]);
    
    const handleRemoveImage = () => {
        setValue(`transactions.${index}.screenshotFile`, null, { shouldDirty: true });
        setValue(`transactions.${index}.screenshotUrl`, '', { shouldDirty: true });
        setPreview(null);
        setIsViewerOpen(false);
    };
    
    const handleScanScreenshot = async () => {
        const fileList = getValues(`transactions.${index}.screenshotFile`);
        if (!fileList || fileList.length === 0) {
            toast({ title: 'No Screenshot', description: 'Please Upload A Screenshot To Scan.', variant: 'destructive' });
            return;
        }
        setIsScanning(true);
        const file = fileList[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUri = e.target?.result as string;
            if (!dataUri) { setIsScanning(false); return; }
            try {
                const apiResponse = await fetch('/api/scan-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoDataUri: dataUri }) });
                if (!apiResponse.ok) throw new Error('API Request Failed');
                const response = await apiResponse.json();
                if (response.amount) setValue(`transactions.${index}.amount`, response.amount, { shouldDirty: true });
                if (response.transactionId) setValue(`transactions.${index}.transactionId`, response.transactionId, { shouldDirty: true });
                if (response.date) setValue(`transactions.${index}.date`, response.date, { shouldDirty: true });
                if (response.upiId) setValue(`transactions.${index}.upiId`, response.upiId, { shouldDirty: true });
                if (response.receiverName && !getValues('receiverName')) setValue('receiverName', response.receiverName, { shouldDirty: true });
                toast({ title: 'Scan Successful', description: 'Transaction Details Extracted.', variant: "success"});
            } catch (error: any) {
                toast({ title: 'Scan Failed', variant: 'destructive'});
            } finally { setIsScanning(false); }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-4 rounded-xl border border-primary/10 bg-primary/[0.02] p-4 relative shadow-sm">
            {!isReadOnly && (
                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => remove(index)} disabled={!canRemove}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={control} name={`transactions.${index}.amount`} render={({ field }) => (
                    <FormItem><FormLabel className="font-bold text-[10px] text-muted-foreground tracking-tight uppercase">Amount (₹) *</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} disabled={isReadOnly} className="font-bold font-mono" /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={control} name={`transactions.${index}.date`} render={({ field }) => (
                    <FormItem><FormLabel className="font-bold text-[10px] text-muted-foreground tracking-tight uppercase">Transaction Date</FormLabel><FormControl><Input type="date" {...field} disabled={isReadOnly} className="font-bold" /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormField control={control} name={`transactions.${index}.transactionId`} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-bold text-[10px] text-muted-foreground tracking-tight uppercase">Reference ID (UPI / UTR)</FormLabel>
                        <FormControl><Input placeholder="Unique ID" {...field} disabled={isReadOnly} className="font-normal" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
                 <FormField control={control} name={`transactions.${index}.upiId`} render={({ field }) => (
                    <FormItem><FormLabel className="font-bold text-[10px] text-muted-foreground tracking-tight uppercase">Sender UPI Handle</FormLabel><FormControl><Input placeholder="e.g. name@upi" {...field} disabled={isReadOnly} className="font-normal" /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>
            <div className="space-y-2">
                {!isReadOnly && (
                    <FormField control={control} name={`transactions.${index}.screenshotFile`} render={() => (
                        <FormItem><FormLabel className="font-bold text-[10px] text-muted-foreground tracking-tight uppercase">Upload Evidence {mandatoryFields.screenshot ? '*' : ''}</FormLabel><FormControl><Input id={`tx-screenshot-upload-${index}`} type="file" accept="image/*" {...register(`transactions.${index}.screenshotFile`)} className="font-normal" /></FormControl><FormMessage /></FormItem>
                    )}/>
                )}
                {preview && (
                    <div className="relative group w-full h-32 rounded-xl border border-primary/10 bg-white shadow-inner overflow-hidden">
                        <Image src={preview.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(preview)}` : preview} alt="Screenshot" fill sizes="(max-width: 768px) 100vw, 300px" className="object-contain" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
                                <DialogTrigger asChild>
                                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 text-white border-white hover:bg-white/20 transition-transform active:scale-95"><ZoomIn className="h-4 w-4" /></Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-[16px] border-primary/10">
                                    <DialogHeader className="px-6 py-4 bg-primary/5 border-b"><DialogTitle className="font-bold text-primary tracking-tight text-sm">Evidence Viewer</DialogTitle></DialogHeader>
                                    <ScrollArea className="flex-1 bg-secondary/20 p-4">
                                        <div className="relative min-h-[60vh] w-full flex items-center justify-center">
                                            <Image src={preview.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(preview)}` : preview} alt="Saboot" fill sizes="100vw" className="object-contain transition-transform origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                                        </div>
                                        <ScrollBar orientation="vertical" /><ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                    <DialogFooter className="sm:justify-center p-4 bg-white border-t flex-wrap gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="font-bold text-primary border-primary/20"><ZoomIn className="mr-2 h-4 w-4"/> Zoom In</Button>
                                        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))} className="font-bold text-primary border-primary/20"><ZoomOut className="mr-2 h-4 w-4"/> Zoom Out</Button>
                                        <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold text-primary border-primary/20"><RotateCw className="mr-2 h-4 w-4"/> Rotate</Button>
                                        <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold text-primary border-primary/20"><RefreshCw className="mr-2 h-4 w-4"/> Reset</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            {!isReadOnly && (
                                <>
                                    <Button type="button" size="icon" variant="outline" onClick={() => document.getElementById(`tx-screenshot-upload-${index}`)?.click()} className="h-8 w-8 text-white border-white hover:bg-white/20 transition-transform active:scale-95"><Replace className="h-4 w-4" /></Button>
                                    <Button type="button" size="icon" variant="destructive" onClick={handleRemoveImage} className="h-8 w-8 transition-transform active:scale-95"><Trash2 className="h-4 w-4" /></Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
                 {!isReadOnly && fileList && fileList.length > 0 && (
                    <Button type="button" onClick={handleScanScreenshot} disabled={isScanning} className="w-full mt-2 font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95 shadow-sm">
                        {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                        Scan Screenshot With AI
                    </Button>
                )}
            </div>
        </div>
    )
}

export function DonationForm({ donation, onSubmit, onCancel, campaigns = [], leads = [], defaultLinkId, isReadOnly = false }: DonationFormProps) {
  const { userProfile } = useSession();
  const auth = useAuth();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDonorSearchOpen, setIsDonorSearchOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donation_config') : null, [firestore]);
  const { data: configSettings } = useDoc<any>(configRef);
  const mandatoryFields = useMemo(() => configSettings?.mandatoryFields || {}, [configSettings]);
  
  const form = useForm<DonationFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      donorName: donation?.donorName || '',
      donorPhone: donation?.donorPhone || '',
      donorId: donation?.donorId || '',
      receiverName: donation?.receiverName || '',
      referral: donation?.referral || '',
      amount: donation?.amount || 0,
      donationType: donation?.donationType || 'Online Payment',
      donationDate: donation?.donationDate || new Date().toISOString().split('T')[0],
      contributionFromDate: donation?.contributionFromDate || '',
      contributionToDate: donation?.contributionToDate || '',
      status: donation?.status || 'Pending',
      comments: donation?.comments || '',
      suggestions: donation?.suggestions || '',
      isTypeSplit: (donation?.typeSplit?.length ?? 0) > 1,
      typeSplit: donation?.typeSplit && donation.typeSplit.length > 0 ? donation.typeSplit.map(ts => ({...ts, forFundraising: ts.forFundraising ?? false})) : [{ category: 'Sadaqah', amount: donation?.amount || 0, forFundraising: false }],
      transactions: donation?.transactions && donation.transactions.length > 0 ? donation.transactions.map(tx => ({...tx, amount: Number(tx.amount), date: tx.date || (donation?.donationDate || new Date().toISOString().split('T')[0]) })) : [{ id: `tx_${Date.now()}`, amount: donation?.amount || 0, transactionId: (donation as any)?.transactionId, date: donation?.donationDate || new Date().toISOString().split('T')[0] }],
      isSplit: (donation?.linkSplit?.length ?? 0) > 1,
      linkSplit: donation?.linkSplit?.map(l => ({ linkId: `${l.linkType}_${l.linkId}`, amount: l.amount })) || (defaultLinkId ? [{linkId: defaultLinkId, amount: donation?.amount || 0}] : []),
    },
  });

  const { control, watch, setValue, getValues, register, handleSubmit, formState: { isDirty } } = form;
  const { fields: transactionFields, append: appendTransaction, remove: removeTransaction } = useFieldArray({ control, name: "transactions" });
  const { fields: typeSplitFields, append: appendTypeSplit, remove: removeTypeSplit, replace: replaceTypeSplit } = useFieldArray({ control, name: "typeSplit" });
  const { fields: linkSplitFields, append: appendLinkSplit, remove: removeLinkSplit, replace: replaceLinkSplit } = useFieldArray({ control, name: "linkSplit" });

  const watchedTransactions = useWatch({ control, name: 'transactions' });
  const isTypeSplit = watch('isTypeSplit');
  const isLinkSplit = watch('isSplit');
  const donorId = watch('donorId');
  const donorPhone = watch('donorPhone');
  const donorName = watch('donorName');

  useEffect(() => {
    const total = watchedTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    setValue('amount', total, { shouldValidate: true, shouldDirty: true });
  }, [watchedTransactions, setValue]);

  const totalAmount = watch('amount');

  useEffect(() => {
    if (!isTypeSplit) {
      const currentSplits = getValues('typeSplit');
      const firstCategory = currentSplits.length > 0 ? currentSplits[0].category : 'Sadaqah';
      replaceTypeSplit([{ category: firstCategory, amount: totalAmount, forFundraising: false }]);
    }
  }, [isTypeSplit, totalAmount, replaceTypeSplit, getValues]);
  
  useEffect(() => {
    if (!isLinkSplit) {
      const currentLinks = getValues('linkSplit') || [];
      const firstLink = currentLinks.length > 0 ? currentLinks[0].linkId : (defaultLinkId || 'unlinked');
      replaceLinkSplit([{ linkId: firstLink, amount: totalAmount }]);
    }
  }, [isLinkSplit, totalAmount, replaceLinkSplit, getValues, defaultLinkId]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const isAlreadyLinked = donation?.linkSplit?.some(link => link.linkId === c.id && link.linkType === 'campaign');
      const isDefaultContext = defaultLinkId === `campaign_${c.id}`;
      return isAlreadyLinked || isDefaultContext || (c.status !== 'Completed' && c.publicVisibility === 'Published');
    });
  }, [campaigns, donation, defaultLinkId]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const isAlreadyLinked = donation?.linkSplit?.some(link => link.linkId === l.id && link.linkType === 'lead');
      const isDefaultContext = defaultLinkId === `lead_${l.id}`;
      return isAlreadyLinked || isDefaultContext || (l.status !== 'Completed' && l.publicVisibility === 'Published');
    });
  }, [leads, donation, defaultLinkId]);

  const onFormSubmit = async (data: DonationFormData) => {
    const missingFields: string[] = [];
    Object.entries(mandatoryFields).forEach(([field, isMandatory]) => {
        if (isMandatory) {
            if (field === 'screenshot') {
                const hasScreenshot = data.transactions.some(tx => tx.screenshotUrl || (tx.screenshotFile && tx.screenshotFile.length > 0));
                if (!hasScreenshot) missingFields.push('Transaction Screenshot');
            } else if (!data[field as keyof DonationFormData]) {
                missingFields.push(field);
            }
        }
    });

    if (missingFields.length > 0) {
        toast({ title: "Form Incomplete", description: `Please Fill Required Fields: ${missingFields.join(', ')}`, variant: "destructive" });
        return;
    }

    if (!userProfile) return;

    setIsSubmitting(true);
    try {
        await onSubmit(data);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSelectDonorProfile = (donor: Donor) => {
    setValue('donorName', donor.name, { shouldDirty: true, shouldValidate: true });
    setValue('donorPhone', donor.phone, { shouldDirty: true, shouldValidate: true });
    setValue('donorId', donor.id, { shouldDirty: true });
    toast({ title: 'Identity Verified', variant: 'success' });
  };

  const verifyDonorByPhone = useCallback(async () => {
    if (!firestore || !donorPhone || donorPhone.length < 10) return;
    setIsVerifying(true);
    try {
        const q = query(collection(firestore, 'donors'), where('phone', '==', donorPhone), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const donor = { id: snap.docs[0].id, ...snap.docs[0].data() } as Donor;
            handleSelectDonorProfile(donor);
        } else {
            toast({ title: 'New Donor Profile', description: 'No Existing Record Found. A New Profile Will Be Created.', variant: 'info' });
        }
    } finally {
        setIsVerifying(false);
    }
  }, [firestore, donorPhone, handleSelectDonorProfile, toast]);

  const handleRegisterDonorProfile = async () => {
    if (!userProfile) return;
    setIsSubmitting(true);
    
    const currentUpis = watchedTransactions.map(tx => tx.upiId).filter(Boolean) as string[];
    
    const res = await createDonorAction({
        name: donorName,
        phone: donorPhone || '',
        status: 'Active',
        upiIds: Array.from(new Set(currentUpis)),
        notes: `Profile Established From Donation Registry.`
    }, { id: userProfile.id, name: userProfile.name });

    if (res.success && res.id) {
        setValue('donorId', res.id, { shouldDirty: true });
        toast({ title: 'Profile Created', description: 'Institutional Identity Secured.', variant: 'success' });
    } else {
        toast({ title: 'Creation Failed', description: res.message, variant: 'destructive' });
    }
    setIsSubmitting(false);
  };

  const renderLabel = (label: string, fieldName: string) => (
    <FormLabel className="font-bold text-[10px] text-muted-foreground tracking-tight uppercase">
        {label} {mandatoryFields[fieldName] ? '*' : ''}
    </FormLabel>
  );
  
  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col h-full overflow-hidden bg-white">
        <div className="flex-1 min-h-0 relative flex flex-col">
            <ScrollArea className="flex-1 w-full">
                <div className="px-6 py-4 space-y-6 text-primary font-normal pb-24">
                    <FormField control={control} name="amount" render={({ field }) => (
                        <FormItem><FormLabel className="font-bold text-primary tracking-tight uppercase">Total Donation Amount (₹) *</FormLabel><FormControl><Input type="number" {...field} readOnly className="bg-primary/5 font-bold font-mono text-xl text-primary" /></FormControl><FormDescription className="font-normal text-[10px] opacity-70 italic">Calculated Sum Of All Transactions Below.</FormDescription><FormMessage /></FormItem>
                    )}/>

                    <div className="space-y-4 rounded-xl border border-primary/10 p-4 bg-white shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-primary tracking-tight">Transaction Details</h3>
                            {!isReadOnly && (
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => setIsDonorSearchOpen(true)} className="h-8 font-bold border-primary/20 text-primary active:scale-95 transition-transform">
                                        <Search className="mr-2 h-3.5 w-3.5"/> Find Donor Profile
                                    </Button>
                                </div>
                            )}
                        </div>
                        <FormField control={control} name="donationType" render={({ field }) => (
                            <FormItem>{renderLabel('Payment Method', 'donationType')}<Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Method" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown border-primary/10"><SelectItem value="Online Payment" className="font-normal">Online (Digital)</SelectItem><SelectItem value="Cash" className="font-normal">Cash (Physical)</SelectItem><SelectItem value="Check" className="font-normal">Check</SelectItem><SelectItem value="Other" className="font-normal">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                        )}/>
                        <div className="space-y-4">
                            {transactionFields.map((field, index) => (
                                <TransactionItem key={field.id} control={control} index={index} register={register} setValue={setValue} getValues={getValues} remove={removeTransaction} canRemove={transactionFields.length > 1} isReadOnly={isReadOnly} mandatoryFields={mandatoryFields} />
                            ))}
                        </div>
                        {!isReadOnly && (
                            <Button type="button" variant="outline" size="sm" onClick={() => appendTransaction({ id: `tx_${Date.now()}`, amount: 0, transactionId: '', date: new Date().toISOString().split('T')[0], upiId: '' })} className="font-bold text-primary border-primary/20 transition-transform active:scale-95 shadow-none w-full"><Plus className="mr-2 h-4 w-4"/> Add Another Transaction</Button>
                        )}
                    </div>
                    
                    <Separator className="bg-primary/10" />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FormField control={control} name="donorName" render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    {renderLabel('Donor Name', 'donorName')}
                                    {donorId ? (
                                        <Badge variant="eligible" className="h-4 text-[8px] font-black uppercase"><ShieldCheck className="h-2.5 w-2.5 mr-1"/> Verified Profile</Badge>
                                    ) : !isReadOnly && donorName.length > 2 && (
                                        <Button type="button" variant="link" onClick={handleRegisterDonorProfile} className="h-4 text-[8px] font-black uppercase p-0 text-primary underline">Register Profile</Button>
                                    )}
                                </div>
                                <FormControl><Input placeholder="Full Name" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={control} name="donorPhone" render={({ field }) => (
                            <FormItem>
                                {renderLabel('Phone Number', 'donorPhone')}
                                <div className="flex gap-2">
                                    <FormControl><Input placeholder="10 Digits" {...field} disabled={isReadOnly} className="font-mono text-primary flex-1"/></FormControl>
                                    {!isReadOnly && !donorId && donorPhone?.length === 10 && (
                                        <Button type="button" variant="secondary" size="sm" onClick={verifyDonorByPhone} disabled={isVerifying} className="h-10 font-bold px-3">
                                            {isVerifying ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}
                                        </Button>
                                    )}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FormField control={control} name="receiverName" render={({ field }) => (
                            <FormItem>{renderLabel('Receiver (Member Name)', 'receiverName')}<FormControl><Input placeholder="Organization Member" {...field} disabled={isReadOnly} className="font-normal text-primary"/></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={control} name="referral" render={({ field }) => (
                            <FormItem>{renderLabel('Referral Source', 'referral')}<FormControl><Input placeholder="Who Referred The Donor" {...field} disabled={isReadOnly} className="font-normal text-primary"/></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FormField control={control} name="donationDate" render={({ field }) => (
                            <FormItem>{renderLabel('Donation Date', 'donationDate')}<FormControl><Input type="date" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={control} name="status" render={({ field }) => (
                            <FormItem>{renderLabel('Verification Status', 'status')}<Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown border-primary/10"><SelectItem value="Pending" className="font-normal">Pending Review</SelectItem><SelectItem value="Verified" className="font-normal text-primary">Verified (Secured)</SelectItem><SelectItem value="Canceled" className="font-normal text-destructive">Canceled</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                        )}/>
                    </div>
                    
                    <div className="space-y-4 rounded-xl border border-primary/10 p-4 bg-white shadow-sm">
                        <FormField control={control} name="isTypeSplit" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value === true} onCheckedChange={(val) => field.onChange(val === true)} disabled={isReadOnly}/></FormControl><FormLabel className="font-bold text-primary cursor-pointer tracking-tight">Split By Designation (Category)</FormLabel></FormItem>
                        )}/>
                    {isTypeSplit ? (
                        <div className="space-y-4 animate-fade-in-up">
                            <div className="border border-primary/5 rounded-xl overflow-hidden bg-primary/[0.01]">
                                <ScrollArea className="w-full">
                                    <div className="min-w-[600px]">
                                        <Table>
                                            <TableHeader className="bg-primary/5"><TableRow><TableHead className="font-bold text-primary text-[9px] tracking-tight uppercase">Category Designation</TableHead><TableHead className="font-bold text-primary text-[9px] tracking-tight uppercase">Amount (₹)</TableHead><TableHead className="text-right font-bold text-primary text-[9px] tracking-tight pr-4 uppercase">Action</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {typeSplitFields.map((field, index) => (
                                                    <TableRow key={field.id} className="hover:bg-primary/[0.02] border-b border-primary/5">
                                                        <TableCell><FormField control={control} name={`typeSplit.${index}.category`} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold border-none bg-transparent shadow-none h-8"><SelectValue/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown">{donationCategories.map(cat => <SelectItem key={cat} value={cat} className="font-normal">{cat}</SelectItem>)}</SelectContent></Select>)}/>{watch(`typeSplit.${index}.category`) === 'Zakat' && <FormField control={control} name={`typeSplit.${index}.forFundraising`} render={({ field: checkboxField }) => (<div className="flex items-center space-x-2 px-2 mt-1"><Checkbox checked={checkboxField.value === true} onCheckedChange={(val) => checkboxField.onChange(val === true)} disabled={isReadOnly}/><Label className="text-[8px] font-bold text-muted-foreground tracking-tighter uppercase">Include In Fundraising Goal</Label></div>)}/>}</TableCell>
                                                        <TableCell><FormField control={control} name={`typeSplit.${index}.amount`} render={({ field }) => (<FormControl><Input type="number" placeholder="0.00" {...field} disabled={isReadOnly} className="border-none bg-transparent shadow-none font-bold font-mono h-8 text-primary"/></FormControl>)}/></TableCell>
                                                        <TableCell className="text-right pr-4">{!isReadOnly && <Button type="button" variant="ghost" size="icon" onClick={() => removeTypeSplit(index)} disabled={typeSplitFields.length <= 1} className="h-8 w-8 text-destructive transition-transform hover:scale-110"><Trash2 className="h-4 w-4"/></Button>}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <ScrollBar orientation="horizontal" className="h-1.5" />
                                </ScrollArea>
                            </div>
                            {!isReadOnly && <Button type="button" variant="outline" size="sm" onClick={() => appendTypeSplit({ category: 'Sadaqah', amount: 0, forFundraising: false })} className="font-bold text-primary border-primary/20 transition-transform active:scale-95 shadow-none w-full"><Plus className="mr-2 h-4 w-4"/> Add Another Designation</Button>}
                        </div>
                    ) : (
                        <div className="pl-6 space-y-4">
                            <FormField control={control} name={`typeSplit.0.category`} render={({ field }) => (
                                <FormItem>{renderLabel('Fund Designation', 'typeSplit.0.category')}<Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown border-primary/10">{donationCategories.map(cat => <SelectItem key={cat} value={cat} className="font-normal">{cat}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                            )}/>
                            {watch(`typeSplit.0.category`) === 'Zakat' && (
                                <FormField control={control} name={`typeSplit.0.forFundraising`} render={({ field: checkboxField }) => (
                                    <div className="flex items-center space-x-2 animate-fade-in-zoom">
                                        <Checkbox id="goal-contribution-single" checked={checkboxField.value === true} onCheckedChange={(val) => checkboxField.onChange(val === true)} disabled={isReadOnly}/>
                                        <Label htmlFor="goal-contribution-single" className="text-xs font-bold text-primary tracking-tight cursor-pointer">Include This Zakat In Fundraising Goal Progress</Label>
                                    </div>
                                )}/>
                            )}
                        </div>
                    )}
                    </div>
                    
                    {watch(`typeSplit.0.category`) === 'Monthly Contribution' && (
                    <div className="space-y-4 rounded-xl border border-primary/10 p-4 bg-white shadow-sm animate-fade-in-zoom">
                        <h3 className="text-sm font-bold text-primary tracking-tight">Subscription Cycle</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FormField control={control} name="contributionFromDate" render={({ field }) => (
                            <FormItem>{renderLabel('From Date', 'contributionFromDate')}<FormControl><Input type="date" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl></FormItem>
                        )}/>
                        <FormField control={control} name="contributionToDate" render={({ field }) => (
                            <FormItem>{renderLabel('To Date', 'contributionToDate')}<FormControl><Input type="date" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl></FormItem>
                        )}/>
                        </div>
                    </div>
                    )}

                    <div className="space-y-4 rounded-xl border border-primary/10 p-4 bg-white shadow-sm">
                        <FormField control={control} name="isSplit" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value === true} onCheckedChange={(val) => field.onChange(val === true)} disabled={isReadOnly}/></FormControl><FormLabel className="font-bold text-primary cursor-pointer tracking-tight">Split Contribution Across Multiple Initiatives</FormLabel></FormItem>
                        )}/>
                    {isLinkSplit ? (
                        <div className="space-y-4 animate-fade-in-up">
                            <div className="border border-primary/5 rounded-xl overflow-hidden bg-primary/[0.01]">
                                <ScrollArea className="w-full">
                                    <div className="min-w-[600px]">
                                        <Table>
                                            <TableHeader className="bg-primary/5"><TableRow><TableHead className="font-bold text-primary text-[9px] tracking-tight uppercase">Initiative Target</TableHead><TableHead className="font-bold text-primary text-[9px] tracking-tight uppercase">Amount (₹)</TableHead><TableHead className="text-right font-bold text-primary text-[9px] tracking-tight pr-4 uppercase">Action</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {linkSplitFields.map((field, index) => (
                                                    <TableRow key={field.id} className="hover:bg-primary/[0.02] border-b border-primary/5">
                                                        <TableCell><FormField control={control} name={`linkSplit.${index}.linkId`} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold border-none bg-transparent shadow-none min-w-[200px] h-8"><SelectValue placeholder="Select target..."/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown border-primary/10"><SelectGroup><SelectLabel className="font-black text-primary/40 text-[8px] tracking-widest px-2 uppercase">Active Campaigns</SelectLabel>{filteredCampaigns.map(c => <SelectItem key={c.id} value={`campaign_${c.id}`} className="font-normal">{c.name}</SelectItem>)}</SelectGroup><SelectGroup><Separator className="my-1 opacity-10"/><SelectLabel className="font-black text-primary/40 text-[8px] tracking-widest px-2 uppercase">Active Appeals</SelectLabel>{filteredLeads.map(l => <SelectItem key={l.id} value={`lead_${l.id}`} className="font-normal">{l.name}</SelectItem>)}</SelectGroup></SelectContent></Select>)}/></TableCell>
                                                        <TableCell><FormField control={control} name={`linkSplit.${index}.amount`} render={({ field }) => (<FormControl><Input type="number" placeholder="0.00" {...field} disabled={isReadOnly} className="border-none bg-transparent shadow-none font-bold font-mono h-8 text-primary"/></FormControl>)}/></TableCell>
                                                        <TableCell className="text-right pr-4">{!isReadOnly && <Button type="button" variant="ghost" size="icon" onClick={() => removeLinkSplit(index)} disabled={linkSplitFields.length <= 1} className="h-8 w-8 text-destructive transition-transform hover:scale-110"><Trash2 className="h-4 w-4"/></Button>}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <ScrollBar orientation="horizontal" className="h-1.5" />
                                </ScrollArea>
                            </div>
                            {!isReadOnly && <Button type="button" variant="outline" size="sm" onClick={() => appendLinkSplit({ linkId: 'unlinked', amount: 0 })} className="font-bold text-primary border-primary/20 transition-transform active:scale-95 shadow-none w-full"><Plus className="mr-2 h-4 w-4"/> Allocate To Another Project</Button>}
                        </div>
                    ) : (
                        <FormField control={control} name={`linkSplit.0.linkId`} render={({ field }) => (
                            <FormItem className="pl-6">{renderLabel('Allocate Funds To', 'linkSplit.0.linkId')}<Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold text-primary"><SelectValue placeholder="Unallocated / General Fund"/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown border-primary/10"><SelectItem value="unlinked" className="font-normal italic">-- Unallocated / Organization Fund --</SelectItem><SelectGroup><SelectLabel className="font-black text-primary/40 text-[8px] tracking-widest px-2 uppercase">Campaigns</SelectLabel>{filteredCampaigns.map(c => <SelectItem key={c.id} value={`campaign_${c.id}`} className="font-normal">{c.name}</SelectItem>)}</SelectGroup><SelectGroup><Separator className="my-1 opacity-10"/><SelectLabel className="font-black text-primary/40 text-[8px] tracking-widest px-2 uppercase">Public Appeals</SelectLabel>{filteredLeads.map(l => <SelectItem key={l.id} value={`lead_${l.id}`} className="font-normal">{l.name}</SelectItem>)}</SelectGroup></SelectContent></Select></FormItem>
                        )}/>
                    )}
                    </div>

                    <div className="space-y-6">
                        <FormField control={control} name="comments" render={({ field }) => (
                            <FormItem>{renderLabel('Donor Remarks', 'comments')}<FormControl><Textarea placeholder="Any Specific Instructions From The Donor..." {...field} disabled={isReadOnly} className="font-normal text-primary" /></FormControl></FormItem>
                        )}/>
                        <FormField control={control} name="suggestions" render={({ field }) => (
                            <FormItem>{renderLabel('Team Insights', 'suggestions')}<FormControl><Textarea placeholder="Verification Notes Or Recommendations..." {...field} disabled={isReadOnly} className="font-normal text-primary" /></FormControl></FormItem>
                        )}/>
                    </div>
                </div>
                <ScrollBar orientation="vertical" />
            </ScrollArea>
        </div>

        {!isReadOnly && (
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 sticky bottom-0 bg-background/95 backdrop-blur-sm p-4 border-t z-50 shrink-0">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="w-full sm:w-auto font-bold text-primary border-primary/20 transition-transform active:scale-95">Discard</Button>
                <Button type="submit" disabled={isSubmitting || (!!donation && !isDirty)} className="w-full sm:w-auto font-bold px-10 transition-transform active:scale-95 shadow-md">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSubmitting ? 'Securing Registry...' : 'Finalize Record'}
                </Button>
            </div>
        )}
      </form>
      <DonorSearchDialog 
        open={isDonorSearchOpen} 
        onOpenChange={setIsDonorSearchOpen} 
        onSelectDonor={handleSelectDonorProfile} 
        currentFormData={{
            name: donorName,
            phone: donorPhone,
            upiIds: watchedTransactions.map(t => t.upiId).filter(Boolean) as string[]
        }}
      />
    </Form>
  );
}
