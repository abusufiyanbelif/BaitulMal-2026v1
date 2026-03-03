'use client';
import { useState, useEffect } from 'react';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Settings, Save, Loader2 } from 'lucide-react';
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

export default function BeneficiarySettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSubmitting] = useState(false);

  const docRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'beneficiary_visibility') : null, [firestore]);
  const { data: visibilitySettings, isLoading } = useDoc<any>(docRef);
  const [localSettings, setLocalSettings] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visibilitySettings) {
        setLocalSettings(visibilitySettings);
    }
  }, [visibilitySettings]);

  const handleToggle = (id: string, group: 'public' | 'member') => {
    const key = `${group}_${id}`;
    setLocalSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!docRef) return;
    setIsSubmitting(true);
    try {
        await setDoc(docRef, localSettings);
        toast({ title: "Settings Saved", variant: "success" });
    } catch (e) {
        toast({ title: "Failed to Save", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoading) return <BrandedLoader />;

  return (
    <div className="space-y-6">
        <Card className="animate-fade-in-zoom">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 font-bold text-primary">
            <Settings className="h-5 w-5" /> Beneficiary Summary Visibility Settings
            </CardTitle>
            <CardDescription className="font-normal">
            Control which analytical components are visible in the Beneficiary Summary.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 font-normal">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="font-bold text-[#1b9d4a] uppercase text-xs tracking-widest">Public Summary Visibility</h3>
                    <div className="space-y-3">
                        {VISIBILITY_OPTIONS.map(opt => (
                            <div key={`public_ben_${opt.id}`} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={`public_ben_${opt.id}`} 
                                    checked={localSettings[`public_${opt.id}`] !== false} 
                                    onCheckedChange={() => handleToggle(opt.id, 'public')} 
                                />
                                <Label htmlFor={`public_ben_${opt.id}`} className="cursor-pointer font-normal">{opt.name}</Label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <h3 className="font-bold text-[#1b9d4a] uppercase text-xs tracking-widest">Member Summary Visibility</h3>
                    <div className="space-y-3">
                        {VISIBILITY_OPTIONS.map(opt => (
                            <div key={`member_ben_${opt.id}`} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={`member_ben_${opt.id}`} 
                                    checked={localSettings[`member_${opt.id}`] !== false} 
                                    onCheckedChange={() => handleToggle(opt.id, 'member')} 
                                />
                                <Label htmlFor={`member_ben_${opt.id}`} className="cursor-pointer font-normal">{opt.name}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </CardContent>
        <CardFooter className="justify-end border-t p-4 gap-2">
            <Button onClick={handleSave} disabled={isSaving} className="font-bold">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                Save Visibility Settings
            </Button>
        </CardFooter>
        </Card>
    </div>
  );
}
