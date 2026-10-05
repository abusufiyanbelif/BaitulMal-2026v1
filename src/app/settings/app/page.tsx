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
    CloudCog,
    Instagram,
    Facebook,
    Youtube,
    Twitter,
    Linkedin,
    MessageSquare,
    Send,
    HardHat,
    FlaskConical,
    Wrench,
    AlertCircle,
    XCircle,
    Copy,
    ExternalLink,
    Cpu,
    Database,
    Terminal,
    Share2,
    Play,
    Eye,
    RefreshCw,
    Sliders,
    Zap,
    Check,
    FileText
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
    secondaryUpiId: string;
    isUpiQrPublic: boolean;
    paymentMobileNumber: string;
    contactEmail: string;
    contactPhone: string;
    regNo: string;
    pan: string;
    address: string;
    website: string;
    copyright: string;
    instagramUrl: string;
    facebookUrl: string;
    youtubeUrl: string;
    twitterUrl: string;
    linkedinUrl: string;
    whatsappUrl: string;
    telegramUrl: string;
    isFooterVisible: boolean;
    isFooterSocialVisible: boolean;
    isFooterInstagramVisible: boolean;
    isFooterFacebookVisible: boolean;
    isFooterYoutubeVisible: boolean;
    isFooterTwitterVisible: boolean;
    isFooterLinkedinVisible: boolean;
    isFooterWhatsappVisible: boolean;
    isFooterTelegramVisible: boolean;
    isFooterAddressVisible: boolean;
    isFooterContactVisible: boolean;
    isFooterRegInfoVisible: boolean;
    isUnderConstructionAlertVisible: boolean;
    underConstructionAlertText: string;
    underConstructionAlertStyle: 'amber' | 'blue' | 'emerald' | 'rose';
    isFooterQuickLinksVisible: boolean;
    isFooterSupportUsVisible: boolean;
    isFooterCopyrightVisible: boolean;
    isFooterBuildVersionVisible: boolean;
    bankAccountName: string;
    bankAccountNumber: string;
    bankIfsc: string;
    bankName: string;
    bankBranch: string;
    bankAccountType: string;
    bankSwiftCode: string;
    isBankDetailsPublic: boolean;
    isTestMode: boolean;
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
                    <p className="text-[10px] text-muted-foreground font-normal opacity-60 leading-tight">{description}</p>
                </div>
            </div>
            <div className="flex items-center space-x-3 bg-white/50 px-3 py-1.5 rounded-full border border-primary/5">
                <Label htmlFor={id} className="font-black text-[9px] opacity-40 tracking-widest">Visible</Label>
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

    // Interactive Testing & Sandbox State
    const [testUpiAmount, setTestUpiAmount] = useState('100');
    const [testUpiNote, setTestUpiNote] = useState('Baitulmal Donation Test');
    const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
    const [diagnosticReport, setDiagnosticReport] = useState<{
        score: number;
        total: number;
        items: { id: string; name: string; status: 'pass' | 'warn' | 'fail'; message: string }[];
    } | null>(null);
    const [isPreviewBannerOpen, setIsPreviewBannerOpen] = useState(false);

    // Smart Alert Generator Topic Selection
    const [alertIncludeTopics, setAlertIncludeTopics] = useState<{
        domain: boolean;
        gateways: boolean;
        whatsapp: boolean;
        sync: boolean;
        portals: boolean;
    }>({
        domain: true,
        gateways: true,
        whatsapp: true,
        sync: false,
        portals: false,
    });
    
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
                isUnderConstructionAlertVisible: brandingSettings?.isUnderConstructionAlertVisible ?? true,
                underConstructionAlertText: brandingSettings?.underConstructionAlertText || '',
                underConstructionAlertStyle: brandingSettings?.underConstructionAlertStyle || 'amber',
                summaryStartDate: brandingSettings?.summaryStartDate || '',
                summaryEndDate: brandingSettings?.summaryEndDate || '',
                qrCodeUrl: paymentSettings?.qrCodeUrl || '',
                qrWidth: paymentSettings?.qrWidth || 120,
                qrHeight: paymentSettings?.qrHeight || 120,
                upiId: paymentSettings?.upiId || '',
                secondaryUpiId: paymentSettings?.secondaryUpiId || '',
                isUpiQrPublic: paymentSettings?.isUpiQrPublic ?? true,
                paymentMobileNumber: paymentSettings?.paymentMobileNumber || '',
                contactEmail: paymentSettings?.contactEmail || '',
                contactPhone: paymentSettings?.contactPhone || '',
                regNo: paymentSettings?.regNo || '',
                pan: paymentSettings?.pan || '',
                address: paymentSettings?.address || '',
                website: paymentSettings?.website || '',
                copyright: paymentSettings?.copyright || '',
                instagramUrl: paymentSettings?.instagramUrl || '',
                facebookUrl: paymentSettings?.facebookUrl || '',
                youtubeUrl: paymentSettings?.youtubeUrl || '',
                twitterUrl: paymentSettings?.twitterUrl || '',
                linkedinUrl: paymentSettings?.linkedinUrl || '',
                whatsappUrl: paymentSettings?.whatsappUrl || '',
                telegramUrl: paymentSettings?.telegramUrl || '',
                isFooterVisible: paymentSettings?.isFooterVisible ?? true,
                isFooterSocialVisible: paymentSettings?.isFooterSocialVisible ?? true,
                isFooterInstagramVisible: paymentSettings?.isFooterInstagramVisible ?? true,
                isFooterFacebookVisible: paymentSettings?.isFooterFacebookVisible ?? true,
                isFooterYoutubeVisible: paymentSettings?.isFooterYoutubeVisible ?? true,
                isFooterTwitterVisible: paymentSettings?.isFooterTwitterVisible ?? true,
                isFooterLinkedinVisible: paymentSettings?.isFooterLinkedinVisible ?? true,
                isFooterWhatsappVisible: paymentSettings?.isFooterWhatsappVisible ?? true,
                isFooterTelegramVisible: paymentSettings?.isFooterTelegramVisible ?? true,
                isFooterAddressVisible: paymentSettings?.isFooterAddressVisible ?? true,
                isFooterContactVisible: paymentSettings?.isFooterContactVisible ?? true,
                isFooterRegInfoVisible: paymentSettings?.isFooterRegInfoVisible ?? true,
                isFooterQuickLinksVisible: paymentSettings?.isFooterQuickLinksVisible ?? true,
                isFooterSupportUsVisible: paymentSettings?.isFooterSupportUsVisible ?? true,
                isFooterCopyrightVisible: paymentSettings?.isFooterCopyrightVisible ?? true,
                isFooterBuildVersionVisible: paymentSettings?.isFooterBuildVersionVisible ?? true,
                bankAccountName: paymentSettings?.bankAccountName || '',
                bankAccountNumber: paymentSettings?.bankAccountNumber || '',
                bankIfsc: paymentSettings?.bankIfsc || '',
                bankName: paymentSettings?.bankName || '',
                bankBranch: paymentSettings?.bankBranch || '',
                bankAccountType: paymentSettings?.bankAccountType || 'Current Account',
                bankSwiftCode: paymentSettings?.bankSwiftCode || '',
                isBankDetailsPublic: paymentSettings?.isBankDetailsPublic ?? true,
                isTestMode: paymentSettings?.isTestMode ?? false,
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
            toast({ title: "Permission Required", description: "You do not have permission to update settings.", variant: "destructive" });
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
                isUnderConstructionAlertVisible: editableData.isUnderConstructionAlertVisible,
                underConstructionAlertText: editableData.underConstructionAlertText,
                underConstructionAlertStyle: editableData.underConstructionAlertStyle,
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
                secondaryUpiId: editableData.secondaryUpiId,
                isUpiQrPublic: editableData.isUpiQrPublic,
                paymentMobileNumber: editableData.paymentMobileNumber, 
                contactEmail: editableData.contactEmail,
                contactPhone: editableData.contactPhone, 
                regNo: editableData.regNo, 
                pan: editableData.pan, 
                address: editableData.address,
                website: editableData.website,
                copyright: editableData.copyright,
                instagramUrl: editableData.instagramUrl,
                facebookUrl: editableData.facebookUrl,
                youtubeUrl: editableData.youtubeUrl,
                twitterUrl: editableData.twitterUrl,
                linkedinUrl: editableData.linkedinUrl,
                whatsappUrl: editableData.whatsappUrl,
                telegramUrl: editableData.telegramUrl,
                isFooterVisible: editableData.isFooterVisible,
                isFooterSocialVisible: editableData.isFooterSocialVisible,
                isFooterInstagramVisible: editableData.isFooterInstagramVisible,
                isFooterFacebookVisible: editableData.isFooterFacebookVisible,
                isFooterYoutubeVisible: editableData.isFooterYoutubeVisible,
                isFooterTwitterVisible: editableData.isFooterTwitterVisible,
                isFooterLinkedinVisible: editableData.isFooterLinkedinVisible,
                isFooterWhatsappVisible: editableData.isFooterWhatsappVisible,
                isFooterTelegramVisible: editableData.isFooterTelegramVisible,
                isFooterAddressVisible: editableData.isFooterAddressVisible,
                isFooterContactVisible: editableData.isFooterContactVisible,
                isFooterRegInfoVisible: editableData.isFooterRegInfoVisible,
                isFooterQuickLinksVisible: editableData.isFooterQuickLinksVisible,
                isFooterSupportUsVisible: editableData.isFooterSupportUsVisible,
                isFooterCopyrightVisible: editableData.isFooterCopyrightVisible,
                isFooterBuildVersionVisible: editableData.isFooterBuildVersionVisible,
                bankAccountName: editableData.bankAccountName,
                bankAccountNumber: editableData.bankAccountNumber,
                bankIfsc: editableData.bankIfsc,
                bankName: editableData.bankName,
                bankBranch: editableData.bankBranch,
                bankAccountType: editableData.bankAccountType,
                bankSwiftCode: editableData.bankSwiftCode,
                isBankDetailsPublic: editableData.isBankDetailsPublic,
                isTestMode: editableData.isTestMode,
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
            toast({ title: 'Settings Saved', description: 'Your app settings have been saved successfully.', variant: 'success' });
            setIsEditMode(false);
        } catch (error: any) {
            toast({ title: 'Save Failed', description: error.message || 'Could not save settings. Please try again.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCancel = () => setIsEditMode(false);

    const isGlobalLoading = isSessionLoading || isBrandingLoading || isPaymentLoading || isGPLoading;

    if (isGlobalLoading) {
        return <SectionLoader label="Loading Settings..." description="Please wait while settings are retrieved." />;
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
        isUnderConstructionAlertVisible: brandingSettings?.isUnderConstructionAlertVisible ?? true,
        underConstructionAlertText: brandingSettings?.underConstructionAlertText || '',
        underConstructionAlertStyle: brandingSettings?.underConstructionAlertStyle || 'amber',
        summaryStartDate: brandingSettings?.summaryStartDate || '',
        summaryEndDate: brandingSettings?.summaryEndDate || '',
        qrCodeUrl: paymentSettings?.qrCodeUrl || '',
        qrWidth: paymentSettings?.qrWidth || 120,
        qrHeight: paymentSettings?.qrHeight || 120,
        upiId: paymentSettings?.upiId || '',
        secondaryUpiId: paymentSettings?.secondaryUpiId || '',
        isUpiQrPublic: paymentSettings?.isUpiQrPublic ?? true,
        paymentMobileNumber: paymentSettings?.paymentMobileNumber || '',
        contactEmail: paymentSettings?.contactEmail || '',
        contactPhone: paymentSettings?.contactPhone || '',
        regNo: paymentSettings?.regNo || '',
        pan: paymentSettings?.pan || '',
        address: paymentSettings?.address || '',
        website: paymentSettings?.website || '',
        copyright: paymentSettings?.copyright || '',
        instagramUrl: paymentSettings?.instagramUrl || '',
        facebookUrl: paymentSettings?.facebookUrl || '',
        youtubeUrl: paymentSettings?.youtubeUrl || '',
        twitterUrl: paymentSettings?.twitterUrl || '',
        linkedinUrl: paymentSettings?.linkedinUrl || '',
        whatsappUrl: paymentSettings?.whatsappUrl || '',
        telegramUrl: paymentSettings?.telegramUrl || '',
        isFooterVisible: paymentSettings?.isFooterVisible ?? true,
        isFooterSocialVisible: paymentSettings?.isFooterSocialVisible ?? true,
        isFooterInstagramVisible: paymentSettings?.isFooterInstagramVisible ?? true,
        isFooterFacebookVisible: paymentSettings?.isFooterFacebookVisible ?? true,
        isFooterYoutubeVisible: paymentSettings?.isFooterYoutubeVisible ?? true,
        isFooterTwitterVisible: paymentSettings?.isFooterTwitterVisible ?? true,
        isFooterLinkedinVisible: paymentSettings?.isFooterLinkedinVisible ?? true,
        isFooterWhatsappVisible: paymentSettings?.isFooterWhatsappVisible ?? true,
        isFooterTelegramVisible: paymentSettings?.isFooterTelegramVisible ?? true,
        isFooterAddressVisible: paymentSettings?.isFooterAddressVisible ?? true,
        isFooterContactVisible: paymentSettings?.isFooterContactVisible ?? true,
        isFooterRegInfoVisible: paymentSettings?.isFooterRegInfoVisible ?? true,
        isFooterQuickLinksVisible: paymentSettings?.isFooterQuickLinksVisible ?? true,
        isFooterSupportUsVisible: paymentSettings?.isFooterSupportUsVisible ?? true,
        isFooterCopyrightVisible: paymentSettings?.isFooterCopyrightVisible ?? true,
        isFooterBuildVersionVisible: paymentSettings?.isFooterBuildVersionVisible ?? true,
        bankAccountName: paymentSettings?.bankAccountName || '',
        bankAccountNumber: paymentSettings?.bankAccountNumber || '',
        bankIfsc: paymentSettings?.bankIfsc || '',
        bankName: paymentSettings?.bankName || '',
        bankBranch: paymentSettings?.bankBranch || '',
        bankAccountType: paymentSettings?.bankAccountType || 'Current Account',
        bankSwiftCode: paymentSettings?.bankSwiftCode || '',
        isBankDetailsPublic: paymentSettings?.isBankDetailsPublic ?? true,
        isTestMode: paymentSettings?.isTestMode ?? false,
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-primary/5 shadow-sm">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold tracking-tight text-primary">App Settings & Payment Config</h2>
                        <p className="text-xs text-muted-foreground">Manage your website display, bank accounts, UPI transfers, and test modes easily.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setIsDiagnosticRunning(true);
                                setTimeout(() => {
                                    const items = [
                                        {
                                            id: 'bank-acc',
                                            name: 'Bank Account Details',
                                            status: (displayData.bankAccountName && displayData.bankAccountNumber) ? 'pass' as const : 'fail' as const,
                                            message: (displayData.bankAccountName && displayData.bankAccountNumber) ? `Account holder '${displayData.bankAccountName}' with A/C ${displayData.bankAccountNumber}` : 'Missing Account Name or Number'
                                        },
                                        {
                                            id: 'bank-ifsc',
                                            name: 'Bank IFSC Code Syntax',
                                            status: (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(displayData.bankIfsc?.trim())) ? 'pass' as const : 'warn' as const,
                                            message: (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(displayData.bankIfsc?.trim())) ? `Valid IFSC code: ${displayData.bankIfsc.toUpperCase()}` : 'IFSC Code format recommendation (e.g. SBIN0000373)'
                                        },
                                        {
                                            id: 'upi-primary',
                                            name: 'Primary UPI Handle',
                                            status: (displayData.upiId && displayData.upiId.includes('@')) ? 'pass' as const : 'warn' as const,
                                            message: (displayData.upiId && displayData.upiId.includes('@')) ? `Primary handle active: ${displayData.upiId}` : 'No valid UPI ID configured'
                                        },
                                        {
                                            id: 'qr-code',
                                            name: 'UPI QR Code Image',
                                            status: displayData.qrCodeUrl ? 'pass' as const : 'warn' as const,
                                            message: displayData.qrCodeUrl ? 'Payment QR image is uploaded' : 'No QR code image uploaded'
                                        },
                                        {
                                            id: 'contact-info',
                                            name: 'Contact Info',
                                            status: (displayData.contactEmail && displayData.contactPhone) ? 'pass' as const : 'fail' as const,
                                            message: (displayData.contactEmail && displayData.contactPhone) ? `Email (${displayData.contactEmail}) & Phone (${displayData.contactPhone}) ready` : 'Missing contact email or phone'
                                        },
                                        {
                                            id: 'reg-pan',
                                            name: 'Legal Reg & PAN',
                                            status: (displayData.regNo && displayData.pan) ? 'pass' as const : 'warn' as const,
                                            message: (displayData.regNo && displayData.pan) ? `Reg: ${displayData.regNo} | PAN: ${displayData.pan}` : 'Reg No or PAN number incomplete'
                                        },
                                        {
                                            id: 'sandbox-mode',
                                            name: 'App Mode',
                                            status: displayData.isTestMode ? 'warn' as const : 'pass' as const,
                                            message: displayData.isTestMode ? 'Test Sandbox Mode is ON' : 'Live Production Mode'
                                        }
                                    ];
                                    const passed = items.filter(i => i.status === 'pass').length;
                                    setDiagnosticReport({
                                        score: Math.round((passed / items.length) * 100),
                                        total: items.length,
                                        items
                                    });
                                    setIsDiagnosticRunning(false);
                                    toast({
                                        title: "System Check Completed",
                                        description: `Status score: ${Math.round((passed / items.length) * 100)}% (${passed}/${items.length} checks passed).`,
                                        variant: passed === items.length ? "success" : "default"
                                    });
                                }, 600);
                            }}
                            className="font-bold border-primary/20 text-primary h-10 rounded-xl px-4 hover:bg-primary/5 transition-all text-xs"
                        >
                            {isDiagnosticRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> : <FlaskConical className="mr-2 h-4 w-4 text-emerald-600" />}
                            Run System Check
                        </Button>

                        {!isEditMode ? (
                            <Button onClick={() => setIsEditMode(true)} className="bg-primary hover:bg-primary/90 text-white font-bold h-10 rounded-xl px-5 shadow-md active:scale-95 transition-all text-xs">
                                <Edit className="mr-2 h-4 w-4"/>Edit Settings
                            </Button>
                        ) : (
                            <div className="flex bg-white p-1 rounded-xl border border-primary/10 shadow-sm">
                                <Button variant="ghost" onClick={handleCancel} disabled={isSubmitting} className="font-bold text-destructive rounded-lg h-9 px-4 hover:bg-destructive/5 text-xs">
                                    <X className="mr-1.5 h-3.5 w-3.5 opacity-60" /> Cancel
                                </Button>
                                <div className="w-px h-5 bg-primary/10 my-2" />
                                <Button onClick={handleSave} disabled={isSubmitting} className="font-bold text-white bg-primary hover:bg-primary/90 rounded-lg h-9 px-5 shadow-sm transition-all active:scale-95 text-xs">
                                    {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Save className="mr-1.5 h-3.5 w-3.5"/>} 
                                    Save Settings
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Integration Status Bar */}
                <div className="p-4 rounded-2xl bg-white/60 backdrop-blur-md border border-primary/5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary opacity-60" />
                        <span className="text-xs font-bold text-primary">System Status:</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
                        <Badge variant="outline" className={cn("px-3 py-1 rounded-full border", displayData.bankAccountName ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20")}>
                            Bank: {displayData.bankAccountName ? 'Ready' : 'Incomplete'}
                        </Badge>
                        <Badge variant="outline" className={cn("px-3 py-1 rounded-full border", displayData.upiId ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-rose-500/10 text-rose-700 border-rose-500/20")}>
                            UPI: {displayData.upiId || 'Not Set'}
                        </Badge>
                        <Badge variant="outline" className={cn("px-3 py-1 rounded-full border", displayData.isTestMode ? "bg-amber-500 text-white border-amber-600 animate-pulse" : "bg-primary/10 text-primary border-primary/20")}>
                            {displayData.isTestMode ? "Test Mode Active" : "Live Mode"}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <SettingsSection
                    title="Interactive Diagnostic, Sandbox & Testing Suite"
                    description="Run live system diagnostics, generate test UPI links & QR codes, copy bank transfer payloads, and simulate application test mode."
                    icon={FlaskConical}
                    defaultOpen={true}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Tool 1: Sandbox Test Mode */}
                        <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h4 className="font-black text-sm text-amber-900 flex items-center gap-2">
                                        <Wrench className="h-4 w-4 text-amber-600" />
                                        Application Internal Test / Sandbox Mode
                                    </h4>
                                    <p className="text-xs text-amber-700/80">Enable test mode to run test transactions and dispatches without affecting live statistics.</p>
                                </div>
                                <Switch
                                    checked={displayData.isTestMode}
                                    onCheckedChange={(val) => handleFieldChange('isTestMode', val)}
                                    disabled={isFormDisabled}
                                    className="data-[state=checked]:bg-amber-600"
                                />
                            </div>
                            {displayData.isTestMode && (
                                <div className="p-3 rounded-2xl bg-white border border-amber-500/20 text-xs font-bold text-amber-900 flex items-center justify-between">
                                    <span>🧪 Sandbox Mode is Active. Admin tests are highlighted.</span>
                                    <Badge className="bg-amber-600 text-white">Sandbox Active</Badge>
                                </div>
                            )}
                        </div>

                        {/* Tool 2: Bank Account Payload & IFSC Format Tester */}
                        <div className="p-6 rounded-3xl bg-primary/[0.02] border border-primary/5 space-y-4">
                            <div className="flex items-center justify-between border-b border-primary/5 pb-3">
                                <h4 className="font-black text-sm text-primary flex items-center gap-2">
                                    <Landmark className="h-4 w-4 text-primary opacity-60" />
                                    Bank Account Payload & IFSC Tester
                                </h4>
                                {displayData.bankIfsc && (
                                    <Badge variant="outline" className={cn("text-[10px] font-mono font-bold", /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(displayData.bankIfsc) ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                                        {/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(displayData.bankIfsc) ? "✅ IFSC Syntax Valid" : "⚠️ Check IFSC Format"}
                                    </Badge>
                                )}
                            </div>
                            <div className="p-4 rounded-2xl bg-white border border-primary/5 space-y-2">
                                <div className="text-xs font-mono font-bold text-slate-800 leading-relaxed">
                                    <p><span className="text-muted-foreground">Bank:</span> {displayData.bankName || 'Not Set'} ({displayData.bankAccountType || 'Current'})</p>
                                    <p><span className="text-muted-foreground">Account Holder:</span> {displayData.bankAccountName || 'Not Set'}</p>
                                    <p><span className="text-muted-foreground">A/C No:</span> {displayData.bankAccountNumber || 'Not Set'}</p>
                                    <p><span className="text-muted-foreground">IFSC:</span> {displayData.bankIfsc || 'Not Set'} {displayData.bankBranch ? `(${displayData.bankBranch})` : ''}</p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    const payload = `Bank: ${displayData.bankName || 'N/A'}\nAccount Name: ${displayData.bankAccountName || 'N/A'}\nAccount No: ${displayData.bankAccountNumber || 'N/A'}\nIFSC Code: ${displayData.bankIfsc || 'N/A'}\nBranch: ${displayData.bankBranch || 'N/A'}`;
                                    navigator.clipboard.writeText(payload);
                                    toast({
                                        title: "Bank Details Payload Copied",
                                        description: "Formatted bank details copied to clipboard for testing transfers.",
                                        variant: "success",
                                    });
                                }}
                                className="w-full h-10 font-bold text-xs rounded-xl border-primary/10 hover:bg-primary/5"
                            >
                                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Verified Bank Details Payload
                            </Button>
                        </div>

                        {/* Tool 3: Live Interactive UPI Link & QR Tester */}
                        <div className="p-6 rounded-3xl bg-primary/[0.02] border border-primary/5 space-y-4 lg:col-span-2">
                            <div className="flex items-center justify-between border-b border-primary/5 pb-3">
                                <div className="space-y-0.5">
                                    <h4 className="font-black text-sm text-primary flex items-center gap-2">
                                        <QrCode className="h-4 w-4 text-emerald-600" />
                                        Interactive UPI Link & QR Tester
                                    </h4>
                                    <p className="text-xs text-muted-foreground">Generate live UPI deep links (`upi://pay?...`) and test QR code URLs instantly.</p>
                                </div>
                                {displayData.upiId && (
                                    <Badge variant="outline" className={cn("text-[10px] font-mono font-bold", displayData.upiId.includes('@') ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200")}>
                                        {displayData.upiId.includes('@') ? "✅ Valid VPA Handle" : "❌ Invalid VPA Syntax"}
                                    </Badge>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black tracking-widest opacity-60">Test Amount (₹)</Label>
                                    <Input
                                        type="number"
                                        value={testUpiAmount}
                                        onChange={e => setTestUpiAmount(e.target.value)}
                                        className="h-10 font-mono font-bold rounded-xl bg-white border-primary/10"
                                        placeholder="100"
                                    />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label className="text-[10px] font-black tracking-widest opacity-60">Test Note / Remark</Label>
                                    <Input
                                        value={testUpiNote}
                                        onChange={e => setTestUpiNote(e.target.value)}
                                        className="h-10 font-bold rounded-xl bg-white border-primary/10"
                                        placeholder="Donation Test Note"
                                    />
                                </div>
                            </div>

                            {displayData.upiId ? (
                                <div className="p-4 rounded-2xl bg-white border border-primary/10 space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Generated UPI Deep-Link URI:</span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    const uri = `upi://pay?pa=${encodeURIComponent(displayData.upiId)}&pn=${encodeURIComponent(displayData.bankAccountName || displayData.name || 'Baitulmal')}&am=${testUpiAmount}&tn=${encodeURIComponent(testUpiNote)}&cu=INR`;
                                                    navigator.clipboard.writeText(uri);
                                                    toast({
                                                        title: "UPI URI Copied",
                                                        description: uri,
                                                        variant: "success"
                                                    });
                                                }}
                                                className="h-7 text-xs font-bold text-primary"
                                            >
                                                <Copy className="mr-1 h-3 w-3" /> Copy URI
                                            </Button>
                                            <Button
                                                type="button"
                                                asChild
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs font-bold text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                                            >
                                                <a href={`upi://pay?pa=${encodeURIComponent(displayData.upiId)}&pn=${encodeURIComponent(displayData.bankAccountName || displayData.name || 'Baitulmal')}&am=${testUpiAmount}&tn=${encodeURIComponent(testUpiNote)}&cu=INR`}>
                                                    <ExternalLink className="mr-1 h-3 w-3" /> Launch UPI App
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700 break-all">
                                        {`upi://pay?pa=${displayData.upiId}&pn=${encodeURIComponent(displayData.bankAccountName || displayData.name || 'Baitulmal')}&am=${testUpiAmount}&tn=${encodeURIComponent(testUpiNote)}&cu=INR`}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
                                    ⚠️ Please enter a valid UPI ID in the section below to test live UPI payment links.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Diagnostic Self-Test Results Card */}
                    {diagnosticReport && (
                        <div className="mt-8 p-6 rounded-3xl bg-white border border-primary/10 shadow-lg space-y-6 animate-fade-in-up">
                            <div className="flex items-center justify-between border-b border-primary/10 pb-4">
                                <div className="space-y-1">
                                    <h4 className="font-black text-lg text-primary flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                        System Self-Diagnostic Report
                                    </h4>
                                    <p className="text-xs text-muted-foreground">Automated verification scan across all application resources and configurations.</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-primary">{diagnosticReport.score}%</span>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Readiness Score</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {diagnosticReport.items.map((item) => (
                                    <div key={item.id} className="p-4 rounded-2xl bg-primary/[0.02] border border-primary/5 flex items-start gap-3">
                                        {item.status === 'pass' && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />}
                                        {item.status === 'warn' && <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />}
                                        {item.status === 'fail' && <XCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />}
                                        <div className="space-y-0.5 flex-1">
                                            <div className="flex items-center justify-between">
                                                <h5 className="font-bold text-xs text-primary">{item.name}</h5>
                                                <Badge className={cn("text-[9px] px-2 py-0.5", item.status === 'pass' ? "bg-emerald-100 text-emerald-800" : item.status === 'warn' ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800")}>
                                                    {item.status.toUpperCase()}
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground leading-tight">{item.message}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </SettingsSection>

                {/* Section 3: Website Display */}
                <SettingsSection 
                    title="Website Display" 
                    description="Change how your website looks and what people can see."
                    icon={Layout}
                    defaultOpen={true}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <Label htmlFor="heroTitle" className="text-[10px] font-black text-muted-foreground tracking-[0.2em] pl-1 opacity-40">Big Title / Headline</Label>
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
                                <Label htmlFor="heroDescription" className="text-[10px] font-black text-muted-foreground tracking-[0.2em] pl-1 opacity-40">Short Description</Label>
                                <Textarea 
                                    id="heroDescription"
                                    rows={4}
                                    value={displayData.heroDescription}
                                    onChange={(e) => handleFieldChange('heroDescription', e.target.value)}
                                    disabled={isFormDisabled}
                                    className="font-normal text-sm leading-relaxed min-h-[100px] bg-white/50 border-primary/5 rounded-3xl p-6 shadow-sm focus:ring-primary disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 disabled:text-primary/60"
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-8 rounded-[40px] bg-primary/[0.02] border border-primary/5 space-y-6">
                                <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                    <Activity className="h-5 w-5 text-primary opacity-40" />
                                    <h4 className="text-[10px] font-black text-muted-foreground tracking-[0.2em]">Latest Updates Bar</h4>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { id: 'ticker-active', label: 'Current Help Requests', field: 'isTickerActiveVisible' },
                                        { id: 'ticker-donations', label: 'Recent Donations', field: 'isTickerDonationVisible' },
                                        { id: 'ticker-completed', label: 'Completed Help', field: 'isTickerCompletedVisible' },
                                    ].map(ticker => (
                                        <div key={ticker.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-primary/5 shadow-sm">
                                            <Label htmlFor={ticker.id} className="text-[10px] font-black tracking-widest">{ticker.label}</Label>
                                            <Switch id={ticker.id} checked={displayData[ticker.field as keyof typeof displayData] as boolean} onCheckedChange={(val) => handleFieldChange(ticker.field as keyof FormDataType, val)} disabled={isFormDisabled} className="data-[state=checked]:bg-primary" />
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Max Feed Items</Label>
                                        <Input type="number" value={displayData.tickerMaxDonations} onChange={e => handleFieldChange('tickerMaxDonations', e.target.value)} disabled={isFormDisabled} className="h-12 font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Archive Depth</Label>
                                        <Input type="number" value={displayData.tickerMaxCompleted} onChange={e => handleFieldChange('tickerMaxCompleted', e.target.value)} disabled={isFormDisabled} className="h-12 font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        <VisibilityToggle 
                            id="hero-visibility"
                            label="Main Banner"
                            description="Shows the top welcome section."
                            icon={Monitor}
                            checked={displayData.isHeroVisible}
                            onChange={(val) => handleFieldChange('isHeroVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="news-ticker-visibility"
                            label="Moving Updates"
                            description="Shows moving text with updates."
                            icon={Megaphone}
                            checked={displayData.isNewsTickerVisible}
                            onChange={(val) => handleFieldChange('isNewsTickerVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="wisdom-visibility"
                            label="Daily Quotes"
                            description="Shows religious and good quotes."
                            icon={Quote}
                            checked={displayData.isWisdomVisible}
                            onChange={(val) => handleFieldChange('isWisdomVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="overall-summary-visibility"
                            label="Total Money Collected"
                            description="Shows how much money is gathered."
                            icon={Target}
                            checked={displayData.isOverallSummaryVisible}
                            onChange={(val) => handleFieldChange('isOverallSummaryVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="donation-summary-visibility"
                            label="Donation Charts"
                            description="Shows charts of donations."
                            icon={PieChart}
                            checked={displayData.isDonationSummaryVisible}
                            onChange={(val) => handleFieldChange('isDonationSummaryVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="purpose-summary-visibility"
                            label="How Money is Used"
                            description="Shows categories of spending."
                            icon={HeartHandshake}
                            checked={displayData.isPurposeSummaryVisible}
                            onChange={(val) => handleFieldChange('isPurposeSummaryVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="donate-now-visibility"
                            label="Donate Now Button"
                            description="Enables or disables public online donation button."
                            icon={HeartHandshake}
                            checked={displayData.isLandingDonateNowVisible}
                            onChange={(val) => handleFieldChange('isLandingDonateNowVisible', val)}
                            disabled={isFormDisabled}
                        />
                    </div>
                </SettingsSection>

                {/* Section 4: Expanded Bank & Payment Details */}
                <SettingsSection 
                    title="Bank & Payment Details" 
                    description="Set up your primary & backup UPI accounts, full bank account info, and online payment gateways."
                    icon={CreditCard}
                    defaultOpen={true}
                >
                    <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div className="space-y-1">
                            <h4 className="font-black text-sm text-primary flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-blue-600" />
                                Online Payment Gateways (Razorpay, Instamojo, PhonePe, Paytm, Stripe)
                            </h4>
                            <p className="text-xs text-muted-foreground">Configure automated online payment gateways, sandbox testing modes, and public/donor visibility rules.</p>
                        </div>
                        <Button asChild className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-5 rounded-xl shrink-0 shadow-md">
                            <Link href="/settings/payment-gateways">
                                Manage Gateways <ChevronRight className="ml-1 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-10">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                    <QrCode className="h-5 w-5 text-primary opacity-40" />
                                    <h4 className="text-[10px] font-black text-muted-foreground tracking-[0.2em]">UPI & QR Transfer Settings</h4>
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
                                                <Label htmlFor="qr-upload" className="cursor-pointer bg-white text-primary font-black text-[10px] tracking-widest px-6 h-10 rounded-xl flex items-center shadow-xl active:scale-95 transition-all">
                                                    Update Vector
                                                </Label>
                                                <Input id="qr-upload" type="file" className="hidden" accept="image/*" onChange={e => setQrCodeFile(e.target.files?.[0] || null)} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-4 flex-1 pt-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Primary UPI ID (VPA Handle)</Label>
                                            <Input 
                                                value={displayData.upiId} 
                                                onChange={e => handleFieldChange('upiId', e.target.value)} 
                                                disabled={isFormDisabled} 
                                                className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 disabled:text-xl" 
                                                placeholder="handle@upi"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Secondary / Backup UPI ID</Label>
                                            <Input 
                                                value={displayData.secondaryUpiId} 
                                                onChange={e => handleFieldChange('secondaryUpiId', e.target.value)} 
                                                disabled={isFormDisabled} 
                                                className="h-11 font-mono font-bold rounded-2xl border-primary/5 bg-white shadow-sm px-4 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 text-xs" 
                                                placeholder="backup@icici"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Mobile Number for Payment</Label>
                                            <Input 
                                                value={displayData.paymentMobileNumber} 
                                                onChange={e => handleFieldChange('paymentMobileNumber', e.target.value)} 
                                                disabled={isFormDisabled} 
                                                className="h-11 font-mono font-bold rounded-2xl border-primary/5 bg-white shadow-sm px-4 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 text-xs" 
                                                placeholder="+91-XXXXX-XXXXX"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-primary/5">
                                            <Label className="text-xs font-bold text-primary">Display QR & UPI Publicly</Label>
                                            <Switch
                                                checked={displayData.isUpiQrPublic}
                                                onCheckedChange={(val) => handleFieldChange('isUpiQrPublic', val)}
                                                disabled={isFormDisabled}
                                                className="data-[state=checked]:bg-primary"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="p-8 rounded-[40px] bg-primary/[0.02] border border-primary/5 space-y-6">
                                <div className="flex items-center justify-between border-b border-primary/5 pb-4">
                                    <div className="flex items-center gap-3">
                                        <Landmark className="h-5 w-5 text-primary opacity-40" />
                                        <h4 className="text-[10px] font-black text-muted-foreground tracking-[0.2em]">Bank Account Details</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Label className="text-[10px] font-bold opacity-60">Public View</Label>
                                        <Switch
                                            checked={displayData.isBankDetailsPublic}
                                            onCheckedChange={(val) => handleFieldChange('isBankDetailsPublic', val)}
                                            disabled={isFormDisabled}
                                            className="data-[state=checked]:bg-primary"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Account Holder Name</Label>
                                        <Input value={displayData.bankAccountName} onChange={e => handleFieldChange('bankAccountName', e.target.value)} disabled={isFormDisabled} className="h-12 font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="Baitulmal Samajik Sanstha" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Bank Name</Label>
                                            <Input value={displayData.bankName} onChange={e => handleFieldChange('bankName', e.target.value)} disabled={isFormDisabled} className="h-11 font-bold rounded-2xl border-primary/5 bg-white shadow-sm px-4 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 text-xs" placeholder="State Bank of India" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Branch Name</Label>
                                            <Input value={displayData.bankBranch} onChange={e => handleFieldChange('bankBranch', e.target.value)} disabled={isFormDisabled} className="h-11 font-bold rounded-2xl border-primary/5 bg-white shadow-sm px-4 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 text-xs" placeholder="Solapur Main Branch" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Account Number</Label>
                                            <Input value={displayData.bankAccountNumber} onChange={e => handleFieldChange('bankAccountNumber', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="0000000000" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Bank IFSC Code</Label>
                                            <Input value={displayData.bankIfsc} onChange={e => handleFieldChange('bankIfsc', e.target.value.toUpperCase())} disabled={isFormDisabled} className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 uppercase" placeholder="SBIN0000000" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Account Type</Label>
                                            <Select value={displayData.bankAccountType} onValueChange={(val) => handleFieldChange('bankAccountType', val)} disabled={isFormDisabled}>
                                                <SelectTrigger className="h-11 font-bold rounded-2xl border-primary/5 bg-white shadow-sm px-4 text-xs">
                                                    <SelectValue placeholder="Select Account Type" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-2xl border-primary/10 p-1">
                                                    <SelectItem value="Current Account" className="font-bold text-xs">Current Account</SelectItem>
                                                    <SelectItem value="Savings Account" className="font-bold text-xs">Savings Account</SelectItem>
                                                    <SelectItem value="Trust FCRA Account" className="font-bold text-xs">Trust / FCRA Account</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">SWIFT / BIC Code</Label>
                                            <Input value={displayData.bankSwiftCode} onChange={e => handleFieldChange('bankSwiftCode', e.target.value.toUpperCase())} disabled={isFormDisabled} className="h-11 font-mono font-bold rounded-2xl border-primary/5 bg-white shadow-sm px-4 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0 text-xs uppercase" placeholder="SBININBBXXX" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection 
                    title="Login Options" 
                    description="Manage how donors and members can log in."
                    icon={Shield}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="p-8 rounded-[40px] bg-primary/[0.02] border border-primary/5 space-y-6">
                            <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                <Lock className="h-5 w-5 text-primary opacity-40" />
                                <h4 className="text-[10px] font-black text-muted-foreground tracking-[0.2em]">Login Security</h4>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-5 rounded-3xl bg-white border border-primary/5 shadow-sm">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-black tracking-widest">Inbound Portal (Donors)</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground opacity-60">Authorize donors to access their cloud history.</p>
                                    </div>
                                    <Switch checked={displayData.isDonorLoginEnabled} onCheckedChange={(val) => handleFieldChange('isDonorLoginEnabled', val)} disabled={isFormDisabled} className="data-[state=checked]:bg-primary" />
                                </div>
                                <div className="flex items-center justify-between p-5 rounded-3xl bg-white border border-primary/5 shadow-sm">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-black tracking-widest">Outbound Portal (Recipients)</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground opacity-60">Authorize beneficiaries to track their aid status.</p>
                                    </div>
                                    <Switch checked={displayData.isBeneficiaryLoginEnabled} onCheckedChange={(val) => handleFieldChange('isBeneficiaryLoginEnabled', val)} disabled={isFormDisabled} className="data-[state=checked]:bg-primary" />
                                </div>
                            </div>
                        </div>

                        <div className="p-8 rounded-[40px] bg-primary/[0.02] border border-primary/5 space-y-6">
                            <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                <Key className="h-5 w-5 text-primary opacity-40" />
                                <h4 className="text-[10px] font-black text-muted-foreground tracking-[0.2em]">Credential Protocol</h4>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Primary Auth Method</Label>
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
                                        <Label className="text-xs font-black tracking-widest">Donor Self-Reporting</Label>
                                        <p className="text-[9px] font-bold text-muted-foreground opacity-60">Authorize donors to log their own financial transfers.</p>
                                    </div>
                                    <Switch checked={displayData.isDonorSelfRecordPaymentEnabled} onCheckedChange={(val) => handleFieldChange('isDonorSelfRecordPaymentEnabled', val)} disabled={isFormDisabled} className="data-[state=checked]:bg-primary" />
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection 
                    title="Organization Branding Matrix" 
                    description="Orchestrate the visual identity and metadata of the organization."
                    icon={Palette}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                <Activity className="h-5 w-5 text-primary opacity-40" />
                                <h4 className="text-[10px] font-black text-muted-foreground tracking-[0.2em]">Organization Profile</h4>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black text-muted-foreground tracking-[0.2em] pl-1 opacity-40">Organization Name</Label>
                                    <Input value={displayData.name} onChange={e => handleFieldChange('name', e.target.value)} disabled={isFormDisabled} className="h-14 font-black text-xl rounded-3xl border-primary/5 bg-white shadow-sm px-6 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Registration No.</Label>
                                        <Input value={displayData.regNo} onChange={e => handleFieldChange('regNo', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">PAN Vector</Label>
                                        <Input value={displayData.pan} onChange={e => handleFieldChange('pan', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-black rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" />
                                    </div>
                                </div>
                                <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 space-y-5">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="font-black text-xs text-amber-900 flex items-center gap-2">
                                                <HardHat className="h-4 w-4 text-amber-600" /> Site Under Construction / Service Notice Banner
                                            </Label>
                                            <p className="text-[10px] text-amber-700/70 font-normal">Display global top announcement banner to inform users of domain setup or operational status.</p>
                                        </div>
                                        <Switch checked={displayData.isUnderConstructionAlertVisible} onCheckedChange={(val) => handleFieldChange('isUnderConstructionAlertVisible', val)} disabled={isFormDisabled} className="data-[state=checked]:bg-amber-600" />
                                    </div>

                                    {displayData.isUnderConstructionAlertVisible && (
                                        <div className="space-y-4 pt-2 border-t border-amber-500/10">
                                            {/* Style / Theme Preset */}
                                            <div className="space-y-2">
                                                <Label className="text-[9px] font-black tracking-widest text-amber-900/60 uppercase">Banner Color Theme</Label>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {[
                                                        { id: 'amber', label: '🟡 Amber (Notice)', class: 'bg-amber-500/20 text-amber-900 border-amber-500/30' },
                                                        { id: 'blue', label: '🔵 Blue (System Update)', class: 'bg-blue-500/20 text-blue-900 border-blue-500/30' },
                                                        { id: 'emerald', label: '🟢 Emerald (Operational)', class: 'bg-emerald-500/20 text-emerald-900 border-emerald-500/30' },
                                                        { id: 'rose', label: '🔴 Rose (Maintenance)', class: 'bg-rose-500/20 text-rose-900 border-rose-500/30' },
                                                    ].map((preset) => (
                                                        <button
                                                            key={preset.id}
                                                            type="button"
                                                            disabled={isFormDisabled}
                                                            onClick={() => handleFieldChange('underConstructionAlertStyle', preset.id)}
                                                            className={cn(
                                                                "text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all",
                                                                preset.class,
                                                                displayData.underConstructionAlertStyle === preset.id ? "ring-2 ring-primary ring-offset-1 font-black shadow-sm scale-105" : "opacity-60 hover:opacity-100"
                                                            )}
                                                        >
                                                            {preset.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Smart Message Generator Box */}
                                            <div className="p-4 rounded-2xl bg-white/70 border border-amber-500/15 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-[10px] font-black text-amber-900 flex items-center gap-1.5">
                                                        <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Smart Message Generator
                                                    </Label>
                                                    <span className="text-[9px] font-bold text-amber-700/60">Select Active Capabilities</span>
                                                </div>
                                                
                                                <div className="flex flex-wrap gap-2">
                                                    {[
                                                        { key: 'domain', label: '🌐 Domain Setup' },
                                                        { key: 'gateways', label: '💳 Online Gateways & QR' },
                                                        { key: 'whatsapp', label: '💬 WhatsApp & Receipts' },
                                                        { key: 'sync', label: '🔄 Real-Time Data Sync' },
                                                        { key: 'portals', label: '🔐 Self-Service Portals' },
                                                    ].map((item) => (
                                                        <button
                                                            key={item.key}
                                                            type="button"
                                                            disabled={isFormDisabled}
                                                            onClick={() => setAlertIncludeTopics(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                                                            className={cn(
                                                                "text-[9px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1",
                                                                alertIncludeTopics[item.key as keyof typeof alertIncludeTopics]
                                                                    ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                                                                    : "bg-white text-muted-foreground border-border hover:bg-slate-50"
                                                            )}
                                                        >
                                                            {item.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <Button
                                                    type="button"
                                                    disabled={isFormDisabled}
                                                    onClick={() => {
                                                        const parts: string[] = [];
                                                        if (alertIncludeTopics.domain) {
                                                            parts.push("Official web domain registration & custom URL setup is currently in progress");
                                                        }
                                                        
                                                        const activeServices: string[] = [];
                                                        if (alertIncludeTopics.gateways) {
                                                            activeServices.push("online payment options & QR transfers");
                                                        }
                                                        if (alertIncludeTopics.whatsapp) {
                                                            activeServices.push("WhatsApp direct channel & receipt dispatch");
                                                        }
                                                        if (alertIncludeTopics.sync) {
                                                            activeServices.push("real-time cloud data sync");
                                                        }
                                                        if (alertIncludeTopics.portals) {
                                                            activeServices.push("Donor self-service portal access");
                                                        }

                                                        let generated = "";
                                                        if (parts.length > 0 && activeServices.length > 0) {
                                                            generated = `Notice: ${parts.join('. ')}. However, ${activeServices.join(', ')} remain 100% active, secure, and operational.`;
                                                        } else if (parts.length > 0) {
                                                            generated = `Notice: ${parts.join('. ')}. All community services remain fully active.`;
                                                        } else if (activeServices.length > 0) {
                                                            generated = `System Update: ${activeServices.join(', ')} are live and fully operational across all portals.`;
                                                        } else {
                                                            generated = "Notice: Website maintenance and system optimizations in progress. All donor services are active.";
                                                        }

                                                        handleFieldChange('underConstructionAlertText', generated);
                                                        toast({
                                                            title: "Smart Alert Message Generated",
                                                            description: "Alert text populated based on selected active services. You can customize it further below.",
                                                            variant: "success",
                                                        });
                                                    }}
                                                    className="w-full h-8 font-black text-[10px] uppercase tracking-wider bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm"
                                                >
                                                    <Sparkles className="mr-1.5 h-3 w-3" /> Auto-Generate Alert Message
                                                </Button>
                                            </div>

                                            {/* Editable Text Area */}
                                            <div className="space-y-1.5">
                                                <Label className="text-[9px] font-black tracking-widest text-amber-900/60 uppercase pl-1">Custom Alert Message (Fully Editable)</Label>
                                                <Textarea 
                                                    value={displayData.underConstructionAlertText} 
                                                    onChange={e => handleFieldChange('underConstructionAlertText', e.target.value)} 
                                                    disabled={isFormDisabled} 
                                                    rows={3} 
                                                    className="font-semibold text-xs rounded-2xl border-amber-500/20 bg-white shadow-sm p-3 focus-visible:ring-amber-500" 
                                                    placeholder="Notice: Official domain registration & web URL setup is in progress. All online donation options and community portals are fully operational."
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-primary/5 pb-4">
                                <Globe2 className="h-5 w-5 text-primary opacity-40" />
                                <h4 className="text-[10px] font-black text-muted-foreground tracking-[0.2em]">Digital Presence Vectors</h4>
                            </div>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Official Portal URL</Label>
                                    <Input value={displayData.website} onChange={e => handleFieldChange('website', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="https://organization.org" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1">Contact Email Vector</Label>
                                    <Input value={displayData.contactEmail} onChange={e => handleFieldChange('contactEmail', e.target.value)} disabled={isFormDisabled} className="h-12 font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="admin@organization.org" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1 flex items-center gap-1.5">
                                        <Instagram className="h-3 w-3 text-pink-500" /> Instagram Profile URL
                                    </Label>
                                    <Input value={displayData.instagramUrl} onChange={e => handleFieldChange('instagramUrl', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="https://instagram.com/your_profile" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1 flex items-center gap-1.5">
                                        <Facebook className="h-3 w-3 text-blue-600" /> Facebook Profile URL
                                    </Label>
                                    <Input value={displayData.facebookUrl} onChange={e => handleFieldChange('facebookUrl', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="https://facebook.com/your_page" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1 flex items-center gap-1.5">
                                        <Youtube className="h-3 w-3 text-red-600" /> YouTube Channel URL
                                    </Label>
                                    <Input value={displayData.youtubeUrl} onChange={e => handleFieldChange('youtubeUrl', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="https://youtube.com/@your_channel" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1 flex items-center gap-1.5">
                                        <Twitter className="h-3 w-3 text-slate-800" /> Twitter / X Profile URL
                                    </Label>
                                    <Input value={displayData.twitterUrl} onChange={e => handleFieldChange('twitterUrl', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="https://x.com/your_handle" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1 flex items-center gap-1.5">
                                        <Linkedin className="h-3 w-3 text-blue-700" /> LinkedIn Profile URL
                                    </Label>
                                    <Input value={displayData.linkedinUrl} onChange={e => handleFieldChange('linkedinUrl', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="https://linkedin.com/company/your_org" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1 flex items-center gap-1.5">
                                        <MessageSquare className="h-3 w-3 text-emerald-600" /> WhatsApp Link / Number
                                    </Label>
                                    <Input value={displayData.whatsappUrl} onChange={e => handleFieldChange('whatsappUrl', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="https://wa.me/919876543210 or +919876543210" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black tracking-widest opacity-40 pl-1 flex items-center gap-1.5">
                                        <Send className="h-3 w-3 text-sky-500" /> Telegram Channel / Link
                                    </Label>
                                    <Input value={displayData.telegramUrl} onChange={e => handleFieldChange('telegramUrl', e.target.value)} disabled={isFormDisabled} className="h-12 font-mono font-bold text-xs rounded-2xl border-primary/5 bg-white shadow-sm px-5 disabled:opacity-100 disabled:bg-transparent disabled:border-none disabled:p-0" placeholder="https://t.me/your_channel or @your_channel" />
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                {/* Footer Content & Visibility Controls */}
                <SettingsSection
                    title="Footer Content & Visibility Controls"
                    description="Manage visibility rules for social icons, contact details, quick links, and footer layout sections."
                    icon={Layout}
                    defaultOpen={true}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <VisibilityToggle
                            id="isFooterVisible"
                            label="Public Site Footer"
                            description="Master switch to display or hide the footer section across all public pages."
                            icon={Layout}
                            checked={displayData.isFooterVisible}
                            onChange={val => handleFieldChange('isFooterVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle
                            id="isFooterSocialVisible"
                            label="Social Media Profile Icons (All)"
                            description="Master switch to display or hide the entire social media icons row."
                            icon={Globe2}
                            checked={displayData.isFooterSocialVisible}
                            onChange={val => handleFieldChange('isFooterSocialVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle
                            id="isFooterInstagramVisible"
                            label="Instagram Icon"
                            description="Display Instagram profile button in footer."
                            icon={Instagram}
                            checked={displayData.isFooterInstagramVisible}
                            onChange={val => handleFieldChange('isFooterInstagramVisible', val)}
                            disabled={isFormDisabled || !displayData.isFooterSocialVisible}
                        />
                        <VisibilityToggle
                            id="isFooterFacebookVisible"
                            label="Facebook Icon"
                            description="Display Facebook profile button in footer."
                            icon={Facebook}
                            checked={displayData.isFooterFacebookVisible}
                            onChange={val => handleFieldChange('isFooterFacebookVisible', val)}
                            disabled={isFormDisabled || !displayData.isFooterSocialVisible}
                        />
                        <VisibilityToggle
                            id="isFooterYoutubeVisible"
                            label="YouTube Icon"
                            description="Display YouTube channel button in footer."
                            icon={Youtube}
                            checked={displayData.isFooterYoutubeVisible}
                            onChange={val => handleFieldChange('isFooterYoutubeVisible', val)}
                            disabled={isFormDisabled || !displayData.isFooterSocialVisible}
                        />
                        <VisibilityToggle
                            id="isFooterTwitterVisible"
                            label="Twitter / X Icon"
                            description="Display Twitter / X handle button in footer."
                            icon={Twitter}
                            checked={displayData.isFooterTwitterVisible}
                            onChange={val => handleFieldChange('isFooterTwitterVisible', val)}
                            disabled={isFormDisabled || !displayData.isFooterSocialVisible}
                        />
                        <VisibilityToggle
                            id="isFooterLinkedinVisible"
                            label="LinkedIn Icon"
                            description="Display LinkedIn company button in footer."
                            icon={Linkedin}
                            checked={displayData.isFooterLinkedinVisible}
                            onChange={val => handleFieldChange('isFooterLinkedinVisible', val)}
                            disabled={isFormDisabled || !displayData.isFooterSocialVisible}
                        />
                        <VisibilityToggle
                            id="isFooterWhatsappVisible"
                            label="WhatsApp Icon"
                            description="Display WhatsApp chat/group button in footer."
                            icon={MessageSquare}
                            checked={displayData.isFooterWhatsappVisible}
                            onChange={val => handleFieldChange('isFooterWhatsappVisible', val)}
                            disabled={isFormDisabled || !displayData.isFooterSocialVisible}
                        />
                        <VisibilityToggle
                            id="isFooterTelegramVisible"
                            label="Telegram Icon"
                            description="Display Telegram channel button in footer."
                            icon={Send}
                            checked={displayData.isFooterTelegramVisible}
                            onChange={val => handleFieldChange('isFooterTelegramVisible', val)}
                            disabled={isFormDisabled || !displayData.isFooterSocialVisible}
                        />
                        <VisibilityToggle
                            id="isFooterAddressVisible"
                            label="Organization Address"
                            description="Display physical office address in public site footer."
                            icon={MapPin}
                            checked={displayData.isFooterAddressVisible}
                            onChange={val => handleFieldChange('isFooterAddressVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle
                            id="isFooterContactVisible"
                            label="Phone & Email Contacts"
                            description="Display official phone number and email contact links in public site footer."
                            icon={Globe}
                            checked={displayData.isFooterContactVisible}
                            onChange={val => handleFieldChange('isFooterContactVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle
                            id="isFooterQuickLinksVisible"
                            label="Quick Links Navigation Column"
                            description="Display quick navigation links (About Us, Donation Info, Guidance, Site Map)."
                            icon={ListChecks}
                            checked={displayData.isFooterQuickLinksVisible}
                            onChange={val => handleFieldChange('isFooterQuickLinksVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle
                            id="isFooterSupportUsVisible"
                            label="'How to Donate' Support Column"
                            description="Display right-hand column with 'How to Donate' action button."
                            icon={HeartHandshake}
                            checked={displayData.isFooterSupportUsVisible}
                            onChange={val => handleFieldChange('isFooterSupportUsVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle
                            id="isFooterRegInfoVisible"
                            label="Registration & PAN Details"
                            description="Display official Registration Number and PAN in footer bottom bar."
                            icon={ShieldCheck}
                            checked={displayData.isFooterRegInfoVisible}
                            onChange={val => handleFieldChange('isFooterRegInfoVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle
                            id="isFooterCopyrightVisible"
                            label="Copyright Notice"
                            description="Display copyright notice text line in footer bottom bar."
                            icon={Shield}
                            checked={displayData.isFooterCopyrightVisible}
                            onChange={val => handleFieldChange('isFooterCopyrightVisible', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle
                            id="isFooterBuildVersionVisible"
                            label="System Build Version Tag"
                            description="Display system build version badge in footer bottom bar."
                            icon={Activity}
                            checked={displayData.isFooterBuildVersionVisible}
                            onChange={val => handleFieldChange('isFooterBuildVersionVisible', val)}
                            disabled={isFormDisabled}
                        />
                    </div>
                </SettingsSection>
            </div>
            
            {isEditMode && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
                    <div className="flex items-center gap-2 bg-primary/20 backdrop-blur-2xl p-2 rounded-[32px] border border-primary/20 shadow-2xl">
                        <Button variant="ghost" onClick={handleCancel} disabled={isSubmitting} className="font-black tracking-widest text-[10px] text-primary h-12 px-8 rounded-3xl hover:bg-white/20 transition-all">
                            <X className="mr-2 h-4 w-4" /> Discard Updates
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-white font-black tracking-widest text-[10px] h-12 px-12 rounded-3xl shadow-xl shadow-primary/40 transition-all active:scale-95">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CloudCog className="mr-2 h-4 w-4"/>} 
                            Commit Sync
                        </Button>
                    </div>
                </div>
            )}
        </main>
    );
}