
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSession } from '@/hooks/use-session';
import { useInfoSettings } from '@/hooks/use-info-settings';
import { useDonationInfo } from '@/hooks/use-donation-info';
import { defaultDonationInfo } from '@/lib/donation-info-default';
import { useFirestore } from '@/firebase/provider';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import type { DonationInfoData } from '@/lib/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Eye, Edit, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const donationTypeSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required.'),
  description: z.string().min(1, 'Description is required.'),
  usage: z.string().min(1, 'Usage is required.'),
  restrictions: z.string().optional(),
  impact: z.string().optional(),
  keyUse: z.string().optional(),
  application: z.string().optional(),
});

const formSchema = z.object({
  types: z.array(donationTypeSchema),
});

type DonationInfoFormValues = z.infer<typeof formSchema>;

export default function InfoSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { infoSettings, isLoading: isInfoSettingsLoading } = useInfoSettings();
    const { donationInfoData, isLoading: isDonationInfoLoading, forceRefetch } = useDonationInfo();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isDonationInfoPublic, setIsDonationInfoPublic] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<DonationInfoFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { types: [] }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'types'
    });

    useEffect(() => {
        if (infoSettings) {
            setIsDonationInfoPublic(infoSettings.isDonationInfoPublic || false);
        }
    }, [infoSettings]);
    
    useEffect(() => {
        if (donationInfoData) {
            form.reset({ types: donationInfoData.types });
        } else {
            form.reset({ types: defaultDonationInfo });
        }
    }, [donationInfoData, form]);

    const canUpdateSettings = userProfile?.role === 'Admin' || !!userProfile?.permissions?.settings?.info?.update;

    const handleSaveVisibility = async () => {
        if (!firestore || !canUpdateSettings) return;
        setIsSubmitting(true);
        try {
            await setDoc(doc(firestore, 'settings', 'info'), { isDonationInfoPublic }, { merge: true });
            toast({ title: 'Success!', description: 'Visibility settings saved.', variant: 'success' });
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/info', operation: 'write' }));
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleSaveContent = async (data: DonationInfoFormValues) => {
        if (!firestore || !canUpdateSettings) return;
        setIsSubmitting(true);
        try {
            const dataToSave: DonationInfoData = { types: data.types };
            await setDoc(doc(firestore, 'settings', 'donationInfo'), dataToSave);
            toast({ title: 'Success!', description: 'Donation info content saved.', variant: 'success' });
            forceRefetch();
        } catch (error) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/donationInfo', operation: 'write' }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const isLoading = isSessionLoading || isInfoSettingsLoading || isDonationInfoLoading;

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
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Edit className="mr-2 h-4 w-4" /> Edit Content
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle>Edit Donation Info Content</DialogTitle>
                                        <DialogDescription>
                                            Modify the text that appears on the public "Donation Types Explained" page.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex-1 overflow-y-auto pr-4">
                                        <Form {...form}>
                                            <form onSubmit={form.handleSubmit(handleSaveContent)} id="donation-info-form" className="space-y-4">
                                                <Accordion type="single" collapsible className="w-full">
                                                    {fields.map((field, index) => (
                                                        <AccordionItem value={field.id} key={field.id}>
                                                            <AccordionTrigger>{form.watch(`types.${index}.title`)}</AccordionTrigger>
                                                            <AccordionContent className="space-y-4">
                                                                 <FormField control={form.control} name={`types.${index}.title`} render={({ field }) => (
                                                                    <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                                                )}/>
                                                                <FormField control={form.control} name={`types.${index}.description`} render={({ field }) => (
                                                                    <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
                                                                )}/>
                                                                <FormField control={form.control} name={`types.${index}.usage`} render={({ field }) => (
                                                                    <FormItem><FormLabel>Usage</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                                                                )}/>
                                                                 <FormField control={form.control} name={`types.${index}.restrictions`} render={({ field }) => (
                                                                    <FormItem><FormLabel>Restrictions</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                                                                )}/>
                                                                <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}><Trash2 className="mr-2 h-4 w-4"/>Remove</Button>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    ))}
                                                </Accordion>
                                                <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `new_${Date.now()}`, title: 'New Category', description: '', usage: ''})}><Plus className="mr-2 h-4 w-4"/> Add Category</Button>
                                            </form>
                                        </Form>
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
                                        </DialogClose>
                                        <Button type="submit" form="donation-info-form" disabled={isSubmitting}>
                                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                            Save Content
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
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
                    <Button onClick={handleSaveVisibility} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
