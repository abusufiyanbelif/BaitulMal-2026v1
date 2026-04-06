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
    ShieldCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { processPublicDonationAction } from '@/app/donations/public-actions';
import { upiProviders, supportedBanks } from '@/lib/modules';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const donationSchema = z.object({
  donorName: z.string().min(2, "Name must be at least 2 characters."),
  donorPhone: z.string().min(10, "Valid phone number is required."),
  donorEmail: z.string().email("Invalid email address.").optional().or(z.literal('')),
  amount: z.coerce.number().min(1, "Minimum donation is ₹1."),
  paymentMethod: z.enum(['UPI', 'Bank Transfer']),
  paymentProvider: z.string().min(1, "Please select a payment provider."),
  transactionId: z.string().min(4, "Transaction Reference ID is required."),
  notes: z.string().optional(),
});

type DonationFormValues = z.infer<typeof donationSchema>;

interface PublicDonationFormProps {
    initialCampaignId?: string;
    initialLeadId?: string;
    campaignName?: string;
    leadName?: string;
    onSuccess?: (id: string) => void;
}

export function PublicDonationForm({ 
    initialCampaignId, 
    initialLeadId, 
    campaignName, 
    leadName, 
    onSuccess 
}: PublicDonationFormProps) {
    const { toast } = useToast();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [donationId, setDonationId] = useState<string | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);

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
        },
    });

    const paymentMethod = form.watch('paymentMethod');

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
        toast({ title: "Copied to clipboard", variant: "success" });
    };

    async function onSubmit(values: DonationFormValues) {
        setIsSubmitting(true);
        try {
            const result = await processPublicDonationAction({
                ...values,
                campaignId: initialCampaignId,
                leadId: initialLeadId,
            });

            if (result.success) {
                setIsSuccess(true);
                setDonationId(result.id || null);
                if (onSuccess) onSuccess(result.id || '');
                toast({ title: "Donation Submitted", description: "Thank you for your generous contribution!", variant: "success" });
            } else {
                toast({ title: "Submission Failed", description: result.message, variant: "destructive" });
            }
        } catch (error: any) {
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 animate-fade-in-up">
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
                                {(campaignName || leadName) && (
                                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Supporting Cause</p>
                                            <p className="text-sm font-bold text-primary truncate max-w-[200px]">{campaignName || leadName}</p>
                                        </div>
                                        <Badge variant="outline" className="font-bold bg-white text-primary border-primary/20">Linked</Badge>
                                    </div>
                                )}

                                <FormField
                                    control={form.control}
                                    name="donorName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Full Name</FormLabel>
                                            <FormControl><Input placeholder="Your Name" {...field} className="h-11 rounded-xl border-primary/10 focus:border-primary/30 transition-all font-normal" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="donorPhone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Phone Number (WhatsApp)</FormLabel>
                                                <FormControl><Input placeholder="10-digit Mobile" {...field} className="h-11 rounded-xl border-primary/10 transition-all font-normal" /></FormControl>
                                                <FormDescription className="text-[10px] font-normal italic">Mandatory for secure tracking.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
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
                                    control={form.control}
                                    name="donorEmail"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Email Address (Optional)</FormLabel>
                                            <FormControl><Input placeholder="email@example.com" {...field} className="h-11 rounded-xl border-primary/10 transition-all font-normal" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card className="border-primary/10 shadow-lg bg-white overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b">
                                <CardTitle className="flex items-center gap-2 text-lg font-bold text-primary">
                                    <Smartphone className="h-5 w-5" /> 2. Payment Method
                                </CardTitle>
                                <CardDescription className="font-normal">Select how you've transferred the funds.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <FormField
                                    control={form.control}
                                    name="paymentMethod"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormControl>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => field.onChange('UPI')}
                                                        className={cn(
                                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 h-24 shadow-sm",
                                                            field.value === 'UPI' ? "border-primary bg-primary/5 shadow-inner" : "border-primary/10 bg-white hover:bg-primary/[0.02]"
                                                        )}
                                                    >
                                                        <div className={cn("p-2 rounded-full", field.value === 'UPI' ? "bg-primary text-white" : "bg-primary/5 text-primary")}>
                                                            <Smartphone className="h-4 w-4" />
                                                        </div>
                                                        <span className="text-xs font-bold uppercase tracking-widest">Online UPI</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => field.onChange('Bank Transfer')}
                                                        className={cn(
                                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 h-24 shadow-sm",
                                                            field.value === 'Bank Transfer' ? "border-primary bg-primary/5 shadow-inner" : "border-primary/10 bg-white hover:bg-primary/[0.02]"
                                                        )}
                                                    >
                                                        <div className={cn("p-2 rounded-full", field.value === 'Bank Transfer' ? "bg-primary text-white" : "bg-primary/5 text-primary")}>
                                                            <Landmark className="h-4 w-4" />
                                                        </div>
                                                        <span className="text-xs font-bold uppercase tracking-widest">Bank Transfer</span>
                                                    </button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="animate-fade-in-up">
                                    {paymentMethod === 'UPI' ? (
                                        <FormField
                                            control={form.control}
                                            name="paymentProvider"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">UPI Provider</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 rounded-xl border-primary/10 shadow-sm font-normal">
                                                                <SelectValue placeholder="Select App (GPay, Paytm...)" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="rounded-xl border-primary/10 shadow-dropdown">
                                                            {upiProviders.map(provider => (
                                                                <SelectItem key={provider} value={provider} className="font-normal">{provider}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ) : (
                                        <FormField
                                            control={form.control}
                                            name="paymentProvider"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Sending From Bank</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 rounded-xl border-primary/10 shadow-sm font-normal">
                                                                <SelectValue placeholder="Select Your Bank" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="rounded-xl border-primary/10 shadow-dropdown">
                                                            {supportedBanks.map(bank => (
                                                                <SelectItem key={bank} value={bank} className="font-normal">{bank}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>

                                <FormField
                                    control={form.control}
                                    name="transactionId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-xs uppercase tracking-widest opacity-60">Transaction Reference ID</FormLabel>
                                            <FormControl><Input placeholder="UPI Ref/Bank TxID" {...field} className="h-11 rounded-xl border-primary/10 font-mono font-bold" /></FormControl>
                                            <FormDescription className="text-[10px] font-normal italic">Enter the Ref ID from your payment successful screen.</FormDescription>
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

                                            {paymentMethod === 'Bank Transfer' && paymentSettings?.bankAccountNumber && (
                                                <div className="space-y-4 animate-fade-in-down">
                                                    <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/50 flex items-center justify-between">
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold text-amber-800/60 uppercase tracking-widest">Bank Name</p>
                                                            <p className="font-bold text-amber-900">{paymentSettings.bankAccountName || 'Official Trust Account'}</p>
                                                        </div>
                                                        <Landmark className="h-5 w-5 text-amber-600/40" />
                                                    </div>
                                                    <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/10 flex items-center justify-between group transition-colors">
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Account Number</p>
                                                            <p className="font-mono font-bold text-primary">{paymentSettings.bankAccountNumber}</p>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-10 w-10 text-primary border border-primary/10 rounded-xl" onClick={() => handleCopy(paymentSettings.bankAccountNumber!, 'bank_acc')}>
                                                            {copiedField === 'bank_acc' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                    <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/10 flex items-center justify-between group transition-colors">
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">IFSC Code</p>
                                                            <p className="font-mono font-bold text-primary">{paymentSettings.bankIfsc}</p>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-10 w-10 text-primary border border-primary/10 rounded-xl" onClick={() => handleCopy(paymentSettings.bankIfsc!, 'bank_ifsc')}>
                                                            {copiedField === 'bank_ifsc' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <FormField
                                    control={form.control}
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
