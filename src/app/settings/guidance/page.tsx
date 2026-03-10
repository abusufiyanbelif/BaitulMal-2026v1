'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/hooks/use-session';
import { useGuidance } from '@/hooks/use-guidance';
import { useFirestore, useMemoFirebase } from '@/firebase/provider';
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
    ChevronDown, 
    BookOpen, 
    Hospital, 
    Info, 
    Phone, 
    MapPin, 
    Globe, 
    User,
    CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn, getNestedValue } from '@/lib/utils';
import { BrandedLoader } from '@/components/branded-loader';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { ResourceCategory, ExternalResource, GuidanceData } from '@/lib/types';

export default function GuidanceSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const { guidanceData, isLoading: isDataLoading, forceRefetch } = useGuidance();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Local editable state
    const [localGuidance, setLocalGuidance] = useState<GuidanceData | null>(null);

    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.guidance.update', false);

    useEffect(() => {
        if (guidanceData) {
            setLocalGuidance(JSON.parse(JSON.stringify(guidanceData)));
        } else if (!isDataLoading) {
            setLocalGuidance({
                title: 'Community Resource Directory',
                description: 'While we strive to help everyone, our resources are limited. Here are external organizations and schemes that may be able to assist you.',
                categories: [],
                isPublic: false
            } as GuidanceData);
        }
    }, [guidanceData, isDataLoading]);

    const handleSave = async () => {
        if (!firestore || !canUpdate || !localGuidance) return;
        setIsSubmitting(true);
        try {
            await setDoc(doc(firestore, 'settings', 'guidance'), localGuidance);
            toast({ title: 'Guidance Updated', description: 'Institutional records synchronized successfully.', variant: 'success' });
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
        if (!localGuidance || !confirm('Permanently Delete This Entire Category And All Its Resources?')) return;
        setLocalGuidance({ ...localGuidance, categories: localGuidance.categories.filter(c => c.id !== catId) });
    };

    const addResource = (catId: string) => {
        if (!localGuidance) return;
        const newRes: ExternalResource = {
            id: `res_${Date.now()}`,
            name: 'New Help Resource',
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

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-primary">Guidance & Resources</h2>
                    <p className="text-sm text-muted-foreground font-normal">Manage the directory of external organizations and schemes.</p>
                </div>
                {!isEditMode ? (
                    <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md transition-transform active:scale-95">
                        <Edit className="mr-2 h-4 w-4" /> Modify Directory
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsEditMode(false)} disabled={isSubmitting} className="font-bold border-primary/20 text-primary">
                            <X className="mr-2 h-4 w-4" /> Discard
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="font-bold shadow-md bg-primary text-white">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                            Secure Sync
                        </Button>
                    </div>
                )}
            </div>

            {localGuidance && (
                <div className="space-y-6">
                    {/* Public Visibility Toggle */}
                    <Card className="border-primary/10 bg-white shadow-sm">
                        <CardContent className="pt-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-xl border p-4 bg-primary/[0.02] gap-4 transition-all hover:border-primary/20">
                                <div className="space-y-1 flex-1">
                                    <h3 className="font-bold text-primary text-sm tracking-tight flex items-center gap-2">
                                        <Eye className="h-4 w-4" /> Directory Visibility
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-normal">Controls the public availability of this directory on the external site.</p>
                                    <Button variant="link" size="sm" asChild className="p-0 h-auto font-bold text-primary mt-2">
                                        <Link href="/info/guidance" target="_blank"><Eye className="mr-2 h-4 w-4" /> Preview Public Page</Link>
                                    </Button>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor="guidance-public" className="font-bold text-xs opacity-60 tracking-tight">Public Access</Label>
                                        <Switch 
                                            id="guidance-public" 
                                            checked={localGuidance.isPublic} 
                                            onCheckedChange={(val) => setLocalGuidance({...localGuidance, isPublic: val})} 
                                            disabled={!isEditMode || isSubmitting} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Header Details */}
                    <Card className="border-primary/10 bg-white shadow-sm overflow-hidden">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-lg font-bold text-primary tracking-tight">Directory Branding</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="font-bold text-xs text-muted-foreground tracking-tighter uppercase">Page Title</Label>
                                <Input 
                                    value={localGuidance.title} 
                                    onChange={(e) => setLocalGuidance({...localGuidance, title: e.target.value})} 
                                    disabled={!isEditMode}
                                    className="font-bold text-primary h-10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-xs text-muted-foreground tracking-tighter uppercase">Introductory Guidance Note</Label>
                                <Textarea 
                                    rows={3} 
                                    value={localGuidance.description} 
                                    onChange={(e) => setLocalGuidance({...localGuidance, description: e.target.value})} 
                                    disabled={!isEditMode}
                                    className="font-normal text-sm leading-relaxed"
                                    placeholder="Explain why this directory exists..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Categories and Resources */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-primary tracking-tight flex items-center gap-2">
                                <Hospital className="h-6 w-6" /> Assistance Categories
                            </h3>
                            {isEditMode && (
                                <Button onClick={addCategory} variant="outline" size="sm" className="font-bold border-primary/20 text-primary">
                                    <Plus className="mr-2 h-4 w-4" /> Add Category
                                </Button>
                            )}
                        </div>

                        {localGuidance.categories.map((cat, catIdx) => (
                            <Card key={cat.id} className="border-primary/10 overflow-hidden bg-white shadow-md">
                                <CardHeader className="bg-primary/[0.03] border-b px-6 py-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 space-y-1">
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
                                <CardContent className="p-6 space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resources In Category</Label>
                                            {isEditMode && (
                                                <Button onClick={() => addResource(cat.id)} size="sm" variant="outline" className="h-7 text-[10px] font-bold">
                                                    <Plus className="h-3 w-3 mr-1" /> Add Entry
                                                </Button>
                                            )}
                                        </div>
                                        
                                        <div className="grid gap-4">
                                            {cat.resources.map((res, resIdx) => (
                                                <div key={res.id} className="relative p-4 border rounded-xl bg-primary/[0.01] transition-all hover:bg-white hover:shadow-sm border-primary/5 space-y-4">
                                                    {isEditMode && (
                                                        <div className="absolute top-2 right-2 flex items-center gap-2">
                                                            <div className="flex items-center space-x-2 mr-2">
                                                                <Checkbox 
                                                                    id={`hide-res-${res.id}`} 
                                                                    checked={res.isHidden} 
                                                                    onCheckedChange={(val) => updateResource(cat.id, res.id, 'isHidden', !!val)} 
                                                                />
                                                                <Label htmlFor={`hide-res-${res.id}`} className="text-[10px] font-bold opacity-60">Hide</Label>
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
                                                                className="h-8 font-bold text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-bold text-muted-foreground">Subtitle / Contact Person</Label>
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
                                                            <Label className="text-[9px] font-bold flex items-center gap-1"><Phone className="h-2 w-2"/> Phone</Label>
                                                            <Input value={res.phone || ''} onChange={(e) => updateResource(cat.id, res.id, 'phone', e.target.value)} disabled={!isEditMode} className="h-8 font-mono text-xs"/>
                                                        </div>
                                                        <div className="space-y-1 md:col-span-2">
                                                            <Label className="text-[9px] font-bold flex items-center gap-1"><MapPin className="h-2 w-2"/> Address</Label>
                                                            <Input value={res.address || ''} onChange={(e) => updateResource(cat.id, res.id, 'address', e.target.value)} disabled={!isEditMode} className="h-8 text-xs"/>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-bold flex items-center gap-1"><Info className="h-2 w-2"/> Institutional Guidance & Assistance Scope</Label>
                                                        <Textarea 
                                                            value={res.description || ''} 
                                                            onChange={(e) => updateResource(cat.id, res.id, 'description', e.target.value)} 
                                                            disabled={!isEditMode}
                                                            className="text-xs font-normal min-h-[60px]"
                                                            placeholder="Detail what help they provide and how to apply..."
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label className="text-[9px] font-bold flex items-center gap-1"><Globe className="h-2 w-2"/> Official Website / Portal</Label>
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
                            <div className="text-center py-20 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/10">
                                <BookOpen className="h-12 w-12 mx-auto text-primary/20 mb-4" />
                                <p className="text-sm font-bold text-primary/60 tracking-widest">Guidance Directory Is Empty.</p>
                                {isEditMode && <p className="text-xs font-normal text-muted-foreground mt-2">Initialize Your Hub By Adding A Category Above.</p>}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
