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
import { Loader2, ShieldAlert, Eye, Save, Plus, Trash2, Quote, ListChecks, HelpCircle, UploadCloud, Image as ImageIcon, BookOpen, Edit, X, CheckCircle2, XCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const useCaseSchema = z.object({
  id: z.string(),
  title: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  isAllowed: z.boolean().default(true),
  isHidden: z.boolean().default(false),
  quranVerse: z.string().optional().or(z.literal('')),
  quranSource: z.string().optional().or(z.literal('')),
});

const qaItemSchema = z.object({
  id: z.string(),
  question: z.string().optional().or(z.literal('')),
  answer: z.string().optional().or(z.literal('')),
  reference: z.string().optional().or(z.literal('')),
  isHidden: z.boolean().default(false),
  quranVerse: z.string().optional().or(z.literal('')),
  quranSource: z.string().optional().or(z.literal('')),
});

const donationTypeSchema = z.object({
  id: z.string(),
  title: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  quranVerse: z.string().optional().or(z.literal('')),
  quranSource: z.string().optional().or(z.literal('')),
  purposePointsRaw: z.string().optional().or(z.literal('')),
  useCasesHeading: z.string().optional().or(z.literal('')),
  useCases: z.array(useCaseSchema),
  qaItems: z.array(qaItemSchema),
  usage: z.string().optional().or(z.literal('')),
  restrictions: z.string().optional().or(z.literal('')),
  imageUrl: z.string().optional().or(z.literal('')),
  imageFile: z.any().optional(),
  hideKeyHighlights: z.boolean().default(false),
  hideUseCases: z.boolean().default(false),
  hideQA: z.boolean().default(false),
  hideUsage: z.boolean().default(false),
  hideRestrictions: z.boolean().default(false),
});

const formSchema = z.object({
  types: z.array(donationTypeSchema),
});

type DonationInfoFormValues = z.infer<typeof formSchema>;

function UseCaseEditor({ control, typeIndex, isReadOnly }: { control: any, typeIndex: number, isReadOnly: boolean }) {
    const { fields, append, remove } = useFieldArray({ control, name: `types.${typeIndex}.useCases` });
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-primary"><HelpCircle className="h-4 w-4"/> Scenarios & Rules</h4>
                {!isReadOnly && (
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `uc_${Date.now()}`, title: '', description: '', isAllowed: true, isHidden: false })}>
                        <Plus className="h-3 w-3 mr-1"/> Add Scenario
                    </Button>
                )}
            </div>
            <div className="grid gap-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="relative p-4 border rounded-md bg-muted/10 space-y-4 shadow-sm">
                        {!isReadOnly && (
                            <div className="absolute top-2 right-2 flex items-center gap-2">
                                <FormField control={control} name={`types.${typeIndex}.useCases.${index}.isHidden`} render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer">Hide</FormLabel>
                                    </FormItem>
                                )}/>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={control} name={`types.${typeIndex}.useCases.${index}.isAllowed`} render={({ field }) => (
                                <FormItem className="flex items-center space-x-2 space-y-0 pt-6">
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isReadOnly} /></FormControl>
                                    <FormLabel className="text-xs font-bold uppercase">{field.value ? 'Allowed' : 'Restricted'}</FormLabel>
                                </FormItem>
                            )}/>
                            <FormField control={control} name={`types.${typeIndex}.useCases.${index}.title`} render={({ field }) => (
                                <FormItem className="flex-1"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Scenario Name</FormLabel><FormControl><Input placeholder="e.g. Case 1: Ration Kit" {...field} disabled={isReadOnly} /></FormControl></FormItem>
                            )}/>
                        </div>
                        <FormField control={control} name={`types.${typeIndex}.useCases.${index}.description`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Guideline / Rule</FormLabel><FormControl><Textarea rows={2} {...field} disabled={isReadOnly} /></FormControl></FormItem>
                        )}/>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-dashed">
                            <FormField control={control} name={`types.${typeIndex}.useCases.${index}.quranVerse`} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Religious Proof</FormLabel><FormControl><Textarea rows={2} className="text-xs" placeholder="Verse or Hadith text..." {...field} disabled={isReadOnly} /></FormControl></FormItem>
                            )}/>
                            <FormField control={control} name={`types.${typeIndex}.useCases.${index}.quranSource`} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Citation</FormLabel><FormControl><Input className="text-xs" placeholder="Source citation..." {...field} disabled={isReadOnly} /></FormControl></FormItem>
                            )}/>
                        </div>
                    </div>
                ))}
                {fields.length === 0 && <p className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-md italic">No scenarios added.</p>}
            </div>
        </div>
    );
}

function QAEditor({ control, typeIndex, isReadOnly }: { control: any, typeIndex: number, isReadOnly: boolean }) {
    const { fields, append, remove } = useFieldArray({ control, name: `types.${typeIndex}.qaItems` });
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-blue-700"><BookOpen className="h-4 w-4"/> FAQ Items</h4>
                {!isReadOnly && (
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `qa_${Date.now()}`, question: '', answer: '', reference: '', isHidden: false })}>
                        <Plus className="h-3 w-3 mr-1"/> Add Question
                    </Button>
                )}
            </div>
            <div className="grid gap-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="relative p-4 border rounded-md bg-blue-50/20 space-y-4 shadow-sm">
                        {!isReadOnly && (
                            <div className="absolute top-2 right-2 flex items-center gap-2">
                                <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.isHidden`} render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer">Hide</FormLabel>
                                    </FormItem>
                                )}/>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </div>
                        )}
                        <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.question`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Question</FormLabel><FormControl><Input {...field} disabled={isReadOnly} /></FormControl></FormItem>
                        )}/>
                        <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.answer`} render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Answer</FormLabel><FormControl><Textarea rows={2} {...field} disabled={isReadOnly} /></FormControl></FormItem>
                        )}/>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-dashed border-blue-200">
                            <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.quranVerse`} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Religious Proof</FormLabel><FormControl><Textarea rows={2} className="text-xs" placeholder="Verse or Hadith text..." {...field} disabled={isReadOnly} /></FormControl></FormItem>
                            )}/>
                            <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.quranSource`} render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Citation</FormLabel><FormControl><Input className="text-xs" placeholder="Source citation..." {...field} disabled={isReadOnly} /></FormControl></FormItem>
                            )}/>
                        </div>
                    </div>
                ))}
                {fields.length === 0 && <p className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-md italic">No questions added.</p>}
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
    const [isInitialized, setIsInitialized] = useState(false);
    const [editModes, setEditModes] = useState<Record<string, boolean>>({});

    const form = useForm<DonationInfoFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { types: [] }
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'types' });

    useEffect(() => {
        if (infoSettings) setIsDonationInfoPublic(infoSettings.isDonationInfoPublic || false);
    }, [infoSettings]);
    
    useEffect(() => {
        if (!isDonationInfoLoading && donationInfoData && !isInitialized) {
            const dataToLoad = (donationInfoData.types && donationInfoData.types.length > 0) ? donationInfoData.types : defaultDonationInfo;
            const mappedTypes = dataToLoad.map(t => ({
                ...t,
                purposePointsRaw: (t as any).purposePoints?.join('\n') || '',
                useCases: (t.useCases || []),
                qaItems: t.qaItems || [],
                imageUrl: t.imageUrl || '',
                hideKeyHighlights: !!t.hideKeyHighlights,
                hideUseCases: !!t.hideUseCases,
                hideQA: !!t.hideQA,
                hideUsage: !!t.hideUsage,
                hideRestrictions: !!t.hideRestrictions,
            }));
            form.reset({ types: mappedTypes });
            if (mappedTypes.length > 0) setActiveTab(mappedTypes[0].id);
            setIsInitialized(true);
        }
    }, [donationInfoData, isDonationInfoLoading, isInitialized, form]);

    const canUpdateSettings = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.update', false);

    const handleSaveVisibility = async () => {
        if (!firestore || !canUpdateSettings) return;
        setIsSubmitting(true);
        try {
            await setDoc(doc(firestore, 'settings', 'info'), { isDonationInfoPublic }, { merge: true });
            toast({ title: 'Visibility Updated', description: 'Changes saved.', variant: 'success' });
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/info', operation: 'write' }));
        } finally { setIsSubmitting(false); }
    };
    
    const handleSaveSingleCategory = async (typeIndex: number) => {
        if (!firestore || !storage || !canUpdateSettings) return;
        const data = form.getValues();
        const typeToSave = data.types[typeIndex];
        const categoryLabel = typeToSave.title || typeToSave.id;
        setIsSubmitting(true);
        toast({ title: `Saving ${categoryLabel}...`, description: 'Please wait.' });
        try {
            const { purposePointsRaw, imageFile, ...rest } = typeToSave;
            let finalImageUrl = rest.imageUrl || '';
            if (imageFile && imageFile.length > 0) {
                const file = imageFile[0];
                const resizedBlob = await new Promise<Blob>((resolve) => { (Resizer as any).imageFileResizer(file, 800, 600, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob'); });
                const filePath = `settings/info/donation_types/${typeToSave.id}.png`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                finalImageUrl = await getDownloadURL(fileRef);
            }
            const processedType = {
                ...rest,
                imageUrl: finalImageUrl,
                useCases: typeToSave.useCases.filter(uc => uc.title?.trim() || uc.description?.trim()),
                qaItems: typeToSave.qaItems.filter(qa => qa.question?.trim() || qa.answer?.trim()),
                purposePoints: purposePointsRaw ? purposePointsRaw.split('\n').filter(p => p.trim() !== '') : [],
            };
            const currentFullData = (donationInfoData?.types || []).length > 0 ? [...donationInfoData!.types] : [...defaultDonationInfo];
            const existingIdx = currentFullData.findIndex(t => t.id === typeToSave.id);
            if (existingIdx !== -1) currentFullData[existingIdx] = processedType as any;
            else currentFullData.push(processedType as any);
            await setDoc(doc(firestore, 'settings', 'donationInfo'), { types: currentFullData });
            toast({ title: 'Saved!', description: `${categoryLabel} has been updated.`, variant: 'success' });
            setEditModes(prev => ({ ...prev, [typeToSave.id]: false }));
            forceRefetch();
        } catch (error: any) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/donationInfo', operation: 'write' }));
        } finally { setIsSubmitting(false); }
    };

    if (isSessionLoading || isInfoSettingsLoading || isDonationInfoLoading) return <BrandedLoader />;
    if (!canUpdateSettings) return <main className="container mx-auto p-4 md:p-8"><Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Access Denied</AlertTitle><AlertDescription>Missing permissions.</AlertDescription></Alert></main>;
    
    return (
        <div className="space-y-6">
            <Card className="animate-fade-in-zoom shadow-sm">
                <CardHeader><CardTitle>Page Visibility</CardTitle><CardDescription>Control public informational pages.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1.5 flex-1"><h3 className="font-semibold">Donation Types Explained</h3><p className="text-sm text-muted-foreground">Detailed information guide for donors.</p><Button variant="outline" size="sm" asChild className="mt-2"><Link href="/info/donation-info" target="_blank"><Eye className="mr-2 h-4 w-4" /> Preview Public Page</Link></Button></div>
                        <div className="flex items-center space-x-2 pt-4 sm:pt-0"><Label htmlFor="donation-info-public">Publicly Available</Label><Switch id="donation-info-public" checked={isDonationInfoPublic} onCheckedChange={setIsDonationInfoPublic} disabled={isSubmitting} /></div>
                    </div>
                </CardContent>
                <CardFooter className="justify-end border-t bg-muted/5 p-4"><Button onClick={handleSaveVisibility} disabled={isSubmitting || isDonationInfoPublic === (infoSettings?.isDonationInfoPublic || false)}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>} Save Visibility</Button></CardFooter>
            </Card>

            <Card className="animate-fade-in-up border-primary/10 overflow-hidden">
                <CardHeader className="bg-primary/5">
                    <div className="flex items-center justify-between gap-4">
                        <div><CardTitle>Content Manager</CardTitle><CardDescription>Manage each donation category independently.</CardDescription></div>
                        <Button onClick={() => { const id = `type_${Date.now()}`; append({ id, title: 'New Category', useCases: [], qaItems: [] }); setActiveTab(id); setEditModes(p => ({ ...p, [id]: true })); }} variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Form {...form}><form onSubmit={(e) => e.preventDefault()}>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <div className="bg-muted/10 border-b"><ScrollArea className="w-full whitespace-nowrap"><TabsList className="h-auto w-max bg-transparent p-0 rounded-none">{fields.map((field, index) => { const typeId = form.getValues(`types.${index}.id`); const title = form.watch(`types.${index}.title`) || 'New Type'; return (<TabsTrigger key={field.id} value={typeId} className={cn("rounded-none border-b-2 border-transparent px-6 py-4 font-black uppercase tracking-widest text-muted-foreground transition-all duration-300 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground")}>{title}</TabsTrigger>);})}</TabsList><ScrollBar orientation="horizontal" /></ScrollArea></div>
                            {fields.map((field, index) => {
                                const typeId = form.getValues(`types.${index}.id`);
                                const isEditingTab = editModes[typeId] || false;
                                return (
                                    <TabsContent key={field.id} value={typeId} className="p-4 sm:p-8 space-y-8 animate-fade-in-up mt-0">
                                        <div className="flex justify-between items-center bg-muted/20 p-4 rounded-lg"><div className="flex items-center gap-3"><h3 className="text-xl font-black text-primary uppercase tracking-tight">{form.watch(`types.${index}.title`) || 'Category'}</h3><Badge variant={isEditingTab ? "default" : "secondary"}>{isEditingTab ? "Edit Mode" : "Read Mode"}</Badge></div><div className="flex gap-2">{isEditingTab ? (<Button type="button" variant="outline" size="sm" onClick={() => setEditModes(p => ({...p, [typeId]: false}))} disabled={isSubmitting}><X className="mr-2 h-4 w-4"/> Cancel</Button>) : (<Button type="button" variant="outline" size="sm" onClick={() => setEditModes(p => ({...p, [typeId]: true}))}><Edit className="mr-2 h-4 w-4"/> Edit Category</Button>)}<Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => { remove(index); if (fields.length > 1) setActiveTab(form.getValues('types.0.id')); }}><Trash2 className="h-5 w-5"/></Button></div></div>
                                        <div className={cn("grid gap-8 transition-opacity", !isEditingTab && "opacity-70 pointer-events-none")}>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                                                <div className="md:col-span-2 space-y-4"><FormField control={form.control} name={`types.${index}.title`} render={({ field }) => (<FormItem><FormLabel className="font-bold uppercase tracking-tighter">Heading</FormLabel><FormControl><Input {...field} disabled={!isEditingTab} /></FormControl></FormItem>)}/><FormField control={form.control} name={`types.${index}.description`} render={({ field }) => (<FormItem><FormLabel className="font-bold uppercase tracking-tighter">Intro</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!isEditingTab} /></FormControl></FormItem>)} /></div>
                                                <div className="space-y-2"><FormLabel className="font-bold uppercase tracking-tighter">Header Image</FormLabel><div className="relative aspect-[4/3] w-full rounded-md border-2 border-dashed overflow-hidden flex items-center justify-center bg-muted/30">{form.watch(`types.${index}.imageUrl`) ? (<Image src={form.watch(`types.${index}.imageUrl`)!} alt="Header" fill className="object-cover" unoptimized />) : (<div className="text-center p-4"><ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40" /></div>)}</div><FormControl><Input type="file" accept="image/*" className="text-xs h-auto py-1" disabled={!isEditingTab} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => form.setValue(`types.${index}.imageUrl`, reader.result as string); reader.readAsDataURL(file); form.setValue(`types.${index}.imageFile`, e.target.files); } }} /></FormControl></div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-lg border p-4 bg-muted/5"><div className="space-y-4"><h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-primary"><Quote className="h-4 w-4"/> Reference</h4><FormField control={form.control} name={`types.${index}.quranVerse`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Verse/Hadith</FormLabel><FormControl><Textarea rows={3} {...field} disabled={!isEditingTab} /></FormControl></FormItem>)}/><FormField control={form.control} name={`types.${index}.quranSource`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">Citation</FormLabel><FormControl><Input {...field} disabled={!isEditingTab} /></FormControl></FormItem>)}/></div><div className="space-y-4"><h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-primary"><ListChecks className="h-4 w-4"/> Highlights</h4><FormField control={form.control} name={`types.${index}.purposePointsRaw`} render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase">One per line</FormLabel><FormControl><Textarea rows={6} {...field} disabled={!isEditingTab} /></FormControl></FormItem>)}/></div></div>
                                            <div className="space-y-4 rounded-lg border-2 border-primary/10 p-4 bg-primary/5"><FormField control={form.control} name={`types.${index}.useCasesHeading`} render={({ field }) => (<FormItem className="mb-4"><FormLabel className="font-bold">Heading for Use Cases</FormLabel><FormControl><Input {...field} disabled={!isEditingTab} /></FormControl></FormItem>)}/><UseCaseEditor control={form.control} typeIndex={index} isReadOnly={!isEditingTab} /></div>
                                            <div className="space-y-4 rounded-lg border-2 border-blue-100 p-4 bg-blue-50/30"><QAEditor control={form.control} typeIndex={index} isReadOnly={!isEditingTab} /></div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField control={form.control} name={`types.${index}.usage`} render={({ field }) => (<FormItem><FormLabel className="font-bold text-green-700 uppercase">Usage Guidelines</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!isEditingTab} /></FormControl></FormItem>)}/><FormField control={form.control} name={`types.${index}.restrictions`} render={({ field }) => (<FormItem><FormLabel className="font-bold text-destructive uppercase">Restrictions</FormLabel><FormControl><Textarea rows={4} {...field} disabled={!isEditingTab} /></FormControl></FormItem>)}/></div>
                                        </div>
                                        <div className="border-t pt-6 flex justify-end"><Button type="button" size="lg" onClick={() => handleSaveSingleCategory(index)} disabled={isSubmitting || !isEditingTab}>{isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />} Save {form.watch(`types.${index}.title`) || 'Category'}</Button></div>
                                    </TabsContent>
                                );
                            })}
                        </Tabs>
                    </form></Form>
                </CardContent>
            </Card>
        </div>
    );
}
