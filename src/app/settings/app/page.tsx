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
    Filter
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
}

function VerifiableItem({ icon: Icon, label, value, isEditing, id, onChange, placeholder }: { 
    icon: any, 
    label: string, 
    value: string, 
    isEditing: boolean, 
    id: string, 
    onChange: (val: string) => void,
    placeholder?: string
}) {
    return (
        <div className="flex items-start gap-4 py-2 group">
            <div className="mt-1 shrink-0 p-2 rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-bold text-primary tracking-tight">{label}</p>
                {isEditing ? (
                    <Input 
                        id={id}
                        value={value} 
                        onChange={(e) => onChange(e.target.value)} 
                        placeholder={placeholder}
                        className="font-normal h-9"
                    />
                ) : (
                    <p className="text-sm font-normal text-muted-foreground leading-relaxed">
                        {value || <span className="italic opacity-50">Not Configured</span>}
                    </p>
                )}
            </div>
        </div>
    );
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 bg-muted/5 gap-4 transition-all hover:border-primary/20">
            <div className="space-y-1 flex-1">
                <h3 className="font-bold text-primary text-sm tracking-tight flex items-center gap-2">
                    <Icon className="h-4 w-4" /> {label}
                </h3>
                <p className="text-xs text-muted-foreground font-normal">{description}</p>
            </div>
            <div className="flex items-center space-x-2">
                <Label htmlFor={id} className="font-bold text-xs opacity-60 tracking-tight">Visible</Label>
                <Switch 
                    id={id} 
                    checked={checked} 
                    onCheckedChange={onChange} 
                    disabled={disabled} 
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
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
            <Card className="border-primary/10 shadow-sm overflow-hidden bg-white">
                <CollapsibleTrigger asChild>
                    <CardHeader className="bg-primary/5 cursor-pointer hover:bg-primary/[0.08] transition-colors border-b">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="space-y-0.5">
                                    <CardTitle className="text-lg font-bold text-primary tracking-tight">{title}</CardTitle>
                                    <CardDescription className="text-xs font-normal text-primary/60">{description}</CardDescription>
                                </div>
                            </div>
                            <ChevronDown className={cn("h-5 w-5 text-primary transition-transform duration-300", isOpen && "rotate-180")} />
                        </div>
                    </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="pt-6">
                        {children}
                    </CardContent>
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
            toast({ title: "Configuration Error", description: "Missing Data Or Permissions To Secure Settings.", variant: "destructive" });
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
            toast({ title: 'Success', description: 'Institutional Configuration Updated Successfully.', variant: 'success' });
            setIsEditMode(false);
        } catch (error: any) {
            toast({ title: 'Save failed', description: error.message || 'An unexpected error occurred while securing settings.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCancel = () => setIsEditMode(false);

    const isGlobalLoading = isSessionLoading || isBrandingLoading || isPaymentLoading || isGPLoading;

    if (isGlobalLoading) {
        return <BrandedLoader message="Syncing Institutional Settings..." />;
    }

    const isFormDisabled = !isEditMode || isSubmitting;

    const displayData = isEditMode && editableData ? editableData : {
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
        isTickerActiveVisible: brandingSettings?.isTickerActiveVisible ?? true,
        isTickerDonationVisible: brandingSettings?.isTickerDonationVisible ?? true,
        isTickerCompletedVisible: brandingSettings?.isTickerCompletedVisible ?? true,
        tickerMaxDonations: brandingSettings?.tickerMaxDonations ?? 15,
        tickerMaxCompleted: brandingSettings?.tickerMaxCompleted ?? 5,
        tickerSkipIds: brandingSettings?.tickerSkipIds || [],
        isDonorLoginEnabled: brandingSettings?.isDonorLoginEnabled ?? true,
        isBeneficiaryLoginEnabled: brandingSettings?.isBeneficiaryLoginEnabled ?? true,
        isDonorSelfRecordPaymentEnabled: brandingSettings?.isDonorSelfRecordPaymentEnabled ?? false,
    };

    return (
        <div className="space-y-6 text-primary font-normal pb-20">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-primary">App Settings</h2>
                    <p className="text-sm text-muted-foreground font-normal">Manage Organization Profile, Branding, And Core Standards.</p>
                </div>
                {!isEditMode ? (
                    <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md transition-transform active:scale-95">
                        <Edit className="mr-2 h-4 w-4"/>Modify Configuration
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCancel} disabled={isSubmitting} className="font-bold border-primary/20 text-primary transition-transform active:scale-95"><X className="mr-2 h-4 w-4" /> Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="font-bold shadow-md active:scale-95 transition-transform">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save All Changes
                        </Button>
                    </div>
                )}
            </div>

            <div className="space-y-6 animate-fade-in-up">
                
                <SettingsSection 
                    title="Landing Page Configuration" 
                    description="Configure the primary welcome message and component visibility on the homepage."
                    icon={Monitor}
                    defaultOpen={true}
                >
                    <div className="space-y-6">
                        <div className="grid gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="heroTitle" className="font-bold text-xs text-muted-foreground tracking-tight capitalize opacity-60">Hero Title</Label>
                                {isEditMode ? (
                                    <Input 
                                        id="heroTitle"
                                        value={displayData.heroTitle}
                                        onChange={(e) => handleFieldChange('heroTitle', e.target.value)}
                                        className="font-normal"
                                    />
                                ) : (
                                    <p className="text-lg font-bold text-primary">{displayData.heroTitle}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="heroDescription" className="font-bold text-xs text-muted-foreground tracking-tight capitalize opacity-60">Hero Description</Label>
                                {isEditMode ? (
                                    <Textarea 
                                        id="heroDescription"
                                        rows={3}
                                        value={displayData.heroDescription}
                                        onChange={(e) => handleFieldChange('heroDescription', e.target.value)}
                                        className="font-normal leading-relaxed"
                                    />
                                ) : (
                                    <p className="text-sm font-normal text-muted-foreground leading-relaxed">{displayData.heroDescription}</p>
                                )}
                            </div>
                        </div>

                        <Separator className="bg-primary/10" />

                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-primary flex items-center gap-2 tracking-tight">
                                <Calendar className="h-4 w-4" /> Reporting Period Filter
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="summaryStartDate" className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize opacity-60">Aggregate Start Date</Label>
                                    <Input 
                                        id="summaryStartDate"
                                        type="date"
                                        value={displayData.summaryStartDate}
                                        onChange={(e) => handleFieldChange('summaryStartDate', e.target.value)}
                                        disabled={isFormDisabled}
                                        className="font-bold h-10 border-primary/10"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="summaryEndDate" className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize opacity-60">Aggregate End Date</Label>
                                    <Input 
                                        id="summaryEndDate"
                                        type="date"
                                        value={displayData.summaryEndDate}
                                        onChange={(e) => handleFieldChange('summaryEndDate', e.target.value)}
                                        disabled={isFormDisabled}
                                        className="font-bold h-10 border-primary/10"
                                    />
                                </div>
                            </div>
                        </div>

                        <Separator className="bg-primary/10" />

                        <div className="space-y-6">
                            <h4 className="text-xs font-bold text-primary flex items-center gap-2 tracking-tight">
                                <Megaphone className="h-4 w-4" /> News Ticker Configuration
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4 rounded-xl border border-primary/10 p-4 bg-muted/5">
                                    <h5 className="text-[10px] font-bold text-primary/60 capitalize tracking-widest border-b pb-2 mb-2">Display Toggles</h5>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="ticker-active" className="text-xs font-bold">Show Active Initiatives</Label>
                                            <Switch id="ticker-active" checked={displayData.isTickerActiveVisible} onCheckedChange={(val) => handleFieldChange('isTickerActiveVisible', val)} disabled={isFormDisabled} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="ticker-donations" className="text-xs font-bold">Show Verified Donations</Label>
                                            <Switch id="ticker-donations" checked={displayData.isTickerDonationVisible} onCheckedChange={(val) => handleFieldChange('isTickerDonationVisible', val)} disabled={isFormDisabled} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="ticker-completed" className="text-xs font-bold">Show Recent Archive</Label>
                                            <Switch id="ticker-completed" checked={displayData.isTickerCompletedVisible} onCheckedChange={(val) => handleFieldChange('isTickerCompletedVisible', val)} disabled={isFormDisabled} />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4 rounded-xl border border-primary/10 p-4 bg-muted/5">
                                    <h5 className="text-[10px] font-bold text-primary/60 capitalize tracking-widest border-b pb-2 mb-2">Item Constraints</h5>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-bold">Max Donations</Label>
                                            <Input type="number" value={displayData.tickerMaxDonations} onChange={e => handleFieldChange('tickerMaxDonations', e.target.value)} disabled={isFormDisabled} className="h-8 text-xs font-bold" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[9px] font-bold">Max Archive</Label>
                                            <Input type="number" value={displayData.tickerMaxCompleted} onChange={e => handleFieldChange('tickerMaxCompleted', e.target.value)} disabled={isFormDisabled} className="h-8 text-xs font-bold" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-3 p-4 rounded-xl border border-primary/10 bg-white shadow-sm">
                                <h5 className="text-xs font-bold text-primary tracking-tight flex items-center gap-2">
                                    <Filter className="h-4 w-4 opacity-40"/> Ticker Exclusion List (Skip IDs)
                                </h5>
                                <p className="text-[10px] text-muted-foreground font-normal">Select specific initiatives that should never appear in the rolling ticker.</p>
                                <div className="border rounded-lg bg-muted/5 p-2">
                                    <ScrollArea className="h-48 w-full">
                                        <div className="space-y-1">
                                            {[...(allCampaigns || []), ...(allLeads || [])].map((item) => {
                                                const isSkipped = displayData.tickerSkipIds.includes(item.id);
                                                return (
                                                    <div key={item.id} className="flex items-center space-x-3 p-2 rounded hover:bg-primary/5 transition-colors border-b border-primary/5 last:border-0">
                                                        <Checkbox 
                                                            id={`skip-${item.id}`} 
                                                            checked={isSkipped} 
                                                            onCheckedChange={(checked) => {
                                                                const current = [...displayData.tickerSkipIds];
                                                                const updated = checked ? [...current, item.id] : current.filter(id => id !== item.id);
                                                                handleFieldChange('tickerSkipIds', updated);
                                                            }} 
                                                            disabled={isFormDisabled}
                                                        />
                                                        <Label htmlFor={`skip-${item.id}`} className="text-xs font-normal cursor-pointer flex-1 flex justify-between gap-4">
                                                            <span className="truncate">{item.name}</span>
                                                            <span className="text-[9px] font-mono opacity-40 shrink-0">ID:{item.id.slice(-4)}</span>
                                                        </Label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <ScrollBar orientation="vertical" />
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <VisibilityToggle 
                                id="hero-visibility"
                                label="Show Hero Message"
                                description="Display the primary title and description at the top of the landing page."
                                icon={Monitor}
                                checked={displayData.isHeroVisible}
                                onChange={(val) => handleFieldChange('isHeroVisible', val)}
                                disabled={isFormDisabled}
                            />
                            <VisibilityToggle 
                                id="news-ticker-visibility"
                                label="Main News Tickers"
                                description="Master toggle for all rolling community updates."
                                icon={Megaphone}
                                checked={displayData.isNewsTickerVisible}
                                onChange={(val) => handleFieldChange('isNewsTickerVisible', val)}
                                disabled={isFormDisabled}
                            />
                            <VisibilityToggle 
                                id="wisdom-visibility"
                                label="Wisdom & Reflections"
                                description="Display daily religious guidance and scholar quotes."
                                icon={Quote}
                                checked={displayData.isWisdomVisible}
                                onChange={(val) => handleFieldChange('isWisdomVisible', val)}
                                disabled={isFormDisabled}
                            />
                            <VisibilityToggle 
                                id="overall-summary-visibility"
                                label="Overall Funding Progress"
                                description="Display the combined organizational progress bar."
                                icon={Target}
                                checked={displayData.isOverallSummaryVisible}
                                onChange={(val) => handleFieldChange('isOverallSummaryVisible', val)}
                                disabled={isFormDisabled}
                            />
                            <VisibilityToggle 
                                id="donation-summary-visibility"
                                label="Donation Summary Charts"
                                description="Display category distributions and historical trends."
                                icon={PieChart}
                                checked={displayData.isDonationSummaryVisible}
                                onChange={(val) => handleFieldChange('isDonationSummaryVisible', val)}
                                disabled={isFormDisabled}
                            />
                            <VisibilityToggle 
                                id="purpose-summary-visibility"
                                label="Impact By Purpose"
                                description="Display verified fund utilization across community pillars."
                                icon={HeartHandshake}
                                checked={displayData.isPurposeSummaryVisible}
                                onChange={(val) => handleFieldChange('isPurposeSummaryVisible', val)}
                                disabled={isFormDisabled}
                            />
                            <VisibilityToggle 
                                id="initiative-summary-visibility"
                                label="Initiative Summaries"
                                description="Display counts and tables for active campaigns and appeals."
                                icon={Building2}
                                checked={displayData.isInitiativeSummaryVisible}
                                onChange={(val) => handleFieldChange('isInitiativeSummaryVisible', val)}
                                disabled={isFormDisabled}
                            />
                            <VisibilityToggle 
                                id="recent-verification-visibility"
                                label="Real-time Verification Feed"
                                description="Display the animated feed of confirmed community contributions."
                                icon={CheckCircle2}
                                checked={displayData.isRecentVerificationVisible}
                                onChange={(val) => handleFieldChange('isRecentVerificationVisible', val)}
                                disabled={isFormDisabled}
                            />
                            <VisibilityToggle 
                                id="landing-donate-now-visibility"
                                label="Landing Page Donate Button"
                                description="Show a prominent 'Donate Now' button in the hero section."
                                icon={HeartHandshake}
                                checked={displayData.isLandingDonateNowVisible}
                                onChange={(val) => handleFieldChange('isLandingDonateNowVisible', val)}
                                disabled={isFormDisabled}
                            />
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection 
                    title="Portals & Access Control" 
                    description="Globally toggle access to the Donor and Beneficiary authentications and features."
                    icon={ShieldCheck}
                    defaultOpen={true}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <VisibilityToggle 
                            id="donor-login-visibility"
                            label="Donor Portal Login"
                            description="If disabled, donors cannot securely log in or view their profile histories."
                            icon={HeartHandshake}
                            checked={displayData.isDonorLoginEnabled}
                            onChange={(val) => handleFieldChange('isDonorLoginEnabled', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="beneficiary-login-visibility"
                            label="Beneficiary Portal Login"
                            description="If disabled, beneficiaries cannot log in to check their status or submit updates."
                            icon={User}
                            checked={displayData.isBeneficiaryLoginEnabled}
                            onChange={(val) => handleFieldChange('isBeneficiaryLoginEnabled', val)}
                            disabled={isFormDisabled}
                        />
                        <VisibilityToggle 
                            id="donor-payment-self-record"
                            label="Donor Self-Payment Record"
                            description="If disabled, only staff members can record payments on behalf of the donor."
                            icon={CreditCard}
                            checked={displayData.isDonorSelfRecordPaymentEnabled}
                            onChange={(val) => handleFieldChange('isDonorSelfRecordPaymentEnabled', val)}
                            disabled={isFormDisabled}
                        />
                    </div>
                </SettingsSection>

                <SettingsSection 
                    title="Organization Details" 
                    description="Public profile, visual identity, and contact information."
                    icon={Building2}
                    defaultOpen={false}
                >
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-muted-foreground tracking-tight border-b pb-2 capitalize opacity-60">Identity & Registration</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                <VerifiableItem 
                                    icon={Building2} 
                                    label="Organization Name" 
                                    value={displayData.name} 
                                    isEditing={isEditMode}
                                    id="org-name"
                                    onChange={(v) => handleFieldChange('name', v)}
                                    placeholder="Full Legal Name"
                                />
                                <VerifiableItem 
                                    icon={MapPin} 
                                    label="Address" 
                                    value={displayData.address} 
                                    isEditing={isEditMode}
                                    id="org-address"
                                    onChange={(v) => handleFieldChange('address', v)}
                                    placeholder="Official Registered Address"
                                />
                                <VerifiableItem 
                                    icon={Hash} 
                                    label="Registration No." 
                                    value={displayData.regNo} 
                                    isEditing={isEditMode}
                                    id="org-reg"
                                    onChange={(v) => handleFieldChange('regNo', v)}
                                    placeholder="e.g. Solapur/0000373/2025"
                                />
                                <VerifiableItem 
                                    icon={ShieldCheck} 
                                    label="PAN Number" 
                                    value={displayData.pan} 
                                    isEditing={isEditMode}
                                    id="org-pan"
                                    onChange={(v) => handleFieldChange('pan', v)}
                                    placeholder="Institutional PAN"
                                />
                                <VerifiableItem 
                                    icon={Globe} 
                                    label="Website" 
                                    value={displayData.website} 
                                    isEditing={isEditMode}
                                    id="org-web"
                                    onChange={(v) => handleFieldChange('website', v)}
                                    placeholder="https://www.example.org"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-muted-foreground tracking-tight border-b pb-2 capitalize opacity-60">Visual Identity</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="flex flex-col items-center gap-4 bg-muted/5 rounded-xl p-4 border border-dashed border-primary/10">
                                    <div className="relative w-full max-w-[200px] aspect-[2/1] rounded-lg flex items-center justify-center bg-white overflow-hidden shadow-inner border border-primary/5">
                                        {(isEditMode ? editableData?.logoUrl : brandingSettings?.logoUrl) ? (
                                            <img src={(isEditMode ? editableData?.logoUrl : brandingSettings?.logoUrl)!.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent((isEditMode ? editableData?.logoUrl : brandingSettings?.logoUrl)!)}` : (isEditMode ? editableData?.logoUrl : brandingSettings?.logoUrl)} alt="Logo" className="object-contain p-2 h-full w-full" />
                                        ) : (
                                            <div className="text-muted-foreground text-center p-2 font-normal opacity-20">
                                                <ImageIcon className="mx-auto h-8 w-8" />
                                                <p className="text-[10px] mt-1 font-bold tracking-tighter capitalize">No Logo Uploaded</p>
                                            </div>
                                        )}
                                    </div>
                                    {isEditMode && (
                                        <div className="flex gap-2">
                                            <label htmlFor="logo-upload" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-[10px] font-bold border border-primary/20 bg-background hover:bg-primary/5 h-7 px-3 cursor-pointer capitalize text-primary transition-all active:scale-95 shadow-sm">
                                                <UploadCloud className="mr-1.5 h-3.5 w-3.5" /> Upload Logo
                                            </label>
                                            <Input id="logo-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => e.target.files && setLogoFile(e.target.files[0])} />
                                            {editableData?.logoUrl && (
                                                <Button type="button" variant="destructive" size="icon" className="h-7 w-7 transition-transform active:scale-90" onClick={handleRemoveLogo} disabled={isSubmitting}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="logoWidth" className="font-bold text-[10px] text-muted-foreground capitalize opacity-60">Width (px)</Label>
                                        <Input id="logoWidth" type="number" value={displayData.logoWidth || 40} onChange={(e) => handleFieldChange('logoWidth', e.target.value)} disabled={isFormDisabled} className="h-9 font-normal text-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="logoHeight" className="font-bold text-[10px] text-muted-foreground capitalize opacity-60">Height (px)</Label>
                                        <Input id="logoHeight" type="number" value={displayData.logoHeight || 40} onChange={(e) => handleFieldChange('logoHeight', e.target.value)} disabled={isFormDisabled} className="h-9 font-normal text-primary" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-muted-foreground tracking-tight border-b pb-2 capitalize opacity-60">Public Footer & Support</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div className="space-y-1">
                                    <Label htmlFor="contactEmail" className="font-bold text-sm text-primary">Service Email</Label>
                                    <Input id="contactEmail" value={displayData.contactEmail} onChange={(e) => handleFieldChange('contactEmail', e.target.value)} disabled={isFormDisabled} placeholder="support@org.com" className="h-9 font-normal text-primary"/>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="contactPhone" className="font-bold text-sm text-primary">Support Hotline</Label>
                                    <Input id="contactPhone" value={displayData.contactPhone} onChange={(e) => handleFieldChange('contactPhone', e.target.value)} disabled={isFormDisabled} placeholder="+91 00000 00000" className="h-9 font-normal text-primary"/>
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <Label htmlFor="copyright" className="font-bold text-sm text-primary">Footer Rights Notice</Label>
                                    <Input id="copyright" value={displayData.copyright} onChange={(e) => handleFieldChange('copyright', e.target.value)} disabled={isFormDisabled} placeholder="© 2026 Your Organization. All Rights Reserved." className="h-9 font-normal text-primary"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection 
                    title="Financial Channels" 
                    description="Configure direct bank transfer and digital payment handle details."
                    icon={CreditCard}
                >
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-muted-foreground tracking-tight border-b pb-2 capitalize opacity-60">Direct Bank Transfer</h4>
                                <VerifiableItem 
                                    icon={User} 
                                    label="Account Title" 
                                    value={displayData.bankAccountName} 
                                    isEditing={isEditMode}
                                    id="bank-name"
                                    onChange={(v) => handleFieldChange('bankAccountName', v)}
                                    placeholder="Full Holder Name"
                                />
                                <VerifiableItem 
                                    icon={CreditCard} 
                                    label="Account Number" 
                                    value={displayData.bankAccountNumber} 
                                    isEditing={isEditMode}
                                    id="bank-acc"
                                    onChange={(v) => handleFieldChange('bankAccountNumber', v)}
                                    placeholder="Account Identifier"
                                />
                                <VerifiableItem 
                                    icon={Landmark} 
                                    label="IFSC Code" 
                                    value={displayData.bankIfsc} 
                                    isEditing={isEditMode}
                                    id="bank-ifsc"
                                    onChange={(v) => handleFieldChange('bankIfsc', v)}
                                    placeholder="11-digit Code"
                                />
                            </div>
                            
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-muted-foreground tracking-tight border-b pb-2 capitalize opacity-60">Digital Handles & QR</h4>
                                <VerifiableItem 
                                    icon={QrCode} 
                                    label="Primary UPI ID" 
                                    value={displayData.upiId} 
                                    isEditing={isEditMode}
                                    id="upi-id"
                                    onChange={(v) => handleFieldChange('upiId', v)}
                                    placeholder="e.g. 1234567890@upi"
                                />
                                <VerifiableItem 
                                    icon={Smartphone} 
                                    label="Linked Mobile Number" 
                                    value={displayData.paymentMobileNumber} 
                                    isEditing={isEditMode}
                                    id="pay-mob"
                                    onChange={(v) => handleFieldChange('paymentMobileNumber', v)}
                                    placeholder="e.g. 9876543210"
                                />
                                
                                <div className="pt-4 flex flex-col items-center gap-4 bg-secondary/30 rounded-xl p-4 border border-primary/10">
                                    <div className="relative w-32 h-32 border-2 border-dashed border-primary/20 rounded-lg flex items-center justify-center bg-white overflow-hidden shadow-inner">
                                        {(isEditMode ? editableData?.qrCodeUrl : paymentSettings?.qrCodeUrl) ? (
                                            <img src={(isEditMode ? editableData?.qrCodeUrl : paymentSettings?.qrCodeUrl)!.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent((isEditMode ? editableData?.qrCodeUrl : paymentSettings?.qrCodeUrl)!)}` : (isEditMode ? editableData?.qrCodeUrl : paymentSettings?.qrCodeUrl)} alt="QR" className="object-contain p-2 h-full w-full" />
                                        ) : (
                                            <div className="text-muted-foreground text-center p-2 font-normal opacity-20">
                                                <QrCode className="mx-auto h-8 w-8" />
                                                <p className="text-[10px] mt-1 font-bold tracking-tighter capitalize">No QR Code</p>
                                            </div>
                                        )}
                                    </div>
                                    {isEditMode && (
                                        <div className="w-full flex justify-center gap-2">
                                            <label htmlFor="qr-upload" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-bold border border-primary/20 bg-background hover:bg-primary/5 h-8 px-3 cursor-pointer capitalize text-primary transition-all active:scale-95 shadow-sm">
                                                <UploadCloud className="mr-2 h-4 w-4" /> Change QR Image
                                            </label>
                                            <Input id="qr-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => e.target.files && setQrCodeFile(e.target.files[0])} />
                                            {editableData?.qrCodeUrl && (
                                                <Button type="button" variant="destructive" size="sm" className="font-bold h-8 transition-transform active:scale-90" onClick={handleRemoveQrCode} disabled={isSubmitting}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    <div className="w-full grid grid-cols-2 gap-4 mt-2">
                                        <div className="space-y-1">
                                            <Label htmlFor="qrWidth" className="font-bold text-[10px] text-muted-foreground capitalize opacity-60">Width (px)</Label>
                                            <Input id="qrWidth" type="number" value={displayData.qrWidth || 120} onChange={(e) => handleFieldChange('qrWidth', e.target.value)} disabled={isFormDisabled} className="h-8 font-normal text-primary" placeholder="120"/>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="qrHeight" className="font-bold text-[10px] text-muted-foreground capitalize opacity-60">Height (px)</Label>
                                            <Input id="qrHeight" type="number" value={displayData.qrHeight || 120} onChange={(e) => handleFieldChange('qrHeight', e.target.value)} disabled={isFormDisabled} className="h-8 font-normal text-primary" placeholder="120"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                <SettingsSection 
                    title="Core Institutional Standards" 
                    description="Define focus pillars and operational rules for public guidance."
                    icon={Shield}
                >
                    <div className="space-y-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 bg-muted/5 gap-4 transition-all hover:border-primary/20">
                            <div className="space-y-1 flex-1">
                                <h3 className="font-bold text-primary text-sm tracking-tight">Public Principles Availability</h3>
                                <p className="text-xs text-muted-foreground font-normal">Toggle visibility of the standards section on informational pages.</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="gp-visibility" className="font-bold text-xs opacity-60">Visible</Label>
                                <Switch 
                                    id="gp-visibility" 
                                    checked={displayData.isGuidingPrinciplesPublic} 
                                    onCheckedChange={(val) => handleFieldChange('isGuidingPrinciplesPublic', val)} 
                                    disabled={isFormDisabled} 
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="font-bold text-[10px] text-muted-foreground tracking-tighter capitalize opacity-60">Section Headline</Label>
                                <Input 
                                    value={displayData.gpTitle} 
                                    onChange={(e) => handleFieldChange('gpTitle', e.target.value)} 
                                    disabled={isFormDisabled}
                                    className="font-bold text-primary h-10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="font-bold text-[10px] text-muted-foreground tracking-tighter capitalize opacity-60">Preamble Description</Label>
                                <Textarea 
                                    rows={3} 
                                    value={displayData.gpDescription} 
                                    onChange={(e) => handleFieldChange('gpDescription', e.target.value)} 
                                    disabled={isFormDisabled} 
                                    placeholder="Enter introductory text..." 
                                    className="font-normal text-sm leading-relaxed text-primary"
                                />
                            </div>
                        </div>

                        <Separator className="bg-primary/10" />

                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-primary tracking-tight flex items-center gap-2 capitalize"><Target className="h-4 w-4 opacity-40"/> Impact Pillars (Focus Areas)</h4>
                                {isEditMode && (
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddFocusArea} className="h-7 text-[10px] font-bold border-primary/20 text-primary active:scale-95 transition-transform shadow-sm"><Plus className="h-3 w-3 mr-1"/> Add Pillar</Button>
                                )}
                            </div>
                            <div className="grid gap-4">
                                {(displayData.focusAreas || []).map((area, index) => (
                                    <div key={area.id || index} className="relative p-4 border rounded-xl bg-primary/[0.01] space-y-4 border-primary/5 shadow-sm group">
                                        {isEditMode && (
                                            <div className="absolute top-2 right-2 flex items-center gap-2">
                                                <div className="flex items-center space-x-1.5 mr-2">
                                                    <Checkbox 
                                                        id={`focus-hide-${index}`}
                                                        checked={area.isHidden} 
                                                        onCheckedChange={(checked) => handleFocusAreaChange(index, 'isHidden', !!checked)} 
                                                    />
                                                    <Label htmlFor={`focus-hide-${index}`} className="text-[10px] font-bold opacity-60 capitalize cursor-pointer">Hide</Label>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive transition-transform active:scale-90" onClick={() => handleRemoveFocusArea(index)}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label className="text-[9px] font-bold text-muted-foreground capitalize opacity-60">Visual & Label</Label>
                                                <div className="flex gap-2">
                                                    <Select value={area.icon} onValueChange={(val) => handleFocusAreaChange(index, 'icon', val as any)} disabled={isFormDisabled}>
                                                        <SelectTrigger className="w-12 h-9 p-0 justify-center"><FocusAreaIcon type={area.icon}/></SelectTrigger>
                                                        <SelectContent className="rounded-[12px] shadow-dropdown">
                                                            <SelectItem value="Education"><GraduationCap className="h-4 w-4 text-primary"/></SelectItem>
                                                            <SelectItem value="Healthcare"><HeartPulse className="h-4 w-4 text-primary"/></SelectItem>
                                                            <SelectItem value="Relief"><Utensils className="h-4 w-4 text-primary"/></SelectItem>
                                                            <SelectItem value="Other"><HelpCircle className="h-4 w-4 text-primary"/></SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input 
                                                        value={area.title} 
                                                        onChange={(e) => handleFocusAreaChange(index, 'title', e.target.value)} 
                                                        disabled={isFormDisabled}
                                                        className="font-bold h-9 text-primary"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[9px] font-bold text-muted-foreground capitalize opacity-60">Objective Description</Label>
                                                <Textarea 
                                                    value={area.description} 
                                                    onChange={(e) => handleFocusAreaChange(index, 'description', e.target.value)} 
                                                    disabled={isFormDisabled}
                                                    rows={2}
                                                    className="text-xs font-normal min-h-[36px] text-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator className="bg-primary/10" />

                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-primary tracking-tight flex items-center gap-2 capitalize"><ListChecks className="h-4 w-4 opacity-40"/> Procedural Directives</h4>
                                {isEditMode && (
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddPrinciple} className="h-7 text-[10px] font-bold border-primary/20 text-primary active:scale-95 transition-transform shadow-sm"><Plus className="h-3 w-3 mr-1"/> Add Rule</Button>
                                )}
                            </div>
                            <div className="space-y-4">
                                {(displayData.principles || []).map((principle, index) => (
                                    <div key={principle.id || index} className="relative group p-4 border rounded-xl bg-white space-y-3 shadow-sm border-primary/5 hover:border-primary/20 transition-all">
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold text-primary text-[10px] tracking-widest capitalize opacity-40">Standard Directive #{index + 1}</p>
                                            {isEditMode && (
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center space-x-1.5">
                                                        <Checkbox 
                                                            id={`gp-hide-${index}`}
                                                            checked={principle.isHidden} 
                                                            onCheckedChange={(checked) => handleFieldChange('principles', displayData.principles.map((p, i) => i === index ? {...p, isHidden: !!checked} : p))} 
                                                        />
                                                        <Label htmlFor={`gp-hide-${index}`} className="text-[10px] font-bold opacity-60 capitalize cursor-pointer">Hide</Label>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive transition-transform active:scale-90" onClick={() => handleRemovePrinciple(index)}>
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                        {isEditMode ? (
                                            <Textarea 
                                                value={principle.text} 
                                                onChange={(e) => handleFieldChange('principles', displayData.principles.map((p, i) => i === index ? {...p, text: e.target.value} : p))} 
                                                placeholder="Enter Standard Procedural Rule..." 
                                                className="font-normal min-h-[80px] text-sm leading-relaxed text-primary" 
                                            />
                                        ) : (
                                            <div className="flex items-start gap-2">
                                                <p className="text-sm font-normal text-foreground leading-relaxed flex-1">
                                                    {principle.text || <span className="italic opacity-30">Unspecified Directive Text</span>}
                                                </p>
                                                {principle.isHidden && <Badge variant="outline" className="text-[8px] font-black capitalize border-primary/10">Private</Badge>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </SettingsSection>

            </div>
        </div>
    );
}
