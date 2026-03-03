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
    { id: 'yearly_summary', name: 'Yearly Financial Summary' },
    { id: 'category_breakdown', name: 'Donations by Category Donut Chart' },
    { id: 'initiative_breakdown', name: 'Donations by Initiative Table' },
    { id: 'fund_totals_global', name: 'Global Fund Totals by Type' },
    { id: 'payment_type_chart', name: 'Global Payment Type Distribution' },
    { id: 'monthly_contribution_chart', name: 'Monthly Contribution Trends' },
];

const MANDATORY_FIELDS = [
    { id: 'donorName', name: 'Donor Name' },
    { id: 'donorPhone', name: 'Donor Phone' },
    { id: 'receiverName', name: 'Receiver Name' },
    { id: 'referral', name: 'Referral' },
    { id: 'amount', name: 'Amount' },
    { id: 'donationType', name: 'Payment Method' },
    { id: 'donationDate', name: 'Donation Date' },
    { id: 'contributionFromDate', name: 'From Date' },
    { id: 'contributionToDate', name: 'To Date' },
    { id: 'status', name: 'Status' },
    { id: 'comments', name: 'Comments' },
    { id: 'suggestions', name: 'Suggestions' },
    { id: 'screenshot', name: 'Transaction Screenshot' },
];

export default function DonationSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSubmitting] = useState(false);

  const visRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donation_visibility') : null, [firestore]);
  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donation_config') : null, [firestore]);
  
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
        <Card className="animate-fade-in-zoom border-[#8fbca0]">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold text-[#136c34]">
                    <Settings className="h-5 w-5" /> Donation Hub Visibility Settings
                </CardTitle>
                <CardDescription className="text-[#4D805F]">
                    Control the visibility of financial components in the primary Donation Summary pages.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="font-bold text-[#136c34] uppercase text-xs tracking-widest">Public Summary Visibility</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`public_don_${opt.id}`} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`public_don_${opt.id}`} 
                                        checked={localVis[`public_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'public')} 
                                    />
                                    <Label htmlFor={`public_don_${opt.id}`} className="cursor-pointer font-normal text-[#4D805F]">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-bold text-[#136c34] uppercase text-xs tracking-widest">Member Summary Visibility</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`member_don_${opt.id}`} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`member_don_${opt.id}`} 
                                        checked={localVis[`member_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'member')} 
                                    />
                                    <Label htmlFor={`member_don_${opt.id}`} className="cursor-pointer font-normal text-[#4D805F]">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="animate-fade-in-up border-[#8fbca0]">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold text-[#136c34]">
                    <CheckSquare className="h-5 w-5" /> Mandatory Fields Setup
                </CardTitle>
                <CardDescription className="text-[#4D805F]">
                    Define which information must be captured for every donation.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MANDATORY_FIELDS.map(field => (
                        <div key={field.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`mandatory_don_${field.id}`} 
                                checked={localMandatory[field.id] === true} 
                                onCheckedChange={() => handleMandatoryToggle(field.id)} 
                            />
                            <Label htmlFor={`mandatory_don_${field.id}`} className="cursor-pointer font-normal text-[#4D805F]">{field.name}</Label>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="justify-end border-t border-[#8fbca0] p-4">
                <Button onClick={handleSave} disabled={isSaving} className="font-bold bg-[#136c34] hover:bg-[#136c34]/90">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Save Settings
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}