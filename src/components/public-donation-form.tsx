'use client';
import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription, 
    CardFooter 
} from '@/components/ui/card';
import { 
    Form, 
    FormControl, 
    FormField, 
    FormItem, 
    FormLabel, 
    FormMessage,
    FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
    HeartHandshake, 
    CreditCard, 
    Smartphone, 
    Landmark, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    Copy, 
    Check,
    QrCode,
    ChevronRight,
    ArrowLeft,
    ShieldCheck,
    Plus,
    Trash2,
    ScanLine,
    ImageIcon,
    RotateCw,
    ZoomIn,
    ZoomOut,
    RefreshCw,
    FolderKanban,
    Lightbulb
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { processPublicDonationAction } from '@/app/donations/public-actions';
import { upiProviders, supportedBanks, donationCategories } from '@/lib/modules';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { usePublicData } from '@/hooks/use-public-data';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const donationSchema = z.object({
  donorName: z.string().min(2, "Name must be at least 2 characters."),
  donorPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: "Please enter a valid phone number with country code." }),
  donorEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  amount: z.coerce.number().min(1, "Minimum donation is ₹1."),
  paymentMethod: z.enum(['UPI', 'Bank Transfer']),
  paymentProvider: z.string().min(1, "Please select a payment provider."),
  transactionId: z.string().min(4, "Transaction Reference ID is required."),
  notes: z.string().optional(),
  isTypeSplit: z.boolean().default(false),
  typeSplit: z.array(z.object({
    category: z.enum(donationCategories),
    amount: z.coerce.number().min(0, "Amount cannot be negative."),
    forFundraising: z.boolean().default(false),
  })).min(1, "At least one category is required."),
  isSplit: z.boolean().default(false),
  linkSplit: z.array(z.object({
    linkId: z.string(),
    amount: z.coerce.number().min(0, "Allocation cannot be negative."),
  })).optional(),
  screenshotFile: z.any().optional(),
});

type DonationFormValues = z.infer<typeof donationSchema>;

interface PublicDonationFormProps {
    initialCampaignId?: string;
    initialLeadId?: string;
    campaignName?: string;
    leadName?: string;
    onSuccess?: (id: string) => void;
}

import { useFieldArray } from 'react-hook-form';
import { storageRef, uploadBytes, getDownloadURL, useStorage } from '@/firebase';

export function PublicDonationForm({ 
    initialCampaignId, 
    initialLeadId, 
    campaignName, 
    leadName, 
    onSuccess 
}: PublicDonationFormProps) {
    const { toast } = useToast();
    const storage = useStorage();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const { campaignsWithProgress: campaigns, leadsWithProgress: leads, isLoading: isPublicDataLoading } = usePublicData();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [donationId, setDonationId] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const form = useForm<DonationFormValues>({
        resolver: zodResolver(donationSchema),
        defaultValues: {
            donorName: '',
            donorPhone: '',
            donorEmail: '',
            amount: 0,
            paymentMethod: 'UPI',
            paymentProvider: '',
            transactionId: '',
            notes: '',
            isTypeSplit: false,
            typeSplit: [{ category: 'Sadaqah', amount: 0, forFundraising: false }],
            isSplit: false,
            linkSplit: (initialCampaignId || initialLeadId) ? [{ linkId: initialCampaignId ? `campaign_${initialCampaignId}` : `lead_${initialLeadId}`, amount: 0 }] : [],
        },
    });

    const { control, watch, setValue, getValues, register, handleSubmit } = form;
    const { fields: typeSplitFields, append: appendTypeSplit, remove: removeTypeSplit, replace: replaceTypeSplit } = useFieldArray({ control, name: "typeSplit" });
    const { fields: linkSplitFields, append: appendLinkSplit, remove: removeLinkSplit, replace: replaceLinkSplit } = useFieldArray({ control, name: "linkSplit" });

    const paymentMethod = watch('paymentMethod');
    const totalAmount = watch('amount');
    const isTypeSplit = watch('isTypeSplit');
    const isLinkSplit = watch('isSplit');
    const screenshotFile = watch('screenshotFile');

    useEffect(() => {
        if (screenshotFile && screenshotFile.length > 0) {
            const file = screenshotFile[0];
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }
    }, [screenshotFile]);

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
            const firstLink = currentLinks.length > 0 ? currentLinks[0].linkId : 'unallocated';
            replaceLinkSplit([{ linkId: firstLink, amount: totalAmount }]);
        }
    }, [isLinkSplit, totalAmount, replaceLinkSplit, getValues]);

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
        toast({ title: "Copied to clipboard", variant: "success" });
    };

    const handleScanScreenshot = async () => {
        const fileList = getValues('screenshotFile');
        if (!fileList || fileList.length === 0) {
            toast({ title: 'No Evidence', description: 'Please upload a payment screenshot first.', variant: 'destructive' });
            return;
        }

        setIsScanning(true);
        try {
            const file = fileList[0];
            const dataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const apiResponse = await fetch('/api/scan-payment', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ photoDataUri: dataUri }) 
            });
            
            if (!apiResponse.ok) throw new Error('AI Scan Request Failed');
            const response = await apiResponse.json();
            
            if (response.amount) setValue('amount', response.amount, { shouldDirty: true, shouldValidate: true });
            if (response.transactionId) setValue('transactionId', response.transactionId, { shouldDirty: true, shouldValidate: true });
            if (response.upiId) setValue('paymentProvider', response.upiId, { shouldDirty: true, shouldValidate: true });
            if (response.onlineProvider) setValue('paymentMethod', 'UPI');
            
            toast({ title: 'AI Scan Successful', description: 'Transaction details extracted automatically.', variant: "success"});
        } catch (error: any) {
            toast({ title: 'Scan Failed', description: error.message || 'Error occurred while scanning.', variant: 'destructive'});
        } finally { 
            setIsScanning(false); 
        }
    };

    async function onSubmit(values: DonationFormValues) {
        setIsSubmitting(true);
        try {
            let screenshotUrl = '';
            const fileList = getValues('screenshotFile');
            
            if (fileList && fileList.length > 0 && storage) {
                const file = fileList[0];
                const sRef = storageRef(storage, `evidence/public_${Date.now()}_${file.name}`);
                const uploadResult = await uploadBytes(sRef, file);
                screenshotUrl = await getDownloadURL(uploadResult.ref);
            }

            const result = await processPublicDonationAction({
                ...values,
                screenshotUrl
            } as any);

            if (result.success) {
                setIsSuccess(true);
                setDonationId(result.id || null);
                if (onSuccess) onSuccess(result.id || '');
                toast({ title: "Donation Submitted", description: "Thank you for your generous contribution!", variant: "success" });
            } else {
                toast({ title: "Submission Failed", description: result.message, variant: "destructive" });
            }
        } catch (error: any) {
            console.error("Submission error:", error);
            toast({ title: "Critical Error", description: "An unexpected error occurred. Please try again later.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isSuccess) {
        return (
            <Card className="max-w-lg mx-auto border-green-100 shadow-xl overflow-hidden animate-fade-in-up">
                <div className="bg-green-500 h-2 w-full" />
                <CardContent className="pt-10 pb-10 text-center space-y-6">
                    <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 animate-bounce">
                        <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-primary tracking-tight">Thank You!</h2>
                        <p className="text-muted-foreground font-normal">Your contribution of <span className="font-bold text-primary">₹{form.getValues('amount')}</span> has been received and is waiting for internal verification.</p>
                    </div>
                    <div className="p-4 bg-primary/[0.02] border border-primary/10 rounded-xl space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Donation Reference</p>
                        <p className="font-mono text-lg font-bold text-primary">{donationId}</p>
                    </div>
                    <div className="flex flex-col gap-2 pt-4">
                        <Button variant="outline" className="font-bold border-primary/20 text-primary" onClick={() => window.location.reload()}>Make Another Donation</Button>
                        <Button asChild className="font-bold"><a href="/">Return to Homepage</a></Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-fade-in-up">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Step 1: Donor & Amount */}
                    <div className="space-y-6">
                        <Card className="border-primary/10 shadow-lg bg-white overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b">
                                <CardTitle className="flex items-center gap-2 text-lg font-bold text-primary">
                                    <HeartHandshake className="h-5 w-5" /> 1. Contribution Details
                                </CardTitle>
                                <CardDescription className="font-normal">Tell us who you are and how much you'd like to share.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={control}
                                        name="donorName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Full Name</FormLabel>
                                                <FormControl><Input placeholder="Your Name" {...field} className="h-11 rounded-xl border-primary/10 focus:border-primary/30 transition-all font-normal" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Amount (INR)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-primary">₹</span>
                                                        <Input type="number" placeholder="0" {...field} className="h-11 pl-8 rounded-xl border-primary/10 transition-all font-bold text-lg" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={control}
                                    name="donorPhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Phone Number (WhatsApp)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="+91 0000000000" {...field} className="h-11 rounded-xl border-primary/10 transition-all font-normal" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-4 pt-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="isTypeSplit" checked={isTypeSplit} onCheckedChange={(checked) => setValue('isTypeSplit', checked === true)} />
                                        <Label htmlFor="isTypeSplit" className="text-xs font-bold text-primary cursor-pointer uppercase tracking-wider">Split By Designation (Category)</Label>
                                    </div>

                                    {isTypeSplit ? (
                                        <div className="space-y-3 animate-fade-in-up bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            {typeSplitFields.map((field, index) => (
                                                <div key={field.id} className="flex gap-2 items-end">
                                                    <div className="flex-1 space-y-1">
                                                        <FormField
                                                            control={control}
                                                            name={`typeSplit.${index}.category`}
                                                            render={({ field }) => (
                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger className="h-9 rounded-lg border-slate-200">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        {donationCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="w-24">
                                                        <FormField
                                                            control={control}
                                                            name={`typeSplit.${index}.amount`}
                                                            render={({ field }) => (
                                                                <FormControl><Input type="number" {...field} className="h-9 rounded-lg border-slate-200 font-bold" /></FormControl>
                                                            )}
                                                        />
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeTypeSplit(index)} disabled={typeSplitFields.length <= 1} className="h-9 w-9 text-slate-400">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button type="button" variant="outline" size="sm" onClick={() => appendTypeSplit({ category: 'Sadaqah', amount: 0, forFundraising: false })} className="w-full text-[10px] font-bold uppercase tracking-widest h-8 rounded-lg border-dashed">
                                                <Plus className="mr-2 h-3 w-3" /> Add Category
                                            </Button>
                                        </div>
                                    ) : (
                                        <FormField
                                            control={control}
                                            name="typeSplit.0.category"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-bold text-[10px] uppercase tracking-widest opacity-60">Designation / Category</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 rounded-xl border-primary/10">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="rounded-xl border-primary/10">
                                                            {donationCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="isSplit" checked={isLinkSplit} onCheckedChange={(checked) => setValue('isSplit', checked === true)} />
                                        <Label htmlFor="isSplit" className="text-xs font-bold text-primary cursor-pointer uppercase tracking-wider">Allocate to Multiple Initiatives</Label>
                                    </div>

                                    {isLinkSplit ? (
                                        <div className="space-y-3 animate-fade-in-up bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            {linkSplitFields.map((field, index) => (
                                                <div key={field.id} className="flex gap-2 items-end">
                                                    <div className="flex-1 space-y-1">
                                                        <FormField
                                                            control={control}
                                                            name={`linkSplit.${index}.linkId`}
                                                            render={({ field }) => (
                                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger className="h-9 rounded-lg border-slate-200">
                                                                            <SelectValue placeholder="Select target..." />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Campaigns</div>
                                                                        {campaigns.map(c => <SelectItem key={c.id} value={`campaign_${c.id}`}>{c.name}</SelectItem>)}
                                                                        <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Appeals</div>
                                                                        {leads.map(l => <SelectItem key={l.id} value={`lead_${l.id}`}>{l.name}</SelectItem>)}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="w-24">
                                                        <FormField
                                                            control={control}
                                                            name={`linkSplit.${index}.amount`}
                                                            render={({ field }) => (
                                                                <FormControl><Input type="number" {...field} className="h-9 rounded-lg border-slate-200 font-bold" /></FormControl>
                                                            )}
                                                        />
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLinkSplit(index)} disabled={linkSplitFields.length <= 1} className="h-9 w-9 text-slate-400">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <Button type="button" variant="outline" size="sm" onClick={() => appendLinkSplit({ linkId: 'unallocated', amount: 0 })} className="w-full text-[10px] font-bold uppercase tracking-widest h-8 rounded-lg border-dashed">
                                                <Plus className="mr-2 h-3 w-3" /> Add Initiative
                                            </Button>
                                        </div>
                                    ) : (
                                        <FormField
                                            control={control}
                                            name="linkSplit.0.linkId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-bold text-[10px] uppercase tracking-widest opacity-60">Target Initiative</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 rounded-xl border-primary/10">
                                                                <SelectValue placeholder="Select Target..." />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="rounded-xl border-primary/10">
                                                            <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Campaigns</div>
                                                            {campaigns.map(c => <SelectItem key={c.id} value={`campaign_${c.id}`}>{c.name}</SelectItem>)}
                                                            <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Appeals</div>
                                                            {leads.map(l => <SelectItem key={l.id} value={`lead_${l.id}`}>{l.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-primary/10 shadow-lg bg-white overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b">
                                <CardTitle className="flex items-center gap-2 text-lg font-bold text-primary">
                                    <Smartphone className="h-5 w-5" /> 2. Evidence Verification
                                </CardTitle>
                                <CardDescription className="font-normal">Upload your payment screenshot for AI-powered verification.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <FormField
                                    control={control}
                                    name="screenshotFile"
                                    render={({ field: { value, onChange, ...field } }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Payment Evidence (Screenshot)</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    onChange={(e) => onChange(e.target.files)}
                                                    className="h-11 rounded-xl border-primary/10 font-normal" 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {preview && (
                                    <div className="relative group w-full h-48 rounded-2xl border border-primary/10 bg-slate-50 shadow-inner overflow-hidden">
                                        <Image src={preview} alt="Evidence Preview" fill className="object-contain p-2" />
                                        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <Button type="button" size="sm" onClick={handleScanScreenshot} disabled={isScanning} className="font-bold bg-white text-primary hover:bg-white/90">
                                                {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                                                Auto-Fill With AI
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <FormField
                                    control={control}
                                    name="transactionId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Transaction Reference ID</FormLabel>
                                            <FormControl><Input placeholder="UPI Ref / UTR / TxID" {...field} className="h-11 rounded-xl border-primary/10 font-mono font-bold" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Step 2: Payment Instructions & Details */}
                    <div className="space-y-6">
                        <Card className="border-primary/10 shadow-lg bg-white overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b">
                                <CardTitle className="flex items-center gap-2 text-lg font-bold text-primary">
                                    <QrCode className="h-5 w-5" /> Official Payment Details
                                </CardTitle>
                                <CardDescription className="font-normal">Scan the QR or use the details below to transfer funds.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-8">
                                {isPaymentLoading ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-4 opacity-40">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-[10px] font-bold tracking-widest uppercase">Fetching secure records...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8 animate-fade-in-up">
                                        {/* QR Code Section */}
                                        {paymentSettings?.qrCodeUrl && (
                                            <div className="flex flex-col items-center gap-4 group">
                                                <div className="relative p-4 bg-white rounded-3xl border-2 border-primary/5 shadow-2xl transition-transform hover:scale-[1.02] cursor-pointer">
                                                    <div className="relative w-48 h-48 sm:w-64 sm:h-64">
                                                        <Image 
                                                            src={`/api/image-proxy?url=${encodeURIComponent(paymentSettings.qrCodeUrl)}`} 
                                                            alt="Payment QR" 
                                                            fill 
                                                            className="object-contain p-2"
                                                        />
                                                    </div>
                                                </div>
                                                <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-widest px-4 py-1">Supported Apps: GPay, PhonePe, Paytm</Badge>
                                            </div>
                                        )}

                                        {/* UPI and Bank Details List */}
                                        <div className="grid gap-4 font-normal">
                                            {paymentSettings?.upiId && (
                                                <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/10 flex items-center justify-between group transition-colors hover:bg-primary/[0.05]">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Official UPI ID</p>
                                                        <p className="font-mono font-bold text-primary">{paymentSettings.upiId}</p>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-primary border border-primary/10 rounded-xl" onClick={() => handleCopy(paymentSettings.upiId!, 'upi')}>
                                                        {copiedField === 'upi' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <FormField
                                    control={control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Personal Message or Notes</FormLabel>
                                            <FormControl><Textarea placeholder="Any specific requirements or message..." {...field} className="min-h-[100px] rounded-xl border-primary/10 font-normal resize-none" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                            <CardFooter className="bg-primary/5 border-t px-6 py-8 flex flex-col gap-4">
                                <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl active:scale-95 transition-transform group">
                                    {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <HeartHandshake className="mr-2 h-6 w-6 text-red-300 group-hover:scale-110 transition-all" />}
                                    Submit Donation Details
                                </Button>
                                <div className="flex items-center gap-2 justify-center opacity-40">
                                    <ShieldCheck className="h-3 w-3" />
                                    <p className="text-[9px] font-bold uppercase tracking-widest">Secure Submission • Manual Verification Pipeline</p>
                                </div>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </form>
        </Form>
    );
}
