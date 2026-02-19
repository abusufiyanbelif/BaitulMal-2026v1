

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import { useStorage, useFirestore, errorEmitter, FirestorePermissionError, useAuth } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, writeBatch } from 'firebase/firestore';
import Resizer from 'react-image-file-resizer';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, UploadCloud, ShieldAlert, Save, Image as ImageIcon, QrCode, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

interface FormDataType {
    logoUrl: string;
    logoWidth: number | string;
    logoHeight: number | string;
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
}

export default function AppSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const storage = useStorage();
    const firestore = useFirestore();
    const auth = useAuth();
    const { toast } = useToast();
    
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [editableData, setEditableData] = useState<FormDataType | null>(null);

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [qrCodeFile, setQrCodeFile] = useState<File | null>(null);
    
    const canUpdateSettings = userProfile?.role === 'Admin' || !!userProfile?.permissions?.settings?.app?.update;

    const handleFieldChange = useCallback((field: keyof FormDataType, value: string | number) => {
        setEditableData(prev => prev ? { ...prev, [field]: value } : null);
    }, []);

    useEffect(() => {
        if (isEditMode) {
            setEditableData({
                logoUrl: brandingSettings?.logoUrl || '',
                logoWidth: brandingSettings?.logoWidth || '',
                logoHeight: brandingSettings?.logoHeight || '',
                qrCodeUrl: paymentSettings?.qrCodeUrl || '',
                qrWidth: paymentSettings?.qrWidth || '',
                qrHeight: paymentSettings?.qrHeight || '',
                upiId: paymentSettings?.upiId || '',
                paymentMobileNumber: paymentSettings?.paymentMobileNumber || '',
                contactEmail: paymentSettings?.contactEmail || '',
                contactPhone: paymentSettings?.contactPhone || '',
                regNo: paymentSettings?.regNo || '',
                pan: paymentSettings?.pan || '',
                address: paymentSettings?.address || '',
                website: paymentSettings?.website || '',
                copyright: paymentSettings?.copyright || '',
            });
        } else {
            setEditableData(null);
            setLogoFile(null);
            setQrCodeFile(null);
        }
    }, [isEditMode, brandingSettings, paymentSettings]);

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

    const handleSave = async () => {
        if (!firestore || !storage || !canUpdateSettings || !editableData) {
            toast({ title: 'Error', description: 'Cannot save settings.', variant: 'destructive'});
            return;
        }

        if (logoFile || qrCodeFile) {
            if (!auth?.currentUser) {
                toast({
                    title: "Authentication Error",
                    description: "User not authenticated yet. Please wait.",
                    variant: "destructive",
                });
                return;
            }
        }

        setIsSubmitting(true);
        toast({ title: 'Saving settings...', description: 'Please wait.' });

        try {
            const batch = writeBatch(firestore);

            // --- Branding Save Logic ---
            let newLogoUrl = editableData.logoUrl;
            if (logoFile) {
                 const resizedBlob = await new Promise<Blob>((resolve) => {
                    Resizer(logoFile, 800, 800, 'PNG', 100, 0, blob => resolve(blob as Blob), 'blob');
                });
                const filePath = 'settings/logo';
                const fileRef = storageRef(storage, filePath);
                const uploadResult = await uploadBytes(fileRef, resizedBlob);
                newLogoUrl = await getDownloadURL(uploadResult.ref);
            }
            
            const brandingData = { 
                logoUrl: newLogoUrl,
                logoWidth: Number(editableData.logoWidth) || null,
                logoHeight: Number(editableData.logoHeight) || null
            };
            batch.set(doc(firestore, 'settings', 'branding'), brandingData, { merge: true });

            // --- Payment Save Logic ---
            let newQrCodeUrl = editableData.qrCodeUrl;
            if (qrCodeFile) {
                const resizedBlob = await new Promise<Blob>((resolve) => {
                    Resizer(qrCodeFile, 800, 800, 'PNG', 100, 0, blob => resolve(blob as Blob), 'blob');
                });
                const filePath = 'settings/payment_qr';
                const fileRef = storageRef(storage, filePath);
                const uploadResult = await uploadBytes(fileRef, resizedBlob);
                newQrCodeUrl = await getDownloadURL(uploadResult.ref);
            }
            const paymentData = {
                qrCodeUrl: newQrCodeUrl, qrWidth: Number(editableData.qrWidth) || null, qrHeight: Number(editableData.qrHeight) || null,
                upiId: editableData.upiId, paymentMobileNumber: editableData.paymentMobileNumber, contactEmail: editableData.contactEmail,
                contactPhone: editableData.contactPhone, regNo: editableData.regNo, pan: editableData.pan, address: editableData.address,
                website: editableData.website,
                copyright: editableData.copyright,
            };
            batch.set(doc(firestore, 'settings', 'payment'), paymentData, { merge: true });

            await batch.commit();

            toast({ title: 'Success!', description: 'Settings have been updated.', variant: 'success' });
            setIsEditMode(false);
        } catch (error: any) {
            console.error('Settings save failed:', error);
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/branding or settings/payment', operation: 'write' }));
            } else {
                toast({ title: 'Save Failed', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCancel = () => {
        setIsEditMode(false);
    };

    const isLoading = isSessionLoading || isBrandingLoading || isPaymentLoading;
    const isFormDisabled = !isEditMode || isSubmitting;
    
    const renderImagePreview = (previewUrl: string) => {
        const proxiedUrl = previewUrl.startsWith('http') 
            ? `/api/image-proxy?url=${encodeURIComponent(previewUrl)}`
            : previewUrl; // It's a data URL, so use it directly
        return <img src={proxiedUrl} alt="Preview" className="object-contain p-2 h-full w-full" />;
    };

    const logoDisplayUrl = isEditMode ? editableData?.logoUrl : brandingSettings?.logoUrl;
    const qrDisplayUrl = isEditMode ? editableData?.qrCodeUrl : paymentSettings?.qrCodeUrl;
    const displayData = isEditMode && editableData ? editableData : {
        logoUrl: brandingSettings?.logoUrl || '',
        logoWidth: brandingSettings?.logoWidth || '',
        logoHeight: brandingSettings?.logoHeight || '',
        qrCodeUrl: paymentSettings?.qrCodeUrl || '',
        qrWidth: paymentSettings?.qrWidth || '',
        qrHeight: paymentSettings?.qrHeight || '',
        upiId: paymentSettings?.upiId || '',
        paymentMobileNumber: paymentSettings?.paymentMobileNumber || '',
        contactEmail: paymentSettings?.contactEmail || '',
        contactPhone: paymentSettings?.contactPhone || '',
        regNo: paymentSettings?.regNo || '',
        pan: paymentSettings?.pan || '',
        address: paymentSettings?.address || '',
        website: paymentSettings?.website || '',
        copyright: paymentSettings?.copyright || '',
    };

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
                    <CardContent><Skeleton className="h-64 w-full" /></CardContent>
                </Card>
                <Card>
                    <CardHeader><Skeleton className="h-8 w-64" /></CardHeader>
                    <CardContent><Skeleton className="h-64 w-full" /></CardContent>
                </Card>
            </div>
        )
    }

    if (!canUpdateSettings) {
        return (
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                    You do not have permission to modify application settings.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">App Settings</h2>
                {!isEditMode ? (
                    <Button onClick={() => setIsEditMode(true)}><Edit className="mr-2 h-4 w-4"/>Edit Settings</Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Save All
                        </Button>
                    </div>
                )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="animate-fade-in-zoom" style={{ animationDelay: '400ms'}}>
                    <CardHeader>
                        <CardTitle>Branding Settings</CardTitle>
                        <CardDescription>Manage the application logo and watermark.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Application Logo</h3>
                            <p className="text-sm text-muted-foreground">
                                Upload a logo to be displayed in the header and as a watermark.
                            </p>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative w-48 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-secondary/30">
                                    {logoDisplayUrl ? (
                                        renderImagePreview(logoDisplayUrl)
                                    ) : (
                                        <div className="text-muted-foreground text-center p-2">
                                            <ImageIcon className="mx-auto h-8 w-8" />
                                            <p className="text-xs mt-1">No logo uploaded</p>
                                        </div>
                                    )}
                                </div>
                                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="logoWidth">Width (px)</Label>
                                        <Input id="logoWidth" type="number" placeholder="e.g., 48" value={displayData.logoWidth || ''} onChange={(e) => handleFieldChange('logoWidth', e.target.value)} disabled={isFormDisabled} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="logoHeight">Height (px)</Label>
                                        <Input id="logoHeight" type="number" placeholder="e.g., 48" value={displayData.logoHeight || ''} onChange={(e) => handleFieldChange('logoHeight', e.target.value)} disabled={isFormDisabled} />
                                    </div>
                                </div>
                            </div>
                            {isEditMode && (
                                <div className="flex gap-2 justify-center">
                                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('logo-upload')?.click()} disabled={isSubmitting}>
                                        <UploadCloud className="mr-2 h-4 w-4" /> Change Logo
                                    </Button>
                                    {editableData?.logoUrl && (
                                        <Button type="button" variant="destructive" size="sm" onClick={handleRemoveLogo} disabled={isSubmitting}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Remove
                                        </Button>
                                    )}
                                    <Input id="logo-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={(e) => e.target.files && setLogoFile(e.target.files[0])} />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="animate-fade-in-zoom" style={{ animationDelay: '500ms'}}>
                    <CardHeader>
                        <CardTitle>Organization, Payment &amp; Contact Settings</CardTitle>
                        <CardDescription>Configure QR code, UPI, and contact details for receipts and the footer.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="regNo">Registration No.</Label>
                                <Input id="regNo" value={displayData.regNo || ''} onChange={(e) => handleFieldChange('regNo', e.target.value)} placeholder="e.g. Solapur/0000373/2025" disabled={isFormDisabled} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pan">PAN</Label>
                                <Input id="pan" value={displayData.pan || ''} onChange={(e) => handleFieldChange('pan', e.target.value)} placeholder="e.g. AAPAB1213J" disabled={isFormDisabled} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <Textarea id="address" value={displayData.address || ''} onChange={(e) => handleFieldChange('address', e.target.value)} placeholder="Full address of the organization" disabled={isFormDisabled} />
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>UPI QR Code</Label>
                                 <div className="flex flex-col items-center gap-4">
                                    <div className="relative w-48 h-48 border-2 border-dashed rounded-lg flex items-center justify-center bg-secondary/30">
                                        {qrDisplayUrl ? (
                                            renderImagePreview(qrDisplayUrl)
                                        ) : (
                                            <div className="text-muted-foreground text-center p-2">
                                                <QrCode className="mx-auto h-8 w-8" />
                                                <p className="text-xs mt-1">No QR code uploaded</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="qrWidth">Width (px)</Label>
                                            <Input id="qrWidth" type="number" placeholder="e.g., 128" value={displayData.qrWidth || ''} onChange={(e) => handleFieldChange('qrWidth', e.target.value)} disabled={isFormDisabled} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="qrHeight">Height (px)</Label>
                                            <Input id="qrHeight" type="number" placeholder="e.g., 128" value={displayData.qrHeight || ''} onChange={(e) => handleFieldChange('qrHeight', e.target.value)} disabled={isFormDisabled} />
                                        </div>
                                    </div>
                                     {isEditMode && (
                                        <div className="flex gap-2 justify-center">
                                            <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('qr-upload')?.click()} disabled={isSubmitting}>
                                                <UploadCloud className="mr-2 h-4 w-4" /> Change QR
                                            </Button>
                                            {editableData?.qrCodeUrl && (
                                                <Button type="button" variant="destructive" size="sm" onClick={handleRemoveQrCode} disabled={isSubmitting}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                                                </Button>
                                            )}
                                            <Input id="qr-upload" type="file" className="hidden" accept="image/png, image/jpeg" onChange={(e) => e.target.files && setQrCodeFile(e.target.files[0])} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="upiId">UPI ID</Label>
                                <Input id="upiId" value={displayData.upiId || ''} onChange={(e) => handleFieldChange('upiId', e.target.value)} placeholder="e.g. 1234567890@upi" disabled={isFormDisabled} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="paymentMobile">Payment Mobile Number</Label>
                                <Input id="paymentMobile" value={displayData.paymentMobileNumber || ''} onChange={(e) => handleFieldChange('paymentMobileNumber', e.target.value)} placeholder="e.g. 9876543210" disabled={isFormDisabled} />
                            </div>
                            <Separator />
                             <div className="space-y-2">
                                <Label htmlFor="contactEmail">Contact Email</Label>
                                <Input id="contactEmail" value={displayData.contactEmail || ''} onChange={(e) => handleFieldChange('contactEmail', e.target.value)} placeholder="e.g. contact@example.com" disabled={isFormDisabled} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="contactPhone">Contact Phone</Label>
                                <Input id="contactPhone" value={displayData.contactPhone || ''} onChange={(e) => handleFieldChange('contactPhone', e.target.value)} placeholder="e.g. 9876543210" disabled={isFormDisabled} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="website">Website URL</Label>
                                <Input id="website" value={displayData.website || ''} onChange={(e) => handleFieldChange('website', e.target.value)} placeholder="https://example.com" disabled={isFormDisabled} />
                            </div>
                            <Separator/>
                            <div className="space-y-2">
                                <Label htmlFor="copyright">Copyright Text</Label>
                                <Textarea id="copyright" value={displayData.copyright || ''} onChange={(e) => handleFieldChange('copyright', e.target.value as string)} placeholder="e.g. © 2026 Your Org Name. All Rights Reserved." disabled={isFormDisabled} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
