
'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { useInfoSettings } from '@/hooks/use-info-settings';
import { useFirestore } from '@/firebase/provider';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Eye, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';

export default function InfoSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { infoSettings, isLoading: isInfoSettingsLoading } = useInfoSettings();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isDonationInfoPublic, setIsDonationInfoPublic] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (infoSettings) {
            setIsDonationInfoPublic(infoSettings.isDonationInfoPublic || false);
        }
    }, [infoSettings]);

    const canUpdateSettings = userProfile?.role === 'Admin' || !!userProfile?.permissions?.settings?.info?.update;

    const handleSave = async () => {
        if (!firestore || !canUpdateSettings) {
            toast({ title: 'Error', description: 'Cannot save settings.', variant: 'destructive'});
            return;
        }

        setIsSubmitting(true);
        toast({ title: 'Saving settings...', description: 'Please wait.' });

        try {
            const infoDocRef = doc(firestore, 'settings', 'info');
            await setDoc(infoDocRef, { isDonationInfoPublic }, { merge: true });
            toast({ title: 'Success!', description: 'Info page settings have been updated.', variant: 'success' });
        } catch (error: any) {
            console.error('Info settings save failed:', error);
             errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/info', operation: 'write' }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const isLoading = isSessionLoading || isInfoSettingsLoading;

    if (isLoading) {
        return <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
    }

    if (!canUpdateSettings) {
        return (
            <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                    You do not have permission to modify these settings.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <Card className="animate-fade-in-zoom">
            <CardHeader>
                <CardTitle>Manage Informational Pages</CardTitle>
                <CardDescription>Control the visibility and content of public info pages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4">
                    <div className="space-y-1.5 flex-1">
                        <h3 className="font-semibold">Donation Types Explained</h3>
                        <p className="text-sm text-muted-foreground">
                            This page provides visitors with detailed information about different Islamic donation categories.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                             <Button variant="outline" size="sm" asChild>
                                <Link href="/info/donation-info" target="_blank">
                                    <Eye className="mr-2 h-4 w-4" /> Preview Page
                                </Link>
                            </Button>
                             <Button variant="outline" size="sm" disabled>
                                <Edit className="mr-2 h-4 w-4" /> Edit Content (Coming Soon)
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-4 sm:pt-0">
                        <Label htmlFor="donation-info-public">Public</Label>
                        <Switch
                            id="donation-info-public"
                            checked={isDonationInfoPublic}
                            onCheckedChange={setIsDonationInfoPublic}
                            disabled={isSubmitting}
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
