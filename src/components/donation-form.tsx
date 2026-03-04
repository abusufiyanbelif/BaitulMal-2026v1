'use client';

import { z } from 'zod';
import { useForm, useFieldArray, useWatch, type Control, type UseFormRegister, type UseFormSetValue, type UseFormGetValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useMemo } from 'react';
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
import type { Donation, DonationCategory, Campaign, Lead, TransactionDetail as TransactionDetailType, DonationLink } from '@/lib/types';
import { donationCategories } from '@/lib/modules';
import { Loader2, ScanLine, Replace, Trash2, Plus, DollarSign, ZoomIn, ZoomOut, RotateCw, RefreshCw, ImageIcon, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSession } from '@/hooks/use-session';
import { useAuth } from '@/firebase';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const linkSplitSchema = z.array(z.object({
    linkId: z.string(),
    amount: z.coerce.number().min(0, { message: "Allocation amount cannot be negative." }),
})).optional();

const formSchema = z.object({
  donorName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  donorPhone: z.string().length(10, { message: "Phone must be exactly 10 digits." }).optional().or(z.literal('')),
  receiverName: z.string().min(2, { message: "Receiver name must be at least 2 characters." }),
  referral: z.string().min(1, { message: "Referral is required." }),
  amount: z.coerce.number(),
  typeSplit: z.array(z.object({
    category: z.enum(donationCategories),
    amount: z.coerce.number().min(0, { message: 'Amount cannot be negative.' }),
    forFundraising: z.boolean().optional(),
  })).min(1, { message: 'At least one donation category is required.'}),
  donationType: z.enum(['Cash', 'Online Payment', 'Check', 'Other']),
  donationDate: z.string().min(1, { message: "Donation date is required."}),
  contributionFromDate: z.string().optional(),
  contributionToDate: z.string().optional(),
  status: z.enum(['Verified', 'Pending', 'Canceled']),
  comments: z.string().optional(),
  suggestions: z.string().optional(),
  isTypeSplit: z.boolean().default(false),
  transactions: z.array(z.object({
      id: z.string(),
      amount: z.coerce.number().min(0, "Transaction amount can't be negative."),
      transactionId: z.string().optional(),
      date: z.string().optional(),
      upiId: z.string().optional(),
      screenshotUrl: z.string().optional(),
      screenshotIsPublic: z.boolean().optional(),
      screenshotFile: z.any().optional(),
  })).min(1, "At least one transaction is required."),
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
}

const TransactionItem = ({ control, index, remove, register, setValue, getValues, canRemove, isReadOnly }: { control: Control<DonationFormData>, index: number, remove: (index: number) => void, register: UseFormRegister<DonationFormData>, setValue: UseFormSetValue<DonationFormData>, getValues: UseFormGetValues<DonationFormData>, canRemove: boolean, isReadOnly: boolean }) => {
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
            toast({ title: 'No screenshot', description: 'Please upload a screenshot to scan.', variant: 'destructive' });
            return;
        }
        setIsScanning(true);
        toast({ title: 'Scanning screenshot...', description: 'Please wait.' });
        const file = fileList[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUri = e.target?.result as string;
            if (!dataUri) { setIsScanning(false); return; }
            try {
                const apiResponse = await fetch('/api/scan-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photoDataUri: dataUri }) });
                if (!apiResponse.ok) throw new Error('API request failed');
                const response = await apiResponse.json();
                if (response.amount) setValue(`transactions.${index}.amount`, response.amount, { shouldDirty: true });
                if (response.transactionId) setValue(`transactions.${index}.transactionId`, response.transactionId, { shouldDirty: true });
                if (response.date) setValue(`transactions.${index}.date`, response.date, { shouldDirty: true });
                if (response.upiId) setValue(`transactions.${index}.upiId`, response.upiId, { shouldDirty: true });
                if (response.receiverName && !getValues('receiverName')) setValue('receiverName', response.receiverName, { shouldDirty: true });
                toast({ title: 'Scan complete', description: 'Transaction details have been populated.', variant: 'success'});
            } catch (error: any) {
                toast({ title: 'Scan failed', description: 'Could not read details from this image.', variant: 'destructive'});
            } finally { setIsScanning(false); }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-4 rounded-md border bg-muted/20 p-4 relative">
            {!isReadOnly && (
                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-destructive" onClick={() => remove(index)} disabled={!canRemove}>
                    <Trash2 className="h-4 w-4"/>
                </Button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={control} name={`transactions.${index}.amount`} render={({ field }) => (
                    <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Amount (₹)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={control} name={`transactions.${index}.date`} render={({ field }) => (
                    <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Transaction date</FormLabel><FormControl><Input type="date" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormField control={control} name={`transactions.${index}.transactionId`} render={({ field }) => (
                    <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Transaction id</FormLabel><FormControl><Input placeholder="UPI ref, check no., etc." {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormField control={control} name={`transactions.${index}.upiId`} render={({ field }) => (
                    <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Sender UPI ID</FormLabel><FormControl><Input placeholder="e.g. sender@upi" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>
                )}/>
            </div>
            <div className="space-y-2">
                {!isReadOnly && (
                    <FormField control={control} name={`transactions.${index}.screenshotFile`} render={() => (
                        <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Upload screenshot</FormLabel><FormControl><Input id={`tx-screenshot-upload-${index}`} type="file" accept="image/*" {...register(`transactions.${index}.screenshotFile`)} /></FormControl><FormMessage /></FormItem>
                    )}/>
                )}
                {preview && (
                    <div className="relative group w-full h-32 rounded-md border border-primary/10 bg-secondary/30 overflow-hidden">
                        <Image src={preview.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(preview)}` : preview} alt="Screenshot" fill sizes="(max-width: 768px) 100vw, 300px" className="object-contain" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
                                <DialogTrigger asChild>
                                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 text-white border-white hover:bg-white/20">
                                        <ZoomIn className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl">
                                    <DialogHeader><DialogTitle className="font-bold text-primary uppercase">Transaction artifact</DialogTitle></DialogHeader>
                                    <div className="relative h-[70vh] w-full mt-4 overflow-auto bg-secondary/20 border border-primary/10 rounded-md">
                                        <Image src={preview.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent(preview)}` : preview} alt="Screenshot" fill sizes="100vw" className="object-contain transition-transform origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                                    </div>
                                    <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setZoom(z => z * 1.2)} className="font-bold text-primary border-primary/20"><ZoomIn className="mr-2 h-4 w-4"/> Zoom in</Button>
                                        <Button variant="outline" size="sm" onClick={() => setZoom(z => z / 1.2)} className="font-bold text-primary border-primary/20"><ZoomOut className="mr-2 h-4 w-4"/> Zoom out</Button>
                                        <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold text-primary border-primary/20"><RotateCw className="mr-2 h-4 w-4"/> Rotate</Button>
                                        <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold text-primary border-primary/20"><RefreshCw className="mr-2 h-4 w-4"/> Reset</Button>
                                        {!isReadOnly && (
                                            <>
                                                <Separator orientation="vertical" className="h-8 hidden sm:block"/>
                                                <Button variant="outline" size="sm" onClick={() => document.getElementById(`tx-screenshot-upload-${index}`)?.click()} className="font-bold text-primary border-primary/20"><Replace className="mr-2 h-4 w-4"/> Replace</Button>
                                                <Button variant="destructive" size="sm" onClick={handleRemoveImage} className="font-bold"><Trash2 className="mr-2 h-4 w-4"/> Remove</Button>
                                            </>
                                        )}
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            {!isReadOnly && (
                                <>
                                    <Button type="button" size="icon" variant="outline" onClick={() => document.getElementById(`tx-screenshot-upload-${index}`)?.click()} className="h-8 w-8 text-white border-white hover:bg-white/20">
                                        <Replace className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" size="icon" variant="destructive" onClick={handleRemoveImage} className="h-8 w-8">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
                 {!isReadOnly && fileList && fileList.length > 0 && (
                    <Button type="button" onClick={handleScanScreenshot} disabled={isScanning} className="w-full mt-2 font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-transform active:scale-95">
                        {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ScanLine className="mr-2 h-4 w-4" />}
                        Scan screenshot with AI
                    </Button>
                )}
            </div>
        </div>
    )
}

export function DonationForm({ donation, onSubmit, onCancel, campaigns = [], leads = [], defaultLinkId, isReadOnly = false }: DonationFormProps & { isReadOnly?: boolean }) {
  const isEditing = !!donation;
  const { userProfile } = useSession();
  const auth = useAuth();
  const { toast } = useToast();
  
  const form = useForm<DonationFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      donorName: donation?.donorName || '',
      donorPhone: donation?.donorPhone || '',
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
      typeSplit: donation?.typeSplit && donation.typeSplit.length > 0 ? donation.typeSplit.map(ts => ({...ts, forFundraising: ts.forFundraising ?? true})) : [{ category: 'Sadaqah', amount: donation?.amount || 0, forFundraising: true }],
      transactions: donation?.transactions && donation.transactions.length > 0 ? donation.transactions.map(tx => ({...tx, amount: Number(tx.amount), date: tx.date || (donation?.donationDate || new Date().toISOString().split('T')[0]) })) : [{ id: `tx_${Date.now()}`, amount: donation?.amount || 0, transactionId: (donation as any)?.transactionId, date: donation?.donationDate || new Date().toISOString().split('T')[0] }],
      isSplit: (donation?.linkSplit?.length ?? 0) > 1,
      linkSplit: donation?.linkSplit?.map(l => ({ linkId: `${l.linkType}_${l.linkId}`, amount: l.amount })) || (defaultLinkId ? [{linkId: defaultLinkId, amount: donation?.amount || 0}] : []),
    },
  });

  const { control, watch, setValue, getValues, register, formState: { isDirty, errors, isSubmitting } } = form;
  const { fields: transactionFields, append: appendTransaction, remove: removeTransaction } = useFieldArray({ control, name: "transactions" });
  const { fields: typeSplitFields, append: appendTypeSplit, remove: removeTypeSplit, replace: replaceTypeSplit } = useFieldArray({ control, name: "typeSplit" });
  const { fields: linkSplitFields, append: appendLinkSplit, remove: removeLinkSplit, replace: replaceLinkSplit } = useFieldArray({ control, name: "linkSplit" });

  const watchedTransactions = useWatch({ control, name: 'transactions' });
  const isTypeSplit = watch('isTypeSplit');
  const watchedTypeSplit = watch('typeSplit');
  const isMonthlyContribution = useMemo(() => watchedTypeSplit?.some(s => s.category === 'Monthly Contribution'), [watchedTypeSplit]);
  const isLinkSplit = watch('isSplit');

  useEffect(() => {
    const total = watchedTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    setValue('amount', total, { shouldValidate: true, shouldDirty: true });
  }, [watchedTransactions, setValue]);

  const totalAmount = watch('amount');

  useEffect(() => {
    if (!isTypeSplit) {
      const currentSplits = getValues('typeSplit');
      const firstCategory = currentSplits.length > 0 ? currentSplits[0].category : 'Sadaqah';
      replaceTypeSplit([{ category: firstCategory, amount: totalAmount, forFundraising: true }]);
    }
  }, [isTypeSplit, totalAmount, replaceTypeSplit, getValues]);
  
  useEffect(() => {
    if (!isLinkSplit) {
      const currentLinks = getValues('linkSplit') || [];
      const firstLink = currentLinks.length > 0 ? currentLinks[0].linkId : (defaultLinkId || 'unlinked');
      replaceLinkSplit([{ linkId: firstLink, amount: totalAmount }]);
    }
  }, [isLinkSplit, totalAmount, replaceTypeSplit, getValues, defaultLinkId]);

  const handleSubmit = (data: DonationFormData) => {
    const hasFilesToUpload = data.transactions.some(tx => tx.screenshotFile && (tx.screenshotFile as FileList).length > 0);
    if (hasFilesToUpload && !auth?.currentUser) {
        toast({ title: "Authentication error", description: "User not authenticated yet.", variant: "destructive" });
        return;
    }
    onSubmit(data);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-4 text-primary font-normal">
          <FormField control={control} name="amount" render={({ field }) => (
              <FormItem><FormLabel className="font-bold text-primary">Total donation amount (₹)</FormLabel><FormControl><Input type="number" {...field} readOnly className="bg-primary/5 font-bold text-lg" /></FormControl><FormDescription className="font-normal">Calculated sum of all transactions.</FormDescription><FormMessage /></FormItem>
          )}/>

        <div className="space-y-4 rounded-xl border border-primary/10 p-4 bg-white shadow-sm">
            <h3 className="text-base font-bold text-primary">Transaction details</h3>
            <FormField control={control} name="donationType" render={({ field }) => (
                <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Payment method *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select method" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Online Payment" className="font-bold">Online payment</SelectItem><SelectItem value="Cash" className="font-bold">Cash</SelectItem><SelectItem value="Check" className="font-bold">Check</SelectItem><SelectItem value="Other" className="font-bold">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>
            )}/>
            <div className="space-y-4">
               {transactionFields.map((field, index) => (
                    <TransactionItem key={field.id} control={control} index={index} register={register} setValue={setValue} getValues={getValues} remove={removeTransaction} canRemove={transactionFields.length > 1} isReadOnly={isReadOnly} />
               ))}
            </div>
            {!isReadOnly && (
                <Button type="button" variant="outline" size="sm" onClick={() => appendTransaction({ id: `tx_${Date.now()}`, amount: 0, transactionId: '', date: new Date().toISOString().split('T')[0], upiId: '' })} className="font-bold text-primary border-primary/20 transition-transform active:scale-95"><Plus className="mr-2 h-4 w-4"/> Add another transaction</Button>
            )}
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField control={control} name="donorName" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Donor name *</FormLabel><FormControl><Input placeholder="e.g. Saleem Khan" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={control} name="donorPhone" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Donor phone</FormLabel><FormControl><Input placeholder="10-digit mobile" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl><FormMessage /></FormItem>
              )}/>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FormField control={control} name="receiverName" render={({ field }) => (
                <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Receiver name *</FormLabel><FormControl><Input placeholder="e.g. Organization Rep" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={control} name="referral" render={({ field }) => (
                <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Referral *</FormLabel><FormControl><Input placeholder="e.g. Local Volunteer" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl><FormMessage /></FormItem>
            )}/>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FormField control={control} name="donationDate" render={({ field }) => (
                <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Entry date *</FormLabel><FormControl><Input type="date" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={control} name="status" render={({ field }) => (
                <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Status *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Pending" className="font-bold">Pending</SelectItem><SelectItem value="Verified" className="font-bold">Verified</SelectItem><SelectItem value="Canceled" className="font-bold text-destructive">Canceled</SelectItem></SelectContent></Select><FormMessage /></FormItem>
            )}/>
        </div>
        
        <div className="space-y-4 rounded-xl border border-primary/10 p-4 bg-white shadow-sm">
             <FormField control={control} name="isTypeSplit" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isReadOnly}/></FormControl><FormLabel className="font-bold text-primary cursor-pointer">Split by category (Zakat, Sadaqah, etc.)</FormLabel></FormItem>
              )}/>
          {isTypeSplit ? (
            <div className="space-y-4 pl-6">
                <div className="border border-primary/5 rounded-lg overflow-hidden">
                    <ScrollArea className="w-full">
                        <Table>
                            <TableHeader className="bg-primary/5"><TableRow><TableHead className="font-bold text-primary">Category</TableHead><TableHead className="font-bold text-primary">Amount (₹)</TableHead><TableHead className="text-right font-bold text-primary">Action</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {typeSplitFields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell><FormField control={control} name={`typeSplit.${index}.category`} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold border-none bg-transparent shadow-none"><SelectValue/></SelectTrigger></FormControl><SelectContent>{donationCategories.map(cat => <SelectItem key={cat} value={cat} className="font-bold">{cat}</SelectItem>)}</SelectContent></Select>)}/>{watch(`typeSplit.${index}.category`) === 'Zakat' && <FormField control={control} name={`typeSplit.${index}.forFundraising`} render={({ field: checkboxField }) => (<div className="flex items-center space-x-2 px-2 mt-1"><Checkbox checked={checkboxField.value} onCheckedChange={checkboxField.onChange} disabled={isReadOnly}/><Label className="text-[10px] font-normal text-muted-foreground">Include in goal</Label></div>)}/>}</TableCell>
                                        <TableCell><FormField control={control} name={`typeSplit.${index}.amount`} render={({ field }) => (<FormControl><Input type="number" placeholder="0.00" {...field} disabled={isReadOnly} className="border-none bg-transparent shadow-none font-bold font-mono"/></FormControl>)}/></TableCell>
                                        <TableCell className="text-right">{!isReadOnly && <Button type="button" variant="ghost" size="icon" onClick={() => removeTypeSplit(index)} disabled={typeSplitFields.length <= 1}><Trash2 className="h-4 w-4 text-destructive"/></Button>}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
                {!isReadOnly && <Button type="button" variant="outline" size="sm" onClick={() => appendTypeSplit({ category: 'Sadaqah', amount: 0, forFundraising: true })} className="font-bold text-primary border-primary/20 transition-transform active:scale-95"><Plus className="mr-2 h-4 w-4"/> Add category</Button>}
            </div>
          ) : (
            <div className="pl-6 space-y-4">
                <FormField control={control} name={`typeSplit.0.category`} render={({ field }) => (
                    <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Primary category *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold"><SelectValue/></SelectTrigger></FormControl><SelectContent>{donationCategories.map(cat => <SelectItem key={cat} value={cat} className="font-bold">{cat}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )}/>
                {watch('typeSplit.0.category') === 'Zakat' && (
                    <FormField control={control} name="typeSplit.0.forFundraising" render={({ field: checkboxField }) => (
                        <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-2"><FormControl><Checkbox checked={checkboxField.value} onCheckedChange={checkboxField.onChange} disabled={isReadOnly}/></FormControl><FormLabel className="text-xs font-normal text-muted-foreground cursor-pointer">Include this Zakat in fundraising goal tracking</FormLabel></FormItem>
                    )}/>
                )}
            </div>
          )}
        </div>
        
        {isMonthlyContribution && (
          <div className="space-y-4 rounded-xl border border-primary/10 p-4 bg-white shadow-sm animate-fade-in-zoom">
            <h3 className="text-base font-bold text-primary">Monthly contribution period</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField control={control} name="contributionFromDate" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">From date</FormLabel><FormControl><Input type="date" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl></FormItem>
              )}/>
              <FormField control={control} name="contributionToDate" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">To date</FormLabel><FormControl><Input type="date" {...field} disabled={isReadOnly} className="font-bold text-primary"/></FormControl></FormItem>
              )}/>
            </div>
          </div>
        )}

        <div className="space-y-4 rounded-xl border border-primary/10 p-4 bg-white shadow-sm">
             <FormField control={control} name="isSplit" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isReadOnly}/></FormControl><FormLabel className="font-bold text-primary cursor-pointer">Split across multiple initiatives</FormLabel></FormItem>
              )}/>
          {isLinkSplit ? (
            <div className="space-y-4 pl-6">
                <div className="border border-primary/5 rounded-lg overflow-hidden">
                    <ScrollArea className="w-full">
                        <Table>
                            <TableHeader className="bg-primary/5"><TableRow><TableHead className="font-bold text-primary">Initiative</TableHead><TableHead className="font-bold text-primary">Allocation (₹)</TableHead><TableHead className="text-right font-bold text-primary">Action</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {linkSplitFields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell><FormField control={control} name={`linkSplit.${index}.linkId`} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold border-none bg-transparent shadow-none min-w-[200px]"><SelectValue placeholder="Select initiative..."/></SelectTrigger></FormControl><SelectContent><SelectGroup><SelectLabel className="font-bold text-primary/60">Campaigns</SelectLabel>{campaigns.map(c => <SelectItem key={c.id} value={`campaign_${c.id}`} className="font-bold">{c.name}</SelectItem>)}</SelectGroup><SelectGroup><SelectLabel className="font-bold text-primary/60">Leads</SelectLabel>{leads.map(l => <SelectItem key={l.id} value={`lead_${l.id}`} className="font-bold">{l.name}</SelectItem>)}</SelectGroup></SelectContent></Select>)}/></TableCell>
                                        <TableCell><FormField control={control} name={`linkSplit.${index}.amount`} render={({ field }) => (<FormControl><Input type="number" placeholder="0.00" {...field} disabled={isReadOnly} className="border-none bg-transparent shadow-none font-bold font-mono text-primary"/></FormControl>)}/></TableCell>
                                        <TableCell className="text-right">{!isReadOnly && <Button type="button" variant="ghost" size="icon" onClick={() => removeLinkSplit(index)} disabled={linkSplitFields.length <= 1}><Trash2 className="h-4 w-4 text-destructive"/></Button>}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
                {!isReadOnly && <Button type="button" variant="outline" size="sm" onClick={() => appendLinkSplit({ linkId: 'unlinked', amount: 0 })} className="font-bold text-primary border-primary/20 transition-transform active:scale-95"><Plus className="mr-2 h-4 w-4"/> Add initiative</Button>}
            </div>
          ) : (
             <FormField control={control} name={`linkSplit.0.linkId`} render={({ field }) => (
                <FormItem className="pl-6"><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Linked initiative</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadOnly}><FormControl><SelectTrigger className="font-bold text-primary"><SelectValue placeholder="No initiative linked"/></SelectTrigger></FormControl><SelectContent><SelectItem value="unlinked" className="font-normal italic">-- Do not link --</SelectItem><SelectGroup><SelectLabel className="font-bold text-primary/60">Campaigns</SelectLabel>{campaigns.map(c => <SelectItem key={c.id} value={`campaign_${c.id}`} className="font-bold">{c.name}</SelectItem>)}</SelectGroup><SelectGroup><SelectLabel className="font-bold text-primary/60">Leads</SelectLabel>{leads.map(l => <SelectItem key={l.id} value={`lead_${l.id}`} className="font-bold">{l.name}</SelectItem>)}</SelectGroup></SelectContent></Select></FormItem>
            )}/>
          )}
        </div>

        <div className="space-y-6">
            <FormField control={control} name="comments" render={({ field }) => (
                <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Donor comments</FormLabel><FormControl><Textarea placeholder="Notes from the donor..." {...field} disabled={isReadOnly} className="font-normal text-primary" /></FormControl></FormItem>
            )}/>
            <FormField control={control} name="suggestions" render={({ field }) => (
                <FormItem><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Staff suggestions</FormLabel><FormControl><Textarea placeholder="Internal improvements..." {...field} disabled={isReadOnly} className="font-normal text-primary" /></FormControl></FormItem>
            )}/>
        </div>

        {!isReadOnly && (
            <div className="flex justify-end gap-3 pt-6 sticky bottom-0 bg-background/80 backdrop-blur-sm p-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="font-bold text-primary border-primary/20 transition-transform active:scale-95">Cancel</Button>
                <Button type="submit" disabled={isSubmitting || (isEditing && !isDirty)} className="font-bold px-8 transition-transform active:scale-95 shadow-md">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save record
                </Button>
            </div>
        )}
      </form>
    </Form>
  );
}