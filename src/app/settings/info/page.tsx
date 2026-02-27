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

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Eye, Save, Plus, Trash2, Quote, Info, ListChecks, ImageIcon, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const donationTypeSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required.'),
  description: z.string().min(1, 'Description is required.'),
  quranVerse: z.string().optional(),
  quranSource: z.string().optional(),
  purposePointsRaw: z.string().optional(),
  usage: z.string().min(1, 'Usage info is required.'),
  restrictions: z.string().optional(),
  imageHint: z.string().optional(),
  extraContent: z.string().optional(),
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
    const [activeTab, setActiveTab] = useState<string>('');

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
            const mappedTypes = donationInfoData.types.map(t => ({
                ...t,
                purposePointsRaw: t.purposePoints?.join('\n') || ''
            }));
            form.reset({ types: mappedTypes });
            if (mappedTypes.length > 0 && !activeTab) {
                setActiveTab(mappedTypes[0].id);
            }
        } else {
            const mappedDefaults = defaultDonationInfo.map(t => ({
                ...t,
                purposePointsRaw: t.purposePoints?.join('\n') || ''
            }));
            form.reset({ types: mappedDefaults });
            if (mappedDefaults.length > 0 && !activeTab) {
                setActiveTab(mappedDefaults[0].id);
            }
        }
    }, [donationInfoData, form, activeTab]);

    const canUpdateSettings = userProfile?.role === 'Admin' || !!userProfile?.permissions?.settings?.info?.update;

    const handleSaveVisibility = async () => {
        if (!firestore || !canUpdateSettings) return;
        setIsSubmitting(true);
        try {
            await setDoc(doc(firestore, 'settings', 'info'), { isDonationInfoPublic }, { merge: true });
            toast({ title: 'Visibility Updated', description: 'Changes have been saved successfully.', variant: 'success' });
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/info', operation: 'write' }));
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const onContentSubmit = async (data: DonationInfoFormValues) => {
        if (!firestore || !canUpdateSettings) return;
        setIsSubmitting(true);
        try {
            const typesToSave = data.types.map(t => {
                const { purposePointsRaw, ...rest } = t;
                return {
                    ...rest,
                    purposePoints: purposePointsRaw ? purposePointsRaw.split('\n').filter(p => p.trim() !== '') : []
                };
            });

            await setDoc(doc(firestore, 'settings', 'donationInfo'), { types: typesToSave });
            toast({ title: 'Content Saved', description: 'Informational content has been updated.', variant: 'success' });
            forceRefetch();
        } catch (error) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/donationInfo', operation: 'write' }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddType = () => {
        const id = `type_${Date.now()}`;
        append({
            id,
            title: 'New Donation Type',
            description: '',
            usage: '',
            purposePointsRaw: '',
            imageHint: 'charity'
        });
        setActiveTab(id);
    };

    const isLoading = isSessionLoading || isInfoSettingsLoading || isDonationInfoLoading;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Card><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-8 w-64" /></CardHeader><CardContent><Skeleton className="h-[400px] w-full" /></CardContent></Card>
            </div>
        );
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
        <div className="space-y-6">
            <Card className="animate-fade-in-zoom">
                <CardHeader>
                    <CardTitle>Page Visibility</CardTitle>
                    <CardDescription>Control which informational pages are visible to the public.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1.5 flex-1">
                            <h3 className="font-semibold">Donation Types Explained</h3>
                            <p className="text-sm text-muted-foreground">
                                Detailed information about Zakat, Sadaqah, Lillah, and Interest disposal.
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                                <Button variant="outline" size="sm" asChild>
                                    <Link href="/info/donation-info" target="_blank">
                                        <Eye className="mr-2 h-4 w-4" /> Preview Page
                                    </Link>
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
                </CardHeader>
                <CardFooter className="justify-end border-t bg-muted/5 p-4">
                    <Button onClick={handleSaveVisibility} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4"/> Save Visibility
                    </Button>
                </CardFooter>
            </Card>

            <Card className="animate-fade-in-up" style={{ animationDelay: '200ms'}}>
                <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <CardTitle>Content Editor</CardTitle>
                            <CardDescription>Modify the detailed text and structure for each donation category.</CardDescription>
                        </div>
                        <Button onClick={handleAddType} variant="outline" size="sm">
                            <Plus className="mr-2 h-4 w-4" /> Add Type
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 pt-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onContentSubmit)}>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <div className="border-b bg-muted/5 px-4 pt-4 sm:px-0 sm:pt-0">
                                    <ScrollArea className="w-full whitespace-nowrap">
                                        <TabsList className="h-auto w-max bg-transparent p-0">
                                            {fields.map((field, index) => (
                                                <TabsTrigger 
                                                    key={field.id} 
                                                    value={field.id}
                                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 font-bold"
                                                >
                                                    {form.watch(`types.${index}.title`) || 'New Type'}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>

                                {fields.map((field, index) => (
                                    <TabsContent key={field.id} value={field.id} className="p-4 sm:p-6 space-y-6">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-bold text-primary">Editing: {form.watch(`types.${index}.title`)}</h3>
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                size="sm" 
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => {
                                                    remove(index);
                                                    if (fields.length > 1) {
                                                        setActiveTab(fields[index === 0 ? 1 : index - 1].id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4"/> Remove Category
                                            </Button>
                                        </div>

                                        <div className="grid gap-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField control={form.control} name={`types.${index}.title`} render={({ field }) => (
                                                    <FormItem><FormLabel>Heading/Title *</FormLabel><FormControl><Input placeholder="e.g. Zakat (Obligatory Charity)" {...field} /></FormControl><FormMessage /></FormItem>
                                                )}/>
                                                <FormField control={form.control} name={`types.${index}.imageHint`} render={({ field }) => (
                                                    <FormItem><FormLabel>Image Keyword</FormLabel><FormControl><Input placeholder="e.g. charity, money, poor" {...field} /></FormControl><FormDescription>Thematic keyword for the background image.</FormDescription><FormMessage /></FormItem>
                                                )}/>
                                            </div>

                                            <FormField control={form.control} name={`types.${index}.description`} render={({ field }) => (
                                                <FormItem><FormLabel>General Introduction *</FormLabel><FormControl><Textarea rows={3} placeholder="A brief explanation..." {...field} /></FormControl><FormMessage /></FormItem>
                                            )}/>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-lg border p-4 bg-muted/5">
                                                <div className="space-y-4">
                                                    <h4 className="text-sm font-bold flex items-center gap-2"><Quote className="h-4 w-4"/> Religious Reference</h4>
                                                    <FormField control={form.control} name={`types.${index}.quranVerse`} render={({ field }) => (
                                                        <FormItem><FormLabel>Reference Text</FormLabel><FormControl><Textarea rows={2} placeholder="Quranic verse or Hadith..." {...field} /></FormControl></FormItem>
                                                    )}/>
                                                    <FormField control={form.control} name={`types.${index}.quranSource`} render={({ field }) => (
                                                        <FormItem><FormLabel>Source Citation</FormLabel><FormControl><Input placeholder="e.g. Surah Al-Baqarah 2:43" {...field} /></FormControl></FormItem>
                                                    )}/>
                                                </div>
                                                <div className="space-y-4">
                                                    <h4 className="text-sm font-bold flex items-center gap-2"><ListChecks className="h-4 w-4"/> Key Objectives</h4>
                                                    <FormField control={form.control} name={`types.${index}.purposePointsRaw`} render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Points (one per line)</FormLabel>
                                                            <FormControl><Textarea rows={5} placeholder="Enter objectives..." {...field} /></FormControl>
                                                            <FormDescription>Formats into a bulleted list on the public page.</FormDescription>
                                                        </FormItem>
                                                    )}/>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField control={form.control} name={`types.${index}.usage`} render={({ field }) => (
                                                    <FormItem><FormLabel>Permissible Usage *</FormLabel><FormControl><Textarea rows={3} placeholder="How funds are used..." {...field} /></FormControl></FormItem>
                                                )}/>
                                                <FormField control={form.control} name={`types.${index}.restrictions`} render={({ field }) => (
                                                    <FormItem><FormLabel>Restrictions</FormLabel><FormControl><Textarea rows={3} placeholder="What is forbidden..." {...field} /></FormControl></FormItem>
                                                )}/>
                                            </div>
                                            
                                            <FormField control={form.control} name={`types.${index}.extraContent`} render={({ field }) => (
                                                <FormItem><FormLabel>Additional Custom Details</FormLabel><FormControl><Textarea rows={3} placeholder="Other specific rules..." {...field} /></FormControl></FormItem>
                                            )}/>
                                        </div>
                                    </TabsContent>
                                ))}
                            </Tabs>

                            <div className="border-t p-6 bg-muted/5 flex justify-end gap-2">
                                <Button type="submit" disabled={isSubmitting || fields.length === 0} size="lg" className="px-8 shadow-lg transition-all hover:scale-105 active:scale-95">
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Save className="mr-2 h-4 w-4"/> Save Content
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}