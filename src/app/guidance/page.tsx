'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { useGuidance } from '@/hooks/use-guidance';
import { useFirestore } from '@/firebase/provider';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Plus, 
    Trash2, 
    Save, 
    X, 
    Edit, 
    Loader2, 
    Eye, 
    BookOpen, 
    Hospital, 
    Info, 
    Phone, 
    MapPin, 
    Globe,
    ArrowLeft,
    ShieldAlert
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, getNestedValue } from '@/lib/utils';
import { BrandedLoader } from '@/components/branded-loader';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import type { ResourceCategory, ExternalResource, GuidanceData } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function GuidanceHubPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { guidanceData, isLoading: isDataLoading, forceRefetch } = useGuidance();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localGuidance, setLocalGuidance] = useState<GuidanceData | null>(null);

    const canRead = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.guidance.read', false);
    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.guidance.update', false);

    useEffect(() => {
        if (guidanceData) {
            setLocalGuidance(JSON.parse(JSON.stringify(guidanceData)));
        }
    }, [guidanceData]);

    const handleSave = async () => {
        if (!firestore || !canUpdate || !localGuidance) return;
        setIsSubmitting(true);
        try {
            await setDoc(doc(firestore, 'settings', 'guidance'), localGuidance);
            toast({ title: 'Directory Synchronized', description: 'Resource changes have been secured.', variant: 'success' });
            setIsEditMode(false);
            forceRefetch();
        } catch (error: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'settings/guidance', operation: 'write', requestResourceData: localGuidance }));
        } finally {
            setIsSubmitting(false);
        }
    };

    const addCategory = () => {
        if (!localGuidance) return;
        const newCat: ResourceCategory = {
            id: `cat_${Date.now()}`,
            name: 'New Category',
            resources: []
        };
        setLocalGuidance({ ...localGuidance, categories: [...localGuidance.categories, newCat] });
    };

    const removeCategory = (catId: string) => {
        if (!localGuidance || !confirm('Delete This Entire Category And All Its Resources?')) return;
        setLocalGuidance({ ...localGuidance, categories: localGuidance.categories.filter(c => c.id !== catId) });
    };

    const addResource = (catId: string) => {
        if (!localGuidance) return;
        const newRes: ExternalResource = {
            id: `res_${Date.now()}`,
            name: 'New Resource',
            isHidden: false
        };
        const updated = localGuidance.categories.map(c => 
            c.id === catId ? { ...c, resources: [...c.resources, newRes] } : c
        );
        setLocalGuidance({ ...localGuidance, categories: updated });
    };

    const updateResource = (catId: string, resId: string, field: keyof ExternalResource, value: any) => {
        if (!localGuidance) return;
        const updated = localGuidance.categories.map(c => {
            if (c.id === catId) {
                return {
                    ...c,
                    resources: c.resources.map(r => r.id === resId ? { ...r, [field]: value } : r)
                };
            }
            return c;
        });
        setLocalGuidance({ ...localGuidance, categories: updated });
    };

    const removeResource = (catId: string, resId: string) => {
        if (!localGuidance) return;
        const updated = localGuidance.categories.map(c => {
            if (c.id === catId) {
                return { ...c, resources: c.resources.filter(r => r.id !== resId) };
            }
            return c;
        });
        setLocalGuidance({ ...localGuidance, categories: updated });
    };

    if (isSessionLoading || isDataLoading) return <BrandedLoader />;

    if (!canRead) {
        return (
            <main className="container mx-auto p-8">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle className="font-bold">Access Denied</AlertTitle>
                    <AlertDescription className="font-normal text-primary/70">
                        Missing Permissions To Access The Guidance Hub.
                    </AlertDescription>
                </Alert>
            </main>
        );
    }

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-6 text-primary font-normal animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Button variant="outline" asChild className="mb-2 font-bold border-primary/10 text-primary transition-transform active:scale-95">
                        <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Dashboard</Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Guidance Hub</h1>
                    <p className="text-sm text-muted-foreground font-normal">Manage the institutional directory of external assistance resources.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" asChild className="font-bold border-primary/10 text-primary active:scale-95">
                        <Link href="/info/guidance" target="_blank"><Eye className="mr-2 h-4 w-4" /> Public Preview</Link>
                    </Button>
                    {canUpdate && (
                        !isEditMode ? (
                            <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md">
                                <Edit className="mr-2 h-4 w-4" /> Modify Resources
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setIsEditMode(false)} disabled={isSubmitting} className="font-bold border-primary/20 text-primary">
                                    <X className="mr-2 h-4 w-4" /> Discard
                                </Button>
                                <Button onClick={handleSave} disabled={isSubmitting} className="font-bold shadow-md">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                                    Secure Hub
                                </Button>
                            </div>
                        )
                    )}
                </div>
            </div>

            {localGuidance && (
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-primary tracking-tight flex items-center gap-2">
                            <Hospital className="h-6 w-6" /> Assistance Categories
                        </h3>
                        {isEditMode && (
                            <Button onClick={addCategory} variant="outline" size="sm" className="font-bold border-primary/20 text-primary active:scale-95 transition-transform shadow-sm">
                                <Plus className="mr-2 h-4 w-4" /> Add Category
                            </Button>
                        )}
                    </div>

                    <div className="grid gap-8">
                        {localGuidance.categories.map((cat) => (
                            <Card key={cat.id} className="border-primary/10 overflow-hidden bg-white shadow-md">
                                <CardHeader className="bg-primary/[0.03] border-b px-6 py-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            {isEditMode ? (
                                                <Input 
                                                    value={cat.name} 
                                                    onChange={(e) => {
                                                        const updated = localGuidance.categories.map(c => c.id === cat.id ? { ...c, name: e.target.value } : c);
                                                        setLocalGuidance({ ...localGuidance, categories: updated });
                                                    }}
                                                    className="font-bold text-lg h-9 bg-white"
                                                />
                                            ) : (
                                                <CardTitle className="text-lg font-bold text-primary">{cat.name}</CardTitle>
                                            )}
                                        </div>
                                        {isEditMode && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCategory(cat.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest">Resources In Category</Label>
                                            {isEditMode && (
                                                <Button onClick={() => addResource(cat.id)} size="sm" variant="outline" className="h-7 text-[10px] font-bold border-primary/10 text-primary">
                                                    <Plus className="h-3 w-3 mr-1" /> Add Entry
                                                </Button>
                                            )}
                                        </div>
                                        
                                        <div className="grid gap-4">
                                            {cat.resources.map((res) => (
                                                <div key={res.id} className="relative p-4 border rounded-xl bg-primary/[0.01] transition-all hover:bg-white hover:shadow-sm border-primary/5 space-y-4">
                                                    {isEditMode && (
                                                        <div className="absolute top-2 right-2 flex items-center gap-2">
                                                            <div className="flex items-center space-x-2 mr-2">
                                                                <Checkbox 
                                                                    id={`hide-res-${res.id}`} 
                                                                    checked={res.isHidden} 
                                                                    onCheckedChange={(val) => updateResource(cat.id, res.id, 'isHidden', val === true)} 
                                                                />
                                                                <Label htmlFor={`hide-res-${res.id}`} className="text-[10px] font-bold opacity-60 cursor-pointer">Hide</Label>
                                                            </div>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeResource(cat.id, res.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-bold text-muted-foreground">Resource Name</Label>
                                                            <Input 
                                                                value={res.name} 
                                                                onChange={(e) => updateResource(cat.id, res.id, 'name', e.target.value)} 
                                                                disabled={!isEditMode}
                                                                className="h-8 font-bold text-sm text-primary"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-bold text-muted-foreground">Subtitle / Context</Label>
                                                            <Input 
                                                                value={res.subtitle || ''} 
                                                                onChange={(e) => updateResource(cat.id, res.id, 'subtitle', e.target.value)} 
                                                                disabled={!isEditMode}
                                                                className="h-8 font-normal text-sm"
                                                                placeholder="e.g. Dr. Name or Hospital Type"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-bold flex items-center gap-1"><Phone className="h-3 w-3 opacity-40"/> Phone</Label>
                                                            <Input value={res.phone || ''} onChange={(e) => updateResource(cat.id, res.id, 'phone', e.target.value)} disabled={!isEditMode} className="h-8 font-mono text-xs"/>
                                                        </div>
                                                        <div className="space-y-1 md:col-span-2">
                                                            <Label className="text-[9px] font-bold flex items-center gap-1"><MapPin className="h-3 w-3 opacity-40"/> Address</Label>
                                                            <Input value={res.address || ''} onChange={(e) => updateResource(cat.id, res.id, 'address', e.target.value)} disabled={!isEditMode} className="h-8 text-xs"/>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-bold flex items-center gap-1"><Info className="h-3 w-3 opacity-40"/> Institutional Guidance & Assistance Scope</Label>
                                                        <Textarea 
                                                            value={res.description || ''} 
                                                            onChange={(e) => updateResource(cat.id, res.id, 'description', e.target.value)} 
                                                            disabled={!isEditMode}
                                                            className="text-xs font-normal min-h-[60px]"
                                                            placeholder="Detail what help they provide and how to apply..."
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-bold flex items-center gap-1"><Globe className="h-3 w-3 opacity-40"/> Official Website / Portal</Label>
                                                        <Input value={res.link || ''} onChange={(e) => updateResource(cat.id, res.id, 'link', e.target.value)} disabled={!isEditMode} className="h-8 font-mono text-xs" placeholder="https://..."/>
                                                    </div>
                                                </div>
                                            ))}
                                            {cat.resources.length === 0 && <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-md italic font-normal">No resources defined in this category.</p>}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {localGuidance.categories.length === 0 && (
                            <div className="text-center py-24 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/10">
                                <BookOpen className="h-12 w-12 mx-auto text-primary/20 mb-4" />
                                <p className="text-sm font-bold text-primary/60 tracking-widest">Guidance Hub Is Currently Empty.</p>
                                {isEditMode && <p className="text-xs font-normal text-muted-foreground mt-2">Initialize The Registry By Adding A Category Above.</p>}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
