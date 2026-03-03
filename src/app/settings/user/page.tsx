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

const MANDATORY_FIELDS = [
    { id: 'name', name: 'Full Name' },
    { id: 'email', name: 'Email Address' },
    { id: 'phone', name: 'Phone Number' },
    { id: 'loginId', name: 'Login ID' },
    { id: 'role', name: 'Role (Admin/User)' },
    { id: 'status', name: 'Status (Active/Inactive)' },
    { id: 'idProofType', name: 'ID Type' },
    { id: 'idNumber', name: 'ID Number' },
    { id: 'organizationGroup', name: 'Org Group' },
    { id: 'organizationRole', name: 'Org Role' },
];

export default function UserSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSubmitting] = useState(false);

  const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'user_config') : null, [firestore]);
  const { data: configSettings, isLoading } = useDoc<any>(configRef);

  const [localMandatory, setLocalMandatory] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (configSettings?.mandatoryFields) {
        setLocalMandatory(configSettings.mandatoryFields);
    }
  }, [configSettings]);

  const handleMandatoryToggle = (id: string) => {
    setLocalMandatory(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async () => {
    if (!configRef) return;
    setIsSubmitting(true);
    try {
        await setDoc(configRef, { mandatoryFields: localMandatory }, { merge: true });
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
        <Card className="animate-fade-in-zoom border-[#8fbca0]">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold text-[#136c34]">
                    <Settings className="h-5 w-5" /> User Module Settings
                </CardTitle>
                <CardDescription className="text-[#4D805F]">
                    General configuration for staff and administrator accounts.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-[#4D805F]">System-wide user behavior and login policy configurations can be managed here.</p>
            </CardContent>
        </Card>

        <Card className="animate-fade-in-up border-[#8fbca0]">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold text-[#136c34]">
                    <CheckSquare className="h-5 w-5" /> Mandatory Fields Setup
                </CardTitle>
                <CardDescription className="text-[#4D805F]">
                    Define which information must be collected for every organization user account.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MANDATORY_FIELDS.map(field => (
                        <div key={field.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`mandatory_user_${field.id}`} 
                                checked={localMandatory[field.id] === true} 
                                onCheckedChange={() => handleMandatoryToggle(field.id)} 
                            />
                            <Label htmlFor={`mandatory_user_${field.id}`} className="cursor-pointer font-normal text-[#4D805F]">{field.name}</Label>
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