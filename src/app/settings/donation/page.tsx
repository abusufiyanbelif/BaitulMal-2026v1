
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Settings, Save, Loader2, CheckSquare, Edit, X, RefreshCw, DatabaseZap, ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BrandedLoader } from '@/components/branded-loader';
import { Button } from '@/components/ui/button';
import { syncAllDonationsToDonorsAction, bulkRecalculateInitiativeTotalsAction } from '@/app/donations/actions';

const VISIBILITY_OPTIONS = [
    { id: 'yearly_summary', name: 'Yearly financial summary' },
    { id: 'category_breakdown', name: 'Donations by category donut chart' },
    { id: 'initiative_breakdown', name: 'Donations by initiative table' },
    { id: 'fund_totals_global', name: 'Global fund totals by type' },
    { id: 'payment_type_chart', name: 'Global payment type distribution' },
    { id: 'monthly_contribution_chart', name: 'Monthly contribution trends' },
    { id: 'unlinked_funds', name: 'Available Unlinked Funds total' },
];

const MANDATORY_FIELDS = [
    { id: 'donorName', name: 'Donor name' },
    { id: 'donorPhone', name: 'Donor phone' },
    { id: 'receiverName', name: 'Receiver name' },
    { id: 'referral', name: 'Referral' },
    { id: 'amount', name: 'Amount' },
    { id: 'donationType', name: 'Payment method' },
    { id: 'donationDate', name: 'Donation date' },
    { id: 'contributionFromDate', name: 'From date' },
    { id: 'contributionToDate', name: 'To date' },
    { id: 'status', name: 'Status' },
    { id: 'comments', name: 'Comments' },
    { id: 'suggestions', name: 'Suggestions' },
    { id: 'screenshot', name: 'Transaction screenshot' },
];

export default function DonationSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const visRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donation_visibility') : null, [firestore]);
  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donation_config') : null, [firestore]);
  
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
             setDoc(configRef, { mandatoryFields: localMandatory, isVerificationRequired: localVerification }, { merge: true })
         ]);
        toast({ title: "Settings saved", variant: "success" });
        setIsEditMode(false);
    } catch (e) {
        toast({ title: "Failed to save", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSyncHistorical = async () => {
    setIsSyncing(true);
    const res = await syncAllDonationsToDonorsAction();
    if (res.success) {
        toast({ title: "Sync Complete", description: `Successfully linked ${res.count} historical donations to the donor registry.`, variant: "success" });
    } else {
        toast({ title: "Sync Failed", description: res.message, variant: "destructive" });
    }
    setIsSyncing(false);
  };

  const handleRecalculateTotals = async () => {
      setIsSubmitting(true);
      const res = await bulkRecalculateInitiativeTotalsAction();
      if (res.success) {
          toast({ title: "Reconciliation Complete", description: res.message, variant: "success" });
      } else {
          toast({ title: "Recalculation Failed", description: res.message, variant: "destructive" });
      }
      setIsSubmitting(false);
  };

  const handleCancel = () => {
     if (visibilitySettings) setLocalVis(visibilitySettings);
     if (configSettings?.mandatoryFields) setLocalMandatory(configSettings.mandatoryFields);
     if (configSettings?.isVerificationRequired) setLocalVerification(configSettings.isVerificationRequired);
     setIsEditMode(false);
   };

  if (isVisLoading || isConfigLoading) return <BrandedLoader />;

  return (
    <div className="space-y-6 text-primary font-normal">
        <div className="flex justify-between items-center">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold">Donation Settings</h2>
                <p className="text-sm text-muted-foreground font-normal">Configure financial reporting and data requirements for donations.</p>
            </div>
            {!isEditMode ? (
                <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md">
                    <Edit className="mr-2 h-4 w-4" /> Edit Settings
                </Button>
            ) : (
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCancel} disabled={isSubmitting} className="font-bold border-primary/20 text-primary">
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSubmitting || !isDirty} className="font-bold shadow-md">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Save Changes
                    </Button>
                </div>
            )}
        </div>

        <Card className="animate-fade-in-zoom border-primary/10 bg-primary/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold">
                    <DatabaseZap className="h-5 w-5" /> Historical Data Sync
                </CardTitle>
                <CardDescription className="font-normal text-primary/70">
                    Scan all pre-existing donations and automatically create/link Donor Profiles based on phone numbers.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4">
                    <Button onClick={handleSyncHistorical} disabled={isSyncing} variant="secondary" className="font-bold border-primary/10 text-primary active:scale-95 transition-transform">
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Synchronize Historical Donations to Donor Registry
                    </Button>
                    <Button onClick={handleRecalculateTotals} disabled={isSubmitting} variant="outline" className="font-bold border-primary/10 text-primary active:scale-95 transition-transform bg-white">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                        Recalculate All Initiative Totals (Financial Audit)
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card className="animate-fade-in-up border-primary/10 bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2 font-bold">
                    <Settings className="h-5 w-5" /> Summary Visibility
                </CardTitle>
                <CardDescription className="font-normal">
                    Control the visibility of financial components in the primary donation summary pages.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="font-bold text-primary text-[10px] tracking-widest capitalize">Public View</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`public_don_${opt.id}`} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-primary/5 transition-colors">
                                    <Checkbox 
                                        id={`public_don_${opt.id}`} 
                                        checked={localVis[`public_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'public')} 
                                        disabled={!isEditMode}
                                    />
                                    <Label htmlFor={`public_don_${opt.id}`} className="cursor-pointer font-bold text-sm tracking-tight">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-bold text-primary text-[10px] tracking-widest capitalize">Member View</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`member_don_${opt.id}`} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-primary/5 transition-colors">
                                    <Checkbox 
                                        id={`member_don_${opt.id}`} 
                                        checked={localVis[`member_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'member')} 
                                        disabled={!isEditMode}
                                    />
                                    <Label htmlFor={`member_don_${opt.id}`} className="cursor-pointer font-bold text-sm tracking-tight">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="animate-fade-in-up border-primary/10 bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2 font-bold">
                    <CheckSquare className="h-5 w-5" /> Mandatory Fields
                </CardTitle>
                <CardDescription className="font-normal">
                    Define which information must be captured for every donation entry.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MANDATORY_FIELDS.map(field => (
                        <div key={field.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-primary/5 transition-colors">
                            <Checkbox 
                                id={`mandatory_don_${field.id}`} 
                                checked={localMandatory[field.id] === true} 
                                onCheckedChange={() => handleMandatoryToggle(field.id)} 
                                disabled={!isEditMode}
                            />
                            <Label htmlFor={`mandatory_don_${field.id}`} className="cursor-pointer font-bold text-sm tracking-tight">{field.name}</Label>
                        </div>
                    ))}
                </div>
            </CardContent>
         </Card>
 
         <Card className="animate-fade-in-up border-primary/10 bg-white shadow-sm overflow-hidden">
             <CardHeader className="bg-primary/5 border-b">
                 <CardTitle className="flex items-center gap-2 font-bold">
                     <ShieldCheck className="h-5 w-5" /> Audit & Workflow
                 </CardTitle>
                 <CardDescription className="font-normal text-primary/70">
                     Require secondary confirmation from another member before donation edits take effect.
                 </CardDescription>
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
     </div>
  );
}
