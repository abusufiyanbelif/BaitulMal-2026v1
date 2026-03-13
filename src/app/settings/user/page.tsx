'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Settings, Save, Loader2, CheckSquare, Edit, X, RefreshCw, Users, ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BrandedLoader } from '@/components/branded-loader';
import { Button } from '@/components/ui/button';
import { syncAllUsersToDonorsAction } from '@/app/users/actions';
import { useSession } from '@/hooks/use-session';

const MANDATORY_FIELDS = [
    { id: 'name', name: 'Full name' },
    { id: 'email', name: 'Email address' },
    { id: 'phone', name: 'Phone number' },
    { id: 'loginId', name: 'Login ID' },
    { id: 'role', name: 'Role (admin/user)' },
    { id: 'status', name: 'Status (active/inactive)' },
    { id: 'idProofType', name: 'ID type' },
    { id: 'idNumber', name: 'ID number' },
    { id: 'organizationGroup', name: 'Org group' },
    { id: 'organizationRole', name: 'Org role' },
];

export default function UserSettingsPage() {
  const firestore = useFirestore();
  const { userProfile } = useSession();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'user_config') : null, [firestore]);
  const { data: configSettings, isLoading } = useDoc<any>(configRef);

  const [localMandatory, setLocalMandatory] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (configSettings?.mandatoryFields) {
        setLocalMandatory(configSettings.mandatoryFields);
    }
  }, [configSettings]);

  const isDirty = useMemo(() => {
    return JSON.stringify(localMandatory) !== JSON.stringify(configSettings?.mandatoryFields || {});
  }, [localMandatory, configSettings]);

  const handleMandatoryToggle = (id: string) => {
    setLocalMandatory(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async () => {
    if (!configRef) return;
    setIsSubmitting(true);
    try {
        await setDoc(configRef, { mandatoryFields: localMandatory }, { merge: true });
        toast({ title: "Settings saved", variant: "success" });
        setIsEditMode(false);
    } catch (e) {
        toast({ title: "Failed to save", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSyncMembers = async () => {
    if (!userProfile) return;
    setIsSyncing(true);
    const res = await syncAllUsersToDonorsAction(userProfile.id, userProfile.name);
    if (res.success) {
        toast({ title: "Sync Complete", description: res.message, variant: "success" });
    } else {
        toast({ title: "Sync Failed", description: res.message, variant: "destructive" });
    }
    setIsSyncing(false);
  };

  const handleCancel = () => {
    if (configSettings?.mandatoryFields) {
        setLocalMandatory(configSettings.mandatoryFields);
    }
    setIsEditMode(false);
  };

  if (isLoading) return <BrandedLoader />;

  return (
    <div className="space-y-6 text-primary font-normal animate-fade-in-up">
        <div className="flex justify-between items-center">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold">User settings</h2>
                <p className="text-sm text-muted-foreground font-normal">Manage data validation and account policies for the organization.</p>
            </div>
            {!isEditMode ? (
                <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md transition-transform active:scale-95">
                    <Edit className="mr-2 h-4 w-4" /> Edit Settings
                </Button>
            ) : (
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCancel} disabled={isSubmitting} className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
                        <X className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSubmitting || !isDirty} className="font-bold shadow-md transition-transform active:scale-95">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Save Changes
                    </Button>
                </div>
            )}
        </div>

        <Card className="border-primary/10 bg-primary/5 shadow-none overflow-hidden">
            <CardHeader className="bg-primary/5 border-b pb-4">
                <CardTitle className="flex items-center gap-2 font-bold text-lg">
                    <ShieldCheck className="h-5 w-5" /> Member-Donor Mirroring
                </CardTitle>
                <CardDescription className="font-normal text-primary/70">Every organization member is also registered as a contributor in the Donor Hub.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-4 rounded-xl bg-white border border-primary/10 shadow-sm">
                    <div className="space-y-1">
                        <h3 className="font-bold text-sm tracking-tight flex items-center gap-2 text-primary">
                            <Users className="h-4 w-4" /> Mirror Existing Members
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Scan the user registry and ensure every member has a linked Donor Profile. Run this if profiles were created before the Donor Module was introduced.</p>
                    </div>
                    <Button onClick={handleSyncMembers} disabled={isSyncing} variant="secondary" className="font-bold border-primary/10 text-primary active:scale-95 transition-transform shrink-0">
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Mirror Profiles Now
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card className="animate-fade-in-zoom border-primary/10 bg-white shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2 font-bold text-primary">
                    <Settings className="h-5 w-5" /> Account requirements
                </CardTitle>
                <CardDescription className="font-normal">
                    Define which information must be collected for every organization user account.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MANDATORY_FIELDS.map(field => (
                        <div key={field.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-primary/[0.02] transition-colors border border-transparent hover:border-primary/5">
                            <Checkbox 
                                id={`mandatory_user_${field.id}`} 
                                checked={localMandatory[field.id] === true} 
                                onCheckedChange={() => handleMandatoryToggle(field.id)} 
                                disabled={!isEditMode}
                            />
                            <Label htmlFor={`mandatory_user_${field.id}`} className="cursor-pointer font-bold text-sm tracking-tight">{field.name}</Label>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
