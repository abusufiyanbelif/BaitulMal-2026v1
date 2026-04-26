'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Settings, Save, Loader2, CheckSquare, Edit, X, ShieldCheck, Bell, Smartphone } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { BrandedLoader } from '@/components/branded-loader';
import { Button } from '@/components/ui/button';
import { useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserCheck, Users, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const VISIBILITY_OPTIONS = [
    { id: 'funding_progress', name: 'Fundraising progress' },
    { id: 'quick_stats', name: 'Quick stats (beneficiaries)' },
    { id: 'beneficiary_groups', name: 'Beneficiary groups table' },
    { id: 'fund_totals', name: 'Fund totals by type' },
    { id: 'zakat_utilization', name: 'Zakat utilization' },
    { id: 'donations_by_category', name: 'Donations by category chart' },
    { id: 'donations_by_payment_type', name: 'Donations by payment type chart' },
    { id: 'documents', name: 'Artifacts & documents' },
];

const MANDATORY_FIELDS = [
    { id: 'name', name: 'Lead name' },
    { id: 'description', name: 'Description' },
    { id: 'purpose', name: 'Purpose' },
    { id: 'category', name: 'Category' },
    { id: 'status', name: 'Status' },
    { id: 'authenticityStatus', name: 'Authenticity status' },
    { id: 'publicVisibility', name: 'Public visibility' },
    { id: 'startDate', name: 'Start date' },
    { id: 'endDate', name: 'End date' },
    { id: 'requiredAmount', name: 'Required amount' },
    { id: 'targetAmount', name: 'Target goal' },
    { id: 'degree', name: 'Education: degree' },
    { id: 'year', name: 'Education: year' },
    { id: 'semester', name: 'Education: semester' },
    { id: 'diseaseIdentified', name: 'Medical: disease' },
    { id: 'diseaseStage', name: 'Medical: stage' },
    { id: 'seriousness', name: 'Medical: seriousness' },
];

export default function LeadSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const visRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'lead_visibility') : null, [firestore]);
  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'lead_config') : null, [firestore]);
  
  const { data: visibilitySettings, isLoading: isVisLoading } = useDoc<any>(visRef);
  const { data: configSettings, isLoading: isConfigLoading } = useDoc<any>(configRef);

  const [localVis, setLocalVis] = useState<Record<string, boolean>>({});
  const [localMandatory, setLocalMandatory] = useState<Record<string, boolean>>({});
  const [localVerificationMode, setLocalVerificationMode] = useState('Disabled');
  const [minApprovalsRequired, setMinApprovalsRequired] = useState(1);
  const [authorizedVerifiers, setAuthorizedVerifiers] = useState<string[]>([]);
  const [localWhatsAppNotify, setLocalWhatsAppNotify] = useState(true);
  const [localInAppNotify, setLocalInAppNotify] = useState(true);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const usersRef = useMemoFirebase(() => (firestore) ? query(collection(firestore, 'users'), where('status', '==', 'Active')) : null, [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersRef);

  const availableVerifiers = useMemo(() => {
    return (allUsers || []).filter(u => 
        (u.role === 'Admin' || u.role === 'User') &&
        (u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.loginId.toLowerCase().includes(userSearchTerm.toLowerCase()))
    );
  }, [allUsers, userSearchTerm]);
  const [localDonateNow, setLocalDonateNow] = useState(false);
  
   useEffect(() => {
     if (visibilitySettings) setLocalVis(visibilitySettings);
     if (configSettings?.mandatoryFields) setLocalMandatory(configSettings.mandatoryFields);
     if (configSettings?.verificationMode) {
         const mode = configSettings.verificationMode;
         const capitalized = mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
         setLocalVerificationMode(capitalized);
     } else if (configSettings?.isVerificationRequired) {
         setLocalVerificationMode('Mandatory');
     }
     if (configSettings?.minApprovalsRequired !== undefined) setMinApprovalsRequired(configSettings.minApprovalsRequired);
     if (configSettings?.authorizedVerifiers) setAuthorizedVerifiers(configSettings.authorizedVerifiers);
     if (configSettings?.isDonateNowVisible) setLocalDonateNow(configSettings.isDonateNowVisible);
     setLocalWhatsAppNotify(configSettings?.enableWhatsAppNotifications !== false);
     setLocalInAppNotify(configSettings?.enableInAppNotifications !== false);
   }, [visibilitySettings, configSettings]);

   const isDirty = useMemo(() => {
     const visChanged = JSON.stringify(localVis) !== JSON.stringify(visibilitySettings || {});
     const mandatoryChanged = JSON.stringify(localMandatory) !== JSON.stringify(configSettings?.mandatoryFields || {});
     const verificationChanged = localVerificationMode !== (configSettings?.verificationMode || 'Disabled');
     const minApprovalsChanged = Number(minApprovalsRequired) !== (configSettings?.minApprovalsRequired || 1);
     const authorizedChanged = JSON.stringify(authorizedVerifiers) !== JSON.stringify(configSettings?.authorizedVerifiers || []);
     const donateNowChanged = localDonateNow !== (configSettings?.isDonateNowVisible || false);
     const whatsappChanged = localWhatsAppNotify !== (configSettings?.enableWhatsAppNotifications !== false);
     const inAppChanged = localInAppNotify !== (configSettings?.enableInAppNotifications !== false);
     return visChanged || mandatoryChanged || verificationChanged || minApprovalsChanged || authorizedChanged || donateNowChanged || whatsappChanged || inAppChanged;
   }, [localVis, localMandatory, localVerificationMode, minApprovalsRequired, authorizedVerifiers, localDonateNow, localWhatsAppNotify, localInAppNotify, visibilitySettings, configSettings]);

  const handleVisToggle = (id: string, group: 'public' | 'member') => {
    const key = `${group}_${id}`;
    setLocalVis(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleMandatoryToggle = (id: string) => {
    setLocalMandatory(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleVerifier = (userId: string) => {
    if (!isEditMode) return;
    setAuthorizedVerifiers(prev => 
        prev.includes(userId) 
            ? prev.filter(id => id !== userId) 
            : [...prev, userId]
    );
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
                 verificationMode: localVerificationMode,
                 minApprovalsRequired: Number(minApprovalsRequired) || 1,
                 authorizedVerifiers: authorizedVerifiers,
                 isDonateNowVisible: localDonateNow,
                 enableWhatsAppNotifications: localWhatsAppNotify,
                 enableInAppNotifications: localInAppNotify
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
      if (configSettings?.verificationMode) {
          const mode = configSettings.verificationMode;
          const capitalized = mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
          setLocalVerificationMode(capitalized);
      } else if (configSettings?.isVerificationRequired) {
          setLocalVerificationMode('Mandatory');
      }
      if (configSettings?.minApprovalsRequired !== undefined) setMinApprovalsRequired(configSettings.minApprovalsRequired);
      if (configSettings?.isDonateNowVisible) setLocalDonateNow(configSettings.isDonateNowVisible);
      setLocalWhatsAppNotify(configSettings?.enableWhatsAppNotifications !== false);
      setLocalWhatsAppNotify(configSettings?.enableWhatsAppNotifications !== false);
      setLocalInAppNotify(configSettings?.enableInAppNotifications !== false);
      setIsEditMode(false);
   };

  if (isVisLoading || isConfigLoading) return <BrandedLoader />;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold text-primary">Lead settings</h2>
                <p className="text-sm text-muted-foreground font-normal">Manage data rules and summary visibility for individual support leads.</p>
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
                    <Settings className="h-5 w-5" /> Visibility settings
                </CardTitle>
                <CardDescription className="font-normal">
                    Control which summary components are visible to the public and staff members for lead appeals.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="font-bold text-primary text-xs tracking-widest capitalize">Public view</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`public_lead_${opt.id}`} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`public_lead_${opt.id}`} 
                                        checked={localVis[`public_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'public')} 
                                        disabled={!isEditMode}
                                    />
                                    <Label htmlFor={`public_lead_${opt.id}`} className="cursor-pointer font-normal">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-bold text-primary text-xs tracking-widest capitalize">Member view</h3>
                        <div className="space-y-3">
                            {VISIBILITY_OPTIONS.map(opt => (
                                <div key={`member_lead_${opt.id}`} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`member_lead_${opt.id}`} 
                                        checked={localVis[`member_${opt.id}`] !== false} 
                                        onCheckedChange={() => handleVisToggle(opt.id, 'member')} 
                                        disabled={!isEditMode}
                                    />
                                    <Label htmlFor={`member_lead_${opt.id}`} className="cursor-pointer font-normal">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="animate-fade-in-up border-primary/10 h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-bold text-primary">
                        <CheckSquare className="h-5 w-5" /> Mandatory fields
                    </CardTitle>
                    <CardDescription className="font-normal">
                        Define required fields for individual support leads.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {MANDATORY_FIELDS.map(field => (
                            <div key={field.id} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={`mandatory_lead_${field.id}`} 
                                    checked={localMandatory[field.id] === true} 
                                    onCheckedChange={() => handleMandatoryToggle(field.id)} 
                                    disabled={!isEditMode}
                                />
                                <Label htmlFor={`mandatory_lead_${field.id}`} className="cursor-pointer font-normal">{field.name}</Label>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <Card className="animate-fade-in-up border-primary/10 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="flex items-center gap-2 font-bold text-primary">
                            <ShieldCheck className="h-5 w-5" /> Audit & Workflow
                        </CardTitle>
                        <CardDescription className="font-normal text-primary/70">
                            Require secondary confirmation from another member.
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
                                Control how modifications to leads are handled by default.
                             </p>
                         </div>

                         {localVerificationMode !== 'Disabled' && (
                             <div className="flex flex-col space-y-3 p-4 rounded-xl bg-primary/[0.02] border border-primary/10 animate-fade-in mt-4">
                                 <Label className="font-bold text-sm tracking-tight text-primary">Required Approvals</Label>
                                 <Input 
                                     type="number" 
                                     min={1} 
                                     max={10}
                                     value={minApprovalsRequired} 
                                     onChange={(e) => setMinApprovalsRequired(parseInt(e.target.value))}
                                     disabled={!isEditMode}
                                     className="font-bold border-primary/20 bg-white shadow-sm w-full"
                                 />
                                 <p className="text-[10px] text-muted-foreground font-medium">
                                     Number of members required to approve a single change request.
                                 </p>
                             </div>
                         )}

                         {localVerificationMode !== 'Disabled' && (
                             <div className="flex flex-col space-y-3 p-4 rounded-xl bg-primary/[0.02] border border-primary/10 animate-fade-in mt-4">
                                 <div className="flex items-center justify-between">
                                     <Label className="font-bold text-sm tracking-tight text-primary">Designated Verifiers</Label>
                                     <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">{authorizedVerifiers.length} Selected</Badge>
                                 </div>
                                 <p className="text-[10px] text-muted-foreground font-medium">
                                     If specified, only these users will be allowed to verify changes. Leave empty to allow any Admin or Organization Member.
                                 </p>
                                 
                                 <div className="relative mt-2">
                                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                     <Input 
                                         placeholder="Filter members..." 
                                         className="pl-9 text-xs h-9 border-primary/10"
                                         value={userSearchTerm}
                                         onChange={(e) => setUserSearchTerm(e.target.value)}
                                         disabled={!isEditMode}
                                     />
                                 </div>

                                 <ScrollArea className="max-h-[240px] border rounded-lg bg-white p-2 border-primary/10">
                                     <div className="space-y-1">
                                         {availableVerifiers.map(u => (
                                             <div 
                                                 key={u.id}
                                                 onClick={() => toggleVerifier(u.id)}
                                                 className={cn(
                                                     "flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors",
                                                     authorizedVerifiers.includes(u.id) ? "bg-primary/10" : "hover:bg-primary/5"
                                                 )}
                                             >
                                                 <div className="flex items-center gap-2">
                                                     <Checkbox 
                                                         checked={authorizedVerifiers.includes(u.id)} 
                                                         onCheckedChange={() => toggleVerifier(u.id)}
                                                         disabled={!isEditMode}
                                                         className="data-[state=checked]:bg-primary"
                                                     />
                                                     <div className="flex flex-col">
                                                         <span className="text-xs font-bold">{u.name}</span>
                                                         <span className="text-[9px] text-muted-foreground">{u.role} | {u.loginId}</span>
                                                     </div>
                                                 </div>
                                                 {authorizedVerifiers.includes(u.id) && <UserCheck className="h-3 w-3 text-primary" />}
                                             </div>
                                         ))}
                                     </div>
                                 </ScrollArea>
                             </div>
                         )}
                     </CardContent>
                </Card>

                 <Card className="animate-fade-in-up border-primary/10 bg-white shadow-sm overflow-hidden">
                     <CardHeader className="bg-primary/5 border-b">
                         <CardTitle className="flex items-center gap-2 font-bold text-primary">
                             <Save className="h-5 w-5" /> Donation Controls
                         </CardTitle>
                         <CardDescription className="font-normal text-primary/70">
                             Manage public-facing donation options for individual appeals.
                         </CardDescription>
                     </CardHeader>
                     <CardContent className="pt-6">
                         <div className="flex items-center space-x-3 p-4 rounded-xl bg-primary/[0.02] border border-primary/10">
                             <Checkbox 
                                 id="is_donate_now_visible" 
                                 checked={localDonateNow} 
                                 onCheckedChange={(checked) => setLocalDonateNow(!!checked)} 
                                 disabled={!isEditMode}
                                 className="data-[state=checked]:bg-primary"
                             />
                             <div className="space-y-0.5">
                                 <Label htmlFor="is_donate_now_visible" className="cursor-pointer font-bold text-sm tracking-tight text-primary">Show "Donate Now" Button</Label>
                                 <p className="text-[10px] text-muted-foreground font-medium">Allow the public to initiate donations directly from the appeal page.</p>
                             </div>
                         </div>
                     </CardContent>
                 </Card>

                 <Card className="animate-fade-in-up border-primary/10 bg-white shadow-sm overflow-hidden">
                     <CardHeader className="bg-primary/5 border-b">
                         <CardTitle className="flex items-center gap-2 font-bold text-primary">
                             <Bell className="h-5 w-5" /> Notification Settings
                         </CardTitle>
                         <CardDescription className="font-normal text-primary/70">
                             Configure how members and admins are notified about lead events.
                         </CardDescription>
                     </CardHeader>
                     <CardContent className="pt-6 space-y-4">
                         <div className="flex items-center space-x-3 p-4 rounded-xl bg-primary/[0.02] border border-primary/10">
                             <Checkbox 
                                 id="lead_whatsapp_notify" 
                                 checked={localWhatsAppNotify} 
                                 onCheckedChange={(checked) => setLocalWhatsAppNotify(!!checked)} 
                                 disabled={!isEditMode}
                                 className="data-[state=checked]:bg-primary"
                             />
                             <div className="space-y-0.5">
                                 <div className="flex items-center gap-2">
                                    <Smartphone className="h-3 w-3 text-green-500" />
                                    <Label htmlFor="lead_whatsapp_notify" className="cursor-pointer font-bold text-sm tracking-tight text-primary">WhatsApp Notifications</Label>
                                 </div>
                                 <p className="text-[10px] text-muted-foreground font-medium">Send automated WhatsApp alerts for lead creations and approvals.</p>
                             </div>
                         </div>

                         <div className="flex items-center space-x-3 p-4 rounded-xl bg-primary/[0.02] border border-primary/10">
                             <Checkbox 
                                 id="lead_inapp_notify" 
                                 checked={localInAppNotify} 
                                 onCheckedChange={(checked) => setLocalInAppNotify(!!checked)} 
                                 disabled={!isEditMode}
                                 className="data-[state=checked]:bg-primary"
                             />
                             <div className="space-y-0.5">
                                 <div className="flex items-center gap-2">
                                    <Bell className="h-3 w-3 text-blue-500" />
                                    <Label htmlFor="lead_inapp_notify" className="cursor-pointer font-bold text-sm tracking-tight text-primary">In-App Notifications</Label>
                                 </div>
                                 <p className="text-[10px] text-muted-foreground font-medium">Show alerts on profile dashboard and approval toast messages after login.</p>
                             </div>
                         </div>
                     </CardContent>
                 </Card>
             </div>
         </div>
     </div>
  );
}
