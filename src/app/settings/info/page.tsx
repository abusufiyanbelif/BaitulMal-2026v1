'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { useSession } from '@/hooks/use-session';
import { useDonationInfo } from '@/hooks/use-donation-info';
import { defaultDonationInfo } from '@/lib/donation-info-default';
import { useFirestore, useStorage, useAuth } from '@/firebase/provider';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Resizer from 'react-image-file-resizer';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Save, Plus, Trash2, Quote, ListChecks, HelpCircle, Image as ImageIcon, BookOpen, Edit, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BrandedLoader } from '@/components/branded-loader';
import { donationCategories } from '@/lib/modules';
import { Switch } from '@/components/ui/switch';

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
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-primary"><HelpCircle className="h-4 w-4"/> Scenarios & rules</h4>
                {!isReadOnly && (
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `uc_${Date.now()}`, title: '', description: '', isAllowed: true, isHidden: false })} className="font-bold">
                        <Plus className="h-3 w-3 mr-1"/> Add scenario
                    </Button>
                )}
            </div>
            <div className="grid gap-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="relative p-4 border rounded-md bg-muted/10 space-y-4 shadow-sm">
                        {!isReadOnly && (
                            <div className="absolute top-2 right-2 flex items-center gap-2">
                                <FormField control={control} name={`types.${typeIndex}.useCases.${index}.isHidden`} render={({ field: hiddenField }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><Checkbox checked={hiddenField.value} onCheckedChange={hiddenField.onChange} /></FormControl>
                                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer">Hide</FormLabel>
                                    </FormItem>
                                )}/>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={control} name={`types.${typeIndex}.useCases.${index}.isAllowed`} render={({ field: allowedField }) => (
                                <FormItem className="flex items-center space-x-2 space-y-0 pt-6">
                                    <FormControl><Switch checked={allowedField.value} onCheckedChange={allowedField.onChange} disabled={isReadOnly} /></FormControl>
                                    <FormLabel className="text-xs font-bold uppercase">{allowedField.value ? 'Allowed' : 'Restricted'}</FormLabel>
                                </FormItem>
                            )}/>
                            <FormField control={control} name={`types.${typeIndex}.useCases.${index}.title`} render={({ field: titleField }) => (
                                <FormItem className="flex-1"><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Scenario name</FormLabel><FormControl><Input placeholder="e.g. Case 1: Ration Kit" {...titleField} disabled={isReadOnly} /></FormControl></FormItem>
                            )}/>
                        </div>
                        <FormField control={control} name={`types.${typeIndex}.useCases.${index}.description`} render={({ field: descField }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Guideline / rule</FormLabel><FormControl><Textarea rows={2} {...descField} disabled={isReadOnly} /></FormControl></FormItem>
                        )}/>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-dashed">
                            <FormField control={control} name={`types.${typeIndex}.useCases.${index}.quranVerse`} render={({ field: verseField }) => (
                                <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Religious proof</FormLabel><FormControl><Textarea rows={2} className="text-xs" placeholder="Verse or Hadith text..." {...verseField} disabled={isReadOnly} /></FormControl></FormItem>
                            )}/>
                            <FormField control={control} name={`types.${typeIndex}.useCases.${index}.quranSource`} render={({ field: sourceField }) => (
                                <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Citation</FormLabel><FormControl><Input className="text-xs" placeholder="Source citation..." {...sourceField} disabled={isReadOnly} /></FormControl></FormItem>
                            )}/>
                        </div>
                    </div>
                ))}
                {fields.length === 0 && <p className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-md italic font-normal">No scenarios added.</p>}
            </div>
        </div>
    );
}

function QAEditor({ control, typeIndex, isReadOnly }: { control: any, typeIndex: number, isReadOnly: boolean }) {
    const { fields, append, remove } = useFieldArray({ control, name: `types.${typeIndex}.qaItems` });
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-blue-700"><BookOpen className="h-4 w-4"/> FAQ items</h4>
                {!isReadOnly && (
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ id: `qa_${Date.now()}`, question: '', answer: '', reference: '', isHidden: false })} className="font-bold">
                        <Plus className="h-3 w-3 mr-1"/> Add question
                    </Button>
                )}
            </div>
            <div className="grid gap-4">
                {fields.map((field, index) => (
                    <div key={field.id} className="relative p-4 border rounded-md bg-blue-50/20 space-y-4 shadow-sm">
                        {!isReadOnly && (
                            <div className="absolute top-2 right-2 flex items-center gap-2">
                                <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.isHidden`} render={({ field: hiddenField }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><Checkbox checked={hiddenField.value} onCheckedChange={hiddenField.onChange} /></FormControl>
                                        <FormLabel className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer">Hide</FormLabel>
                                    </FormItem>
                                )}/>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </div>
                        )}
                        <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.question`} render={({ field: qField }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Question</FormLabel><FormControl><Input {...qField} disabled={isReadOnly} /></FormControl></FormItem>
                        )}/>
                        <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.answer`} render={({ field: aField }) => (
                            <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Answer</FormLabel><FormControl><Textarea rows={2} {...aField} disabled={isReadOnly} /></FormControl></FormItem>
                        )}/>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-dashed border-blue-200">
                            <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.quranVerse`} render={({ field: vField }) => (
                                <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Religious proof</FormLabel><FormControl><Textarea rows={2} className="text-xs" placeholder="Verse or Hadith text..." {...vField} disabled={isReadOnly} /></FormControl></FormItem>
                            )}/>
                            <FormField control={control} name={`types.${typeIndex}.qaItems.${index}.quranSource`} render={({ field: sField }) => (
                                <FormItem><FormLabel className="text-[10px] uppercase font-bold text-muted-foreground">Citation</FormLabel><FormControl><Input className="text-xs" placeholder="Source citation..." {...sField} disabled={isReadOnly} /></FormControl></FormItem>
                            )}/>
                        </div>
                    </div>
                ))}
                {fields.length === 0 && <p className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-md italic font-normal">No questions added.</p>}
            </div>
        </div>
    );
}

export default function InfoSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { donationInfoData, isLoading: isDonationInfoLoading, forceRefetch: forceRefetchDonationInfo } = useDonationInfo();
    
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('');
    const [isInitialized, setIsInitialized] = useState(false);
    const [editModes, setEditModes] = useState<Record<string, boolean>>({});

    const form = useForm<DonationInfoFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { 
            types: [],
        }
    });

    const { fields: donationTypeFields, append: appendDonationType, remove: removeDonationType } = useFieldArray({ control: form.control, name: 'types' });

    useEffect(() => {
        if (!isDonationInfoLoading && donationInfoData && !isInitialized) {
            const typesToLoad = (donationInfoData.types && donationInfoData.types.length > 0) ? donationInfoData.types : defaultDonationInfo;
            const mappedTypes = typesToLoad.map(t => ({
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

            form.reset({ 
                types: mappedTypes,
            });
            if (mappedTypes.length > 0) setActiveTab(mappedTypes[0].id);
            setIsInitialized(true);
        }
    }, [donationInfoData, isDonationInfoLoading, isInitialized, form]);

    const canUpdateSettings = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.update', false);

    const handleSaveDonationCategory = async (typeIndex: number) => {
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
                useCases: typeToSave.useCases.filter(uc => uc.title?.trim()), 
                qaItems: typeToSave.qaItems.filter(qa => qa.question?.trim()), 
                purposePoints: purposePointsRaw ? purposePointsRaw.split('\n').filter(p => p.trim() !== '') : [],
            };
            const currentFullData = (donationInfoData?.types || []).length > 0 ? [...donationInfoData!.types] : [...defaultDonationInfo];
            const existingIdx = currentFullData.findIndex(t => t.id === typeToSave.id);
            if (existingIdx !== -1) currentFullData[existingIdx] = processedType as any;
            else currentFullData.push(processedType as any);
            await setDoc(doc(firestore, 'settings', 'donationInfo'), { types: currentFullData });
            toast({ title: 'Saved!', description: `${categoryLabel} has been updated.`, variant: 'success' });
            setEditModes(prev => ({ ...prev, [typeToSave.id]: false }));
            forceRefetchDonationInfo();
        } catch (error: any) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/donationInfo', operation: 'write' }));
        } finally { setIsSubmitting(false); }
    };

    if (isSessionLoading || isDonationInfoLoading) {
        return <BrandedLoader />;
    }

    if (!canUpdateSettings) {
        return (
            <main className="container mx-auto p-4 md:p-8">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle className="font-bold">Access Denied</AlertTitle>
                    <AlertDescription className="font-normal text-primary/70">You do not have permission to manage informational settings.</AlertDescription>
                </Alert>
            </main>
        );
    }
    
    return (
        <div className="space-y-6 text-primary font-normal">
            <Form {...form}>
                <div className="space-y-6">
                    <Card className="animate-fade-in-up border-primary/10 overflow-hidden shadow-sm">
                        <CardHeader className="bg-primary/5 border-b">
                            <div className="flex items-center justify-between gap-4">
                                <div><CardTitle className="font-bold uppercase tracking-tight">Donation Content Manager</CardTitle><CardDescription className="font-normal text-primary/70">Manage educational content for each donation category.</CardDescription></div>
                                <Button onClick={() => { const id = `type_${Date.now()}`; appendDonationType({ id, title: 'New Category', useCases: [], qaItems: [], hideKeyHighlights: false, hideUseCases: false, hideQA: false, hideUsage: false, hideRestrictions: false }); setActiveTab(id); setEditModes(p => ({ ...p, [id]: true })); }} variant="outline" size="sm" className="font-bold text-primary border-primary/20 active:scale-95 transition-transform"><Plus className="mr-2 h-4 w-4" /> Add category</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 font-normal">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <div className="bg-muted/10 border-b"><ScrollArea className="w-full whitespace-nowrap"><TabsList className="h-auto w-max bg-transparent p-0 rounded-none">{donationTypeFields.map((field, index) => { const typeId = form.getValues(`types.${index}.id`); const title = form.watch(`types.${index}.title`) || 'New Type'; return (<TabsTrigger key={field.id} value={typeId} className={cn("rounded-none border-b-2 border-transparent px-6 py-4 font-black uppercase tracking-widest text-muted-foreground transition-all duration-300 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground")}>{title}</TabsTrigger>);})}</TabsList><ScrollBar orientation="horizontal" /></ScrollArea></div>
                                {donationTypeFields.map((field, index) => {
                                    const typeId = form.getValues(`types.${index}.id`);
                                    const isEditingTab = editModes[typeId] || false;
                                    return (
                                        <TabsContent key={field.id} value={typeId} className="p-4 sm:p-8 space-y-8 animate-fade-in-up mt-0">
                                            <div className="flex justify-between items-center bg-muted/20 p-4 rounded-lg"><div className="flex items-center gap-3"><h3 className="text-xl font-black text-primary uppercase tracking-tight">{form.watch(`types.${index}.title`) || 'Category'}</h3><Badge variant={isEditingTab ? "default" : "secondary"} className="font-bold uppercase text-[10px]">{isEditingTab ? "Editing" : "Locked"}</Badge></div><div className="flex gap-2">{isEditingTab ? (<Button type="button" variant="outline" size="sm" onClick={() => setEditModes(p => ({...p, [typeId]: false}))} disabled={isSubmitting} className="font-bold"><X className="mr-2 h-4 w-4"/> Cancel</Button>) : (<Button type="button" variant="outline" size="sm" onClick={() => setEditModes(p => ({...p, [typeId]: true}))} className="font-bold text-primary border-primary/20"><Edit className="mr-2 h-4 w-4"/> Edit</Button>)}<Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => { if(confirm('Delete this entire category?')) { removeDonationType(index); if (donationTypeFields.length > 1) setActiveTab(form.getValues('types.0.id')); } }}><Trash2 className="h-5 w-5"/></Button></div></div>
                                            <div className={cn("grid gap-8 transition-all", !isEditingTab && "opacity-70 pointer-events-none")}>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                                                    <div className="md:col-span-2 space-y-4">
                                                        <FormField control={form.control} name={`types.${index}.title`} render={({ field: tField }) => (<FormItem><FormLabel className="font-bold uppercase tracking-tighter text-xs text-muted-foreground">Heading</FormLabel><FormControl><Input {...tField} disabled={!isEditingTab} /></FormControl></FormItem>)}/>
                                                        <FormField control={form.control} name={`types.${index}.description`} render={({ field: dField }) => (<FormItem><FormLabel className="font-bold uppercase tracking-tighter text-xs text-muted-foreground">Introduction</FormLabel><FormControl><Textarea rows={4} {...dField} disabled={!isEditingTab} /></FormControl></FormItem>)} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <FormLabel className="font-bold uppercase tracking-tighter text-xs text-muted-foreground">Category image</FormLabel>
                                                        <div className="relative aspect-[4/3] w-full rounded-md border-2 border-dashed overflow-hidden flex items-center justify-center bg-muted/30">
                                                            {form.watch(`types.${index}.imageUrl`) ? (<Image src={form.watch(`types.${index}.imageUrl`)!.startsWith('data:') ? form.watch(`types.${index}.imageUrl`)! : `/api/image-proxy?url=${encodeURIComponent(form.watch(`types.${index}.imageUrl`)!)}`} alt="Header" fill className="object-cover" unoptimized />) : (<div className="text-center p-4"><ImageIcon className="h-10 w-10 mx-auto text-muted-foreground/40" /></div>)}
                                                        </div>
                                                        <FormControl><Input type="file" accept="image/*" className="text-xs h-auto py-1" disabled={!isEditingTab} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => form.setValue(`types.${index}.imageUrl`, reader.result as string); reader.readAsDataURL(file); form.setValue(`types.${index}.imageFile`, e.target.files); } }} /></FormControl>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-lg border p-4 bg-muted/5 shadow-sm">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-primary"><Quote className="h-4 w-4"/> Divine proof</h4>
                                                            <FormField control={form.control} name={`types.${index}.hideKeyHighlights`} render={({ field: hideField }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={hideField.value} onCheckedChange={hideField.onChange} disabled={!isEditingTab}/></FormControl><FormLabel className="text-[10px] font-bold uppercase cursor-pointer opacity-60">Hide</FormLabel></FormItem>)}/>
                                                        </div>
                                                        <FormField control={form.control} name={`types.${index}.quranVerse`} render={({ field: qvField }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Verse text</FormLabel><FormControl><Textarea rows={3} {...qvField} disabled={!isEditingTab} className="text-xs italic" /></FormControl></FormItem>)}/>
                                                        <FormField control={form.control} name={`types.${index}.quranSource`} render={({ field: qsField }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Citation</FormLabel><FormControl><Input {...qsField} disabled={!isEditingTab} className="text-xs" /></FormControl></FormItem>)}/>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-primary"><ListChecks className="h-4 w-4"/> Key highlights</h4>
                                                        <FormField control={form.control} name={`types.${index}.purposePointsRaw`} render={({ field: ppField }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">List points (one per line)</FormLabel><FormControl><Textarea rows={6} {...ppField} disabled={!isEditingTab} className="text-xs" /></FormControl></FormItem>)}/>
                                                    </div>
                                                </div>
                                                <div className="space-y-4 rounded-lg border-2 border-primary/10 p-4 bg-primary/5 shadow-sm">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <FormField control={form.control} name={`types.${index}.useCasesHeading`} render={({ field: uhField }) => (<FormItem className="flex-1"><FormLabel className="font-bold text-xs uppercase text-muted-foreground">Scenarios heading</FormLabel><FormControl><Input {...uhField} disabled={!isEditingTab} placeholder="e.g. Practical Scenarios" /></FormControl></FormItem>)}/>
                                                        <FormField control={form.control} name={`types.${index}.hideUseCases`} render={({ field: hideField }) => (<FormItem className="flex items-center space-x-2 space-y-0 mt-6"><FormControl><Checkbox checked={hideField.value} onCheckedChange={hideField.onChange} disabled={!isEditingTab}/></FormControl><FormLabel className="text-[10px] font-bold uppercase cursor-pointer opacity-60">Hide section</FormLabel></FormItem>)}/>
                                                    </div>
                                                    <UseCaseEditor control={form.control} typeIndex={index} isReadOnly={!isEditingTab} />
                                                </div>
                                                <div className="space-y-4 rounded-lg border-2 border-blue-100 p-4 bg-blue-50/30 shadow-sm">
                                                    <div className="flex items-center justify-end">
                                                        <FormField control={form.control} name={`types.${index}.hideQA`} render={({ field: hideField }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={hideField.value} onCheckedChange={hideField.onChange} disabled={!isEditingTab}/></FormControl><FormLabel className="text-[10px] font-bold uppercase cursor-pointer opacity-60">Hide section</FormLabel></FormItem>)}/>
                                                    </div>
                                                    <QAEditor control={form.control} typeIndex={index} isReadOnly={!isEditingTab} />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg border bg-muted/5">
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <FormLabel className="font-bold text-primary uppercase text-xs">Usage guidelines</FormLabel>
                                                            <FormField control={form.control} name={`types.${index}.hideUsage`} render={({ field: hideField }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={hideField.value} onCheckedChange={hideField.onChange} disabled={!isEditingTab}/></FormControl><FormLabel className="text-[10px] font-bold uppercase cursor-pointer opacity-60">Hide</FormLabel></FormItem>)}/>
                                                        </div>
                                                        <FormField control={form.control} name={`types.${index}.usage`} render={({ field: uField }) => (<FormControl><Textarea rows={4} {...uField} disabled={!isEditingTab} className="text-xs" /></FormControl>)} />
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <FormLabel className="font-bold text-destructive uppercase text-xs">Strict restrictions</FormLabel>
                                                            <FormField control={form.control} name={`types.${index}.hideRestrictions`} render={({ field: hideField }) => (<FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={hideField.value} onCheckedChange={hideField.onChange} disabled={!isEditingTab}/></FormControl><FormLabel className="text-[10px] font-bold uppercase cursor-pointer opacity-60">Hide</FormLabel></FormItem>)}/>
                                                        </div>
                                                        <FormField control={form.control} name={`types.${index}.restrictions`} render={({ field: rField }) => (<FormControl><Textarea rows={4} {...rField} disabled={!isEditingTab} className="text-xs" /></FormControl>)} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="border-t pt-6 flex justify-end gap-3"><Button type="button" variant="outline" size="lg" onClick={() => setEditModes(p => ({...p, [typeId]: false}))} disabled={isSubmitting || !isEditingTab} className="font-bold border-primary/20">Discard Changes</Button><Button type="button" size="lg" onClick={() => handleSaveDonationCategory(index)} disabled={isSubmitting || !isEditingTab} className="font-bold shadow-md">{isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />} Save {form.watch(`types.${index}.title`) || 'Category'}</Button></div>
                                        </TabsContent>
                                    );
                                })}
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </Form>
        </div>
    );
}
