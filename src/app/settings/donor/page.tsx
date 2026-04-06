'use client';
 
 import { useState, useEffect, useMemo } from 'react';
 import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
 import { doc, setDoc } from 'firebase/firestore';
 import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
 import { Settings, Save, Loader2, CheckSquare, Edit, X, UserSearch, ShieldCheck } from 'lucide-react';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Label } from '@/components/ui/label';
 import { useToast } from '@/hooks/use-toast';
 import { BrandedLoader } from '@/components/branded-loader';
 import { Button } from '@/components/ui/button';
 
 const VISIBILITY_OPTIONS = [
     { id: 'donor_stat_cards', name: 'Total profile count metrics' },
     { id: 'donor_impact_summary', name: 'Lifetime contribution aggregate' },
     { id: 'donor_retention_chart', name: 'Retention & loyalty chart' },
     { id: 'donor_history_tab', name: 'Donation history table in profile' },
 ];
 
 const MANDATORY_FIELDS = [
     { id: 'name', name: 'Full name' },
     { id: 'phone', name: 'Primary phone number' },
     { id: 'email', name: 'Email address' },
     { id: 'address', name: 'Residential address' },
     { id: 'status', name: 'Active status' },
     { id: 'notes', name: 'Institutional notes' },
 ];
 
 export default function DonorSettingsPage() {
   const firestore = useFirestore();
   const { toast } = useToast();
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isEditMode, setIsEditMode] = useState(false);
 
   const visRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donor_visibility') : null, [firestore]);
   const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donor_config') : null, [firestore]);
   
   const { data: visibilitySettings, isLoading: isVisLoading } = useDoc<any>(visRef);
   const { data: configSettings, isLoading: isConfigLoading } = useDoc<any>(configRef);
 
   const [localVis, setLocalVis] = useState<Record<string, boolean>>({});
   const [localMandatory, setLocalMandatory] = useState<Record<string, boolean>>({});
   const [localVerification, setLocalVerification] = useState(false);
 
   useEffect(() => {
     if (visibilitySettings) setLocalVis(visibilitySettings);
     if (configSettings?.mandatoryFields) setLocalMandatory(configSettings.mandatoryFields);
     if (configSettings?.isVerificationRequired) setLocalVerification(configSettings.isVerificationRequired);
   }, [visibilitySettings, configSettings]);
 
   const isDirty = useMemo(() => {
     const visChanged = JSON.stringify(localVis) !== JSON.stringify(visibilitySettings || {});
     const mandatoryChanged = JSON.stringify(localMandatory) !== JSON.stringify(configSettings?.mandatoryFields || {});
     const verificationChanged = localVerification !== (configSettings?.isVerificationRequired || false);
     return visChanged || mandatoryChanged || verificationChanged;
   }, [localVis, localMandatory, localVerification, visibilitySettings, configSettings]);
 
   const handleVisToggle = (id: string) => {
     setLocalVis(prev => ({ ...prev, [id]: !prev[id] }));
   };
 
   const handleMandatoryToggle = (id: string) => {
     setLocalMandatory(prev => ({ ...prev, [id]: !prev[id] }));
   };
 
   const handleSave = async () => {
     if (!visRef || !configRef) return;
     setIsSubmitting(true);
     try {
         await Promise.all([
             setDoc(visRef, localVis),
             setDoc(configRef, { mandatoryFields: localMandatory, isVerificationRequired: localVerification }, { merge: true })
         ]);
         toast({ title: "Settings Saved Successfully", variant: "success" });
         setIsEditMode(false);
     } catch (e) {
         toast({ title: "Failed to Save Configuration", variant: "destructive" });
     } finally {
         setIsSubmitting(false);
     }
   };
 
   if (isVisLoading || isConfigLoading) return <BrandedLoader />;
 
   return (
     <div className="space-y-6 text-primary font-normal">
         <div className="flex justify-between items-center">
             <div className="space-y-1">
                 <h2 className="text-2xl font-bold">Donor Module Settings</h2>
                 <p className="text-sm text-muted-foreground font-normal">Configure data collection rules and reporting visibility for contributors.</p>
             </div>
             {!isEditMode ? (
                 <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md transition-transform active:scale-95">
                     <Edit className="mr-2 h-4 w-4" /> Edit Config
                 </Button>
             ) : (
                 <div className="flex gap-2">
                     <Button variant="outline" onClick={() => {
                         if (visibilitySettings) setLocalVis(visibilitySettings);
                         if (configSettings?.mandatoryFields) setLocalMandatory(configSettings.mandatoryFields);
                         if (configSettings?.isVerificationRequired) setLocalVerification(configSettings.isVerificationRequired);
                         setIsEditMode(false);
                     }} className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
                         <X className="mr-2 h-4 w-4" /> Discard
                     </Button>
                     <Button onClick={handleSave} disabled={isSubmitting || !isDirty} className="font-bold shadow-md transition-transform active:scale-95">
                         {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                         Secure Changes
                     </Button>
                 </div>
             )}
         </div>
 
         <div className="grid gap-6 md:grid-cols-2 animate-fade-in-up">
             <Card className="border-primary/10 bg-white overflow-hidden shadow-sm">
                 <CardHeader className="bg-primary/5 border-b pb-4">
                     <CardTitle className="flex items-center gap-2 font-bold text-base text-primary">
                         <Settings className="h-5 w-5" /> Module Visibility
                     </CardTitle>
                     <CardDescription className="text-xs font-normal">Control component availability within the member area donor summary.</CardDescription>
                 </CardHeader>
                 <CardContent className="pt-6">
                     <div className="space-y-4">
                         {VISIBILITY_OPTIONS.map(opt => (
                             <div key={opt.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-primary/[0.02] transition-colors">
                                 <Checkbox 
                                     id={`vis_${opt.id}`} 
                                     checked={localVis[opt.id] !== false} 
                                     onCheckedChange={() => handleVisToggle(opt.id)} 
                                     disabled={!isEditMode}
                                 />
                                 <Label htmlFor={`vis_${opt.id}`} className="cursor-pointer font-bold text-sm tracking-tight">{opt.name}</Label>
                             </div>
                         ))}
                     </div>
                 </CardContent>
             </Card>
 
             <Card className="border-primary/10 bg-white overflow-hidden shadow-sm">
                 <CardHeader className="bg-primary/5 border-b pb-4">
                     <CardTitle className="flex items-center gap-2 font-bold text-base text-primary">
                         <CheckSquare className="h-5 w-5" /> Profile Requirements
                     </CardTitle>
                     <CardDescription className="text-xs font-normal">Define which donor profile fields must be populated during registration.</CardDescription>
                 </CardHeader>
                 <CardContent className="pt-6">
                     <div className="grid grid-cols-1 gap-3">
                         {MANDATORY_FIELDS.map(field => (
                             <div key={field.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-primary/[0.02] transition-colors border border-transparent hover:border-primary/5">
                                 <Checkbox 
                                     id={`mandatory_${field.id}`} 
                                     checked={localMandatory[field.id] === true} 
                                     onCheckedChange={() => handleMandatoryToggle(field.id)} 
                                     disabled={!isEditMode}
                                 />
                                 <Label htmlFor={`mandatory_${field.id}`} className="cursor-pointer font-bold text-sm tracking-tight">{field.name}</Label>
                             </div>
                         ))}
                     </div>
                 </CardContent>
             </Card>
         </div>
 
         <Card className="border-primary/10 bg-white shadow-sm overflow-hidden">
             <CardHeader className="bg-primary/5 border-b pb-4">
                 <CardTitle className="flex items-center gap-2 font-bold text-base text-primary">
                     <ShieldCheck className="h-5 w-5" /> Audit & Workflow
                 </CardTitle>
                 <CardDescription className="text-xs font-normal">Require secondary confirmation from another member before donor profile updates take effect.</CardDescription>
             </CardHeader>
             <CardContent className="pt-6">
                 <div className="flex items-center space-x-3 p-4 rounded-xl bg-primary/[0.02] border border-primary/10">
                     <Checkbox 
                         id="verification_required" 
                         checked={localVerification} 
                         onCheckedChange={(checked) => setLocalVerification(!!checked)} 
                         disabled={!isEditMode}
                         className="data-[state=checked]:bg-primary"
                     />
                     <div className="space-y-0.5">
                         <Label htmlFor="verification_required" className="cursor-pointer font-bold text-sm tracking-tight text-primary">Enable "Assign to Verifier" on Edits</Label>
                         <p className="text-[10px] text-muted-foreground font-medium">Changes will remain "Pending" until the assigned member confirms them.</p>
                     </div>
                 </div>
             </CardContent>
         </Card>
 
         <Card className="border-primary/10 bg-primary/5 shadow-none overflow-hidden mt-6">
             <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
                 <div className="p-3 rounded-full bg-primary/10 text-primary">
                     <UserSearch className="h-8 w-8" />
                 </div>
                 <div className="space-y-1">
                     <h3 className="font-bold text-lg tracking-tight">Institutional Donor Search</h3>
                     <p className="text-xs text-muted-foreground font-normal max-w-lg mx-auto">
                         This configuration applies to the **Search Donor** feature within donation registries. Enforcing phone or email as mandatory ensures that profiles can be accurately retrieved and merged.
                     </p>
                 </div>
             </CardContent>
         </Card>
     </div>
   );
 }
