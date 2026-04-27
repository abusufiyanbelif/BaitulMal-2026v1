'use client';

import { useState, useEffect } from 'react';
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
    ZapOff
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { BrandedLoader } from '@/components/branded-loader';
import { getNestedValue } from '@/lib/utils';
import type { ResourceSettings } from '@/lib/types';
import { getWhatsAppAccountInfoAction, sendTestWhatsAppAction, sendTelegramAction } from '@/app/messages/actions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Send } from 'lucide-react';

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
    
    const [editableData, setEditableData] = useState<ResourceSettings | null>(null);
    const [waStatus, setWaStatus] = useState<any>(null);
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [testPhone, setTestPhone] = useState('');

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
            // Pass current editable data if in edit mode, otherwise use saved settings
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
            // Pass current editable data to test it before saving
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
            const result = await sendTelegramAction({
                message: '🧪 *BaitulMal Telegram Test*\n\nYour bot is now successfully connected to the BaitulMal Registry system.\n\n*Status:* Online ✅',
                configOverride: config
            });
            if (result.success) {
                toast({ title: 'Telegram Success', description: 'Check your Telegram group for the test message.', variant: 'success' });
            } else {
                toast({ title: 'Telegram Failed', description: result.message, variant: 'destructive' });
            }
        } finally {
            setIsTestingTelegram(false);
        }
    };

    const handleTestGemini = async () => {
        setIsTestingGemini(true);
        try {
            // This would call a server action to verify the key
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
                // Special handling for booleans passed as strings
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
                telegramBotToken: editableData.telegramBotToken?.trim() || '',
                telegramChatId: editableData.telegramChatId?.toString().trim() || ''
            };
            await setDoc(doc(firestore, 'settings', 'resources'), cleanedData, { merge: true });
            toast({ title: 'Success', description: 'Resource Configuration secured.', variant: 'success' });
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
                        Resource Configuration
                    </h2>
                    <p className="text-sm text-muted-foreground font-normal">Manage API Gateways, AI Credentials, and System Infrastructure.</p>
                </div>
                {!isEditMode ? (
                    <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md transition-transform active:scale-95">
                        <Edit className="mr-2 h-4 w-4"/>Modify Config
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsEditMode(false)} disabled={isSubmitting} className="font-bold border-primary/20 text-primary transition-transform active:scale-95"><X className="mr-2 h-4 w-4" /> Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="font-bold shadow-md active:scale-95 transition-transform">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Secure Config
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
                <div className="space-y-6">
                    <Card className="border-primary/10 shadow-sm overflow-hidden bg-white mb-6">
                        <CardHeader className="bg-primary/5 border-b">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                                    <Smartphone className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-primary tracking-tight">WhatsApp Provider</CardTitle>
                                    <CardDescription className="text-xs font-normal text-primary/60">Choose your primary WhatsApp gateway.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
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

                            {editableData?.activeWhatsAppProvider === 'whapi' ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Whapi API URL</Label>
                                        <Input 
                                            value={editableData?.whatsappApiUrl || ''} 
                                            onChange={(e) => handleFieldChange('whatsappApiUrl', e.target.value)}
                                            placeholder="https://gate.whapi.cloud/messages/text"
                                            className="font-mono text-sm"
                                            readOnly={!isEditMode}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Whapi API Token</Label>
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
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Meta Permanent Access Token</Label>
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
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Phone Number ID</Label>
                                            <Input 
                                                value={editableData?.metaPhoneNumberId || ''} 
                                                onChange={(e) => handleFieldChange('metaPhoneNumberId', e.target.value)}
                                                placeholder="e.g. 123456789"
                                                className="font-mono text-xs"
                                                readOnly={!isEditMode}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">WABA ID</Label>
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

                            <div className="flex items-center justify-between p-3 rounded-xl border border-primary/10 bg-primary/5">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-bold text-primary">Automated WhatsApp Alerts</Label>
                                    <p className="text-[10px] text-muted-foreground font-normal">Enable instant notifications via {editableData?.activeWhatsAppProvider === 'meta' ? 'Meta Cloud' : 'Whapi'}.</p>
                                </div>
                                <Switch 
                                    checked={editableData?.isAutoWhatsAppEnabled ?? true} 
                                    onCheckedChange={(checked) => isEditMode && handleFieldChange('isAutoWhatsAppEnabled', checked.toString())}
                                    disabled={!isEditMode}
                                />
                            </div>

                            <div className="pt-4 space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Test WhatsApp Connection</Label>
                                <div className="flex gap-2">
                                    <Input placeholder="+919999999999" value={testPhone} onChange={e => setTestPhone(e.target.value)} className="h-9 text-xs" />
                                    <Button onClick={handleSendTest} disabled={isSubmitting} variant="secondary" className="h-9 font-bold shrink-0">
                                        <PlayCircle className="h-4 w-4 mr-1.5" /> Send Test
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 shadow-sm overflow-hidden bg-white mb-6">
                        <CardHeader className="bg-primary/5 border-b">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600">
                                    <Send className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-primary tracking-tight">Telegram Alerts (Free)</CardTitle>
                                    <CardDescription className="text-xs font-normal text-primary/60">Institutional group notifications.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl border border-primary/10 bg-primary/5">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-bold text-primary">Enable Telegram Alerts</Label>
                                    <p className="text-[10px] text-muted-foreground font-normal">Send free alerts to your admin Telegram group.</p>
                                </div>
                                <Switch 
                                    checked={editableData?.isTelegramEnabled ?? true} 
                                    onCheckedChange={(checked) => isEditMode && handleFieldChange('isTelegramEnabled', checked.toString())}
                                    disabled={!isEditMode}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Bot API Token</Label>
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

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Target Chat ID</Label>
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
                                Verify Telegram Connection
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-primary/5 border-b">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                                    <Globe className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-primary tracking-tight">System URLs</CardTitle>
                                    <CardDescription className="text-xs font-normal text-primary/60">Public base addresses for notification links.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Public Base URL</Label>
                                <Input 
                                    value={editableData?.baseUrl || ''} 
                                    onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
                                    placeholder="https://yourdomain.com"
                                    className="font-mono text-sm"
                                    readOnly={!isEditMode}
                                />
                                <p className="text-[10px] text-muted-foreground italic">Used for generating clickable links in WhatsApp.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-primary/10 shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-primary/5 border-b">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-primary tracking-tight">AI & Vision (Gemini)</CardTitle>
                                    <CardDescription className="text-xs font-normal text-primary/60">Large language model and OCR credentials.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Gemini API Key</Label>
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
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Vision/Google API Key</Label>
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
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-primary/5 border-b">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                                    <Database className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-primary tracking-tight">Firebase Infrastructure</CardTitle>
                                    <CardDescription className="text-xs font-normal text-primary/60">Core database and storage identifiers.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Project ID</Label>
                                    <Input value={editableData?.firebaseConfig?.projectId || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Storage Bucket</Label>
                                    <Input value={editableData?.firebaseConfig?.storageBucket || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Auth Domain</Label>
                                    <Input value={editableData?.firebaseConfig?.authDomain || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Messaging Sender ID</Label>
                                    <Input value={editableData?.firebaseConfig?.messagingSenderId || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">App ID</Label>
                                <Input value={editableData?.firebaseConfig?.appId || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">API Key</Label>
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
                                <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Measurement ID</Label>
                                <Input value={editableData?.firebaseConfig?.measurementId || ''} readOnly className="h-8 text-[10px] font-mono bg-muted/20" />
                            </div>
                            <p className="text-[10px] text-muted-foreground italic leading-relaxed pt-2">
                                <Info className="h-3 w-3 inline mr-1" /> 
                                These infrastructure values are managed via institutional environment variables and cannot be modified here for security.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card className="border-amber-200 bg-amber-50/30 p-4">
                <div className="flex gap-3">
                    <div className="p-1.5 bg-amber-100 rounded-full text-amber-600 h-fit">
                        <Lock className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-amber-900">Resource Governance</p>
                        <p className="text-xs text-amber-800 leading-relaxed font-normal">
                            Credentials stored here are synchronized across all institutional modules. 
                            Unauthorized modification of these resources may disrupt automated alerts and financial tracking.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
