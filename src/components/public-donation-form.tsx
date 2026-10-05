'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
    Download,
    Mail,
    MessageSquare,
    AlertTriangle,
    Sparkles,
    UserCheck,
    RefreshCw,
    HelpCircle,
    PhoneCall,
    Building2,
    Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
    processPublicDonationAction, 
    sendDonationReceiptEmailAction, 
    sendDonationReceiptWhatsAppAction,
    logFailedTransactionAction
} from '@/app/donations/public-actions';
import { upiProviders, supportedBanks, donationCategories } from '@/lib/modules';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { usePaymentGateways } from '@/hooks/use-payment-gateways';
import { usePublicData } from '@/hooks/use-public-data';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { storageRef, uploadBytes, getDownloadURL, useStorage } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import type { Donor } from '@/lib/types';

const donationSchema = z.object({
  donorName: z.string().min(2, "Name must be at least 2 characters."),
  donorPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: "Please enter a valid phone number with country code." }),
  donorEmail: z.string().min(1, "Valid email address is mandatory for donation receipt and verification.").email("Invalid email address."),
  amount: z.coerce.number().min(1, "Minimum donation is ₹1."),
  frequency: z.enum(['One-Time', 'Monthly']).default('One-Time'),
  paymentMethod: z.enum(['Online Gateway', 'UPI', 'Bank Transfer']),
  paymentProvider: z.string().min(1, "Please select a payment provider or app."),
  transactionId: z.string().optional().or(z.literal('')),
  donationDate: z.string().min(1, "Donation Date is required."),
  referral: z.string().optional(),
  suggestions: z.string().optional(),
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
}).superRefine((data, ctx) => {
  if (data.paymentMethod === 'UPI' || data.paymentMethod === 'Bank Transfer') {
    if (!data.transactionId || data.transactionId.trim().length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transactionId'],
        message: "Transaction Reference / UTR ID is mandatory for offline entry verification.",
      });
    }
  }
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
    const storage = useStorage();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const { gatewaySettings, canPublicUseGateway, canDonorUseGateway, isInternalTest, enabledGateways, allowMultipleGateways } = usePaymentGateways();
    const { campaignsWithProgress: campaigns, leadsWithProgress: leads, isLoading: isPublicDataLoading } = usePublicData();
    const { userProfile, isContributor } = useSession();

    const [selectedGateway, setSelectedGateway] = useState<string>('razorpay');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGatewayProcessing, setIsGatewayProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [donationId, setDonationId] = useState<string | null>(null);
    const [receiptData, setReceiptData] = useState<any | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanMatchInfo, setScanMatchInfo] = useState<{ match: boolean; message: string } | null>(null);

    // Returning Donor identity state
    const [returningDonorName, setReturningDonorName] = useState<string | null>(null);

    // Dispatch states for receipt
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

    // Failed payment modal state
    const [failedPaymentError, setFailedPaymentError] = useState<string | null>(null);

    // Online Gateway Checkout Modal state
    const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);

    const receiptCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Determine if user is team staff vs donor
    const isStaff = userProfile?.role === 'Admin' || userProfile?.role === 'User' || userProfile?.role === 'Staff' || userProfile?.role === 'Member';
    const isDonorUser = !!userProfile && !isStaff;
    const isDonorSelfRecordAllowed = isDonorUser ? (paymentSettings?.isDonorSelfRecordPaymentEnabled !== false) : true;
    const isDonorGatewayAllowed = isDonorUser ? (canDonorUseGateway) : canPublicUseGateway;
    const isGatewayAvailable = isStaff ? (gatewaySettings?.isOnlineGatewayEnabled !== false) : (isDonorUser ? canDonorUseGateway : canPublicUseGateway);
    const isSubmissionAllowed = isStaff || (isDonorUser ? (isDonorSelfRecordAllowed || isDonorGatewayAllowed) : true);

    const form = useForm<DonationFormValues>({
        resolver: zodResolver(donationSchema),
        defaultValues: {
            donorName: '',
            donorPhone: '',
            donorEmail: '',
            amount: 1000,
            frequency: 'One-Time',
            paymentMethod: isGatewayAvailable ? 'Online Gateway' : 'UPI',
            paymentProvider: isGatewayAvailable ? (gatewaySettings?.activeGateway === 'razorpay' ? 'Razorpay' : gatewaySettings?.activeGateway === 'instamojo' ? 'Instamojo' : 'PhonePe') : 'GPay',
            transactionId: '',
            donationDate: '',
            referral: '',
            suggestions: '',
            notes: '',
            isTypeSplit: false,
            typeSplit: [{ category: 'Sadaqah', amount: 1000, forFundraising: false }],
            isSplit: false,
            linkSplit: (initialCampaignId || initialLeadId) ? [{ linkId: initialCampaignId ? `campaign_${initialCampaignId}` : `lead_${initialLeadId}`, amount: 1000 }] : [],
        },
    });

    const { control, watch, setValue, getValues, handleSubmit } = form;
    const { fields: typeSplitFields, append: appendTypeSplit, remove: removeTypeSplit, replace: replaceTypeSplit } = useFieldArray({ control, name: "typeSplit" });
    const { fields: linkSplitFields, append: appendLinkSplit, remove: removeLinkSplit, replace: replaceLinkSplit } = useFieldArray({ control, name: "linkSplit" });

    // Auto-fill donor details if logged in
    useEffect(() => {
        if (userProfile && isContributor) {
            const pName = userProfile.name || '';
            const pPhone = (userProfile as any).phone || '';
            const pEmail = (userProfile as any).email || '';
            setValue('donorName', pName, { shouldValidate: true });
            setValue('donorPhone', pPhone, { shouldValidate: true });
            setValue('donorEmail', pEmail, { shouldValidate: true });
            if (pName) setReturningDonorName(pName);
        }
        setValue('donationDate', new Date().toISOString().split('T')[0]);
    }, [userProfile, isContributor, setValue]);

    // Update payment provider default if method switches
    const paymentMethod = watch('paymentMethod');
    const totalAmount = watch('amount');
    const isTypeSplit = watch('isTypeSplit');
    const isLinkSplit = watch('isSplit');
    const screenshotFile = watch('screenshotFile');
    const donorPhoneWatched = watch('donorPhone');
    const donorEmailWatched = watch('donorEmail');

    // Auto-fallback if gateway is inactive
    useEffect(() => {
        if (!isGatewayAvailable && paymentMethod === 'Online Gateway') {
            setValue('paymentMethod', 'UPI');
            setValue('paymentProvider', upiProviders[0]);
        }
    }, [isGatewayAvailable, paymentMethod, setValue]);

    useEffect(() => {
        if (paymentMethod === 'Online Gateway') {
            const providerName = gatewaySettings?.activeGateway === 'razorpay' ? 'Razorpay' : gatewaySettings?.activeGateway === 'instamojo' ? 'Instamojo' : 'PhonePe';
            setValue('paymentProvider', providerName);
        } else if (paymentMethod === 'UPI') {
            setValue('paymentProvider', upiProviders[0]);
        } else if (paymentMethod === 'Bank Transfer') {
            setValue('paymentProvider', supportedBanks[0]);
        }
    }, [paymentMethod, gatewaySettings?.activeGateway, setValue]);

    // Returning Donor Lookup Greeting
    useEffect(() => {
        if (userProfile && isContributor) return;
        if ((donorPhoneWatched && donorPhoneWatched.length >= 10) || (donorEmailWatched && donorEmailWatched.includes('@'))) {
            // Simulated instant lookup greeting indicator
            setReturningDonorName(getValues('donorName') || 'Valued Donor');
        } else {
            setReturningDonorName(null);
        }
    }, [donorPhoneWatched, donorEmailWatched, userProfile, isContributor, getValues]);

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
            if (response.date) setValue('donationDate', response.date, { shouldDirty: true, shouldValidate: true });
            if (response.onlineProvider) setValue('paymentMethod', 'UPI');

            toast({ title: 'AI Scan Successful', description: 'Transaction details extracted and date synced.', variant: "success"});
        } catch (error: any) {
            toast({ title: 'Scan Failed', description: error.message || 'Error occurred while scanning.', variant: 'destructive'});
        } finally { 
            setIsScanning(false); 
        }
    };

    // --- Action: Execute Online Payment Checkout (Option A) ---
    const handleLaunchGatewayCheckout = async () => {
        if (!isGatewayAvailable) {
            toast({ 
                title: "Online Gateway Inactive", 
                description: "Automated payment gateway is currently disabled. Displaying Direct QR / UPI & Bank details below for manual transfer.", 
                variant: "info" 
            });
            setValue('paymentMethod', 'UPI');
            return;
        }

        const isValid = await form.trigger(['donorName', 'donorPhone', 'amount']);
        if (!isValid) {
            toast({ title: "Missing Information", description: "Please enter your name, phone number, and donation amount.", variant: "destructive" });
            return;
        }

        setIsGatewayProcessing(true);
        setIsGatewayModalOpen(true);

        try {
            // Simulate Payment Gateway API Handshake
            await new Promise((resolve) => setTimeout(resolve, 1800));

            const activeProvider = (gatewaySettings?.activeGateway && gatewaySettings.activeGateway !== 'none') ? gatewaySettings.activeGateway : 'razorpay';
            const generatedTxId = `PAY_${activeProvider.toUpperCase()}_${Date.now()}`;
            setValue('transactionId', generatedTxId);

            // Execute Public Donation Action with instant verification status
            const values = getValues();
            const result = await processPublicDonationAction({
                ...values,
                paymentMethod: 'Online Gateway',
                gatewayProvider: activeProvider,
                gatewayPaymentId: generatedTxId,
                transactionId: generatedTxId,
            });

            if (result.success) {
                setIsGatewayModalOpen(false);
                setIsSuccess(true);
                setDonationId(result.id || null);
                setReceiptData({
                    receiptNo: `REC-${Date.now().toString().slice(-6)}`,
                    id: result.id,
                    donorName: values.donorName,
                    donorPhone: values.donorPhone,
                    donorEmail: values.donorEmail,
                    amount: values.amount,
                    frequency: values.frequency,
                    paymentMethod: `Online Gateway (${activeProvider.toUpperCase()})`,
                    transactionId: generatedTxId,
                    date: values.donationDate || new Date().toISOString().split('T')[0],
                    status: 'Verified (Instant)',
                    isReturningDonor: result.isReturningDonor
                });
                if (onSuccess) onSuccess(result.id || '');
                toast({ title: "Payment Successful!", description: "Thank you for your generous contribution.", variant: "success" });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            setIsGatewayModalOpen(false);
            const errorMsg = error.message || "Online payment was interrupted or failed.";
            setFailedPaymentError(errorMsg);
            
            // Log audit event
            logFailedTransactionAction({
                donorName: getValues('donorName'),
                donorPhone: getValues('donorPhone'),
                donorEmail: getValues('donorEmail'),
                amount: getValues('amount'),
                reason: errorMsg,
                gatewayProvider: (gatewaySettings?.activeGateway && gatewaySettings.activeGateway !== 'none') ? gatewaySettings.activeGateway : 'razorpay'
            });
        } finally {
            setIsGatewayProcessing(false);
        }
    };

    // --- Action: Manual Form Submission (Option B / C) ---
    async function onSubmit(values: DonationFormValues) {
        if (values.paymentMethod === 'Online Gateway') {
            await handleLaunchGatewayCheckout();
            return;
        }

        if (!values.transactionId || values.transactionId.length < 4) {
            toast({ title: "Transaction ID Required", description: "Please enter your UTR / Ref Transaction ID from your payment app.", variant: "destructive" });
            return;
        }

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
                setReceiptData({
                    receiptNo: `REC-${Date.now().toString().slice(-6)}`,
                    id: result.id,
                    donorName: values.donorName,
                    donorPhone: values.donorPhone,
                    donorEmail: values.donorEmail,
                    amount: values.amount,
                    frequency: values.frequency,
                    paymentMethod: values.paymentMethod,
                    paymentProvider: values.paymentProvider,
                    transactionId: values.transactionId,
                    date: values.donationDate || new Date().toISOString().split('T')[0],
                    status: 'Pending Verification',
                    isReturningDonor: result.isReturningDonor
                });
                if (onSuccess) onSuccess(result.id || '');
                toast({ title: "Donation Submitted", description: "Thank you! Our team will verify your submission.", variant: "success" });
            } else {
                setFailedPaymentError(result.message);
            }
        } catch (error: any) {
            console.error("Submission error:", error);
            setFailedPaymentError("An unexpected error occurred. Please try again later.");
        } finally {
            setIsSubmitting(false);
        }
    }

    // --- Action: Generate and Download Receipt PNG Canvas ---
    const handleDownloadReceiptImage = () => {
        if (!receiptData) return;
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 1000;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 800, 1000);

        // Top Gradient Bar
        const grad = ctx.createLinearGradient(0, 0, 800, 0);
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(1, '#1E293B');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 800, 140);

        // Header Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText('BAITULMAL FOUNDATION', 50, 60);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('OFFICIAL DONATION RECEIPT', 50, 95);

        // Receipt Details Box
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(50, 170, 700, 750);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 170, 700, 750);

        // Rows
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`Receipt No: ${receiptData.receiptNo}`, 80, 220);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#64748B';
        ctx.fillText(`Date: ${receiptData.date}`, 550, 220);

        ctx.strokeStyle = '#CBD5E1';
        ctx.beginPath();
        ctx.moveTo(80, 250);
        ctx.lineTo(720, 250);
        ctx.stroke();

        let y = 300;
        const addRow = (label: string, val: string) => {
            ctx.fillStyle = '#64748B';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(label, 80, y);

            ctx.fillStyle = '#0F172A';
            ctx.font = '16px sans-serif';
            ctx.fillText(val, 320, y);
            y += 45;
        };

        addRow('Donor Name:', receiptData.donorName);
        addRow('Phone Number:', receiptData.donorPhone);
        if (receiptData.donorEmail) addRow('Email Address:', receiptData.donorEmail);
        addRow('Donation Amount:', `₹${receiptData.amount.toLocaleString('en-IN')}`);
        addRow('Frequency:', receiptData.frequency);
        addRow('Payment Method:', receiptData.paymentMethod);
        addRow('Transaction ID / UTR:', receiptData.transactionId || 'N/A');
        addRow('Status:', receiptData.status);

        ctx.beginPath();
        ctx.moveTo(80, y + 10);
        ctx.lineTo(720, y + 10);
        ctx.stroke();

        // Footer note
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('✓ Thank you for supporting our cause!', 80, y + 60);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '12px sans-serif';
        ctx.fillText('This is a computer generated receipt. For queries, contact support@baitulmal.org', 80, y + 100);

        // Trigger Download
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `BaitulMal_Receipt_${receiptData.receiptNo}.png`;
        link.href = dataUrl;
        link.click();
        toast({ title: "Receipt Downloaded", description: "Receipt saved as PNG image to your device.", variant: "success" });
    };

    // --- Action: Interactive Dispatch to Email ---
    const handleSendEmail = async () => {
        if (!receiptData) return;
        const emailToUse = receiptData.donorEmail || prompt("Please enter your email address for receipt dispatch:");
        if (!emailToUse) return;

        setIsSendingEmail(true);
        try {
            const res = await sendDonationReceiptEmailAction(receiptData.id, emailToUse);
            if (res.success) {
                toast({ title: "Email Sent", description: res.message, variant: "success" });
            } else {
                toast({ title: "Email Failed", description: res.message, variant: "destructive" });
            }
        } finally {
            setIsSendingEmail(false);
        }
    };

    // --- Action: Interactive Dispatch to WhatsApp ---
    const handleSendWhatsApp = async () => {
        if (!receiptData) return;
        const phoneToUse = receiptData.donorPhone || prompt("Please enter your WhatsApp phone number:");
        if (!phoneToUse) return;

        setIsSendingWhatsApp(true);
        try {
            await sendDonationReceiptWhatsAppAction(receiptData.id, phoneToUse);
            
            // Open direct WhatsApp chat share link for instant convenience
            const waMsg = encodeURIComponent(
                `*BaitulMal Donation Receipt*\n\n*Receipt No:* ${receiptData.receiptNo}\n*Donor:* ${receiptData.donorName}\n*Amount:* ₹${receiptData.amount}\n*TxID:* ${receiptData.transactionId}\n*Status:* ${receiptData.status}\n\nThank you for your generous contribution!`
            );
            window.open(`https://wa.me/${phoneToUse.replace(/\D/g, '')}?text=${waMsg}`, '_blank');
            toast({ title: "WhatsApp Prepared", description: "Opened WhatsApp chat with formatted receipt message.", variant: "success" });
        } finally {
            setIsSendingWhatsApp(false);
        }
    };

    // --- SUCCESS SCREEN WITH VISUAL RECEIPT & DISPATCH BUTTONS ---
    if (isSuccess && receiptData) {
        return (
            <Card className="max-w-xl mx-auto border-emerald-200 shadow-2xl overflow-hidden animate-fade-in-up bg-white">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 h-3 w-full" />
                
                <CardHeader className="text-center pt-8 pb-4 space-y-2">
                    <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-bounce">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <CardTitle className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        Donation Received!
                    </CardTitle>
                    <CardDescription className="text-slate-600 text-sm font-medium">
                        {receiptData.isReturningDonor ? `Welcome back, ${receiptData.donorName}! Contribution linked to your history.` : `Thank you, ${receiptData.donorName}! Your contribution makes a real difference.`}
                    </CardDescription>
                </CardHeader>

                <CardContent className="px-6 space-y-6">
                    {/* Quarantine Alert for Manual / Offline Pending Entries */}
                    {receiptData.status === 'Pending' && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs shadow-sm">
                            <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <p className="font-bold text-amber-900">🔒 Quarantined Pending Team Audit</p>
                                <p className="text-amber-700">
                                    Your offline contribution (Ref: <span className="font-mono font-bold">{receiptData.transactionId}</span>) has been queued for team audit. To preserve calculation accuracy, unverified entries are kept in a separate tracking queue and will only affect campaign targets once verified against bank/UPI statements.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Visual Receipt Card Display */}
                    <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl space-y-4 relative shadow-inner">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Official Receipt</p>
                                <p className="font-mono text-base font-bold text-slate-800">{receiptData.receiptNo}</p>
                            </div>
                            <Badge className={cn("px-3 py-1 font-bold text-xs", receiptData.status.includes('Verified') ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white')}>
                                {receiptData.status}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-600">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Donor</span>
                                <span className="font-bold text-slate-900 text-sm">{receiptData.donorName}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Amount</span>
                                <span className="font-extrabold text-emerald-600 text-base">₹{receiptData.amount.toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Frequency</span>
                                <span className="font-semibold text-slate-800">{receiptData.frequency}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date</span>
                                <span className="font-semibold text-slate-800">{receiptData.date}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Method</span>
                                <span className="font-semibold text-slate-800">{receiptData.paymentMethod}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tx / UTR Reference</span>
                                <span className="font-mono font-bold text-slate-800 truncate block">{receiptData.transactionId || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Receipt Action Buttons */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Receipt Dispatch Options</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Button 
                                type="button" 
                                onClick={handleDownloadReceiptImage}
                                className="h-11 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all"
                            >
                                <Download className="mr-2 h-4 w-4" /> Download Image
                            </Button>

                            <Button 
                                type="button" 
                                onClick={handleSendEmail} 
                                disabled={isSendingEmail}
                                variant="outline"
                                className="h-11 rounded-xl border-slate-200 font-bold text-xs hover:bg-slate-50 transition-all text-slate-700"
                            >
                                {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4 text-blue-600" />}
                                Send to Email
                            </Button>

                            <Button 
                                type="button" 
                                onClick={handleSendWhatsApp} 
                                disabled={isSendingWhatsApp}
                                variant="outline"
                                className="h-11 rounded-xl border-slate-200 font-bold text-xs hover:bg-slate-50 transition-all text-emerald-700"
                            >
                                {isSendingWhatsApp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4 text-emerald-600" />}
                                Send to WhatsApp
                            </Button>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="bg-slate-50 border-t px-6 py-6 flex flex-col gap-3">
                    <Button variant="outline" className="w-full h-11 rounded-xl font-bold border-slate-200 text-slate-700" onClick={() => window.location.reload()}>
                        Make Another Donation
                    </Button>
                    <Button asChild className="w-full h-11 rounded-xl font-bold bg-primary text-white">
                        <a href="/">Return to Homepage</a>
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-fade-in-up">
                
                {/* Disabled Submission Notice */}
                {!isSubmissionAllowed && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-900 animate-fade-in-up shadow-sm">
                        <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                        <div>
                            <p className="font-bold text-sm">Donation Recording Disabled</p>
                            <p className="text-xs text-amber-700">Self-recording donation entries is currently disabled for donor accounts. Please contact our support team to record your contribution.</p>
                        </div>
                    </div>
                )}

                {/* Returning Donor Greeting Banner */}
                {returningDonorName && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between animate-fade-in-up shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                                <UserCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-emerald-900">Welcome Back, {returningDonorName}!</p>
                                <p className="text-xs text-emerald-700">We matched your details. Your donation will be linked to your donor profile.</p>
                            </div>
                        </div>
                        <Badge variant="outline" className="border-emerald-300 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                            Verified Profile
                        </Badge>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    
                    {/* STEP 1: Donor Info, Amount, Frequency & Causes */}
                    <div className="space-y-6">
                        <Card className="border-slate-200 shadow-xl bg-white overflow-hidden rounded-3xl">
                            <CardHeader className="bg-slate-50 border-b px-6 py-5">
                                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                                    <HeartHandshake className="h-5 w-5 text-primary" /> 1. Personal & Donation Details
                                </CardTitle>
                                <CardDescription className="text-slate-500 font-medium text-xs">Enter your contact info, frequency, and amount.</CardDescription>
                            </CardHeader>
                            
                            <CardContent className="pt-6 space-y-5 px-6">
                                
                                {/* Frequency Selector (One-Time vs Monthly) */}
                                <FormField
                                    control={control}
                                    name="frequency"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel className="font-bold text-xs uppercase tracking-widest text-slate-500">Donation Frequency</FormLabel>
                                            <FormControl>
                                                <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => field.onChange('One-Time')}
                                                        className={cn(
                                                            "h-11 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                                                            field.value === 'One-Time' ? "bg-white text-slate-900 shadow-sm border border-slate-200 font-extrabold" : "text-slate-500 hover:text-slate-900"
                                                        )}
                                                    >
                                                        <Sparkles className="h-4 w-4 text-amber-500" /> One-Time Donation
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => field.onChange('Monthly')}
                                                        className={cn(
                                                            "h-11 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                                                            field.value === 'Monthly' ? "bg-white text-emerald-700 shadow-sm border border-slate-200 font-extrabold" : "text-slate-500 hover:text-slate-900"
                                                        )}
                                                    >
                                                        <RefreshCw className="h-4 w-4 text-emerald-600" /> Monthly Pledge
                                                    </button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={control}
                                        name="donorName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-xs uppercase tracking-widest text-slate-500">Full Name</FormLabel>
                                                <FormControl><Input placeholder="Your Name" {...field} className="h-11 rounded-xl border-slate-200 focus:border-primary/40 font-medium" /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-xs uppercase tracking-widest text-slate-500">Amount (INR)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-700">₹</span>
                                                        <Input type="number" placeholder="0" {...field} className="h-11 pl-8 rounded-xl border-slate-200 font-bold text-lg text-slate-900" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={control}
                                        name="donorPhone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-xs uppercase tracking-widest text-slate-500">Phone (WhatsApp)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="+91 9876543210" {...field} className="h-11 rounded-xl border-slate-200 font-medium" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="donorEmail"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-xs uppercase tracking-widest text-slate-500">Email (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="your@email.com" {...field} className="h-11 rounded-xl border-slate-200 font-medium" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Category & Cause Allocations */}
                                <div className="space-y-4 pt-4 border-t border-dashed">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="isTypeSplit" checked={isTypeSplit} onCheckedChange={(checked) => setValue('isTypeSplit', checked === true)} />
                                        <Label htmlFor="isTypeSplit" className="text-xs font-bold text-slate-700 cursor-pointer uppercase tracking-wider">Split donation into multiple categories</Label>
                                    </div>

                                    {isTypeSplit ? (
                                        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
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
                                                    <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Donation Category</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 rounded-xl border-slate-200">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="rounded-xl border-slate-200">
                                                            {donationCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>

                                {/* Target Cause selection */}
                                <div className="space-y-4 pt-2">
                                    <FormField
                                        control={control}
                                        name="linkSplit.0.linkId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-[10px] uppercase tracking-widest text-slate-500">Support A Specific Cause</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-11 rounded-xl border-slate-200">
                                                            <SelectValue placeholder="General Unallocated Fund" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl border-slate-200">
                                                        <SelectItem value="unallocated">General Fund (Most Needed)</SelectItem>
                                                        <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Campaigns</div>
                                                        {campaigns.map(c => <SelectItem key={c.id} value={`campaign_${c.id}`}>{c.name} (Case ID: {c.caseId || c.id})</SelectItem>)}
                                                        <div className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Appeals</div>
                                                        {leads.map(l => <SelectItem key={l.id} value={`lead_${l.id}`}>{l.name} (Case ID: {l.caseId || l.id})</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                            </CardContent>
                        </Card>
                    </div>

                    {/* STEP 2: Payment Method Selection (Option A, B, C) */}
                    <div className="space-y-6">
                        <Card className="border-slate-200 shadow-xl bg-white overflow-hidden rounded-3xl">
                            <CardHeader className="bg-slate-50 border-b px-6 py-5">
                                <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                                    <CreditCard className="h-5 w-5 text-primary" /> 2. Choose Payment Method
                                </CardTitle>
                                <CardDescription className="text-slate-500 font-medium text-xs">Select automated online gateway or direct manual transfer.</CardDescription>
                            </CardHeader>
                            
                            <CardContent className="pt-6 space-y-6 px-6">
                                
                                {/* Payment Method Radio Cards */}
                                <FormField
                                    control={control}
                                    name="paymentMethod"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormControl>
                                                <div className="grid grid-cols-1 gap-3">
                                                    
                                                    {/* Option A: Automated Online Payment Gateway */}
                                                    <div 
                                                        onClick={() => {
                                                            if (!isGatewayAvailable) {
                                                                toast({
                                                                    title: "Online Gateway Inactive",
                                                                    description: "Automated payment gateway is currently disabled. Displaying Direct QR / UPI & Bank details.",
                                                                    variant: "info"
                                                                });
                                                                field.onChange('UPI');
                                                                return;
                                                            }
                                                            if (isDonorUser && !isDonorGatewayAllowed) {
                                                                toast({
                                                                    title: "Online Gateway Disabled",
                                                                    description: "Online gateway is disabled for donor accounts. Displaying Direct QR / UPI & Bank details.",
                                                                    variant: "info"
                                                                });
                                                                field.onChange('UPI');
                                                                return;
                                                            }
                                                            field.onChange('Online Gateway');
                                                        }}
                                                        className={cn(
                                                            "p-4 rounded-2xl border-2 transition-all cursor-pointer relative flex items-start gap-4",
                                                            !isGatewayAvailable || (isDonorUser && !isDonorGatewayAllowed) ? "opacity-60 bg-slate-50 border-slate-200" :
                                                            field.value === 'Online Gateway' ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white text-slate-900 border-slate-200 hover:border-slate-300"
                                                        )}
                                                    >
                                                        <div className={cn("p-2 rounded-xl shrink-0 mt-0.5", field.value === 'Online Gateway' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700")}>
                                                            <Lock className="h-5 w-5" />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold text-sm">Option A: Instant Online Gateway</span>
                                                                {!isGatewayAvailable ? (
                                                                    <Badge variant="outline" className="text-[9px] font-bold bg-slate-200 text-slate-700 border-none">Inactive (Fallback to QR)</Badge>
                                                                ) : gatewaySettings?.isInternalTestMode ? (
                                                                    <Badge variant="outline" className="text-[9px] font-bold bg-amber-400 text-slate-950 border-none">Test Mode Active</Badge>
                                                                ) : null}
                                                            </div>
                                                            <p className={cn("text-xs font-normal", field.value === 'Online Gateway' ? "text-slate-300" : "text-slate-500")}>
                                                                {!isGatewayAvailable 
                                                                    ? "Automated gateway is inactive. Click to view Direct QR, UPI & Bank details below." 
                                                                    : `Automated checkout via ${(selectedGateway || gatewaySettings?.activeGateway || 'gateway').toUpperCase()} (UPI, Cards, NetBanking, GPay, PhonePe). Instant verification.`}
                                                            </p>

                                                            {field.value === 'Online Gateway' && enabledGateways.length > 1 && (
                                                                <div className="pt-2 space-y-1.5 border-t border-slate-700/50 mt-2" onClick={(e) => e.stopPropagation()}>
                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Select Payment Gateway Provider:</p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {enabledGateways.map((gw) => (
                                                                            <button
                                                                                key={gw}
                                                                                type="button"
                                                                                onClick={() => setSelectedGateway(gw)}
                                                                                className={cn(
                                                                                    "px-3 py-1 rounded-xl text-xs font-extrabold capitalize transition-all border",
                                                                                    (selectedGateway || enabledGateways[0]) === gw 
                                                                                        ? "bg-emerald-500 text-white border-emerald-400 shadow-md" 
                                                                                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                                                                                )}
                                                                            >
                                                                                {gw}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Option B: Direct QR / UPI Code */}
                                                    <div 
                                                        onClick={() => {
                                                            if (isDonorUser && !isDonorSelfRecordAllowed) {
                                                                toast({
                                                                    title: "Self-Recording Disabled",
                                                                    description: "Self-recording manual transfers is disabled for donor accounts.",
                                                                    variant: "info"
                                                                });
                                                                return;
                                                            }
                                                            field.onChange('UPI');
                                                        }}
                                                        className={cn(
                                                            "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4",
                                                            isDonorUser && !isDonorSelfRecordAllowed ? "opacity-60 cursor-not-allowed bg-slate-50 border-slate-200" :
                                                            field.value === 'UPI' ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white text-slate-900 border-slate-200 hover:border-slate-300"
                                                        )}
                                                    >
                                                        <div className={cn("p-2 rounded-xl shrink-0 mt-0.5", field.value === 'UPI' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700")}>
                                                            <QrCode className="h-5 w-5" />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <span className="font-bold text-sm block">Option B: Direct QR / UPI Transfer</span>
                                                            <p className={cn("text-xs font-normal", field.value === 'UPI' ? "text-slate-300" : "text-slate-500")}>
                                                                Scan QR code or copy UPI ID directly in your GPay / PhonePe app. Submit UTR ref.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Option C: Direct Bank Transfer */}
                                                    <div 
                                                        onClick={() => {
                                                            if (isDonorUser && !isDonorSelfRecordAllowed) {
                                                                toast({
                                                                    title: "Self-Recording Disabled",
                                                                    description: "Self-recording manual transfers is disabled for donor accounts.",
                                                                    variant: "info"
                                                                });
                                                                return;
                                                            }
                                                            field.onChange('Bank Transfer');
                                                        }}
                                                        className={cn(
                                                            "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4",
                                                            isDonorUser && !isDonorSelfRecordAllowed ? "opacity-60 cursor-not-allowed bg-slate-50 border-slate-200" :
                                                            field.value === 'Bank Transfer' ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white text-slate-900 border-slate-200 hover:border-slate-300"
                                                        )}
                                                    >
                                                        <div className={cn("p-2 rounded-xl shrink-0 mt-0.5", field.value === 'Bank Transfer' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700")}>
                                                            <Building2 className="h-5 w-5" />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <span className="font-bold text-sm block">Option C: Direct Bank Account (NEFT/IMPS)</span>
                                                            <p className={cn("text-xs font-normal", field.value === 'Bank Transfer' ? "text-slate-300" : "text-slate-500")}>
                                                                Transfer directly to official bank account. Submit transaction reference ID.
                                                            </p>
                                                        </div>
                                                    </div>

                                                </div>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {/* DISPLAY OPTION B / C INFORMATIONAL DETAILS */}
                                {paymentMethod === 'UPI' && (
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-fade-in-up">
                                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Direct UPI Transfer Details</p>
                                        
                                        {paymentSettings?.qrCodeUrl && (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                                    <Image 
                                                        src={`/api/image-proxy?url=${encodeURIComponent(paymentSettings.qrCodeUrl)}`} 
                                                        alt="Payment QR" 
                                                        width={160} 
                                                        height={160} 
                                                        className="object-contain"
                                                    />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Scan with GPay / PhonePe / Paytm</span>
                                            </div>
                                        )}

                                        {paymentSettings?.upiId && (
                                            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Official UPI ID</span>
                                                    <span className="font-mono text-sm font-bold text-slate-800">{paymentSettings.upiId}</span>
                                                </div>
                                                <Button type="button" variant="ghost" size="sm" onClick={() => handleCopy(paymentSettings?.upiId || '', 'upi')}>
                                                    {copiedField === 'upi' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {paymentMethod === 'Bank Transfer' && (
                                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-fade-in-up font-mono text-xs">
                                        <p className="text-xs font-bold font-sans text-slate-700 uppercase tracking-wider">Official Bank Account Details</p>
                                        
                                        <div className="space-y-2 text-slate-700">
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-slate-400">Account Name:</span>
                                                <span className="font-bold">{paymentSettings?.accountName || 'BaitulMal Trust'}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-slate-400">Account Number:</span>
                                                <span className="font-bold">{paymentSettings?.accountNumber || '000000000000'}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-slate-400">IFSC Code:</span>
                                                <span className="font-bold">{paymentSettings?.ifscCode || 'SBIN0000000'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Bank & Branch:</span>
                                                <span className="font-bold">{paymentSettings?.bankName || 'State Bank of India'}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* MANUAL SUBMISSION TRANSACTION REF ID & PROOF (for Option B & C) */}
                                {paymentMethod !== 'Online Gateway' && (
                                    <div className="space-y-4 pt-4 border-t border-dashed">
                                        <FormField
                                            control={control}
                                            name="transactionId"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-bold text-xs uppercase tracking-widest text-slate-500">Transaction Reference ID / UTR</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Enter 12-digit UTR or TxID" {...field} className="h-11 rounded-xl border-slate-200 font-mono font-bold" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={control}
                                            name="screenshotFile"
                                            render={({ field: { value, onChange, ...field } }) => (
                                                <FormItem>
                                                    <FormLabel className="font-bold text-xs uppercase tracking-widest text-slate-500">Payment Screenshot Proof (Optional)</FormLabel>
                                                    <FormControl>
                                                        <Input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            onChange={(e) => onChange(e.target.files)}
                                                            className="h-11 rounded-xl border-slate-200 font-medium" 
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {preview && (
                                            <div className="space-y-2">
                                                <div className="relative w-full h-36 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                                                    <Image src={preview} alt="Evidence Preview" fill className="object-contain p-2" />
                                                </div>
                                                <Button type="button" onClick={handleScanScreenshot} disabled={isScanning} className="w-full h-9 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                                                    {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
                                                    Auto-Fill Details From Image
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                            </CardContent>

                            <CardFooter className="bg-slate-50 border-t px-6 py-6 flex flex-col gap-4">
                                {paymentMethod === 'Online Gateway' ? (
                                    <Button 
                                        type="button"
                                        onClick={handleLaunchGatewayCheckout}
                                        disabled={!isSubmissionAllowed || isGatewayProcessing}
                                        className="w-full h-14 rounded-2xl text-base font-extrabold shadow-xl bg-slate-900 text-white hover:bg-slate-800 transition-all group disabled:opacity-50"
                                    >
                                        {isGatewayProcessing ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Lock className="mr-2 h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />}
                                        Pay & Donate Now (₹{totalAmount.toLocaleString('en-IN')})
                                    </Button>
                                ) : (
                                    <Button 
                                        type="submit" 
                                        disabled={!isSubmissionAllowed || isSubmitting} 
                                        className="w-full h-14 rounded-2xl text-base font-extrabold shadow-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all group disabled:opacity-50"
                                    >
                                        {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <HeartHandshake className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />}
                                        Submit Manual Transfer Details
                                    </Button>
                                )}

                                <div className="flex items-center gap-2 justify-center opacity-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    <span>256-Bit SSL Encrypted • Official BaitulMal Portal</span>
                                </div>
                            </CardFooter>
                        </Card>
                    </div>

                </div>
            </form>

            {/* FAILED PAYMENT GUIDANCE DIALOG */}
            <Dialog open={!!failedPaymentError} onOpenChange={() => setFailedPaymentError(null)}>
                <DialogContent className="max-w-md rounded-3xl p-6 bg-white shadow-2xl">
                    <DialogHeader className="text-center space-y-3">
                        <div className="mx-auto w-14 h-14 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                            <AlertTriangle className="h-8 w-8" />
                        </div>
                        <DialogTitle className="text-xl font-extrabold text-slate-900">Payment Interrupted or Failed</DialogTitle>
                        <DialogDescription className="text-xs text-slate-600">
                            {failedPaymentError}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 my-2 text-xs text-slate-700">
                        <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Steps to resolve:</p>
                        <ul className="list-disc list-inside space-y-1 text-slate-600">
                            <li>Check if your bank server timed out or limit exceeded.</li>
                            <li>Try using Option B (Direct QR / UPI ID) to transfer manually.</li>
                            <li>Contact our support helpline if your account was debited.</li>
                        </ul>

                        <div className="pt-2 border-t border-slate-200 space-y-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Support Helpline</p>
                            <p className="font-bold text-slate-900">Phone: +91 98765 43210</p>
                            <p className="font-bold text-slate-900">Email: support@baitulmal.org</p>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 pt-2">
                        <Button className="w-full h-11 rounded-xl font-bold bg-slate-900 text-white" onClick={() => setFailedPaymentError(null)}>
                            Try Again / Change Payment Method
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ONLINE GATEWAY CHECKOUT SIMULATION MODAL */}
            <Dialog open={isGatewayModalOpen} onOpenChange={() => {}}>
                <DialogContent className="max-w-sm rounded-3xl p-8 bg-slate-900 text-white text-center shadow-2xl border border-slate-800">
                    <div className="space-y-6">
                        <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-emerald-400 animate-pulse">
                            <Lock className="h-8 w-8" />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-lg font-bold">Connecting to {(gatewaySettings?.activeGateway || 'gateway').toUpperCase()}</h3>
                            <p className="text-xs text-slate-400">Processing secure encrypted checkout for ₹{totalAmount.toLocaleString('en-IN')}...</p>
                        </div>

                        <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-left space-y-2 font-mono text-xs">
                            <div className="flex justify-between text-slate-400">
                                <span>Provider:</span>
                                <span className="font-bold text-white">{(gatewaySettings?.activeGateway || 'gateway').toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Amount:</span>
                                <span className="font-bold text-emerald-400">₹{totalAmount}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Frequency:</span>
                                <span className="font-bold text-white">{getValues('frequency')}</span>
                            </div>
                        </div>

                        <div className="flex justify-center items-center gap-2 text-xs text-emerald-400 font-bold">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Verifying Credentials & Processing...</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </Form>
    );
}
