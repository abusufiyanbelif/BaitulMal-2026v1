'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { useGuidingPrinciples } from '@/hooks/use-guiding-principles';
import { useStorage, useFirestore, useAuth } from '@/firebase/provider';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, writeBatch } from 'firebase/firestore';
import Resizer from 'react-image-file-resizer';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, UploadCloud, ShieldAlert, Save, Image as ImageIcon, QrCode, Edit, Trash2, X, Building2, MapPin, Hash, ShieldCheck, Globe, Landmark, User, CreditCard, Plus, Shield, ChevronDown, Monitor, FileText, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { cn, getNestedValue } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { GuidingPrinciple } from '@/lib/types';

interface FormDataType {
    name: string;
    logoUrl: string;
    logoWidth: number | string;
    logoHeight: number | string;
    heroTitle: string;
    heroDescription: string;
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
    // Guiding Principles
    isGuidingPrinciplesPublic: boolean;
    gpTitle: string;
    gpDescription: string;
    principles: GuidingPrinciple[];
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
            <div className="flex-1 space-y-1">
                <p className="text-sm font-bold text-primary tracking-tight">{label}</p>
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

export default function AppSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const { guidingPrinciplesData, isLoading: isGPLoading } = useGuidingPrinciples();
    
    const storage = useStorage();
    const firestore = useFirestore();
    const auth = useAuth();
    const { toast } = useToast();
    
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [editableData, setEditableData] = useState<FormDataType | null>(null);

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
    
    const canUpdateSettings = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.update', false);

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
                heroDescription: brandingSettings?.heroDescription || 'Join Baitulmal Samajik Sanstha (Solapur) to make a lasting impact. Your contribution brings hope, changes lives, and empowers our community.',
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
                gpDescription: guidingPrinciplesData?.description || 'To ensure our operations are transparent, fair, and impactful, we adhere to a clear set of guiding principles. These rules govern how we identify beneficiaries, allocate funds, and manage our resources to best serve the community.',
                principles: guidingPrinciplesData?.principles || [],
            });
        } else {
            setEditableData(null);
            setLogoFile(null);
            setQrCodeFile(null);
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
        const newPrinciples = [
            ...editableData.principles,
            { id: `gp_${Date.now()}`, text: '', isHidden: false }
        ];
        handleFieldChange('principles', newPrinciples);
    };

    const handleRemovePrinciple = (index: number) => {
        if (!editableData) return;
        const newPrinciples = editableData.principles.filter((_, i) => i !== index);
        handleFieldChange('principles', newPrinciples);
    };

    const handlePrincipleChange = (index: number, field: 'text' | 'isHidden', value: any) => {
        if (!editableData) return;
        const newPrinciples = [...editableData.principles];
        newPrinciples[index] = { ...newPrinciples[index], [field]: value };
        handleFieldChange('principles', newPrinciples);
    };

    const handleSave = async () => {
        if (!firestore || !storage || !canUpdateSettings || !editableData) return;

        if (logoFile || qrCodeFile) {
            if (!auth?.currentUser) {
                toast({ title: "Authentication Error", description: "User not authenticated yet.", variant: "destructive" });
                return;
            }
        }

        setIsSubmitting(true);
        toast({ title: 'Saving Settings...', description: 'Please wait.' });

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

            // Guiding Principles Save
            const gpData = {
                isGuidingPrinciplesPublic: editableData.isGuidingPrinciplesPublic,
                title: editableData.gpTitle,
                description: editableData.gpDescription,
                principles: editableData.principles.filter(p => p.text?.trim() !== ''),
            };
            batch.set(doc(firestore, 'settings', 'guidingPrinciples'), gpData);

            await batch.commit();
            toast({ title: 'Success!', description: 'All settings have been updated.', variant: 'success' });
            setIsEditMode(false);
        } catch (error: any) {
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings documents', operation: 'write' }));
            } else {
                toast({ title: 'Save Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCancel = () => setIsEditMode(false);

    const isLoading = isSessionLoading || isBrandingLoading || isPaymentLoading || isGPLoading;
    const isFormDisabled = !isEditMode || isSubmitting;

    const displayData = isEditMode && editableData ? editableData : {
        name: brandingSettings?.name || '',
        logoUrl: brandingSettings?.logoUrl || '',
        logoWidth: brandingSettings?.logoWidth || 40,
        logoHeight: brandingSettings?.logoHeight || 40,
        heroTitle: brandingSettings?.heroTitle || 'Empowering Our Community, One Act Of Kindness At A Time.',
        heroDescription: brandingSettings?.heroDescription || 'Join Baitulmal Samajik Sanstha (Solapur) to make a lasting impact.',
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
    };

    const isDirty = useMemo(() => {
        if (!isEditMode || !editableData) return false;
        const initialData: FormDataType = {
            name: brandingSettings?.name || '',
            logoUrl: brandingSettings?.logoUrl || '',
            logoWidth: brandingSettings?.logoWidth || 40,
            logoHeight: brandingSettings?.logoHeight || 40,
            heroTitle: brandingSettings?.heroTitle || 'Empowering Our Community, One Act Of Kindness At A Time.',
            heroDescription: brandingSettings?.heroDescription || 'Join Baitulmal Samajik Sanstha (Solapur) to make a lasting impact.',
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
        };
        return JSON.stringify(initialData) !== JSON.stringify(editableData) || !!logoFile || !!qrCodeFile;
    }, [isEditMode, editableData, brandingSettings, paymentSettings, guidingPrinciplesData, logoFile, qrCodeFile]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-6 text-primary font-normal pb-20">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">App Settings</h2>
                    <p className="text-sm text-muted-foreground">Manage organization profile, branding, and core standards.</p>
                </div>
                {!isEditMode ? (
                    <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md">
                        <Edit className="mr-2 h-4 w-4"/>Edit Settings
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCancel} disabled={isSubmitting} className="font-bold border-primary/20 text-primary">
                            <X className="mr-2 h-4 w-4" /> Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting || !isDirty} className="font-bold shadow-md">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save All Changes
                        </Button>
                    </div>
                )}
            </div>

            <div className="space-y-6 animate-fade-in-up">
                
                {/* Homepage Hero Section */}
                <SettingsSection 
                    title="Homepage Hero Section" 
                    description="Configure the primary welcome message on the landing page."
                    icon={Monitor}
                    defaultOpen={true}
                >
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="heroTitle" className="font-bold text-xs text-muted-foreground tracking-tighter">Hero Title</Label>
                            {isEditMode ? (
                                <Input 
                                    id="heroTitle"
                                    value={displayData.heroTitle}
                                    onChange={(e) => handleFieldChange('heroTitle', e.target.value)}
                                    placeholder="Enter primary heading..."
                                    className="font-bold"
                                />
                            ) : (
                                <p className="text-lg font-bold text-primary">{displayData.heroTitle}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="heroDescription" className="font-bold text-xs text-muted-foreground tracking-tighter">Hero Description</Label>
                            {isEditMode ? (
                                <Textarea 
                                    id="heroDescription"
                                    rows={3}
                                    value={displayData.heroDescription}
                                    onChange={(e) => handleFieldChange('heroDescription', e.target.value)}
                                    placeholder="Enter subtext description..."
                                    className="font-normal"
                                />
                            ) : (
                                <p className="text-sm font-normal text-muted-foreground leading-relaxed">{displayData.heroDescription}</p>
                            )}
                        </div>
                    </div>
                </SettingsSection>

                {/* Organization Details Section */}
                <SettingsSection 
                    title="Organization Details" 
                    description="Public profile, visual identity, and contact information."
                    icon={Building2}
                    defaultOpen={true}
                >
                    <div className="space-y-8">
                        {/* Identity & Registration Heading */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Identity & Registration</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                <VerifiableItem 
                                    icon={Building2} 
                                    label="Organization Name" 
                                    value={displayData.name} 
                                    isEditing={isEditMode}
                                    id="org-name"
                                    onChange={(v) => handleFieldChange('name', v)}
                                    placeholder="Full legal name"
                                />
                                <VerifiableItem 
                                    icon={MapPin} 
                                    label="Address" 
                                    value={displayData.address} 
                                    isEditing={isEditMode}
                                    id="org-address"
                                    onChange={(v) => handleFieldChange('address', v)}
                                    placeholder="Official registered address"
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
                                    placeholder="Permanent account number"
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

                        {/* Visual Identity Sub-section */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Visual Branding</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="flex flex-col items-center gap-4 bg-muted/5 rounded-xl p-4 border border-dashed">
                                    <div className="relative w-full max-w-[200px] aspect-[2/1] rounded-lg flex items-center justify-center bg-white overflow-hidden shadow-inner">
                                        {(isEditMode ? editableData?.logoUrl : brandingSettings?.logoUrl) ? (
                                            <img src={(isEditMode ? editableData?.logoUrl : brandingSettings?.logoUrl)!.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent((isEditMode ? editableData?.logoUrl : brandingSettings?.logoUrl)!)}` : (isEditMode ? editableData?.logoUrl : brandingSettings?.logoUrl)} alt="Logo" className="object-contain p-2 h-full w-full" />
                                        ) : (
                                            <div className="text-muted-foreground text-center p-2 font-normal">
                                                <ImageIcon className="mx-auto h-8 w-8 opacity-20" />
                                                <p className="text-[10px] mt-1 font-bold tracking-tighter">No Logo</p>
                                            </div>
                                        )}
                                    </div>
                                    {isEditMode && (
                                        <div className="flex gap-2">
                                            <label htmlFor="logo-upload" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-[10px] font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent h-7 px-3 cursor-pointer">
                                                <UploadCloud className="mr-1.5 h-3.5 w-3.5" /> Upload Logo
                                            </label>
                                            <Input id="logo-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => e.target.files && setLogoFile(e.target.files[0])} />
                                            {editableData?.logoUrl && (
                                                <Button type="button" variant="destructive" size="icon" className="h-7 w-7" onClick={handleRemoveLogo} disabled={isSubmitting}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="logoWidth" className="font-bold text-[10px] text-muted-foreground">Logo Width (px)</Label>
                                        <Input id="logoWidth" type="number" value={displayData.logoWidth || 40} onChange={(e) => handleFieldChange('logoWidth', e.target.value)} disabled={isFormDisabled} className="h-9 font-bold" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="logoHeight" className="font-bold text-[10px] text-muted-foreground">Logo Height (px)</Label>
                                        <Input id="logoHeight" type="number" value={displayData.logoHeight || 40} onChange={(e) => handleFieldChange('logoHeight', e.target.value)} disabled={isFormDisabled} className="h-9 font-bold" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Communications Sub-section */}
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Communications & Footer</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div className="space-y-1">
                                    <Label htmlFor="contactEmail" className="font-bold text-sm text-primary">Support Email</Label>
                                    <Input id="contactEmail" value={displayData.contactEmail} onChange={(e) => handleFieldChange('contactEmail', e.target.value)} disabled={isFormDisabled} placeholder="support@org.com" className="h-9 font-normal"/>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="contactPhone" className="font-bold text-sm text-primary">Contact Phone</Label>
                                    <Input id="contactPhone" value={displayData.contactPhone} onChange={(e) => handleFieldChange('contactPhone', e.target.value)} disabled={isFormDisabled} placeholder="+91 00000 00000" className="h-9 font-normal"/>
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <Label htmlFor="copyright" className="font-bold text-sm text-primary">Footer Copyright Text</Label>
                                    <Input id="copyright" value={displayData.copyright} onChange={(e) => handleFieldChange('copyright', e.target.value)} disabled={isFormDisabled} placeholder="© 2026 Your Organization. All Rights Reserved." className="h-9 font-normal"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                {/* Bank Transfer & UPI Details Section */}
                <SettingsSection 
                    title="Bank Transfer & UPI Details" 
                    description="Configure all donation channels including bank and digital payment info."
                    icon={CreditCard}
                >
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">Traditional Bank Transfer</h4>
                                <VerifiableItem 
                                    icon={User} 
                                    label="Account Holder Name" 
                                    value={displayData.bankAccountName} 
                                    isEditing={isEditMode}
                                    id="bank-name"
                                    onChange={(v) => handleFieldChange('bankAccountName', v)}
                                    placeholder="Full name as per bank"
                                />
                                <VerifiableItem 
                                    icon={CreditCard} 
                                    label="Account Number" 
                                    value={displayData.bankAccountNumber} 
                                    isEditing={isEditMode}
                                    id="bank-acc"
                                    onChange={(v) => handleFieldChange('bankAccountNumber', v)}
                                    placeholder="Bank account number"
                                />
                                <VerifiableItem 
                                    icon={Landmark} 
                                    label="IFSC Code" 
                                    value={displayData.bankIfsc} 
                                    isEditing={isEditMode}
                                    id="bank-ifsc"
                                    onChange={(v) => handleFieldChange('bankIfsc', v)}
                                    placeholder="11-digit IFSC code"
                                />
                            </div>
                            
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b pb-2">UPI & QR Setup</h4>
                                <VerifiableItem 
                                    icon={QrCode} 
                                    label="UPI ID" 
                                    value={displayData.upiId} 
                                    isEditing={isEditMode}
                                    id="upi-id"
                                    onChange={(v) => handleFieldChange('upiId', v)}
                                    placeholder="e.g. 1234567890@upi"
                                />
                                <VerifiableItem 
                                    icon={Smartphone} 
                                    label="Payment Mobile No." 
                                    value={displayData.paymentMobileNumber} 
                                    isEditing={isEditMode}
                                    id="pay-mob"
                                    onChange={(v) => handleFieldChange('paymentMobileNumber', v)}
                                    placeholder="e.g. 9876543210"
                                />
                                
                                <div className="pt-4 flex flex-col items-center gap-4 bg-secondary/30 rounded-xl p-4 border border-primary/10">
                                    <div className="relative w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-white overflow-hidden">
                                        {(isEditMode ? editableData?.qrCodeUrl : paymentSettings?.qrCodeUrl) ? (
                                            <img src={(isEditMode ? editableData?.qrCodeUrl : paymentSettings?.qrCodeUrl)!.startsWith('http') ? `/api/image-proxy?url=${encodeURIComponent((isEditMode ? editableData?.qrCodeUrl : paymentSettings?.qrCodeUrl)!)}` : (isEditMode ? editableData?.qrCodeUrl : paymentSettings?.qrCodeUrl)} alt="QR" className="object-contain p-2 h-full w-full" />
                                        ) : (
                                            <div className="text-muted-foreground text-center p-2 font-normal">
                                                <QrCode className="mx-auto h-8 w-8 opacity-20" />
                                                <p className="text-[10px] mt-1 font-bold tracking-tighter">No QR Code</p>
                                            </div>
                                        )}
                                    </div>
                                    {isEditMode && (
                                        <div className="w-full flex justify-center gap-2">
                                            <label htmlFor="qr-upload" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent h-8 px-3 cursor-pointer">
                                                <UploadCloud className="mr-2 h-4 w-4" /> Change QR
                                            </label>
                                            <Input id="qr-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => e.target.files && setQrCodeFile(e.target.files[0])} />
                                            {editableData?.qrCodeUrl && (
                                                <Button type="button" variant="destructive" size="sm" className="font-bold h-8" onClick={handleRemoveQrCode} disabled={isSubmitting}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    <div className="w-full grid grid-cols-2 gap-4 mt-2">
                                        <div className="space-y-1">
                                            <Label htmlFor="qrWidth" className="font-bold text-[10px] text-muted-foreground">Width (px)</Label>
                                            <Input id="qrWidth" type="number" value={displayData.qrWidth || 120} onChange={(e) => handleFieldChange('qrWidth', e.target.value)} disabled={isFormDisabled} className="h-8 font-bold" placeholder="Default: 120"/>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="qrHeight" className="font-bold text-[10px] text-muted-foreground">Height (px)</Label>
                                            <Input id="qrHeight" type="number" value={displayData.qrHeight || 120} onChange={(e) => handleFieldChange('qrHeight', e.target.value)} disabled={isFormDisabled} className="h-8 font-bold" placeholder="Default: 120"/>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                {/* Guiding Principles Manager Section */}
                <SettingsSection 
                    title="Guiding Principles Manager" 
                    description="Define core values and operational standards displayed on the about page."
                    icon={Shield}
                >
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 bg-muted/5 gap-4 transition-all hover:border-primary/20">
                            <div className="space-y-1 flex-1">
                                <h3 className="font-bold text-primary text-sm tracking-tight">Our Guiding Principles Section</h3>
                                <p className="text-xs text-muted-foreground font-normal">Controls the visibility of this section on the public about page.</p>
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
                                <Label className="font-bold text-[10px] text-muted-foreground">Commitment Section Description</Label>
                                <Textarea 
                                    rows={3} 
                                    value={displayData.gpDescription} 
                                    onChange={(e) => handleFieldChange('gpDescription', e.target.value)} 
                                    disabled={isFormDisabled} 
                                    placeholder="Brief introduction about your principles..." 
                                    className="font-normal text-sm leading-relaxed"
                                />
                            </div>
                        </div>

                        <Separator className="bg-primary/10" />

                        <div className="space-y-6">
                            {(displayData.principles || []).map((principle, index) => (
                                <div key={principle.id || index} className="relative group p-4 border rounded-md bg-muted/5 space-y-3 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-primary text-xs tracking-tight">Principle #{index + 1}</p>
                                        {isEditMode && (
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center space-x-1.5">
                                                    <Checkbox 
                                                        id={`gp-hide-${index}`}
                                                        checked={principle.isHidden} 
                                                        onCheckedChange={(checked) => handlePrincipleChange(index, 'isHidden', !!checked)} 
                                                    />
                                                    <Label htmlFor={`gp-hide-${index}`} className="text-[10px] font-bold opacity-60 cursor-pointer">Hide</Label>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemovePrinciple(index)}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                    {isEditMode ? (
                                        <Textarea 
                                            value={principle.text} 
                                            onChange={(e) => handlePrincipleChange(index, 'text', e.target.value)} 
                                            placeholder="Enter organizational principle..." 
                                            className="font-normal min-h-[80px] text-sm" 
                                        />
                                    ) : (
                                        <p className="text-sm font-normal text-foreground leading-relaxed">
                                            {principle.text || <span className="italic opacity-50">Empty Principle Text</span>}
                                            {principle.isHidden && <Badge variant="outline" className="ml-2 text-[8px]">Hidden</Badge>}
                                        </p>
                                    )}
                                </div>
                            ))}
                            {(displayData.principles || []).length === 0 && !isEditMode && <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-md italic font-normal">No Principles Defined Yet.</p>}
                        </div>

                        {isEditMode && (
                            <div className="flex justify-center pt-2">
                                <Button type="button" variant="outline" size="sm" onClick={handleAddPrinciple} className="font-bold border-primary/20 text-primary">
                                    <Plus className="h-4 w-4 mr-2"/> Add New Principle
                                </Button>
                            </div>
                        )}
                    </div>
                </SettingsSection>

            </div>
        </div>
    );
}