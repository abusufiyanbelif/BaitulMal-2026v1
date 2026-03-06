'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, errorEmitter, FirestorePermissionError, useCollection, useStorage, useMemoFirebase, useAuth, useDoc, doc } from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import Resizer from 'react-image-file-resizer';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, ShieldAlert, UploadCloud, Trash2, RotateCcw, Save } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Lead } from '@/lib/types';
import { donationCategories, leadPurposesConfig, leadSeriousnessLevels, educationDegrees, educationYears, educationSemesters } from '@/lib/modules';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/file-uploader';
import { BrandedLoader } from '@/components/branded-loader';

const leadSchema = z.object({
  name: z.string().min(3, 'Lead Name Must Be At Least 3 Characters.'),
  description: z.string().optional(),
  purpose: z.enum(['Relief', 'General', 'Education', 'Medical', 'Other']),
  purposeDetails: z.string().optional(),
  category: z.string().optional(),
  categoryDetails: z.string().optional(),
  status: z.enum(['Upcoming', 'Active', 'Completed']),
  authenticityStatus: z.enum(['Pending Verification', 'Verified', 'Rejected', 'On Hold', 'Need More Details']),
  publicVisibility: z.enum(['Hold', 'Ready to Publish', 'Published']),
  startDate: z.string().min(1, 'Start Date Is Required.'),
  endDate: z.string().min(1, 'End Date Is Required.'),
  requiredAmount: z.coerce.number().min(0).optional(),
  targetAmount: z.coerce.number().min(0).optional(),
  allowedDonationTypes: z.array(z.enum(donationCategories)).optional(),
  degree: z.string().optional(),
  year: z.string().optional(),
  semester: z.string().optional(),
  diseaseIdentified: z.string().optional(),
  diseaseStage: z.string().optional(),
  seriousness: z.enum(leadSeriousnessLevels).optional().or(z.literal('')),
  imageFile: z.any().optional(),
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
    message: "End Date Cannot Be Before The Start Date.",
    path: ["endDate"],
}).refine(data => {
    const selectedPurpose = leadPurposesConfig.find(p => p.id === data.purpose);
    if (selectedPurpose && selectedPurpose.categories.length > 0) {
      return !!data.category;
    }
    return true;
}, {
    message: 'Category Is Required For This Purpose.',
    path: ['category'],
});

type LeadFormValues = z.infer<typeof leadSchema>;

export default function CreateLeadPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const auth = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const { userProfile, isLoading: isProfileLoading } = useSession();

  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'lead_config') : null, [firestore]);
  const { data: configSettings } = useDoc<any>(configRef);
  const mandatoryFields = useMemo(() => configSettings?.mandatoryFields || {}, [configSettings]);
  
  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [leadDataToCreate, setLeadDataToCreate] = useState<LeadFormValues | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [documentsToUpload, setDocumentsToUpload] = useState<File[]>([]);

  const leadsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'leads');
  }, [firestore]);
  const { data: leads, isLoading: areLeadsLoading } = useCollection<Lead>(leadsCollectionRef);

  const canCreate = userProfile?.role === 'Admin' || !!userProfile?.permissions?.['leads-members']?.create;

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      description: '',
      purpose: 'Relief',
      category: '',
      status: 'Upcoming',
      authenticityStatus: 'Pending Verification',
      publicVisibility: 'Hold',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
      requiredAmount: 0,
      targetAmount: 0,
      allowedDonationTypes: [...donationCategories],
    },
  });

  const purpose = form.watch('purpose');
  const availableCategories = useMemo(() => {
    const selectedPurpose = leadPurposesConfig.find(p => p.id === purpose);
    return selectedPurpose?.categories || [];
  }, [purpose]);
  
  useEffect(() => {
    form.setValue('category', '');
  }, [purpose, form.setValue]);
  
  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue('imageFile', event.target.files);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    form.setValue('imageFile', null);
    setImagePreview(null);
  };

  const handleCreateLead = async (data: LeadFormValues) => {
    const missingFields: string[] = [];
    Object.entries(mandatoryFields).forEach(([field, isMandatory]) => {
        if (isMandatory && !data[field as keyof LeadFormValues]) {
            missingFields.push(field);
        }
    });

    if (missingFields.length > 0) {
        toast({
            title: "Required Fields Missing",
            description: `Please Complete The Following: ${missingFields.join(', ')}`,
            variant: "destructive",
        });
        return;
    }

    if (!firestore || !canCreate || !userProfile || !storage) return;
    setIsLoading(true);
    setProgress(5);
    setLoadingMessage('Initializing lead creation...');

    const { imageFile, ...leadCoreData } = data;
    
    const hasImageToUpload = imageFile && imageFile.length > 0;
    if ((hasImageToUpload || documentsToUpload.length > 0) && !auth?.currentUser) {
        toast({ title: 'Authentication Error', description: 'User Not Authenticated Yet. Please Wait.', variant: 'destructive' });
        setIsLoading(false);
        return;
    }
    
    const newLeadRef = doc(collection(firestore, 'leads'));
    const newLeadId = newLeadRef.id;

    let imageUrl = '';
    let imageUrlFilename = '';
    
    if (hasImageToUpload) {
        setProgress(15);
        setLoadingMessage('Optimizing header image...');
        try {
            const file = imageFile[0];
            const resizedBlob = await new Promise<Blob>((resolve) => {
                Resizer.imageFileResizer(file, 1280, 400, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob');
            });
            
            setProgress(35);
            setLoadingMessage('Uploading background artifacts...');
            const filePath = `leads/${newLeadId}/background.png`;
            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, resizedBlob);
            imageUrl = await getDownloadURL(fileRef);
            const dateStr = new Date().toISOString().split('T')[0];
            imageUrlFilename = `lead_${data.name.replace(/\s+/g, '_')}_${dateStr}.png`;
        } catch (uploadError: any) {
            console.error("Image Upload Failed:", uploadError);
            toast({ title: 'Image Upload Failed', description: 'Lead was not created.', variant: 'destructive'});
            setIsLoading(false);
            return;
        }
    }
    
    setProgress(55);
    setLoadingMessage('Synchronizing lead artifacts...');
    const documentUploadPromises = documentsToUpload.map(async (file, idx) => {
        const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const fileRef = storageRef(storage, `leads/${newLeadId}/documents/${safeFileName}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        const perDocProgress = 25 / Math.max(1, documentsToUpload.length);
        setProgress(prev => Math.min(prev + perDocProgress, 80));
        return { name: file.name, url: url, uploadedAt: new Date().toISOString(), isPublic: false };
    });
    const documents = await Promise.all(documentUploadPromises);

    setProgress(85);
    setLoadingMessage('Synchronizing with database...');
    const newLeadData: Partial<Lead> = {
      ...leadCoreData,
      requiredAmount: data.requiredAmount || 0,
      targetAmount: data.targetAmount || 0,
      description: data.description || '',
      purposeDetails: data.purposeDetails || '',
      category: data.category || '',
      categoryDetails: data.categoryDetails || '',
      createdAt: serverTimestamp(),
      createdById: userProfile.id,
      createdByName: userProfile.name,
      priceDate: new Date().toISOString().split('T')[0],
      shopName: '',
      shopContact: '',
      shopAddress: '',
      itemCategories: [{ id: 'general', name: 'General', items: [] }],
      seriousness: (data.seriousness as any) || null,
      degree: data.degree || '',
      year: data.year || '',
      semester: data.semester || '',
      diseaseIdentified: data.diseaseIdentified || '',
      diseaseStage: data.diseaseStage || '',
    };
    
    if (imageUrl) {
        newLeadData.imageUrl = imageUrl;
        newLeadData.imageUrlFilename = imageUrlFilename;
    }

    if (documents && documents.length > 0) {
        newLeadData.documents = documents;
    }

    setDoc(newLeadRef, newLeadData)
      .then(() => {
        setProgress(100);
        setLoadingMessage('Lead appeal registered.');
        toast({ title: 'Success', description: 'Lead Created Successfully.', variant: 'success' });
        router.push(`/leads-members`);
      })
      .catch((serverError: any) => {
        const permissionError = new FirestorePermissionError({
            path: 'leads',
            operation: 'create',
            requestResourceData: { ...newLeadData, createdAt: '[SERVER_TIMESTAMP]' },
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsLoading(false);
        setLeadDataToCreate(null);
        setIsDuplicateAlertOpen(false);
      });
  }

  const onSubmit = (data: LeadFormValues) => {
    if (leads && leads.some(c => c.name.trim().toLowerCase() === data.name.trim().toLowerCase())) {
        setLeadDataToCreate(data);
        setIsDuplicateAlertOpen(true);
    } else {
        handleCreateLead(data);
    }
  };

  if (isProfileLoading || areLeadsLoading) {
    return <BrandedLoader message="Initializing Creation Hub..." />;
  }

  if (!canCreate) {
    return (
        <main className="container mx-auto p-4 md:p-8 text-primary">
            <div className="mb-4"><Button variant="outline" asChild><Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Leads</Link></Button></div>
            <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle className="font-bold">Access Denied</AlertTitle><AlertDescription className="font-normal text-primary/70">Missing Permissions To Create A New Support Appeal.</AlertDescription></Alert>
        </main>
    )
  }

  const renderLabel = (label: string, fieldName: string) => (
    <FormLabel className="font-bold text-primary">
        {label} {mandatoryFields[fieldName] ? '*' : ''}
    </FormLabel>
  );

  return (
    <main className="container mx-auto p-4 md:p-8">
      {isLoading && <BrandedLoader message={loadingMessage} progress={progress} />}
      <div className="mb-4">
        <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
          <Link href="/leads-members">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back To Leads
          </Link>
        </Button>
      </div>
      <Card className="max-w-2xl mx-auto animate-fade-in-zoom border-primary/10 bg-white">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="font-bold text-primary tracking-tight">Create New Lead Appeal</CardTitle>
          <CardDescription className="font-normal text-primary/70">Capture Details For Individual Support Vetting.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 font-normal text-primary">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>{renderLabel('Lead Name', 'name')}<FormControl><Input placeholder="e.g. Surgery Assistance For Patient A" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>{renderLabel('Detailed Description', 'description')}<FormControl><Textarea placeholder="Background And Specific Needs..." {...field} rows={4} /></FormControl><FormMessage /></FormItem>
              )}/>
                <FormItem>
                    <FormLabel className="font-bold text-[10px] uppercase text-muted-foreground tracking-widest">Header Image</FormLabel>
                    <FormControl>
                        <Input id="imageFile" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageFileChange} className="hidden" />
                    </FormControl>
                    <label htmlFor="imageFile" className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary transition-colors">
                        {imagePreview ? (
                            <>
                                <Image src={imagePreview} alt="Preview" fill className="object-cover rounded-lg" />
                                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 shadow-lg" onClick={handleRemoveImage}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                             <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                <p className="mb-2 text-sm text-center text-muted-foreground font-normal">
                                    <span className="font-bold text-primary">Click To Upload</span> Or Drag And Drop
                                </p>
                                <p className="text-[10px] text-muted-foreground font-normal uppercase tracking-tighter">PNG, JPG, WEBP Recommended</p>
                            </div>
                        )}
                    </label>
                    <FormMessage />
                </FormItem>
                 <FormItem>
                    <FormLabel className="font-bold text-primary">Lead Artifacts & Proof</FormLabel>
                    <FormControl>
                        <FileUploader
                            onFilesChange={setDocumentsToUpload}
                            multiple={true}
                            acceptedFileTypes="image/png, image/jpeg, image/webp, application/pdf"
                        />
                    </FormControl>
                    <FormDescription className="text-xs font-normal opacity-70 italic">Upload Medical Reports, Marksheets, Or Verification Documents.</FormDescription>
                </FormItem>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="purpose" render={({ field }) => (
                    <FormItem>{renderLabel('Purpose', 'purpose')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Purpose" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown">{leadPurposesConfig.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )}/>
                {availableCategories.length > 0 && (
                  <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>{renderLabel('Category', 'category')}<Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown">{availableCategories.map(cat => <SelectItem key={cat} value={cat} className="font-bold">{cat}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )}/>
                )}
              </div>
              
              {purpose === 'Other' && (
                <FormField control={form.control} name="purposeDetails" render={({ field }) => (
                  <FormItem>{renderLabel('Specific Purpose Details', 'purposeDetails')}<FormControl><Input {...field} className="font-bold" /></FormControl><FormMessage /></FormItem>
                )}/>
              )}

              {purpose === 'Education' && (
                <div className="space-y-4 rounded-xl border p-4 bg-primary/5 animate-fade-in-zoom border-primary/10">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Academic Qualifications</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="degree" render={({ field }) => (
                        <FormItem>{renderLabel('Degree/Class', 'degree')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold h-8"><SelectValue placeholder="Degree..."/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown">{educationDegrees.map(d=><SelectItem key={d} value={d} className="font-bold">{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="year" render={({ field }) => (
                        <FormItem>{renderLabel('Academic Year', 'year')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold h-8"><SelectValue placeholder="Year..."/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown">{educationYears.map(y=><SelectItem key={y} value={y} className="font-bold">{y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="semester" render={({ field }) => (
                        <FormItem>{renderLabel('Semester', 'semester')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold h-8"><SelectValue placeholder="Semester..."/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown">{educationSemesters.map(s=><SelectItem key={s} value={s} className="font-bold">{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                  </div>
                </div>
              )}

              {purpose === 'Medical' && (
                <div className="space-y-4 rounded-xl border p-4 bg-primary/5 animate-fade-in-zoom border-primary/10">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Medical Assessment</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField control={form.control} name="diseaseIdentified" render={({ field }) => (
                        <FormItem>{renderLabel('Disease Identified', 'diseaseIdentified')}<FormControl><Input placeholder="e.g. Cataract" {...field} className="h-8 font-bold" /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="diseaseStage" render={({ field }) => (
                        <FormItem>{renderLabel('Stage/Condition', 'diseaseStage')}<FormControl><Input placeholder="e.g. Initial" {...field} className="h-8 font-bold" /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="seriousness" render={({ field }) => (
                        <FormItem>{renderLabel('Priority Level', 'seriousness')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold h-8"><SelectValue placeholder="Select Level..."/></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown">{leadSeriousnessLevels.map(level => <SelectItem key={level} value={level} className="font-bold">{level}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )}/>
                  </div>
                </div>
              )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="requiredAmount" render={({ field }) => (<FormItem>{renderLabel('Required Amount (₹)', 'requiredAmount')}<FormControl><Input type="number" placeholder="e.g. 125000" {...field} className="font-bold" /></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="targetAmount" render={({ field }) => (<FormItem>{renderLabel('Fundraising Goal (₹)', 'targetAmount')}<FormControl><Input type="number" placeholder="e.g. 100000" {...field} className="font-bold" /></FormControl><FormMessage /></FormItem>)}/>
                </div>

                <FormField control={form.control} name="allowedDonationTypes" render={() => (
                    <FormItem className="space-y-4">
                      <div><FormLabel className="text-base font-bold text-primary">Qualified Donation Types</FormLabel><FormDescription className="text-xs font-normal opacity-70">Select Which Fund Types Count Toward The Target Goal metrics.</FormDescription></div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 border rounded-xl bg-primary/5 border-primary/10">
                        <div className="flex items-center space-x-2"><Checkbox id="select-all-types-lead" checked={form.watch('allowedDonationTypes')?.length === donationCategories.length} onCheckedChange={(checked) => { form.setValue('allowedDonationTypes', checked ? [...donationCategories] : []); }} /><Label htmlFor="select-all-types-lead" className="font-bold text-[10px] uppercase cursor-pointer tracking-widest">Any</Label></div>
                        {donationCategories.map((type) => (
                          <FormField key={type} control={form.control} name="allowedDonationTypes" render={({ field }) => (
                            <FormItem key={type} className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl><Checkbox checked={field.value?.includes(type)} onCheckedChange={(checked) => { return checked ? field.onChange([...(field.value || []), type]) : field.onChange((field.value || []).filter((value) => value !== type))}} /></FormControl>
                                <FormLabel className="font-bold text-[10px] uppercase cursor-pointer tracking-widest opacity-80">{type}</FormLabel>
                            </FormItem>
                          )} />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                )}/>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem>{renderLabel('Start Date', 'startDate')}<FormControl><Input type="date" {...field} className="font-bold text-primary"/></FormControl><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem>{renderLabel('End Date', 'endDate')}<FormControl><Input type="date" {...field} className="font-bold text-primary"/></FormControl><FormMessage /></FormItem>)}/>
              </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="status" render={({ field }) => (<FormItem>{renderLabel('Status', 'status')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Status" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="Upcoming" className="font-bold">Upcoming</SelectItem><SelectItem value="Active" className="font-bold">Active</SelectItem><SelectItem value="Completed" className="font-bold">Completed</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                  <FormField control={form.control} name="authenticityStatus" render={({ field }) => (
                      <FormItem>{renderLabel('Verification Level', 'authenticityStatus')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Authenticity" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="Pending Verification" className="font-bold">Pending</SelectItem><SelectItem value="Verified" className="font-bold text-primary">Verified</SelectItem><SelectItem value="On Hold" className="font-bold">On Hold</SelectItem><SelectItem value="Rejected" className="font-bold text-destructive">Rejected</SelectItem><SelectItem value="Need More Details" className="font-bold">Need Details</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                  )}/>
              </div>
              <FormField control={form.control} name="publicVisibility" render={({ field }) => (
                  <FormItem>{renderLabel('Public Visibility', 'publicVisibility')}<Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="font-bold"><SelectValue placeholder="Select Visibility" /></SelectTrigger></FormControl><SelectContent className="rounded-[12px] shadow-dropdown"><SelectItem value="Hold" className="font-bold">Hold (Private)</SelectItem><SelectItem value="Ready to Publish" className="font-bold">Ready To Publish</SelectItem><SelectItem value="Published" className="font-bold text-primary">Published</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )}/>
              <div className="flex justify-end gap-3 pt-6 border-t mt-6 bg-background/80 backdrop-blur-sm sticky bottom-0 p-4 z-50">
                  <Button type="button" variant="outline" onClick={() => router.push('/leads-members')} disabled={isLoading} className="font-bold border-primary/20 text-primary transition-transform active:scale-95">Discard</Button>
                  <Button type="button" variant="secondary" onClick={() => { form.reset(); setDocumentsToUpload([]); }} disabled={isLoading} className="font-bold transition-transform active:scale-95"><RotateCcw className="mr-2 h-4 w-4"/> Reset Form</Button>
                  <Button type="submit" disabled={isLoading} className="font-bold bg-primary text-white hover:bg-primary/90 shadow-md transition-transform active:scale-95">
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Register Lead Appeal
                  </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
       <AlertDialog open={isDuplicateAlertOpen} onOpenChange={setIsDuplicateAlertOpen}>
        <AlertDialogContent className="rounded-[16px] border-primary/10 shadow-dropdown">
            <AlertDialogHeader>
                <AlertDialogTitle className="font-bold text-primary">Duplicate Lead Entry Detected</AlertDialogTitle>
                <AlertDialogDescription className="font-normal text-primary/70">
                    An Appeal With This Name Already Exists In The Institutional Records. Are You Certain You Want To Create A Duplicate Record?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setLeadDataToCreate(null)} className="font-bold border-primary/20 text-primary">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { if (leadDataToCreate) { handleCreateLead(leadDataToCreate); } }} className="font-bold bg-primary text-white hover:bg-primary/90">
                    Confirm Creation
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}