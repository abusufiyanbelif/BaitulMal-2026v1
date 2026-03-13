'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { useGuidance } from '@/hooks/use-guidance';
import { useFirestore } from '@/firebase/provider';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription,
    CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Save, 
    X, 
    Edit, 
    Loader2, 
    Eye, 
    Monitor,
    BookOpen,
    ShieldAlert,
    ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn, getNestedValue } from '@/lib/utils';
import { BrandedLoader } from '@/components/branded-loader';
import Link from 'next/link';
import type { GuidanceData } from '@/lib/types';

export default function GuidanceSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { guidanceData, isLoading: isDataLoading, forceRefetch } = useGuidance();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localGuidance, setLocalGuidance] = useState<GuidanceData | null>(null);

    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.guidance.update', false);

    useEffect(() => {
        if (guidanceData) {
            setLocalGuidance(JSON.parse(JSON.stringify(guidanceData)));
        }
    }, [guidanceData]);

    const handleSave = async () => {
        if (!firestore || !canUpdate || !localGuidance) return;
        setIsSubmitting(true);
        try {
            await setDoc(doc(firestore, 'settings', 'guidance'), localGuidance);
            toast({ title: 'Settings updated', variant: 'success' });
            setIsEditMode(false);
            forceRefetch();
        } catch (error: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/guidance', operation: 'write', requestResourceData: localGuidance }));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSessionLoading || isDataLoading) return <BrandedLoader />;

    if (!canUpdate && !isSessionLoading) {
        return (
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle className="font-bold">Access Denied</AlertTitle>
                <AlertDescription className="font-normal">
                    Missing Permissions To Manage Guidance Configuration.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-primary">Guidance Settings</h2>
                    <p className="text-sm text-muted-foreground font-normal">Configure global visibility and branding for the Guidance module.</p>
                </div>
                {!isEditMode ? (
                    <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md transition-transform active:scale-95">
                        <Edit className="mr-2 h-4 w-4" /> Edit Config
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsEditMode(false)} disabled={isSubmitting} className="font-bold border-primary/20 text-primary">
                            <X className="mr-2 h-4 w-4" /> Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="font-bold shadow-md bg-primary text-white">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                            Save Config
                        </Button>
                    </div>
                )}
            </div>

            {localGuidance && (
                <div className="space-y-6">
                    <Card className="border-primary/10 bg-white shadow-sm overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
                                <Monitor className="h-5 w-5" /> Module Visibility
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-xl border p-4 bg-muted/5 gap-4 transition-all hover:border-primary/20">
                                <div className="space-y-1 flex-1">
                                    <h3 className="font-bold text-primary text-sm tracking-tight">Public Directory Availability</h3>
                                    <p className="text-xs text-muted-foreground font-normal">When enabled, the guidance directory will be accessible to anonymous public visitors.</p>
                                    <Button variant="link" size="sm" asChild className="p-0 h-auto font-bold text-primary mt-2">
                                        <Link href="/info/guidance" target="_blank"><Eye className="mr-2 h-4 w-4" /> View Public Page</Link>
                                    </Button>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="guidance-public-toggle" className="font-bold text-xs opacity-60">Public Access</Label>
                                    <Switch 
                                        id="guidance-public-toggle" 
                                        checked={localGuidance.isPublic} 
                                        onCheckedChange={(val) => setLocalGuidance({...localGuidance, isPublic: val})} 
                                        disabled={!isEditMode || isSubmitting} 
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-primary/10 bg-white shadow-sm overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
                                <BookOpen className="h-5 w-5" /> Directory Branding
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-2">
                                <Label className="font-bold text-xs text-muted-foreground tracking-tighter uppercase">Page Headline</Label>
                                <Input 
                                    value={localGuidance.title} 
                                    onChange={(e) => setLocalGuidance({...localGuidance, title: e.target.value})} 
                                    disabled={!isEditMode}
                                    className="font-bold text-primary h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-xs text-muted-foreground tracking-tighter uppercase">Directory Description</Label>
                                <Textarea 
                                    rows={4} 
                                    value={localGuidance.description} 
                                    onChange={(e) => setLocalGuidance({...localGuidance, description: e.target.value})} 
                                    disabled={!isEditMode}
                                    className="font-normal text-sm leading-relaxed"
                                    placeholder="Brief introduction for visitors..."
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/5 border-t p-4 flex justify-between items-center">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Operation Workspace:</p>
                            <Button variant="ghost" size="sm" asChild className="font-bold text-primary hover:bg-primary/5">
                                <Link href="/guidance">Go To Guidance Hub <ArrowLeft className="ml-2 h-3 w-3 rotate-180" /></Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}