
'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { useSession } from '@/hooks/use-session';
import { useInfoSettings } from '@/hooks/use-info-settings';
import { useDonationInfo } from '@/hooks/use-donation-info';
import { defaultDonationInfo } from '@/lib/donation-info-default';
import { useFirestore, useStorage, useAuth } from '@/firebase/provider';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Resizer from 'react-image-file-resizer';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Eye, Save, Plus, Trash2, Quote, ListChecks, HelpCircle, UploadCloud, Image as ImageIcon, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const useCaseSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  isAllowed: z.boolean().default(true),
});

const qaItemSchema = z.object({
  id: z.string(),
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
  reference: z.string().optional(),
});

const donationTypeSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required.'),
  description: z.string().min(1, 'Description is required.'),
  quranVerse: z.string().optional(),
  quranSource: z.string().optional(),
  purposePointsRaw: z.string().optional(),
  useCasesHeading: z.string().optional(),
  useCases: z.array(useCaseSchema),
  qaItems: z.array(qaItemSchema),
  usage: z.string().min(1, 'Usage info is required.'),
  restrictions: z.string().optional(),
  imageUrl: z.string().optional(),
  imageFile: z.any().optional(),
});

const formSchema = z.object({
  types: z.array(donationTypeSchema),
});

type DonationInfoFormValues = z.infer<typeof formSchema>;

function UseCaseEditor({ control, typeIndex }: { control: any, typeIndex: number }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `types.${typeIndex}.useCases`
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2"><HelpCircle className="h-4 w-4"/> Practical Use Cases</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `uc_${Date.now()}`, title: '', description: '', isAllowed: true })}>
                    <Plus className="h-3 w-3 mr-1"/> Add Case
                </Button>
            </div>
            <div className="grid gap-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="relative p-4 border rounded-md bg-muted/10 space-y-3">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                        <div className="flex items-center gap-4">
                            <FormField control={control} name={`types.${typeIndex}.useCases.${index}.isAllowed`} render={({ field }) => (
                                <FormItem className="flex flex-col items-center space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )}/>
                            <FormField control={control} name={`types.${typeIndex}.useCases.${index}.title`} render={({ field }) => (
                                <FormItem className="flex-1"><FormLabel className="text-xs">Case Title</FormLabel><FormControl><Input placeholder="e.g. Ration Kit" {...field} /></FormControl></FormItem>
                            )}/>
                        </div>
                        <FormField control={control} name={`types.${typeIndex}.useCases.${index}.description`} render={({ field }) => (
                            <FormItem><FormLabel className="text-xs">Rule/Detail</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )}/>
                    </div>
                ))}
            </div>
        </div>
    );
}

function QAEditor({ control, typeIndex }: { control: any, typeIndex: number }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `types.${typeIndex}.qaItems`
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2"><BookOpen className="h-4 w-4"/> Questions & Answers</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `qa_${Date.now()}`, question: '', answer: '', reference: '' })}>
                    <Plus className="h-3 w-3 mr-1"/> Add Q&A
                </Button>
            </div>
            <div className="grid gap-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="relative p-4 border rounded-md bg-muted/10 space-y-3">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7 text-destructive" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4"/>
                        </Button>
                        <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.question`} render={({ field }) => (
                            <FormItem><FormLabel className="text-xs">Question</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                        )}/>
                        <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.answer`} render={({ field }) => (
                            <FormItem><FormLabel className="text-xs">Answer</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                        )}/>
                        <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.reference`} render={({ field }) => (
                            <FormItem><FormLabel className="text-xs">Reference (Quran/Hadith/Scholar)</FormLabel><FormControl><Input placeholder="e.g. Surah 2:43 or Fatawa" {...field} /></FormControl></FormItem>
                        )}/>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function InfoSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { infoSettings, isLoading: isInfoSettingsLoading } = useInfoSettings();
    const { donationInfoData, isLoading: isDonationInfoLoading, forceRefetch } = useDonationInfo();
    const firestore = useFirestore();
    const storage = useStorage();
    const auth = useAuth();
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

    const { isDirty } = form.formState;

    useEffect(() => {
        if (infoSettings) {
            setIsDonationInfoPublic(infoSettings.isDonationInfoPublic || false);
        }
    }, [infoSettings]);
    
    useEffect(() => {
        if (!isDonationInfoLoading && donationInfoData) {
            const dataToLoad = (donationInfoData.types && donationInfoData.types.length > 0) ? donationInfoData.types : defaultDonationInfo;
            const mappedTypes = dataToLoad.map(t => ({
                ...t,
                purposePointsRaw: (t as any).purposePoints?.join('\n') || '',
                useCases: t.useCases || [],
                qaItems: t.qaItems || [],
                imageUrl: t.imageUrl || ''
            }));
            
            form.reset({ types: mappedTypes });
            
            if (mappedTypes.length > 0 && !activeTab) {
                setActiveTab(mappedTypes[0].id);
            }
        }
    }, [donationInfoData, isDonationInfoLoading, form, activeTab]);

    const canUpdateSettings = userProfile?.role === 'Admin' || !!userProfile?.permissions?.settings?.info?.update;

    const handleSaveVisibility = async () => {
        if (!firestore || !canUpdateSettings) return;
        setIsSubmitting(true);
        try {
            await setDoc(doc(firestore, 'settings', 'info'), { isDonationInfoPublic }, { merge: true });
            toast({ title: 'Visibility Updated', description: 'Changes saved.', variant: 'success' });
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/info', operation: 'write' }));
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const onContentSubmit = async (data: DonationInfoFormValues) => {
        if (!firestore || !storage || !canUpdateSettings) return;
        
        const hasFilesToUpload = data.types.some(t => t.imageFile && t.imageFile.length > 0);
        if (hasFilesToUpload && !auth?.currentUser) {
            toast({ title: "Authentication Error", description: "User not authenticated.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const typesToSave = await Promise.all(data.types.map(async (t) => {
                const { purposePointsRaw, imageFile, ...rest } = t;
                let imageUrl = rest.imageUrl || '';
                
                if (imageFile && imageFile.length > 0) {
                    const file = imageFile[0];
                    const resizedBlob = await new Promise<Blob>((resolve) => {
                        (Resizer as any).imageFileResizer(file, 800, 600, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob');
                    });
                    const filePath = `settings/donation_types/${t.id}.png`;
                    const fileRef = storageRef(storage, filePath);
                    await uploadBytes(fileRef, resizedBlob);
                    imageUrl = await getDownloadURL(fileRef);
                }

                return {
                    ...rest,
                    imageUrl,
                    purposePoints: purposePointsRaw ? purposePointsRaw.split('\n').filter(p => p.trim() !== '') : [],
                };
            }));

            await setDoc(doc(firestore, 'settings', 'donationInfo'), { types: typesToSave });
            toast({ title: 'Content Saved', description: 'Informational content updated.', variant: 'success' });
            forceRefetch();
            form.reset(data); 
        } catch (error) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/donationInfo', operation: 'write' }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddType = () => {
        const id = `type_${Date.now()}`;
        append({ id, title: 'New Category', description: '', usage: '', purposePointsRaw: '', useCases: [], qaItems: [], imageUrl: '' });
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
                <AlertDescription>You do not have permission to modify these settings.</AlertDescription>
            </Alert>
        );
    }
    
    const isVisibilityDirty = isDonationInfoPublic !== (infoSettings?.isDonationInfoPublic || false);

    return (
        <div className="space-y-6">
            <Card className="animate-fade-in-zoom">
                <CardHeader>
                    <CardTitle>Page Visibility</CardTitle>
                    <CardDescription>Control public informational pages.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1.5 flex-1">
                            <h3 className="font-semibold">Donation Types Explained</h3>
                            <p className="text-sm text-muted-foreground">Detailed information guide for donors.</p>
                            <Button variant="outline" size="sm" asChild className="mt-2">
                                <Link href="/info/donation-info" target="_blank">
                                    <Eye className="mr-2 h-4 w-4" /> Preview Page
                                </Link>
                            </Button>
                        </div>
                        <div className="flex items-center space-x-2 pt-4 sm:pt-0">
                            <Label htmlFor="donation-info-public">Public</Label>
                            <Switch id="donation-info-public" checked={isDonationInfoPublic} onCheckedChange={setIsDonationInfoPublic} disabled={isSubmitting} />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="justify-end border-t bg-muted/5 p-4">
                    <Button onClick={handleSaveVisibility} disabled={isSubmitting || !isVisibilityDirty}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4"/> Save Visibility
                    </Button>
                </CardFooter>
            </Card>

            <Card className="animate-fade-in-up">
                <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <CardTitle>Content Manager</CardTitle>
                            <CardDescription>Manage rich content, use cases, and Q&A for donation types.</CardDescription>
                        </div>
                        <Button onClick={handleAddType} variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Type</Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0 pt-0">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onContentSubmit)}>
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <div className="border-b bg-muted/5 px-4 pt-4 sm:px-6 sm:pt-0">
                                    <ScrollArea className="w-full whitespace-nowrap">
                                        <TabsList className="h-auto w-max bg-transparent p-0">
                                            {fields.map((field, index) => {
                                                const typeId = form.getValues(`types.${index}.id`);
                                                return (
                                                    <TabsTrigger key={field.id} value={typeId} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 font-bold">
                                                        {form.watch(`types.${index}.title`) || 'New Type'}
                                                    </TabsTrigger>
                                                );
                                            })}
                                        </TabsList>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>

                                {fields.map((field, index) => {
                                    const typeId = form.getValues(`types.${index}.id`);
                                    return (
                                        <TabsContent key={field.id} value={typeId} className="p-4 sm:p-6 space-y-8">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-lg font-bold text-primary">Editing: {form.watch(`types.${index}.title`)}</h3>
                                                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => { remove(index); if (fields.length > 1) setActiveTab(form.getValues('types.0.id')); }}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            </div>

                                            <div className="grid gap-8">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                                                    <div className="md:col-span-2 space-y-4">
                                                        <FormField control={form.control} name={`types.${index}.title`} render={({ field }) => (
                                                            <FormItem><FormLabel>Heading/Title *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                                        )}/>
                                                        <FormField control={form.control} name={`types.${index}.description`} render={({ field }) => (
                                                            <FormItem><FormLabel>Introduction *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                                                        )}/>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <FormLabel>Header Image</FormLabel>
                                                        <div className="relative aspect-[4/3] w-full rounded-md border-2 border-dashed overflow-hidden flex items-center justify-center bg-muted/30">
                                                            {form.watch(`types.${index}.imageUrl`) ? (
                                                                <Image 
                                                                    src={form.watch(`types.${index}.imageUrl`)?.startsWith('data:') ? form.watch(`types.${index}.imageUrl`)! : `/api/image-proxy?url=${encodeURIComponent(form.watch(`types.${index}.imageUrl`)!)}`} 
                                                                    alt="Header" 
                                                                    fill 
                                                                    className="object-cover" 
                                                                />
                                                            ) : (
                                                                <div className="text-center p-4">
                                                                    <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40" />
                                                                    <p className="text-[10px] text-muted-foreground mt-1">No image uploaded</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <FormControl>
                                                            <Input 
                                                                type="file" 
                                                                accept="image/*" 
                                                                className="text-xs h-auto py-1"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        const reader = new FileReader();
                                                                        reader.onloadend = () => form.setValue(`types.${index}.imageUrl`, reader.result as string, { shouldDirty: true });
                                                                        reader.readAsDataURL(file);
                                                                        form.setValue(`types.${index}.imageFile`, e.target.files);
                                                                    }
                                                                }}
                                                            />
                                                        </FormControl>
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-lg border p-4 bg-muted/5">
                                                    <div className="space-y-4">
                                                        <h4 className="text-sm font-bold flex items-center gap-2"><Quote className="h-4 w-4"/> Religious Reference</h4>
                                                        <FormField control={form.control} name={`types.${index}.quranVerse`} render={({ field }) => (
                                                            <FormItem><FormLabel>Verse/Hadith Text</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
                                                        )}/>
                                                        <FormField control={form.control} name={`types.${index}.quranSource`} render={({ field }) => (
                                                            <FormItem><FormLabel>Citation Source</FormLabel><FormControl><Input placeholder="e.g. Sahih Bukhari" {...field} /></FormControl></FormItem>
                                                        )}/>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <h4 className="text-sm font-bold flex items-center gap-2"><ListChecks className="h-4 w-4"/> Key Highlights</h4>
                                                        <FormField control={form.control} name={`types.${index}.purposePointsRaw`} render={({ field }) => (
                                                            <FormItem><FormLabel>Points (One per line)</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl></FormItem>
                                                        )}/>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 rounded-lg border p-4 bg-primary/5 border-primary/10">
                                                    <FormField control={form.control} name={`types.${index}.useCasesHeading`} render={({ field }) => (
                                                        <FormItem className="mb-4"><FormLabel>Section Heading</FormLabel><FormControl><Input placeholder="e.g. Practical Use Cases" {...field} /></FormControl></FormItem>
                                                    )}/>
                                                    <UseCaseEditor control={form.control} typeIndex={index} />
                                                </div>

                                                <div className="space-y-4 rounded-lg border p-4 bg-blue-50/50 border-blue-100">
                                                    <QAEditor control={form.control} typeIndex={index} />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <FormField control={form.control} name={`types.${index}.usage`} render={({ field }) => (
                                                        <FormItem><FormLabel>Permissible Usage *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                                                    )}/>
                                                    <FormField control={form.control} name={`types.${index}.restrictions`} render={({ field }) => (
                                                        <FormItem><FormLabel>Restrictions</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
                                                    )}/>
                                                </div>
                                            </div>
                                        </TabsContent>
                                    );
                                })}
                            </Tabs>
                            <div className="border-t p-6 bg-muted/5 flex justify-end">
                                <Button type="submit" disabled={isSubmitting || fields.length === 0 || !isDirty} size="lg">
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Save className="mr-2 h-4 w-4"/> Save All Content
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
