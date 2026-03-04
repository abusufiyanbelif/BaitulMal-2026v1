'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Settings, Save, Loader2, CheckSquare, Edit, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { BrandedLoader } from '@/components/branded-loader';
import { Button } from '@/components/ui/button';

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
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleCancel = () => {
    if (configSettings?.mandatoryFields) {
        setLocalMandatory(configSettings.mandatoryFields);
    }
    setIsEditMode(false);
  };

  if (isLoading) return <BrandedLoader />;

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold text-primary">User settings</h2>
                <p className="text-sm text-muted-foreground font-normal">Manage data validation and account policies for the organization.</p>
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
                    <Settings className="h-5 w-5" /> Module configuration
                </CardTitle>
                <CardDescription className="font-normal">
                    General settings for staff and administrator accounts.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-foreground font-normal leading-relaxed">System-wide user behavior and login policy configurations can be managed here to ensure organizational security and data integrity.</p>
            </CardContent>
        </Card>

        <Card className="animate-fade-in-up border-primary/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-bold text-primary">
                    <CheckSquare className="h-5 w-5" /> Mandatory fields
                </CardTitle>
                <CardDescription className="font-normal">
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
                                disabled={!isEditMode}
                            />
                            <Label htmlFor={`mandatory_user_${field.id}`} className="cursor-pointer font-normal">{field.name}</Label>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
