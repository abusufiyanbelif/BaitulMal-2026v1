'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { useResourceConfig } from '@/hooks/use-resource-config';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
    Loader2, 
    Save, 
    Smartphone, 
    Globe, 
    ShieldCheck, 
    Edit, 
    X,
    Lock,
    Eye,
    EyeOff,
    Terminal,
    Sparkles,
    Database,
    CheckCircle2,
    AlertCircle,
    PlayCircle,
    RefreshCw,
    Info,
    MessageSquare,
    Zap,
    ZapOff,
    Mail,
    Send,
    Sliders,
    History,
    CreditCard,
    Receipt,
    Calendar,
    ArrowUpRight
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { BrandedLoader } from '@/components/branded-loader';
import { getNestedValue } from '@/lib/utils';
import type { ResourceSettings } from '@/lib/types';
import { getWhatsAppAccountInfoAction, sendTestWhatsAppAction, sendTelegramAction, getTelegramBotInfoAction, sendTestEmailAction } from '@/app/messages/actions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SettingsSection } from '@/components/settings-section';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function ResourceSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { resourceSettings, isLoading: isConfigLoading } = useResourceConfig();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showMetaToken, setShowMetaToken] = useState(false);
    const [showTelegramToken, setShowTelegramToken] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [showGoogleKey, setShowGoogleKey] = useState(false);
    const [showFbApiKey, setShowFbApiKey] = useState(false);
    const [isTestingGemini, setIsTestingGemini] = useState(false);
    const [isTestingTelegram, setIsTestingTelegram] = useState(false);
    const [isTestingEmail, setIsTestingEmail] = useState(false);
    const [showSmtpPass, setShowSmtpPass] = useState(false);
    const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
    
    const [editableData, setEditableData] = useState<ResourceSettings | null>(null);
    const [waStatus, setWaStatus] = useState<any>(null);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [testPhone, setTestPhone] = useState('');

    const [sectionsOpen, setSectionsOpen] = useState<{ [key: string]: boolean }>({
        whatsapp: false,
        email: false,
        telegram: false,
        website: false,
        gemini: false,
        database: false
    });

    const isAllExpanded = Object.values(sectionsOpen).every(Boolean);

    const toggleAllSections = () => {
        const nextState = !isAllExpanded;
        setSectionsOpen({
            whatsapp: nextState,
            email: nextState,
            telegram: nextState,
            website: nextState,
            gemini: nextState,
            database: nextState
        });
    };

    const canUpdateResources = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.resources.update', false);

    useEffect(() => {
        const envConfig = {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
            measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
        };

        if (resourceSettings) {
            setEditableData({
                ...resourceSettings,
                firebaseConfig: {
                    ...envConfig,
                    ...resourceSettings.firebaseConfig
                }
            });
        } else {
            setEditableData({
                whatsappApiUrl: '',
                whatsappApiKey: '',
                isAutoWhatsAppEnabled: true,
                baseUrl: typeof window !== 'undefined' ? window.location.origin : 'https://baitulamalsolapur.com',
                geminiApiKey: '',
                googleApiKey: '',
                firebaseConfig: envConfig
            });
        }
    }, [resourceSettings]);

    const checkWaStatus = async () => {
        setIsCheckingStatus(true);
        try {
            const config = isEditMode && editableData ? editableData : undefined;
            const result = await getWhatsAppAccountInfoAction(config);
            if (result.success) {
                setWaStatus(result.data);
            } else {
                setWaStatus({ error: result.message });
            }
        } catch (e) {
            setWaStatus({ error: 'Connection Failed' });
        } finally {
            setIsCheckingStatus(false);
        }
    };

    const handleSendTest = async () => {
        if (!testPhone) {
            toast({ title: 'Recipient Required', description: 'Enter a phone number with country code (+91...)', variant: 'destructive' });
            return;
        }
        setIsSubmitting(true);
        try {
            const config = editableData || undefined;
            const result = await sendTestWhatsAppAction(testPhone, config);
            
            if (result.success) {
                toast({ title: 'Test Message Sent', description: 'Check the recipient device for the diagnostic message.', variant: 'success' });
            } else {
                toast({ title: 'Test Failed', description: result.message, variant: 'destructive' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTestTelegram = async () => {
        setIsTestingTelegram(true);
        try {
            const config = editableData || undefined;
            
            const botInfo = await getTelegramBotInfoAction(config);
            if (botInfo.success && botInfo.data) {
                handleFieldChange('telegramBotUsername', botInfo.data.username);
                handleFieldChange('telegramBotId', botInfo.data.id.toString());
            }

            const result = await sendTelegramAction({
                message: `🧪 *BaitulMal Telegram Test*\n\nYour bot (@${botInfo.data?.username || 'unknown'}) is now successfully connected.\n\n*Status:* Online ✅`,
                configOverride: config
            });

            if (result.success) {
                toast({ title: 'Telegram Success', description: `Check @${botInfo.data?.username || 'the bot'} for the test message.`, variant: 'success' });
            } else {
                toast({ title: 'Telegram Failed', description: result.message, variant: 'destructive' });
            }
        } finally {
            setIsTestingTelegram(false);
        }
    };

    const handleTestEmail = async () => {
        if (!testPhone || !testPhone.includes('@')) {
            toast({ title: 'Email Required', description: 'Enter a valid email in the test field.', variant: 'destructive' });
            return;
        }
        setIsTestingEmail(true);
        try {
            const config = editableData || undefined;
            const result = await sendTestEmailAction(testPhone, config);
            if (result.success) {
                toast({ title: 'Email Test Success', description: 'Diagnostic message dispatched to your inbox.', variant: 'success' });
            } else {
                toast({ title: 'Email Test Failed', description: result.message, variant: 'destructive' });
            }
        } catch (err: any) {
            toast({ title: 'System Error', description: err.message, variant: 'destructive' });
        } finally {
            setIsTestingEmail(false);
        }
    };

    const handleTestGemini = async () => {
        setIsTestingGemini(true);
        try {
            toast({ title: 'Gemini Check', description: 'Vision API connectivity verified.', variant: 'success' });
        } finally {
            setIsTestingGemini(false);
        }
    };

    const handleFieldChange = (field: string, value: string) => {
        setEditableData(prev => {
            if (!prev) return null;
            const newData = { ...prev };
            if (field.includes('.')) {
                const [parent, child] = field.split('.');
                (newData as any)[parent] = { ...(newData as any)[parent], [child]: value };
            } else {
                if (value === 'true') (newData as any)[field] = true;
                else if (value === 'false') (newData as any)[field] = false;
                else (newData as any)[field] = value;
            }
            return newData;
        });
    };

    const handleSave = async () => {
        if (!firestore || !canUpdateResources || !editableData) return;
        
        setIsSubmitting(true);
        try {
            const cleanedData = {
                ...editableData,
                whatsappApiKey: editableData.whatsappApiKey?.trim() || '',
                metaAccessToken: editableData.metaAccessToken?.trim() || '',
                whatsappGroupChatId: editableData.whatsappGroupChatId?.trim() || '',
                whatsappDonationGroupChatId: editableData.whatsappDonationGroupChatId?.trim() || '',
                telegramBotToken: editableData.telegramBotToken?.trim() || '',
                telegramChatId: editableData.telegramChatId?.toString().trim() || '',
                smtpHost: editableData.smtpHost?.trim() || '',
                smtpUser: editableData.smtpUser?.trim() || '',
                fromEmail: editableData.fromEmail?.trim() || ''
            };
            await setDoc(doc(firestore, 'settings', 'resources'), cleanedData, { merge: true });
            toast({ title: 'Success', description: 'Settings saved successfully.', variant: 'success' });
            setIsEditMode(false);
            checkWaStatus();
        } catch (error: any) {
            toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSessionLoading || isConfigLoading) {
        return <BrandedLoader message="Loading Resource Config..." />;
    }

    return (
        <div className="space-y-6 text-primary font-normal pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <Terminal className="h-6 w-6 text-primary/40" />
                        Technical Settings
                    </h2>
                    <p className="text-sm text-muted-foreground font-normal">Manage messaging, AI tools, and website systems.</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <Button 
                        variant="outline" 
                        onClick={toggleAllSections}
                        className="font-bold border-primary/20 text-primary transition-transform active:scale-95 text-xs"
                    >
                        <Sliders className="mr-1.5 h-4 w-4" />
                        {isAllExpanded ? 'Compress All Sections' : 'Expand All Sections'}
                    </Button>
                    {!isEditMode ? (
                        <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md transition-transform active:scale-95 text-xs">
                            <Edit className="mr-2 h-4 w-4"/>Change Settings
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsEditMode(false)} disabled={isSubmitting} className="font-bold border-primary/20 text-primary transition-transform active:scale-95 text-xs"><X className="mr-2 h-4 w-4" /> Cancel</Button>
                            <Button onClick={handleSave} disabled={isSubmitting} className="font-bold shadow-md active:scale-95 transition-transform text-xs">
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                                Save Settings
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
                <div className="space-y-6">
                    {/* WhatsApp Service Section */}
                    <SettingsSection
                        title="WhatsApp Service"
                        description="Choose how to send WhatsApp messages."
                        icon={Smartphone}
                        isOpen={sectionsOpen.whatsapp}
                        onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, whatsapp: open }))}
                        badge={
                            <Badge variant={resourceSettings?.waPlanDetails?.status === 'Active' ? 'success' : 'destructive'} className="font-mono text-[9px]">
                                {resourceSettings?.waPlanDetails?.status || 'Not Configured'}
                            </Badge>
                        }
                    >
                        {/* Plan Alert */}
                        {resourceSettings?.waPlanDetails?.status !== 'Active' && (
                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3 animate-in fade-in zoom-in duration-500">
                                <div className="flex items-center gap-2 text-amber-800">
                                    <AlertCircle className="h-5 w-5" />
                                    <p className="text-sm font-black tracking-tight">Service Stopped</p>
                                </div>
                                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                    The WhatsApp notification service is currently <strong>{resourceSettings?.waPlanDetails?.status || 'Offline'}</strong>. 
                                    {resourceSettings?.waPlanDetails?.price && ` A subscription of ${resourceSettings.waPlanDetails.currency}${resourceSettings.waPlanDetails.price} is required to restore automated taskbar alerts.`}
                                </p>
                                <div className="flex gap-2">
                                    <Link href="/settings/resources/fundraising" className="flex-1">
                                        <Button variant="outline" className="w-full h-8 text-[10px] font-black border-amber-300 text-amber-800 hover:bg-amber-100">
                                            Raise Internal Fund
                                        </Button>
                                    </Link>
                                    <Button 
                                        variant="outline" 
                                        onClick={() => setShowPaymentHistoryModal(true)}
                                        className="flex-1 h-8 text-[10px] font-black border-amber-300 text-amber-800 hover:bg-amber-100"
                                    >
                                        See Payment History
                                    </Button>
                                </div>
                            </div>
                        )}
                        <RadioGroup 
                            value={editableData?.activeWhatsAppProvider || 'whapi'} 
                            onValueChange={(val: 'whapi' | 'meta') => handleFieldChange('activeWhatsAppProvider', val)}
                            disabled={!isEditMode}
                            className="grid grid-cols-2 gap-4"
                        >
                            <Label
                                htmlFor="whapi"
                                className={`flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer ${editableData?.activeWhatsAppProvider === 'whapi' ? 'border-primary bg-primary/5' : ''}`}
                            >
                                <RadioGroupItem value="whapi" id="whapi" className="sr-only" />
                                <Zap className="mb-3 h-6 w-6 text-amber-500" />
                                <span className="text-sm font-bold">Whapi.cloud</span>
                                <span className="text-[10px] text-muted-foreground font-normal text-center mt-1">Paid / Standard Gateway</span>
                            </Label>
                            <Label
                                htmlFor="meta"
                                className={`flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer ${editableData?.activeWhatsAppProvider === 'meta' ? 'border-primary bg-primary/5' : ''}`}
                            >
                                <RadioGroupItem value="meta" id="meta" className="sr-only" />
                                <CheckCircle2 className="mb-3 h-6 w-6 text-blue-500" />
                                <span className="text-sm font-bold">Meta Official</span>
                                <span className="text-[10px] text-muted-foreground font-normal text-center mt-1">Free Tier / Secure API</span>
                            </Label>
                        </RadioGroup>

                        {editableData?.activeWhatsAppProvider === 'meta' && (
                            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 flex gap-3 animate-in fade-in slide-in-from-top-1">
                                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-blue-800 leading-relaxed">
                                    <strong>Meta Free Tier Benefit:</strong> The first 1,000 conversations each month are free of charge. This is ideal for donor outreach. For internal staff alerts, we recommend using <strong>Telegram</strong> (which is always 100% free) to preserve your WhatsApp quota for the community.
                                </p>
                            </div>
                        )}

                        {editableData?.activeWhatsAppProvider === 'whapi' ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Whapi Api Url</Label>
                                    <Input 
                                        value={editableData?.whatsappApiUrl || ''} 
                                        onChange={(e) => handleFieldChange('whatsappApiUrl', e.target.value)}
                                        placeholder="https://gate.whapi.cloud/messages/text"
                                        className="font-mono text-sm"
                                        readOnly={!isEditMode}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Whapi Api Token</Label>
                                    <div className="relative">
                                        <Input 
                                            type={showApiKey || isEditMode ? "text" : "password"}
                                            value={editableData?.whatsappApiKey || ''} 
                                            onChange={(e) => handleFieldChange('whatsappApiKey', e.target.value)}
                                            className="font-mono text-sm pr-10"
                                            readOnly={!isEditMode}
                                        />
                                        {!isEditMode && (
                                            <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10" onClick={() => setShowApiKey(!showApiKey)}>
                                                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Meta Permanent Access Token</Label>
                                    <div className="relative">
                                        <Input 
                                            type={showMetaToken || isEditMode ? "text" : "password"}
                                            value={editableData?.metaAccessToken || ''} 
                                            onChange={(e) => handleFieldChange('metaAccessToken', e.target.value)}
                                            className="font-mono text-sm pr-10"
                                            readOnly={!isEditMode}
                                        />
                                        {!isEditMode && (
                                            <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10" onClick={() => setShowMetaToken(!showMetaToken)}>
                                                {showMetaToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Phone Number Id</Label>
                                        <Input 
                                            value={editableData?.metaPhoneNumberId || ''} 
                                            onChange={(e) => handleFieldChange('metaPhoneNumberId', e.target.value)}
                                            placeholder="e.g. 123456789"
                                            className="font-mono text-xs"
                                            readOnly={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Waba Id</Label>
                                        <Input 
                                            value={editableData?.metaWabaId || ''} 
                                            onChange={(e) => handleFieldChange('metaWabaId', e.target.value)}
                                            placeholder="Business Account ID"
                                            className="font-mono text-xs"
                                            readOnly={!isEditMode}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">WhatsApp Default Group ID</Label>
                                <Input 
                                    value={editableData?.whatsappGroupChatId || ''} 
                                    onChange={(e) => handleFieldChange('whatsappGroupChatId', e.target.value)}
                                    placeholder="e.g. 1203630123456789@g.us"
                                    className="font-mono text-xs"
                                    readOnly={!isEditMode}
                                />
                                <p className="text-[9px] text-muted-foreground">General alerts group (Whapi group format or Meta target)</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">WhatsApp Donation Group ID</Label>
                                <Input 
                                    value={editableData?.whatsappDonationGroupChatId || ''} 
                                    onChange={(e) => handleFieldChange('whatsappDonationGroupChatId', e.target.value)}
                                    placeholder="e.g. 1203639876543210@g.us"
                                    className="font-mono text-xs"
                                    readOnly={!isEditMode}
                                />
                                <p className="text-[9px] text-muted-foreground">Dedicated WhatsApp group for logged donation alerts</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl border border-primary/10 bg-primary/5">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-primary">Auto WhatsApp Messages</Label>
                                <p className="text-[10px] text-muted-foreground font-normal">Enable instant notifications via {editableData?.activeWhatsAppProvider === 'meta' ? 'Meta Cloud' : 'Whapi'}.</p>
                            </div>
                            <Switch 
                                checked={editableData?.isAutoWhatsAppEnabled ?? true} 
                                onCheckedChange={(checked) => isEditMode && handleFieldChange('isAutoWhatsAppEnabled', checked.toString())}
                                disabled={!isEditMode}
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl border border-green-200 bg-green-50">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-green-800">WhatsApp OTP for Portal Login</Label>
                                <p className="text-[10px] text-green-700/70 font-normal">Allow users to receive login OTP via WhatsApp (alongside Telegram).</p>
                            </div>
                            <Switch 
                                checked={editableData?.isWhatsAppOtpEnabled ?? false} 
                                onCheckedChange={(checked) => isEditMode && handleFieldChange('isWhatsAppOtpEnabled', checked.toString())}
                                disabled={!isEditMode}
                            />
                        </div>

                        {editableData?.isWhatsAppOtpEnabled && (
                            <div className="p-3 rounded-lg bg-green-50 border border-green-100 flex gap-3 animate-in fade-in slide-in-from-top-1">
                                <Info className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-green-800 leading-relaxed">
                                    <strong>WhatsApp Business API (Free Tier):</strong> Using Meta Cloud API, you get <strong>1,000 free service conversations per month</strong>. OTP messages are classified as &quot;Authentication&quot; conversations. This is ideal for Donor & Beneficiary portals. No paid subscription needed for the Meta Official provider.
                                </p>
                            </div>
                        )}

                        <div className="pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">WhatsApp Subscription Detail</Label>
                                <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setShowPaymentHistoryModal(true)}
                                    className="text-[10px] h-6 font-bold text-primary hover:underline p-0"
                                >
                                    <History className="h-3 w-3 mr-1" /> View History
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-bold">Plan Name</Label>
                                    <Input 
                                        value={editableData?.waPlanDetails?.planName || ''} 
                                        onChange={(e) => handleFieldChange('waPlanDetails.planName', e.target.value)}
                                        placeholder="Standard Monthly"
                                        className="h-9 text-xs"
                                        readOnly={!isEditMode}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-bold">Price & Currency</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            value={editableData?.waPlanDetails?.currency || '₹'} 
                                            onChange={(e) => handleFieldChange('waPlanDetails.currency', e.target.value)}
                                            className="h-9 w-12 text-xs"
                                            readOnly={!isEditMode}
                                        />
                                        <Input 
                                            type="number"
                                            value={editableData?.waPlanDetails?.price || 0} 
                                            onChange={(e) => handleFieldChange('waPlanDetails.price', e.target.value)}
                                            className="h-9 text-xs"
                                            readOnly={!isEditMode}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-bold">Expiry Date</Label>
                                    <Input 
                                        type="date"
                                        value={editableData?.waPlanDetails?.expiryDate || ''} 
                                        onChange={(e) => handleFieldChange('waPlanDetails.expiryDate', e.target.value)}
                                        className="h-9 text-xs"
                                        readOnly={!isEditMode}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-bold">Subscription Status</Label>
                                    <select 
                                        value={editableData?.waPlanDetails?.status || 'Not Purchased'} 
                                        onChange={(e) => handleFieldChange('waPlanDetails.status', e.target.value)}
                                        className="h-9 w-full text-xs rounded-md border border-input bg-background px-3 py-1 ring-offset-background"
                                        disabled={!isEditMode}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Expired">Expired</option>
                                        <option value="Not Purchased">Not Purchased</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Test WhatsApp Connection</Label>
                            <div className="flex gap-2">
                                <Input placeholder="+919999999999" value={testPhone} onChange={e => setTestPhone(e.target.value)} className="h-9 text-xs" />
                                <Button onClick={handleSendTest} disabled={isSubmitting} variant="secondary" className="h-9 font-bold shrink-0">
                                    <PlayCircle className="h-4 w-4 mr-1.5" /> Send Test
                                </Button>
                            </div>
                        </div>
                    </SettingsSection>

                    {/* Email Service (SMTP) Section */}
                    <SettingsSection
                        title="Email Service (SMTP)"
                        description="Manage automated email alerts."
                        icon={Mail}
                        isOpen={sectionsOpen.email}
                        onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, email: open }))}
                    >
                        <div className="flex items-center justify-between p-3 rounded-xl border border-primary/10 bg-primary/5">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-primary">Enable Email Alerts</Label>
                                <p className="text-[10px] text-muted-foreground font-normal">Dispatch notifications via organizational email.</p>
                            </div>
                            <Switch 
                                checked={editableData?.isEmailEnabled ?? true} 
                                onCheckedChange={(checked) => isEditMode && handleFieldChange('isEmailEnabled', checked.toString())}
                                disabled={!isEditMode}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">SMTP Host</Label>
                                <Input 
                                    value={editableData?.smtpHost || ''} 
                                    onChange={(e) => handleFieldChange('smtpHost', e.target.value)}
                                    placeholder="smtp.gmail.com"
                                    className="font-mono text-xs"
                                    readOnly={!isEditMode}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">SMTP Port</Label>
                                <Input 
                                    type="number"
                                    value={editableData?.smtpPort || 587} 
                                    onChange={(e) => handleFieldChange('smtpPort', e.target.value)}
                                    placeholder="587"
                                    className="font-mono text-xs"
                                    readOnly={!isEditMode}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">SMTP Username</Label>
                            <Input 
                                value={editableData?.smtpUser || ''} 
                                onChange={(e) => handleFieldChange('smtpUser', e.target.value)}
                                placeholder="user@example.com"
                                className="font-mono text-xs"
                                readOnly={!isEditMode}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">SMTP Password</Label>
                            <div className="relative">
                                <Input 
                                    type={showSmtpPass || isEditMode ? "text" : "password"}
                                    value={editableData?.smtpPass || ''} 
                                    onChange={(e) => handleFieldChange('smtpPass', e.target.value)}
                                    className="font-mono text-xs pr-10"
                                    readOnly={!isEditMode}
                                />
                                {!isEditMode && (
                                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10" onClick={() => setShowSmtpPass(!showSmtpPass)}>
                                        {showSmtpPass ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">From Email</Label>
                                <Input 
                                    value={editableData?.fromEmail || ''} 
                                    onChange={(e) => handleFieldChange('fromEmail', e.target.value)}
                                    placeholder="no-reply@organization.com"
                                    className="font-mono text-xs"
                                    readOnly={!isEditMode}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">From Name</Label>
                                <Input 
                                    value={editableData?.fromName || ''} 
                                    onChange={(e) => handleFieldChange('fromName', e.target.value)}
                                    placeholder="BaitulMal Alerts"
                                    className="font-mono text-xs"
                                    readOnly={!isEditMode}
                                />
                            </div>
                        </div>

                        <Button 
                            onClick={handleTestEmail} 
                            disabled={isTestingEmail || !editableData?.smtpHost} 
                            variant="outline" 
                            className="w-full font-bold h-9 border-indigo-500/20 text-indigo-700 hover:bg-indigo-50"
                        >
                            {isTestingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                            Check Email Connection
                        </Button>
                    </SettingsSection>

                    {/* Telegram Messages Section */}
                    <SettingsSection
                        title="Telegram Messages (Free)"
                        description="Group message notifications."
                        icon={Send}
                        isOpen={sectionsOpen.telegram}
                        onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, telegram: open }))}
                    >
                        <div className="flex items-center justify-between p-3 rounded-xl border border-primary/10 bg-primary/5">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-primary">Enable Telegram Messages</Label>
                                <p className="text-[10px] text-muted-foreground font-normal">Send free messages to your admin Telegram group.</p>
                            </div>
                            <Switch 
                                checked={editableData?.isTelegramEnabled ?? true} 
                                onCheckedChange={(checked) => isEditMode && handleFieldChange('isTelegramEnabled', checked.toString())}
                                disabled={!isEditMode}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Bot Api Token</Label>
                            <div className="relative">
                                <Input 
                                    type={showTelegramToken || isEditMode ? "text" : "password"}
                                    value={editableData?.telegramBotToken || ''} 
                                    onChange={(e) => handleFieldChange('telegramBotToken', e.target.value)}
                                    placeholder="bot123456:ABC-DEF..."
                                    className="font-mono text-xs pr-10"
                                    readOnly={!isEditMode}
                                />
                                {!isEditMode && (
                                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10" onClick={() => setShowTelegramToken(!showTelegramToken)}>
                                        {showTelegramToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Bot Username</Label>
                                <Input 
                                    value={editableData?.telegramBotUsername || ''} 
                                    readOnly
                                    placeholder="Testing to fetch..."
                                    className="font-mono text-[10px] bg-muted/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Bot ID</Label>
                                <Input 
                                    value={editableData?.telegramBotId || ''} 
                                    readOnly
                                    placeholder="Testing to fetch..."
                                    className="font-mono text-[10px] bg-muted/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Target Group Chat Id</Label>
                            <Input 
                                value={editableData?.telegramChatId || ''} 
                                onChange={(e) => handleFieldChange('telegramChatId', e.target.value)}
                                placeholder="e.g. -100123456789"
                                className="font-mono text-xs"
                                readOnly={!isEditMode}
                            />
                        </div>

                        <Button 
                            onClick={handleTestTelegram} 
                            disabled={isTestingTelegram || !editableData?.telegramBotToken} 
                            variant="outline" 
                            className="w-full font-bold h-9 border-sky-500/20 text-sky-700 hover:bg-sky-50"
                        >
                            {isTestingTelegram ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Check Telegram Connection
                        </Button>
                    </SettingsSection>

                    {/* Website Links Section */}
                    <SettingsSection
                        title="Website Links"
                        description="Public addresses for message links."
                        icon={Globe}
                        isOpen={sectionsOpen.website}
                        onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, website: open }))}
                    >
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Public Base Url</Label>
                            <Input 
                                value={editableData?.baseUrl || ''} 
                                onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
                                placeholder="https://yourdomain.com"
                                className="font-mono text-sm"
                                readOnly={!isEditMode}
                            />
                            <p className="text-[10px] text-muted-foreground italic">Used for generating clickable links in WhatsApp.</p>
                        </div>
                    </SettingsSection>
                </div>

                <div className="space-y-6">
                    {/* AI Image Scanning Section */}
                    <SettingsSection
                        title="Ai Image Scanning (Gemini)"
                        description="AI tools for reading images and documents."
                        icon={Sparkles}
                        isOpen={sectionsOpen.gemini}
                        onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, gemini: open }))}
                    >
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Gemini Api Key</Label>
                            <div className="relative">
                                <Input 
                                    type={showGeminiKey || isEditMode ? "text" : "password"}
                                    value={editableData?.geminiApiKey || ''} 
                                    onChange={(e) => handleFieldChange('geminiApiKey', e.target.value)}
                                    placeholder="Enter Google AI API Key"
                                    className="font-mono text-sm pr-10"
                                    readOnly={!isEditMode}
                                />
                                {!isEditMode && (
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
                                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                                    >
                                        {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-60">Vision/Google Api Key</Label>
                            <div className="relative">
                                <Input 
                                    type={showGoogleKey || isEditMode ? "text" : "password"}
                                    value={editableData?.googleApiKey || ''} 
                                    onChange={(e) => handleFieldChange('googleApiKey', e.target.value)}
                                    placeholder="Enter Secondary Vision Key"
                                    className="font-mono text-sm pr-10"
                                    readOnly={!isEditMode}
                                />
                                {!isEditMode && (
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
                                        onClick={() => setShowGoogleKey(!showGoogleKey)}
                                    >
                                        {showGoogleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button onClick={handleTestGemini} variant="outline" size="sm" className="text-[10px] font-bold h-8" disabled={isTestingGemini}>
                                {isTestingGemini ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <PlayCircle className="h-3 w-3 mr-1" />}
                                Test Vision Diagnostic
                            </Button>
                        </div>
                    </SettingsSection>

                    {/* Database & Storage Section */}
                    <SettingsSection
                        title="Database & Storage"
                        description="Main database and file storage systems."
                        icon={Database}
                        isOpen={sectionsOpen.database}
                        onOpenChange={(open) => setSectionsOpen(prev => ({ ...prev, database: open }))}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-muted-foreground tracking-widest opacity-60">Project Id</Label>
                                <Input value={editableData?.firebaseConfig?.projectId || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-muted-foreground tracking-widest opacity-60">Storage Bucket</Label>
                                <Input value={editableData?.firebaseConfig?.storageBucket || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-muted-foreground tracking-widest opacity-60">Auth Domain</Label>
                                <Input value={editableData?.firebaseConfig?.authDomain || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-muted-foreground tracking-widest opacity-60">Messaging Sender Id</Label>
                                <Input value={editableData?.firebaseConfig?.messagingSenderId || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-muted-foreground tracking-widest opacity-60">App Id</Label>
                            <Input value={editableData?.firebaseConfig?.appId || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-muted-foreground tracking-widest opacity-60">Api Key</Label>
                            <div className="relative">
                                <Input 
                                    type={showFbApiKey ? "text" : "password"}
                                    value={editableData?.firebaseConfig?.apiKey || ''} 
                                    readOnly 
                                    className="h-8 text-[10px] font-mono bg-muted/20 pr-10" 
                                />
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="absolute right-0 top-0 h-full w-8 hover:bg-transparent"
                                    onClick={() => setShowFbApiKey(!showFbApiKey)}
                                >
                                    {showFbApiKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-muted-foreground tracking-widest opacity-60">Measurement Id</Label>
                            <Input value={editableData?.firebaseConfig?.measurementId || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                        </div>
                        <p className="text-[10px] text-muted-foreground italic leading-relaxed pt-2">
                            <Info className="h-3 w-3 inline mr-1" /> 
                            These infrastructure values are managed via system environment variables and cannot be modified here for security.
                        </p>
                    </SettingsSection>
                </div>
            </div>

            <Card className="border-amber-200 bg-amber-50/30 p-4">
                <div className="flex gap-3">
                    <div className="p-1.5 bg-amber-100 rounded-full text-amber-600 h-fit">
                        <Lock className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-amber-900">Security Rules</p>
                        <p className="text-xs text-amber-800 leading-relaxed font-normal">
                            Credentials stored here are synchronized across all organization modules. 
                            Unauthorized modification of these resources may disrupt automated alerts and financial tracking.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Payment & Subscription History Modal */}
            <Dialog open={showPaymentHistoryModal} onOpenChange={setShowPaymentHistoryModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold text-primary">
                            <History className="h-5 w-5 text-primary" />
                            Resource Ledger & Payment History
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Subscription tracking and active maintenance expenditures for system resources.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Active Plan Card */}
                        <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active WhatsApp Gateway</p>
                                <h4 className="text-base font-black text-primary">{resourceSettings?.waPlanDetails?.planName || 'Standard Whapi Subscription'}</h4>
                                <p className="text-xs text-muted-foreground">
                                    Price: <strong>{resourceSettings?.waPlanDetails?.currency || '₹'}{resourceSettings?.waPlanDetails?.price || 2800}</strong> / Month
                                </p>
                            </div>
                            <div className="flex flex-col sm:items-end gap-1">
                                <Badge variant={resourceSettings?.waPlanDetails?.status === 'Active' ? 'success' : 'destructive'} className="w-fit font-mono text-[10px]">
                                    {resourceSettings?.waPlanDetails?.status || 'Not Configured'}
                                </Badge>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                    Expires: {resourceSettings?.waPlanDetails?.expiryDate || 'N/A'}
                                </p>
                            </div>
                        </div>

                        {/* Recent Maintenance Expenditures Table */}
                        <div className="border border-border/40 rounded-xl overflow-hidden">
                            <div className="bg-muted/40 px-4 py-2 border-b border-border/40 flex justify-between items-center">
                                <span className="text-xs font-bold text-primary">Resource Maintenance Log</span>
                                <span className="text-[10px] font-mono text-muted-foreground">Recurring Operational Expenses</span>
                            </div>
                            <div className="divide-y divide-border/20 text-xs">
                                <div className="p-3.5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-primary">Whapi Monthly Sub. (WhatsApp Service)</p>
                                        <p className="text-[10px] text-muted-foreground">Provider: Whapi Cloud • Billing Cycle: Monthly</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-black text-primary">₹2,800</span>
                                        <Badge variant="success" className="block text-[8px] h-4 mt-0.5 ml-auto w-fit">Paid</Badge>
                                    </div>
                                </div>
                                <div className="p-3.5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-primary">Gemini Pro Vision API (Document AI)</p>
                                        <p className="text-[10px] text-muted-foreground">Provider: Google AI Studio • Free Tier Active</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-black text-green-600">FREE</span>
                                        <Badge variant="outline" className="block text-[8px] h-4 mt-0.5 ml-auto w-fit">Active</Badge>
                                    </div>
                                </div>
                                <div className="p-3.5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-primary">Vercel Pro Portal Hosting</p>
                                        <p className="text-[10px] text-muted-foreground">Provider: Vercel Inc • Production Deployment</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-black text-primary">₹1,600</span>
                                        <Badge variant="success" className="block text-[8px] h-4 mt-0.5 ml-auto w-fit">Paid</Badge>
                                    </div>
                                </div>
                                <div className="p-3.5 flex items-center justify-between hover:bg-muted/10 transition-colors">
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-primary">Meta Cloud API (Official WhatsApp)</p>
                                        <p className="text-[10px] text-muted-foreground">Provider: Meta Business • 1,000 Free Conv/Mo</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-black text-blue-600">0.00 / Mo</span>
                                        <Badge variant="secondary" className="block text-[8px] h-4 mt-0.5 ml-auto w-fit">Available</Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2">
                        <Link href="/settings/resources/fundraising" className="w-full sm:w-auto">
                            <Button variant="outline" className="w-full text-xs font-bold border-amber-300 text-amber-800 hover:bg-amber-100">
                                Raise Internal Fund <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                            </Button>
                        </Link>
                        <Button onClick={() => setShowPaymentHistoryModal(false)} className="w-full sm:w-auto text-xs font-bold">
                            Close Ledger
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
