'use client';
import { useState, useEffect } from 'react';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Settings, Save, Loader2, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BrandedLoader } from '@/components/branded-loader';
import { Button } from '@/components/ui/button';

const VISIBILITY_OPTIONS = [
    { id: 'stat_cards', name: 'Top Metrics (Total/Verified/Pending)' },
    { id: 'status_chart', name: 'Status Distribution Donut' },
    { id: 'zakat_chart', name: 'Zakat Eligibility Donut' },
    { id: 'referral_chart', name: 'Top Referral Sources Bar' },
];

const MANDATORY_FIELDS = [
    { id: 'name', name: 'Name' },
    { id: 'address', name: 'Address' },
    { id: 'phone', name: 'Phone Number' },
    { id: 'age', name: 'Age' },
    { id: 'occupation', name: 'Occupation' },
    { id: 'members', name: 'Total Members' },
    { id: 'earningMembers', name: 'Earning Members' },
    { id: 'male', name: 'Male Members' },
    { id: 'female', name: 'Female Members' },
    { id: 'idProofType', name: 'ID Proof Type' },
    { id: 'idNumber', name: 'ID Number' },
    { id: 'referralBy', name: 'Referral By' },
    { id: 'kitAmount', name: 'Requirement Amount' },
    { id: 'status', name: 'Status' },
    { id: 'notes', name: 'Internal Notes' },
    { id: 'zakatAllocation', name: 'Zakat Allocation' },
];

export default function BeneficiarySettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSubmitting] = useState(false);

  const visRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'beneficiary_visibility') : null, [firestore]);
  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'beneficiary_config') : null, [firestore]);
  
  const { data: visibilitySettings, isLoading: isVisLoading } = useDoc<any>(visRef);
  const { data: configSettings, isLoading: isConfigLoading } = useDoc<any>(configRef);

  const [localVis, setLocalVis] = useState<Record<string, boolean>>({});
  const [localMandatory, setLocalMandatory] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visibilitySettings) setLocalVis(visibilitySettings);
    if (configSettings?.mandatoryFields) setLocalMandatory(configSettings.mandatoryFields);
  }, [visibilitySettings, configSettings]);

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
            setDoc(configRef, { mandatoryFields: localMandatory }, { merge: true })
        ]);
        toast({ title: "Settings Saved", variant: "success" });
    } catch (e) {
        toast({ title: "Failed to Save", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isVisLoading || isConfigLoading) return <BrandedLoader />;

  return (
    <div className="space-y-6">
        <Card className="animate-fade-in-zoom border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold text-primary">
                    <Settings className="h-5 w-5" /> Beneficiary Summary Visibility Settings
                </CardTitle>
                <CardDescription className="font-normal">
                    Control which analytical components are visible in the Beneficiary Summary.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="font-bold text-primary uppercase text-xs tracking-widest">Public Summary Visibility</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`public_ben_${opt.id}`} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`public_ben_${opt.id}`} 
                                        checked={localVis[`public_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'public')} 
                                    />
                                    <Label htmlFor={`public_ben_${opt.id}`} className="cursor-pointer font-normal">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-bold text-primary uppercase text-xs tracking-widest">Member Summary Visibility</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`member_ben_${opt.id}`} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`member_ben_${opt.id}`} 
                                        checked={localVis[`member_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'member')} 
                                    />
                                    <Label htmlFor={`member_ben_${opt.id}`} className="cursor-pointer font-normal">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="animate-fade-in-up border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold text-primary">
                    <CheckSquare className="h-5 w-5" /> Mandatory Fields Setup
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
                            />
                            <Label htmlFor={`mandatory_ben_${field.id}`} className="cursor-pointer font-normal">{field.name}</Label>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="justify-end border-t border-primary/10 p-4">
                <Button onClick={handleSave} disabled={isSaving} className="font-bold text-white bg-primary hover:bg-primary/90">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Save Settings
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}