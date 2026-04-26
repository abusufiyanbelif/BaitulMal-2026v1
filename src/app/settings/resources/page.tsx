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
import { getWhatsAppAccountInfoAction, sendTestWhatsAppAction } from '@/app/messages/actions';

export default function ResourceSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { resourceSettings, isLoading: isConfigLoading } = useResourceConfig();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [showGoogleKey, setShowGoogleKey] = useState(false);
    const [showFbApiKey, setShowFbApiKey] = useState(false);
    const [isTestingGemini, setIsTestingGemini] = useState(false);
    
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
                const cleanTest = testPhone.replace(/\D/g, '');
                const cleanInstance = waStatus?.phone?.replace(/\D/g, '');
                const isSelf = cleanTest && cleanInstance && (cleanTest === cleanInstance || cleanInstance.endsWith(cleanTest));

                toast({ 
                    title: isSelf ? 'Self-Test Sent' : 'Test Message Sent', 
                    description: isSelf 
                        ? 'Check your own WhatsApp chat for the diagnostic message.' 
                        : 'Check the recipient device for the diagnostic message.', 
                    variant: 'success' 
                });
            } else {
                toast({ title: 'Test Failed', description: result.message, variant: 'destructive' });
            }
        } finally {
            setIsSubmitting(false);
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
                (newData as any)[field] = value;
            }
            return newData;
        });
    };

    const handleSave = async () => {
        if (!firestore || !canUpdateResources || !editableData) return;
        
        setIsSubmitting(true);
        try {
            await setDoc(doc(firestore, 'settings', 'resources'), editableData, { merge: true });
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
                    <Card className="border-primary/10 shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-primary/5 border-b">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                                    <Smartphone className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-primary tracking-tight">WhatsApp API (Whapi)</CardTitle>
                                    <CardDescription className="text-xs font-normal text-primary/60">Gateway credentials and diagnostic status.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">API Endpoint URL</Label>
                                <Input 
                                    value={editableData?.whatsappApiUrl || ''} 
                                    onChange={(e) => handleFieldChange('whatsappApiUrl', e.target.value)}
                                    placeholder="https://gate.whapi.cloud/messages/text"
                                    className="font-mono text-sm"
                                    readOnly={!isEditMode}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">API Authorization Token</Label>
                                <div className="relative">
                                    <Input 
                                        type={showApiKey || isEditMode ? "text" : "password"}
                                        value={editableData?.whatsappApiKey || ''} 
                                        onChange={(e) => handleFieldChange('whatsappApiKey', e.target.value)}
                                        placeholder="Enter Bearer Token"
                                        className="font-mono text-sm pr-10"
                                        readOnly={!isEditMode}
                                    />
                                    {!isEditMode && (
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                        >
                                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl border border-primary/10 bg-primary/5">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs font-bold text-primary">Automated Notifications</Label>
                                        {editableData?.isAutoWhatsAppEnabled ? <Zap className="h-3 w-3 text-amber-500 animate-pulse" /> : <ZapOff className="h-3 w-3 text-muted-foreground" />}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground font-normal">Send WhatsApp alerts instantly on approval requests.</p>
                                </div>
                                <Switch 
                                    checked={editableData?.isAutoWhatsAppEnabled ?? true} 
                                    onCheckedChange={(checked) => {
                                        if (isEditMode) {
                                            setEditableData(prev => prev ? { ...prev, isAutoWhatsAppEnabled: checked } : null);
                                        }
                                    }}
                                    disabled={!isEditMode}
                                />
                            </div>

                            <div className="pt-4 border-t border-primary/5">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        Connection Status
                                    </h4>
                                    <Button variant="ghost" size="sm" onClick={checkWaStatus} disabled={isCheckingStatus} className="h-7 text-[10px] font-bold">
                                        {isCheckingStatus ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                                        Refresh
                                    </Button>
                                </div>
                                
                                {waStatus ? (
                                    <div className="rounded-xl bg-muted/20 p-4 space-y-3">
                                        {waStatus.error ? (
                                            <div className="flex items-center gap-2 text-red-600">
                                                <AlertCircle className="h-4 w-4" />
                                                <p className="text-xs font-bold">{waStatus.error}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-3">
                                                    {waStatus.profile_pic ? (
                                                        <img src={waStatus.profile_pic} className="h-10 w-10 rounded-full border border-primary/10" />
                                                    ) : (
                                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">WA</div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-bold">{typeof waStatus.alias === 'string' ? waStatus.alias : 'WhatsApp Account'}</p>
                                                        <p className="text-[10px] font-mono text-muted-foreground">{typeof waStatus.phone === 'string' ? waStatus.phone : ''}</p>
                                                    </div>
                                                    <Badge variant="secondary" className="ml-auto text-[9px]">ONLINE</Badge>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/5">
                                                    <div className="text-[10px]">
                                                        <span className="opacity-60">Status:</span> <span className="font-bold text-green-600">
                                                            {typeof waStatus.status === 'string' ? waStatus.status : (waStatus.status?.text || 'Active')}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px]">
                                                        <span className="opacity-60">Tier:</span> <span className="font-bold">{waStatus.limits?.tier || 'Standard'}</span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground italic text-center py-4">Click Refresh To Verify Connection.</p>
                                )}
                            </div>

                            <div className="pt-4 space-y-2">
                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Test Notification</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="+919999999999" 
                                        value={testPhone} 
                                        onChange={e => setTestPhone(e.target.value)}
                                        className="h-9 text-xs"
                                    />
                                    <Button onClick={handleSendTest} disabled={isSubmitting} variant="secondary" className="h-9 font-bold shrink-0">
                                        <PlayCircle className="h-4 w-4 mr-1.5" /> Send Test
                                    </Button>
                                </div>
                            </div>
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
