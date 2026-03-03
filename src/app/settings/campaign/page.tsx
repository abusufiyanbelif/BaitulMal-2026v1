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
    { id: 'funding_progress', name: 'Fundraising progress' },
    { id: 'quick_stats', name: 'Quick stats (beneficiaries/kits)' },
    { id: 'beneficiary_groups', name: 'Beneficiary groups table' },
    { id: 'fund_totals', name: 'Fund totals by type' },
    { id: 'zakat_utilization', name: 'Zakat utilization' },
    { id: 'donations_by_category', name: 'Donations by category chart' },
    { id: 'donations_by_payment_type', name: 'Donations by payment type chart' },
    { id: 'documents', name: 'Artifacts & documents' },
];

const MANDATORY_FIELDS = [
    { id: 'name', name: 'Campaign name' },
    { id: 'description', name: 'Description' },
    { id: 'category', name: 'Category' },
    { id: 'status', name: 'Status' },
    { id: 'authenticityStatus', name: 'Authenticity status' },
    { id: 'publicVisibility', name: 'Public visibility' },
    { id: 'startDate', name: 'Start date' },
    { id: 'endDate', name: 'End date' },
    { id: 'targetAmount', name: 'Target amount' },
];

export default function CampaignSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSubmitting] = useState(false);

  const visRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'campaign_visibility') : null, [firestore]);
  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'campaign_config') : null, [firestore]);
  
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
        toast({ title: "Settings saved", variant: "success" });
    } catch (e) {
        toast({ title: "Failed to save", variant: "destructive" });
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
                    <Settings className="h-5 w-5" /> Campaign visibility settings
                </CardTitle>
                <CardDescription className="font-normal">
                    Control which summary components are visible to the public and staff members.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="font-bold text-primary text-xs tracking-widest">Public summary visibility</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`public_${opt.id}`} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`public_${opt.id}`} 
                                        checked={localVis[`public_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'public')} 
                                    />
                                    <Label htmlFor={`public_${opt.id}`} className="cursor-pointer font-normal">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-bold text-primary text-xs tracking-widest">Member summary visibility</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`member_${opt.id}`} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`member_${opt.id}`} 
                                        checked={localVis[`member_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'member')} 
                                    />
                                    <Label htmlFor={`member_${opt.id}`} className="cursor-pointer font-normal">{opt.name}</Label>
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
                    <CheckSquare className="h-5 w-5" /> Mandatory fields setup
                </CardTitle>
                <CardDescription className="font-normal">
                    Define which fields must be filled when creating or editing a campaign.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MANDATORY_FIELDS.map(field => (
                        <div key={field.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`mandatory_campaign_${field.id}`} 
                                checked={localMandatory[field.id] === true} 
                                onCheckedChange={() => handleMandatoryToggle(field.id)} 
                            />
                            <Label htmlFor={`mandatory_campaign_${field.id}`} className="cursor-pointer font-normal">{field.name}</Label>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="justify-end border-t border-primary/10 p-4">
                <Button onClick={handleSave} disabled={isSaving} className="font-bold text-white bg-primary hover:bg-primary/90">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Save settings
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}