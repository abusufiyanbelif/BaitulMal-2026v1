'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Settings, Save, Loader2, CheckSquare, Edit, X, RefreshCw, DatabaseZap, ShieldCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BrandedLoader } from '@/components/branded-loader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

const VISIBILITY_OPTIONS = [
    { id: 'stat_cards', name: 'Top metrics (total/verified/pending)' },
    { id: 'status_chart', name: 'Status distribution donut' },
    { id: 'zakat_chart', name: 'Zakat eligibility donut' },
    { id: 'referral_chart', name: 'Top referral sources bar' },
];

const MANDATORY_FIELDS = [
    { id: 'name', name: 'Name' },
    { id: 'address', name: 'Address' },
    { id: 'phone', name: 'Phone number' },
    { id: 'age', name: 'Age' },
    { id: 'occupation', name: 'Occupation' },
    { id: 'members', name: 'Total members' },
    { id: 'earningMembers', name: 'Earning members' },
    { id: 'male', name: 'Male members' },
    { id: 'female', name: 'Female members' },
    { id: 'idProofType', name: 'ID proof type' },
    { id: 'idNumber', name: 'ID number' },
    { id: 'referralBy', name: 'Referral by' },
    { id: 'kitAmount', name: 'Requirement amount' },
    { id: 'status', name: 'Status' },
    { id: 'notes', name: 'Internal notes' },
    { id: 'zakatAllocation', name: 'Zakat allocation' },
];

export default function BeneficiarySettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const visRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'beneficiary_visibility') : null, [firestore]);
  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'beneficiary_config') : null, [firestore]);
  
  const { data: visibilitySettings, isLoading: isVisLoading } = useDoc<any>(visRef);
  const { data: configSettings, isLoading: isConfigLoading } = useDoc<any>(configRef);

  const [localVis, setLocalVis] = useState<Record<string, boolean>>({});
  const [localMandatory, setLocalMandatory] = useState<Record<string, boolean>>({});
  const [localVerificationMode, setLocalVerificationMode] = useState('Disabled');
 
   useEffect(() => {
     if (visibilitySettings) setLocalVis(visibilitySettings);
     if (configSettings?.mandatoryFields) setLocalMandatory(configSettings.mandatoryFields);
     if (configSettings?.verificationMode) setLocalVerificationMode(configSettings.verificationMode);
     else if (configSettings?.isVerificationRequired) setLocalVerificationMode('Mandatory');
   }, [visibilitySettings, configSettings]);
 
   const isDirty = useMemo(() => {
     const visChanged = JSON.stringify(localVis) !== JSON.stringify(visibilitySettings || {});
     const mandatoryChanged = JSON.stringify(localMandatory) !== JSON.stringify(configSettings?.mandatoryFields || {});
     const verificationChanged = localVerificationMode !== (configSettings?.verificationMode || 'Disabled');
     return visChanged || mandatoryChanged || verificationChanged;
   }, [localVis, localMandatory, localVerificationMode, visibilitySettings, configSettings]);

  const handleVisToggle = (id: string, group: 'public' | 'member') => {
    const key = `${group}_${id}`;
    setLocalVis(prev => ({ ...prev, [key]: !prev[key] }));
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
             setDoc(configRef, { 
                 mandatoryFields: localMandatory, 
                 isVerificationRequired: localVerificationMode !== 'Disabled',
                 verificationMode: localVerificationMode
             }, { merge: true })
         ]);
        toast({ title: "Settings saved", variant: "success" });
        setIsEditMode(false);
    } catch (e) {
        toast({ title: "Failed to save", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
     if (visibilitySettings) setLocalVis(visibilitySettings);
     if (configSettings?.mandatoryFields) setLocalMandatory(configSettings.mandatoryFields);
     if (configSettings?.verificationMode) setLocalVerificationMode(configSettings.verificationMode);
     else if (configSettings?.isVerificationRequired) setLocalVerificationMode('Mandatory');
     setIsEditMode(false);
   };

  if (isVisLoading || isConfigLoading) return <BrandedLoader />;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold text-primary">Beneficiary settings</h2>
                <p className="text-sm text-muted-foreground font-normal">Manage data collection and visibility for the beneficiary module.</p>
            </div>
            {!isEditMode ? (
                <Button onClick={() => setIsEditMode(true)} className="font-bold">
                    <Edit className="mr-2 h-4 w-4" /> Edit Settings
                </Button>
            ) : (
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCancel} disabled={isSubmitting} className="font-bold border-primary/20 text-primary">
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSubmitting || !isDirty} className="font-bold">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Save Changes
                    </Button>
                </div>
            )}
        </div>

        <Card className="animate-fade-in-zoom border-primary/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold text-primary">
                    <Settings className="h-5 w-5" /> Summary visibility
                </CardTitle>
                <CardDescription className="font-normal">
                    Control which analytical components are visible in the beneficiary summary.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="font-bold text-primary text-xs tracking-widest capitalize">Public view</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`public_ben_${opt.id}`} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`public_ben_${opt.id}`} 
                                        checked={localVis[`public_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'public')} 
                                        disabled={!isEditMode}
                                    />
                                    <Label htmlFor={`public_ben_${opt.id}`} className="cursor-pointer font-normal">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-bold text-primary text-xs tracking-widest capitalize">Member view</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`member_ben_${opt.id}`} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`member_ben_${opt.id}`} 
                                        checked={localVis[`member_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'member')} 
                                        disabled={!isEditMode}
                                    />
                                    <Label htmlFor={`member_ben_${opt.id}`} className="cursor-pointer font-normal">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="animate-fade-in-up border-primary/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold text-primary">
                    <CheckSquare className="h-5 w-5" /> Mandatory fields
                </CardTitle>
                <CardDescription className="font-normal">
                    Define required information for beneficiaries across the master list and initiatives.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MANDATORY_FIELDS.map(field => (
                        <div key={field.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`mandatory_ben_${field.id}`} 
                                checked={localMandatory[field.id] === true} 
                                onCheckedChange={() => handleMandatoryToggle(field.id)} 
                                disabled={!isEditMode}
                            />
                            <Label htmlFor={`mandatory_ben_${field.id}`} className="cursor-pointer font-normal">{field.name}</Label>
                        </div>
                    ))}
                </div>
            </CardContent>
         </Card>
 
         <Card className="animate-fade-in-up border-primary/10 bg-white shadow-sm overflow-hidden">
             <CardHeader className="bg-primary/5 border-b">
                 <CardTitle className="flex items-center gap-2 font-bold text-primary">
                     <ShieldCheck className="h-5 w-5" /> Audit & Workflow
                 </CardTitle>
                 <CardDescription className="font-normal text-primary/70">
                     Require secondary confirmation from another member before beneficiary profile updates take effect.
                 </CardDescription>
             </CardHeader>
             <CardContent className="pt-6">
                 <div className="flex flex-col space-y-3 p-4 rounded-xl bg-primary/[0.02] border border-primary/10">
                     <Label className="font-bold text-sm tracking-tight text-primary">Approval Requirement</Label>
                     <Select value={localVerificationMode} onValueChange={setLocalVerificationMode} disabled={!isEditMode}>
                         <SelectTrigger className="font-bold border-primary/20 bg-white shadow-sm w-full">
                             <SelectValue placeholder="Select Requirement" />
                         </SelectTrigger>
                         <SelectContent>
                             <SelectItem value="Disabled">Disabled (Changes apply instantly)</SelectItem>
                             <SelectItem value="Optional">Optional (Can bypass approval)</SelectItem>
                             <SelectItem value="Mandatory">Mandatory (Requires approval)</SelectItem>
                         </SelectContent>
                     </Select>
                     <p className="text-[10px] text-muted-foreground font-medium mt-2">
                        Control how modifications to cases are handled by default.
                     </p>
                 </div>
             </CardContent>
         </Card>
     </div>
  );
}
