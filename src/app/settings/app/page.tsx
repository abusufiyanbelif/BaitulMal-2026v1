'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { useGuidingPrinciples } from '@/hooks/use-guiding-principles';
import { useStorage, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Resizer from 'react-image-file-resizer';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
    Loader2, 
    UploadCloud, 
    Save, 
    ImageIcon, 
    QrCode, 
    Edit, 
    Trash2, 
    X, 
    Building2, 
    MapPin, 
    Hash, 
    ShieldCheck, 
    Globe, 
    Landmark, 
    User, 
    CreditCard, 
    Plus, 
    Shield, 
    ChevronDown, 
    Monitor, 
    Megaphone, 
    Quote, 
    Target, 
    PieChart, 
    Info, 
    HeartHandshake, 
    Smartphone, 
    CheckCircle2, 
    GraduationCap, 
    HeartPulse, 
    Utensils, 
    HelpCircle, 
    ListChecks, 
    Calendar,
    Filter,
    Settings2,
    Layout,
    Globe2,
    ShieldAlert,
    Palette,
    Briefcase,
    Lightbulb,
    Lock,
    Key,
    UserCheck,
    SmartphoneNfc,
    Sparkles,
    ChevronRight,
    Activity,
    CloudCog
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { GuidingPrinciple, FocusArea, Campaign, Lead, BrandingSettings } from '@/lib/types';
import { BrandedLoader } from '@/components/branded-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { donationCategories } from '@/lib/modules';
import { SectionLoader } from '@/components/section-loader';

interface FormDataType {
    name: string;
    logoUrl: string;
    logoWidth: number | string;
    logoHeight: number | string;
    heroTitle: string;
    heroDescription: string;
    isHeroVisible: boolean;
    isNewsTickerVisible: boolean;
    isWisdomVisible: boolean;
    isOverallSummaryVisible: boolean;
    isDonationSummaryVisible: boolean;
    isPurposeSummaryVisible: boolean;
    isInitiativeSummaryVisible: boolean;
    isRecentVerificationVisible: boolean;
    isLandingDonateNowVisible: boolean;
    summaryStartDate: string;
    summaryEndDate: string;
    qrCodeUrl: string;
    qrWidth: number | string;
    qrHeight: number | string;
    upiId: string;
    paymentMobileNumber: string;
    contactEmail: string;
    contactPhone: string;
    regNo: string;
    pan: string;
    address: string;
    website: string;
    copyright: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankIfsc: string;
    isGuidingPrinciplesPublic: boolean;
    gpTitle: string;
    gpDescription: string;
    principles: GuidingPrinciple[];
    focusAreas: FocusArea[];
    isTickerActiveVisible: boolean;
    isTickerDonationVisible: boolean;
    isTickerCompletedVisible: boolean;
    tickerMaxDonations: number | string;
    tickerMaxCompleted: number | string;
    tickerSkipIds: string[];
    isDonorLoginEnabled: boolean;
    isBeneficiaryLoginEnabled: boolean;
    isDonorSelfRecordPaymentEnabled: boolean;
    portalAuthMethod: 'OTP' | 'Password';
    isPortalPasswordEnabled: boolean;
}

interface VisibilityToggleProps {
    id: string;
    label: string;
    description: string;
    icon: any;
    checked: boolean;
    onChange: (val: boolean) => void;
    disabled: boolean;
}

function VisibilityToggle({ id, label, description, icon: Icon, checked, onChange, disabled }: VisibilityToggleProps) {
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-[24px] border border-primary/5 p-5 bg-white/40 backdrop-blur-md gap-4 transition-all hover:border-primary/20 hover:shadow-xl hover:-translate-y-0.5 group">
            <div className="flex items-center gap-4 flex-1">
                <div className={cn("p-2.5 rounded-xl transition-all duration-500", checked ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-primary/5 text-primary/40")}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                    <h3 className="font-black text-primary text-sm tracking-tight">{label}</h3>
                    <p className="text-[10px] text-muted-foreground font-bold opacity-60 leading-tight">{description}</p>
                </div>
            </div>
            <div className="flex items-center space-x-3 bg-white/50 px-3 py-1.5 rounded-full border border-primary/5">
                <Label htmlFor={id} className="font-black text-[9px] opacity-40 tracking-widest uppercase">Visible</Label>
                <Switch 
                    id={id} 
                    checked={checked} 
                    onCheckedChange={onChange} 
                    disabled={disabled} 
                    className="data-[state=checked]:bg-primary"
                />
            </div>
        </div>
    );
}

interface SettingsSectionProps {
    title: string;
    description: string;
    icon: any;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

function SettingsSection({ title, description, icon: Icon, children, defaultOpen = false }: SettingsSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full animate-fade-in-up">
            <Card className="rounded-[40px] border border-primary/5 shadow-none overflow-hidden bg-white/30 backdrop-blur-md transition-all hover:shadow-2xl">
                <CollapsibleTrigger asChild>
                    <CardHeader className="p-8 cursor-pointer hover:bg-primary/[0.02] transition-colors group">
                        <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                                <div className="p-4 rounded-[20px] bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                    <CardTitle className="text-xl font-black text-primary tracking-tighter">{title}</CardTitle>
                                    <CardDescription className="text-sm font-bold text-primary/40 leading-none">{description}</CardDescription>
                                </div>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center text-primary transition-transform duration-500 group-hover:bg-primary group-hover:text-white">
                                <ChevronDown className={cn("h-6 w-6 transition-transform duration-500", isOpen && "rotate-180")} />
                            </div>
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="px-8 pb-8 animate-fade-in-up">
                        <Separator className="bg-primary/5 mb-8" />
                        <div className="space-y-8">
                            {children}
                        </div>
                    </div>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

const FocusAreaIcon = ({ type }: { type: FocusArea['icon'] }) => {
    switch (type) {
        case 'Education': return <GraduationCap className="h-4 w-4" />;
        case 'Healthcare': return <HeartPulse className="h-4 w-4" />;
        case 'Relief': return <Utensils className="h-4 w-4" />;
        default: return <HelpCircle className="h-4 w-4" />;
    }
};

export default function AppSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const { guidingPrinciplesData, isLoading: isGPLoading } = useGuidingPrinciples();
    
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();

    const campaignsRef = useMemoFirebase(() => firestore ? collection(firestore, 'campaigns') : null, [firestore]);
    const leadsRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);
    const { data: allCampaigns } = useCollection<Campaign>(campaignsRef);
    const { data: allLeads } = useCollection<Lead>(leadsRef);

    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [editableData, setEditableData] = useState<FormDataType | null>(null);

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
    
    const canUpdateSettings = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.app.update', false);

    const handleFieldChange = useCallback((field: keyof FormDataType, value: any) => {
        setEditableData(prev => prev ? { ...prev, [field]: value } : null);
    }, []);

    useEffect(() => {
        if (isEditMode) {
            setEditableData({
                name: brandingSettings?.name || '',
                logoUrl: brandingSettings?.logoUrl || '',
                logoWidth: brandingSettings?.logoWidth || 40,
                logoHeight: brandingSettings?.logoHeight || 40,
                heroTitle: brandingSettings?.heroTitle || 'Empowering Our Community, One Act Of Kindness At A Time.',
                heroDescription: brandingSettings?.heroDescription || 'Join Baitulmal Samajik Sanstha (Solapur) To Make A Lasting Impact.',
                isHeroVisible: brandingSettings?.isHeroVisible ?? true,
                isNewsTickerVisible: brandingSettings?.isNewsTickerVisible ?? true,
                isWisdomVisible: brandingSettings?.isWisdomVisible ?? true,
                isOverallSummaryVisible: brandingSettings?.isOverallSummaryVisible ?? true,
                isDonationSummaryVisible: brandingSettings?.isDonationSummaryVisible ?? true,
                isPurposeSummaryVisible: brandingSettings?.isPurposeSummaryVisible ?? true,
                isInitiativeSummaryVisible: brandingSettings?.isInitiativeSummaryVisible ?? true,
                isRecentVerificationVisible: brandingSettings?.isRecentVerificationVisible ?? true,
                isLandingDonateNowVisible: brandingSettings?.isLandingDonateNowVisible ?? true,
                summaryStartDate: brandingSettings?.summaryStartDate || '',
                summaryEndDate: brandingSettings?.summaryEndDate || '',
                qrCodeUrl: paymentSettings?.qrCodeUrl || '',
                qrWidth: paymentSettings?.qrWidth || 120,
                qrHeight: paymentSettings?.qrHeight || 120,
                upiId: paymentSettings?.upiId || '',
                paymentMobileNumber: paymentSettings?.paymentMobileNumber || '',
                contactEmail: paymentSettings?.contactEmail || '',
                contactPhone: paymentSettings?.contactPhone || '',
                regNo: paymentSettings?.regNo || '',
                pan: paymentSettings?.pan || '',
                address: paymentSettings?.address || '',
                website: paymentSettings?.website || '',
                copyright: paymentSettings?.copyright || '',
                bankAccountName: paymentSettings?.bankAccountName || '',
                bankAccountNumber: paymentSettings?.bankAccountNumber || '',
                bankIfsc: paymentSettings?.bankIfsc || '',
                isGuidingPrinciplesPublic: guidingPrinciplesData?.isGuidingPrinciplesPublic || false,
                gpTitle: guidingPrinciplesData?.title || 'Our Guiding Principles',
                gpDescription: guidingPrinciplesData?.description || '',
                principles: guidingPrinciplesData?.principles || [],
                focusAreas: guidingPrinciplesData?.focusAreas || [],
                isTickerActiveVisible: brandingSettings?.isTickerActiveVisible ?? true,
                isTickerDonationVisible: brandingSettings?.isTickerDonationVisible ?? true,
                isTickerCompletedVisible: brandingSettings?.isTickerCompletedVisible ?? true,
                tickerMaxDonations: brandingSettings?.tickerMaxDonations ?? 15,
                tickerMaxCompleted: brandingSettings?.tickerMaxCompleted ?? 5,
                tickerSkipIds: brandingSettings?.tickerSkipIds || [],
                isDonorLoginEnabled: brandingSettings?.isDonorLoginEnabled ?? true,
                isBeneficiaryLoginEnabled: brandingSettings?.isBeneficiaryLoginEnabled ?? true,
                isDonorSelfRecordPaymentEnabled: brandingSettings?.isDonorSelfRecordPaymentEnabled ?? false,
                portalAuthMethod: brandingSettings?.portalAuthMethod || 'OTP',
                isPortalPasswordEnabled: brandingSettings?.isPortalPasswordEnabled ?? true,
            });
        }
    }, [isEditMode, brandingSettings, paymentSettings, guidingPrinciplesData]);

     useEffect(() => {
        if (logoFile) {
            const reader = new FileReader();
            reader.onloadend = () => handleFieldChange('logoUrl', reader.result as string);
            reader.readAsDataURL(logoFile);
        }
    }, [logoFile, handleFieldChange]);

    useEffect(() => {
        if (qrCodeFile) {
            const reader = new FileReader();
            reader.onloadend = () => handleFieldChange('qrCodeUrl', reader.result as string);
            reader.readAsDataURL(qrCodeFile);
        }
    }, [qrCodeFile, handleFieldChange]);

    const handleRemoveLogo = () => {
        setLogoFile(null);
        handleFieldChange('logoUrl', '');
    };
    
    const handleRemoveQrCode = () => {
        setQrCodeFile(null);
        handleFieldChange('qrCodeUrl', '');
    };

    const handleAddPrinciple = () => {
        if (!editableData) return;
        const newPrinciples = [...editableData.principles, { id: `gp_${Date.now()}`, text: '', isHidden: false }];
        handleFieldChange('principles', newPrinciples);
    };

    const handleRemovePrinciple = (index: number) => {
        if (!editableData) return;
        const newPrinciples = [...editableData.principles];
        newPrinciples.splice(index, 1);
        handleFieldChange('principles', newPrinciples);
    };

    const handlePrincipleChange = (index: number, field: keyof GuidingPrinciple, value: any) => {
        if (!editableData) return;
        const newPrinciples = [...editableData.principles];
        newPrinciples[index] = { ...newPrinciples[index], [field]: value };
        handleFieldChange('principles', newPrinciples);
    };

    const handleAddFocusArea = () => {
        if (!editableData) return;
        const newAreas = [...editableData.focusAreas, { id: `fa_${Date.now()}`, title: '', description: '', icon: 'Other', isHidden: false }];
        handleFieldChange('focusAreas', newAreas);
    };

    const handleRemoveFocusArea = (index: number) => {
        if (!editableData) return;
        const newAreas = [...editableData.focusAreas];
        newAreas.splice(index, 1);
        handleFieldChange('focusAreas', newAreas);
    };

    const handleFocusAreaChange = (index: number, field: keyof FocusArea, value: any) => {
        if (!editableData) return;
        const newAreas = [...editableData.focusAreas];
        newAreas[index] = { ...newAreas[index], [field]: value };
        handleFieldChange('focusAreas', newAreas);
    };

    const handleSave = async () => {
        if (!firestore || !storage || !canUpdateSettings || !editableData) {
            toast({ title: "Auth Restriction", description: "Insufficient Privilege to secure institutional settings.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const batch = writeBatch(firestore);

            let newLogoUrl = editableData.logoUrl;
            if (logoFile) {
                 const resizedBlob = await new Promise<Blob>((resolve) => {
                    (Resizer as any).imageFileResizer(logoFile, 800, 800, 'PNG', 100, 0, (blob: any) => resolve(blob as Blob), 'blob');
                });
                const filePath = 'settings/branding/logo.png';
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                newLogoUrl = await getDownloadURL(fileRef);
            }
            
            const brandingData = { 
                name: editableData.name,
                logoUrl: newLogoUrl,
                logoWidth: Number(editableData.logoWidth) || null,
                logoHeight: Number(editableData.logoHeight) || null,
                heroTitle: editableData.heroTitle,
                heroDescription: editableData.heroDescription,
                isHeroVisible: editableData.isHeroVisible,
                isNewsTickerVisible: editableData.isNewsTickerVisible,
                isWisdomVisible: editableData.isWisdomVisible,
                isOverallSummaryVisible: editableData.isOverallSummaryVisible,
                isDonationSummaryVisible: editableData.isDonationSummaryVisible,
                isPurposeSummaryVisible: editableData.isPurposeSummaryVisible,
                isInitiativeSummaryVisible: editableData.isInitiativeSummaryVisible,
                isRecentVerificationVisible: editableData.isRecentVerificationVisible,
                isLandingDonateNowVisible: editableData.isLandingDonateNowVisible,
                summaryStartDate: editableData.summaryStartDate,
                summaryEndDate: editableData.summaryEndDate,
                isTickerActiveVisible: editableData.isTickerActiveVisible,
                isTickerDonationVisible: editableData.isTickerDonationVisible,
                isTickerCompletedVisible: editableData.isTickerCompletedVisible,
                tickerMaxDonations: Number(editableData.tickerMaxDonations),
                tickerMaxCompleted: Number(editableData.tickerMaxCompleted),
                tickerSkipIds: editableData.tickerSkipIds,
                isDonorLoginEnabled: editableData.isDonorLoginEnabled,
                isBeneficiaryLoginEnabled: editableData.isBeneficiaryLoginEnabled,
                isDonorSelfRecordPaymentEnabled: editableData.isDonorSelfRecordPaymentEnabled,
                portalAuthMethod: editableData.portalAuthMethod,
                isPortalPasswordEnabled: editableData.isPortalPasswordEnabled,
            };
            batch.set(doc(firestore, 'settings', 'branding'), brandingData, { merge: true });

            let newQrCodeUrl = editableData.qrCodeUrl;
            if (qrCodeFile) {
                const resizedBlob = await new Promise<Blob>((resolve) => {
                    (Resizer as any).imageFileResizer(qrCodeFile, 800, 800, 'PNG', 100, 0, (blob: any) => resolve(blob as Blob), 'blob');
                });
                const filePath = 'settings/payment/qr_code.png';
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                newQrCodeUrl = await getDownloadURL(fileRef);
            }
            const paymentData = {
                qrCodeUrl: newQrCodeUrl, 
                qrWidth: Number(editableData.qrWidth) || 120, 
                qrHeight: Number(editableData.qrHeight) || 120,
                upiId: editableData.upiId, 
                paymentMobileNumber: editableData.paymentMobileNumber, 
                contactEmail: editableData.contactEmail,
                contactPhone: editableData.contactPhone, 
                regNo: editableData.regNo, 
                pan: editableData.pan, 
                address: editableData.address,
                website: editableData.website,
                copyright: editableData.copyright,
                bankAccountName: editableData.bankAccountName,
                bankAccountNumber: editableData.bankAccountNumber,
                bankIfsc: editableData.bankIfsc,
            };
            batch.set(doc(firestore, 'settings', 'payment'), paymentData, { merge: true });

            const gpData = {
                isGuidingPrinciplesPublic: editableData.isGuidingPrinciplesPublic,
                title: editableData.gpTitle,
                description: editableData.gpDescription,
                principles: editableData.principles.filter(p => p.text?.trim() !== ''),
                focusAreas: editableData.focusAreas.filter(f => f.title?.trim() !== ''),
            };
            batch.set(doc(firestore, 'settings', 'guidingPrinciples'), gpData);

            await batch.commit();
            toast({ title: 'Configuration Finalized', description: 'Cloud Institutional Configuration Synchronized Successfully.', variant: 'success' });
            setIsEditMode(false);
        } catch (error: any) {
            toast({ title: 'Sync Failure', description: error.message || 'Critical error during institutional sync.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCancel = () => setIsEditMode(false);

    const isGlobalLoading = isSessionLoading || isBrandingLoading || isPaymentLoading || isGPLoading;

    if (isGlobalLoading) {
        return <SectionLoader label="Syncing Cloud Hub..." description="Retrieving Institutional Parameters." />;
    }

    const isFormDisabled = !isEditMode || isSubmitting;

    const displayData = (isEditMode && editableData) ? editableData : {
        name: brandingSettings?.name || '',
        logoUrl: brandingSettings?.logoUrl || '',
        logoWidth: brandingSettings?.logoWidth || 40,
        logoHeight: brandingSettings?.logoHeight || 40,
        heroTitle: brandingSettings?.heroTitle || 'Empowering Our Community, One Act Of Kindness At A Time.',
        heroDescription: brandingSettings?.heroDescription || 'Join Baitulmal Samajik Sanstha (Solapur) To Make A Lasting Impact.',
        isHeroVisible: brandingSettings?.isHeroVisible ?? true,
        isNewsTickerVisible: brandingSettings?.isNewsTickerVisible ?? true,
        isWisdomVisible: brandingSettings?.isWisdomVisible ?? true,
        isOverallSummaryVisible: brandingSettings?.isOverallSummaryVisible ?? true,
        isDonationSummaryVisible: brandingSettings?.isDonationSummaryVisible ?? true,
        isPurposeSummaryVisible: brandingSettings?.isPurposeSummaryVisible ?? true,
        isInitiativeSummaryVisible: brandingSettings?.isInitiativeSummaryVisible ?? true,
        isRecentVerificationVisible: brandingSettings?.isRecentVerificationVisible ?? true,
        isLandingDonateNowVisible: brandingSettings?.isLandingDonateNowVisible ?? true,
        summaryStartDate: brandingSettings?.summaryStartDate || '',
        summaryEndDate: brandingSettings?.summaryEndDate || '',
        qrCodeUrl: paymentSettings?.qrCodeUrl || '',
        qrWidth: paymentSettings?.qrWidth || 120,
        qrHeight: paymentSettings?.qrHeight || 120,
        upiId: paymentSettings?.upiId || '',
        paymentMobileNumber: paymentSettings?.paymentMobileNumber || '',
        contactEmail: paymentSettings?.contactEmail || '',
        contactPhone: paymentSettings?.contactPhone || '',
        regNo: paymentSettings?.regNo || '',
        pan: paymentSettings?.pan || '',
        address: paymentSettings?.address || '',
        website: paymentSettings?.website || '',
        copyright: paymentSettings?.copyright || '',
        bankAccountName: paymentSettings?.bankAccountName || '',
        bankAccountNumber: paymentSettings?.bankAccountNumber || '',
        bankIfsc: paymentSettings?.bankIfsc || '',
        isGuidingPrinciplesPublic: guidingPrinciplesData?.isGuidingPrinciplesPublic || false,
        gpTitle: guidingPrinciplesData?.title || 'Our Guiding Principles',
        gpDescription: guidingPrinciplesData?.description || '',
        principles: guidingPrinciplesData?.principles || [],
        focusAreas: guidingPrinciplesData?.focusAreas || [],
        isTickerActiveVisible: brandingSettings?.isTickerActiveVisible ?? true,
        isTickerDonationVisible: brandingSettings?.isTickerDonationVisible ?? true,
        isTickerCompletedVisible: brandingSettings?.isTickerCompletedVisible ?? true,
        tickerMaxDonations: brandingSettings?.tickerMaxDonations ?? 15,
        tickerMaxCompleted: brandingSettings?.tickerMaxCompleted ?? 5,
        tickerSkipIds: brandingSettings?.tickerSkipIds || [],
        isDonorLoginEnabled: brandingSettings?.isDonorLoginEnabled ?? true,
        isBeneficiaryLoginEnabled: brandingSettings?.isBeneficiaryLoginEnabled ?? true,
        isDonorSelfRecordPaymentEnabled: brandingSettings?.isDonorSelfRecordPaymentEnabled ?? false,
        portalAuthMethod: brandingSettings?.portalAuthMethod || 'OTP',
        isPortalPasswordEnabled: brandingSettings?.isPortalPasswordEnabled ?? true,
    };

    return (
        <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-primary font-normal relative min-h-screen">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
            <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                                <Settings2 className="h-5 w-5" />
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-primary">Institutional Core</h1>
                        </div>
                        <p className="text-sm font-bold opacity-70 max-w-2xl leading-relaxed">System-wide configuration, branding protocols, and financial gateway orchestration.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        {!isEditMode ? (
                            <Button onClick={() => setIsEditMode(true)} className="bg-primary hover:bg-primary/90 text-white font-black h-11 rounded-2xl px-6 shadow-xl shadow-primary/20 active:scale-95 transition-all">
                                <Edit className="mr-2 h-4 w-4"/>Modify Protocol
                            </Button>
                        ) : (
                            <div className="flex bg-white/50 backdrop-blur-md p-1 rounded-2xl border border-primary/5 shadow-sm">
                                <Button variant="ghost" onClick={handleCancel} disabled={isSubmitting} className="font-bold text-destructive rounded-xl h-10 px-5 hover:bg-destructive/5">
                                    <X className="mr-2 h-4 w-4 opacity-40" /> Discard
                                </Button>
                                <div className="w-px h-6 bg-primary/10 my-2" />
                                <Button onClick={handleSave} disabled={isSubmitting} className="font-black text-primary rounded-xl h-10 px-6 hover:bg-primary/5">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4 opacity-40"/>} 
                                    Synchronize
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-10">
                
                <SettingsSection 
                    title="Landing Interface Control" 
                    description="Orchestrate the public face of the institution. Manage hero messaging and component visibility."
                    icon={Layout}
                    defaultOpen={true}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <Label htmlFor="heroTitle" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1 opacity-40">Neural Hero Headline</Label>
                                <div className="relative">
                                    <Textarea 
                                        id="heroTitle"
                                        value={displayData.heroTitle}
                                        onChange={(e) => handleFieldChange('heroTitle', e.target.value)}
                                        disabled={isFormDisabled}
                                        className="font-black text-lg tracking-tighter leading-tight min-h-[80px] bg-white/50 border-primary/5 rounded-3xl p-6 shadow-sm focus:ring-primary disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 disabled:text-2xl"
                                    />
                                    {isEditMode && <Sparkles className="absolute top-4 right-4 h-5 w-5 text-primary opacity-20" />}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <Label htmlFor="heroDescription" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1 opacity-40">Subtext Context</Label>
                                <Textarea 
                                    id="heroDescription"
                                    rows={4}
                                    value={displayData.heroDescription}
                                    onChange={(e) => handleFieldChange('heroDescription', e.target.value)}
                                    disabled={isFormDisabled}
                                    className="font-bold text-sm leading-relaxed min-h-[100px] bg-white/50 border-primary/5 rounded-3xl p-6 shadow-sm focus:ring-primary disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 disabled:text-primary/60"
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-8 rounded-[40px] bg-primary/[0.02] border border-primary/5 space-y-6">
                                <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                    <Activity className="h-5 w-5 text-primary opacity-40" />
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Operational Pulse (Ticker)</h4>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'ticker-active', label: 'Active Initiatives', field: 'isTickerActiveVisible' },
                                        { id: 'ticker-donations', label: 'Verified Inbound', field: 'isTickerDonationVisible' },
                                        { id: 'ticker-completed', label: 'Archived Success', field: 'isTickerCompletedVisible' },
                                    ].map(ticker => (
                                        <div key={ticker.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-primary/5 shadow-sm">
                                            <Label htmlFor={ticker.id} className="text-[10px] font-black uppercase tracking-widest">{ticker.label}</Label>
                                            <Switch id={ticker.id} checked={displayData[ticker.field as keyof typeof displayData] as boolean} onCheckedChange={(val) => handleFieldChange(ticker.field as keyof FormDataType, val)} disabled={isFormDisabled} className="data-[state=checked]:bg-primary" />
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">Max Feed Items</Label>
                                        <Input type="number" value={displayData.tickerMaxDonations} onChange={e => handleFieldChange('tickerMaxDonations', e.target.value)} disabled={isFormDisabled} className="h-12 font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">Archive Depth</Label>
                                        <Input type="number" value={displayData.tickerMaxCompleted} onChange={e => handleFieldChange('tickerMaxCompleted', e.target.value)} disabled={isFormDisabled} className="h-12 font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        <VisibilityToggle 
                            id="hero-visibility"
                            label="Hero Matrix"
                            description="Primary welcome message."
                            icon={Monitor}
                            checked={displayData.isHeroVisible}
                            onChange={(val) => handleFieldChange('isHeroVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="news-ticker-visibility"
                            label="Neural Ticker"
                            description="Real-time rolling updates."
                            icon={Megaphone}
                            checked={displayData.isNewsTickerVisible}
                            onChange={(val) => handleFieldChange('isNewsTickerVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="wisdom-visibility"
                            label="Wisdom Feed"
                            description="Religious guidance reflections."
                            icon={Quote}
                            checked={displayData.isWisdomVisible}
                            onChange={(val) => handleFieldChange('isWisdomVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="overall-summary-visibility"
                            label="Funding Pulse"
                            description="Aggregate organizational progress."
                            icon={Target}
                            checked={displayData.isOverallSummaryVisible}
                            onChange={(val) => handleFieldChange('isOverallSummaryVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="donation-summary-visibility"
                            label="Analytics Charts"
                            description="Distribution & trend visuals."
                            icon={PieChart}
                            checked={displayData.isDonationSummaryVisible}
                            onChange={(val) => handleFieldChange('isDonationSummaryVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="purpose-summary-visibility"
                            label="Impact Matrix"
                            description="Fund utilization by category."
                            icon={HeartHandshake}
                            checked={displayData.isPurposeSummaryVisible}
                            onChange={(val) => handleFieldChange('isPurposeSummaryVisible', val)}
                            disabled={isFormDisabled}
                        />
                    </div>
                </SettingsSection>

                <SettingsSection 
                    title="Financial Gateway Protocols" 
                    description="Secure the institutional inbound vectors. Manage payment handles and bank credentials."
                    icon={CreditCard}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-10">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                    <QrCode className="h-5 w-5 text-primary opacity-40" />
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">QR Vector Control</h4>
                                </div>
                                <div className="flex items-start gap-8">
                                    <div className="relative group">
                                        <div className="h-48 w-48 rounded-[32px] bg-primary/5 border border-primary/5 flex items-center justify-center overflow-hidden shadow-inner group-hover:shadow-2xl transition-all duration-500">
                                            {displayData.qrCodeUrl ? (
                                                <img src={displayData.qrCodeUrl} alt="Payment QR" className="h-full w-full object-contain p-4 group-hover:scale-110 transition-transform duration-500" />
                                            ) : (
                                                <ImageIcon className="h-12 w-12 text-primary/10" />
                                            )}
                                        </div>
                                        {isEditMode && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm rounded-[32px]">
                                                <Label htmlFor="qr-upload" className="cursor-pointer bg-white text-primary font-black text-[10px] uppercase tracking-widest px-6 h-10 rounded-xl flex items-center shadow-xl active:scale-95 transition-all">
                                                    Update Vector
                                                </Label>
                                                <Input id="qr-upload" type="file" className="hidden" accept="image/*" onChange={e => setQrCodeFile(e.target.files?.[0] || null)} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-6 flex-1 pt-4">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">Primary UPI Handle</Label>
                                            <Input 
                                                value={displayData.upiId} 
                                                onChange={e => handleFieldChange('upiId', e.target.value)} 
                                                disabled={isFormDisabled} 
                                                className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 disabled:text-xl" 
                                                placeholder="handle@upi"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">Mobile Vector</Label>
                                            <Input 
                                                value={displayData.paymentMobileNumber} 
                                                onChange={e => handleFieldChange('paymentMobileNumber', e.target.value)} 
                                                disabled={isFormDisabled} 
                                                className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" 
                                                placeholder="+91-XXXXX-XXXXX"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-8 rounded-[40px] bg-primary/[0.02] border border-primary/5 space-y-8">
                                <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                    <Landmark className="h-5 w-5 text-primary opacity-40" />
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Institutional Clearing Account</h4>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">Account Holder Name</Label>
                                        <Input value={displayData.bankAccountName} onChange={e => handleFieldChange('bankAccountName', e.target.value)} disabled={isFormDisabled} className="h-12 font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">Account Number</Label>
                                            <Input value={displayData.bankAccountNumber} onChange={e => handleFieldChange('bankAccountNumber', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">IFSC Vector</Label>
                                            <Input value={displayData.bankIfsc} onChange={e => handleFieldChange('bankIfsc', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 uppercase" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection 
                    title="Access & Identity Sovereignty" 
                    description="Configure the authentication protocols for the Donor and Beneficiary portals."
                    icon={Shield}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="p-8 rounded-[40px] bg-primary/[0.02] border border-primary/5 space-y-6">
                            <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                <Lock className="h-5 w-5 text-primary opacity-40" />
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Authentication Matrix</h4>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-5 rounded-3xl bg-white border border-primary/5 shadow-sm">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-black uppercase tracking-widest">Inbound Portal (Donors)</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground opacity-60">Authorize donors to access their cloud history.</p>
                                    </div>
                                    <Switch checked={displayData.isDonorLoginEnabled} onCheckedChange={(val) => handleFieldChange('isDonorLoginEnabled', val)} disabled={isFormDisabled} className="data-[state=checked]:bg-primary" />
                                </div>
                                <div className="flex items-center justify-between p-5 rounded-3xl bg-white border border-primary/5 shadow-sm">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-black uppercase tracking-widest">Outbound Portal (Recipients)</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground opacity-60">Authorize beneficiaries to track their aid status.</p>
                                    </div>
                                    <Switch checked={displayData.isBeneficiaryLoginEnabled} onCheckedChange={(val) => handleFieldChange('isBeneficiaryLoginEnabled', val)} disabled={isFormDisabled} className="data-[state=checked]:bg-primary" />
                                </div>
                            </div>
                        </div>

                        <div className="p-8 rounded-[40px] bg-primary/[0.02] border border-primary/5 space-y-6">
                            <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                <Key className="h-5 w-5 text-primary opacity-40" />
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Credential Protocol</h4>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">Primary Auth Method</Label>
                                    <Select value={displayData.portalAuthMethod} onValueChange={(val) => handleFieldChange('portalAuthMethod', val)} disabled={isFormDisabled}>
                                        <SelectTrigger className="h-12 font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl border-primary/10 shadow-dropdown p-1.5">
                                            <SelectItem value="OTP" className="font-bold text-xs p-3 rounded-xl">Neural OTP (One-Time Password)</SelectItem>
                                            <SelectItem value="Password" className="font-bold text-xs p-3 rounded-xl">Classic Secure Password</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between p-5 rounded-3xl bg-white border border-primary/5 shadow-sm">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-black uppercase tracking-widest">Donor Self-Reporting</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground opacity-60">Authorize donors to log their own financial transfers.</p>
                                    </div>
                                    <Switch checked={displayData.isDonorSelfRecordPaymentEnabled} onCheckedChange={(val) => handleFieldChange('isDonorSelfRecordPaymentEnabled', val)} disabled={isFormDisabled} className="data-[state=checked]:bg-primary" />
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection 
                    title="Institutional Branding Matrix" 
                    description="Orchestrate the visual identity and metadata of the institution."
                    icon={Palette}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                <Activity className="h-5 w-5 text-primary opacity-40" />
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Institutional Profile</h4>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1 opacity-40">Organization Name</Label>
                                    <Input value={displayData.name} onChange={e => handleFieldChange('name', e.target.value)} disabled={isFormDisabled} className="h-14 font-black text-xl rounded-3xl border-primary/5 bg-white shadow-sm px-6 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">Registration No.</Label>
                                        <Input value={displayData.regNo} onChange={e => handleFieldChange('regNo', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">PAN Vector</Label>
                                        <Input value={displayData.pan} onChange={e => handleFieldChange('pan', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 uppercase" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                <Globe2 className="h-5 w-5 text-primary opacity-40" />
                                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Digital Presence Vectors</h4>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">Official Portal URL</Label>
                                    <Input value={displayData.website} onChange={e => handleFieldChange('website', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="https://institution.org" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest opacity-40 pl-1">Contact Email Vector</Label>
                                    <Input value={displayData.contactEmail} onChange={e => handleFieldChange('contactEmail', e.target.value)} disabled={isFormDisabled} className="h-12 font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="admin@institution.org" />
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsSection>
            </div>
            
            {isEditMode && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
                    <div className="flex items-center gap-2 bg-primary/20 backdrop-blur-2xl p-2 rounded-[32px] border border-primary/20 shadow-2xl">
                        <Button variant="ghost" onClick={handleCancel} disabled={isSubmitting} className="font-black uppercase tracking-widest text-[10px] text-primary h-12 px-8 rounded-3xl hover:bg-white/20 transition-all">
                            <X className="mr-2 h-4 w-4" /> Discard Updates
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] h-12 px-12 rounded-3xl shadow-xl shadow-primary/40 transition-all active:scale-95">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CloudCog className="mr-2 h-4 w-4"/>} 
                            Commit Sync
                        </Button>
                    </div>
                </div>
            )}
        </main>
    );
}