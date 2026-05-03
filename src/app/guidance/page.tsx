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
import { Separator } from '@/components/ui/separator';
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
    ShieldAlert,
    ChevronRight,
    Search,
    BookMarked,
    Sparkles,
    LayoutGrid,
    Hash
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, getNestedValue } from '@/lib/utils';
import { BrandedLoader } from '@/components/branded-loader';
import { SectionLoader } from '@/components/section-loader';
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
            toast({ title: 'Guidance Matrix Synchronized', description: 'Resource changes have been finalized.', variant: 'success' });
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
            name: 'New Assistance Sector',
            resources: []
        };
        setLocalGuidance({ ...localGuidance, categories: [...localGuidance.categories, newCat] });
    };

    const removeCategory = (catId: string) => {
        if (!localGuidance || !confirm('Permanently Delete This Sector And All Its Resources?')) return;
        setLocalGuidance({ ...localGuidance, categories: localGuidance.categories.filter(c => c.id !== catId) });
    };

    const addResource = (catId: string) => {
        if (!localGuidance) return;
        const newRes: ExternalResource = {
            id: `res_${Date.now()}`,
            name: 'New Resource Protocol',
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

    if (isSessionLoading || isDataLoading) return <SectionLoader label="Syncing Guidance Hub..." description="Retrieving Organization Assistance Protocols." />;

    if (!canRead) {
        return (
            <main className="container mx-auto p-8 text-primary font-normal">
                <Alert variant="destructive" className="rounded-3xl border-primary/10 shadow-2xl">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle className="font-black tracking-tight">Security Restriction</AlertTitle>
                    <AlertDescription className="font-bold opacity-70">Missing credentials to access the guidance protocols hub.</AlertDescription>
                </Alert>
            </main>
        );
    }

    return (
        <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-primary font-normal relative min-h-screen">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
            <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

            <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                    <div className="space-y-1.5">
                        <Button variant="secondary" asChild size="sm" className="font-bold border-primary/20 text-primary transition-transform active:scale-95 rounded-xl px-5 h-9 mb-2">
                            <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Dashboard</Link>
                        </Button>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-primary">Guidance Hub</h1>
                        <p className="text-sm font-bold opacity-70 max-w-2xl leading-relaxed">Organization directory of external assistance resources, medical protocols, and public support vectors.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <Button variant="outline" asChild size="sm" className="font-bold border-primary/10 text-primary h-11 rounded-2xl px-6 bg-white shadow-sm hover:bg-primary/5 transition-all">
                            <Link href="/info/guidance" target="_blank"><Eye className="mr-2 h-4 w-4 opacity-40" /> Public Portal View</Link>
                        </Button>
                        {canUpdate && (
                            !isEditMode ? (
                                <Button onClick={() => setIsEditMode(true)} className="bg-primary hover:bg-primary/90 text-white font-black h-11 rounded-2xl px-6 shadow-xl shadow-primary/20 active:scale-95 transition-all">
                                    <Edit className="mr-2 h-4 w-4" /> Modify Protocols
                                </Button>
                            ) : (
                                <div className="flex bg-white/50 backdrop-blur-md p-1 rounded-2xl border border-primary/5 shadow-sm">
                                    <Button variant="ghost" onClick={() => setIsEditMode(false)} disabled={isSubmitting} className="font-bold text-destructive rounded-xl h-10 px-5 hover:bg-destructive/5">
                                        <X className="mr-2 h-4 w-4 opacity-40" /> Discard
                                    </Button>
                                    <div className="w-px h-6 bg-primary/10 my-2" />
                                    <Button onClick={handleSave} disabled={isSubmitting} className="font-black text-primary rounded-xl h-10 px-6 hover:bg-primary/5">
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4 opacity-40"/>} 
                                        Finalize Hub
                                    </Button>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            {localGuidance && (
                <div className="space-y-10">
                    <div className="flex items-center justify-between border-b border-primary/5 pb-4">
                        <h3 className="text-xl font-black text-primary tracking-tighter flex items-center gap-3">
                            <LayoutGrid className="h-6 w-6 opacity-40" /> Assistance Sector Matrix
                        </h3>
                        {isEditMode && (
                            <Button onClick={addCategory} variant="outline" size="sm" className="font-black text-[10px] uppercase tracking-widest border-primary/10 h-10 px-6 rounded-xl bg-white shadow-sm hover:bg-primary/5 transition-all active:scale-95">
                                <Plus className="mr-2 h-4 w-4" /> New Sector
                            </Button>
                        )}
                    </div>

                    <div className="grid gap-12 sm:gap-16">
                        {localGuidance.categories.map((cat, catIdx) => (
                            <div key={cat.id} className="space-y-6 animate-fade-in-up" style={{ animationDelay: `${catIdx * 100}ms` }}>
                                <div className="flex items-center justify-between gap-6">
                                    <div className="flex-1 flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-xs shadow-lg">
                                            {catIdx + 1}
                                        </div>
                                        {isEditMode ? (
                                            <Input 
                                                value={cat.name} 
                                                onChange={(e) => {
                                                    const updated = localGuidance.categories.map(c => c.id === cat.id ? { ...c, name: e.target.value } : c);
                                                    setLocalGuidance({ ...localGuidance, categories: updated });
                                                }}
                                                className="font-black text-xl sm:text-2xl h-12 bg-white/50 border-primary/10 rounded-2xl px-6 tracking-tighter w-full max-w-md shadow-sm"
                                            />
                                        ) : (
                                            <h2 className="text-2xl sm:text-3xl font-black text-primary tracking-tighter">{cat.name}</h2>
                                        )}
                                    </div>
                                    {isEditMode && (
                                        <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-2xl transition-all" onClick={() => removeCategory(cat.id)}>
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                                    {cat.resources.map((res, resIdx) => (
                                        <Card key={res.id} className="group relative rounded-[32px] border border-primary/5 bg-white/40 backdrop-blur-md overflow-hidden shadow-none hover:shadow-xl hover:-translate-y-1 transition-all duration-500 animate-fade-in-up" style={{ animationDelay: `${(catIdx * 100) + (resIdx * 50)}ms` }}>
                                            <CardContent className="p-8 space-y-6">
                                                {isEditMode && (
                                                    <div className="absolute top-4 right-4 flex items-center gap-3 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-primary/5 shadow-sm z-10">
                                                        <div className="flex items-center space-x-2 px-3">
                                                            <Checkbox 
                                                                id={`hide-res-${res.id}`} 
                                                                checked={res.isHidden} 
                                                                onCheckedChange={(val) => updateResource(cat.id, res.id, 'isHidden', val === true)} 
                                                                className="h-4 w-4 rounded-md border-primary/20 data-[state=checked]:bg-primary"
                                                            />
                                                            <Label htmlFor={`hide-res-${res.id}`} className="text-[10px] font-black uppercase tracking-widest opacity-60 cursor-pointer">Hide</Label>
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all" onClick={() => removeResource(cat.id, res.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}

                                                <div className="space-y-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1 opacity-40">Identity Protocol</Label>
                                                        <Input 
                                                            value={res.name} 
                                                            onChange={(e) => updateResource(cat.id, res.id, 'name', e.target.value)} 
                                                            disabled={!isEditMode}
                                                            className="h-12 font-black text-lg text-primary tracking-tighter bg-white/50 border-primary/5 rounded-2xl px-5 disabled:opacity-100 disabled:bg-transparent disabled:px-0 disabled:border-none disabled:h-auto disabled:text-xl"
                                                            placeholder="Resource Name"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1 opacity-40">Functional Context</Label>
                                                        <Input 
                                                            value={res.subtitle || ''} 
                                                            onChange={(e) => updateResource(cat.id, res.id, 'subtitle', e.target.value)} 
                                                            disabled={!isEditMode}
                                                            className="h-10 font-bold text-sm text-primary/70 bg-white/50 border-primary/5 rounded-xl px-5 disabled:opacity-100 disabled:bg-transparent disabled:px-0 disabled:border-none disabled:h-auto"
                                                            placeholder="e.g. Hospital Grade / Specialist Title"
                                                        />
                                                    </div>
                                                </div>

                                                <Separator className="bg-primary/5" />

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1 opacity-40 flex items-center gap-1.5"><Phone className="h-3 w-3"/> Tele-Vector</Label>
                                                        <Input 
                                                            value={res.phone || ''} 
                                                            onChange={(e) => updateResource(cat.id, res.id, 'phone', e.target.value)} 
                                                            disabled={!isEditMode} 
                                                            className="h-10 font-mono font-bold text-xs bg-white/50 border-primary/5 rounded-xl px-4 disabled:opacity-100 disabled:bg-transparent disabled:px-0 disabled:border-none disabled:h-auto"
                                                            placeholder="Support Contact"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1 opacity-40 flex items-center gap-1.5"><Globe className="h-3 w-3"/> Portal Link</Label>
                                                        <Input 
                                                            value={res.link || ''} 
                                                            onChange={(e) => updateResource(cat.id, res.id, 'link', e.target.value)} 
                                                            disabled={!isEditMode} 
                                                            className="h-10 font-mono font-bold text-xs bg-white/50 border-primary/5 rounded-xl px-4 disabled:opacity-100 disabled:bg-transparent disabled:px-0 disabled:border-none disabled:h-auto text-primary truncate"
                                                            placeholder="https://official.domain"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1 opacity-40 flex items-center gap-1.5"><MapPin className="h-3 w-3"/> Location Vector</Label>
                                                    <Input 
                                                        value={res.address || ''} 
                                                        onChange={(e) => updateResource(cat.id, res.id, 'address', e.target.value)} 
                                                        disabled={!isEditMode} 
                                                        className="h-10 font-bold text-xs bg-white/50 border-primary/5 rounded-xl px-4 disabled:opacity-100 disabled:bg-transparent disabled:px-0 disabled:border-none disabled:h-auto"
                                                        placeholder="Full Operational Address"
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1 opacity-40 flex items-center gap-1.5"><Info className="h-3.5 w-3.5"/> Operational Scope & Methodology</Label>
                                                    <Textarea 
                                                        value={res.description || ''} 
                                                        onChange={(e) => updateResource(cat.id, res.id, 'description', e.target.value)} 
                                                        disabled={!isEditMode}
                                                        className="font-bold text-sm leading-relaxed min-h-[100px] bg-white/50 border-primary/5 rounded-2xl p-5 disabled:opacity-100 disabled:bg-primary/[0.02] disabled:border-none"
                                                        placeholder="Detail the assistance protocols, application requirements, and organization vetting criteria..."
                                                    />
                                                </div>
                                                
                                                {!isEditMode && res.link && (
                                                    <Button variant="outline" asChild className="w-full h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest border-primary/10 hover:bg-primary hover:text-white transition-all shadow-sm">
                                                        <a href={res.link} target="_blank" rel="noopener noreferrer">Access Portal <ChevronRight className="ml-2 h-4 w-4" /></a>
                                                    </Button>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                    {isEditMode && (
                                        <Button onClick={() => addResource(cat.id)} variant="outline" className="h-auto py-12 rounded-[32px] border-2 border-dashed border-primary/10 hover:border-primary/30 hover:bg-primary/[0.02] transition-all group">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-primary/5 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <Plus className="h-6 w-6" />
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Append Protocol Entry</p>
                                            </div>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                        {localGuidance.categories.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-32 bg-primary/[0.01] rounded-[48px] border-2 border-dashed border-primary/5 animate-pulse">
                                <BookMarked className="h-16 w-16 text-primary/10 mb-6" />
                                <h4 className="font-black text-lg text-primary/30 tracking-widest uppercase">Protocol Hub Is Offline</h4>
                                <p className="text-sm font-bold text-primary/20 mt-2">Initialize the matrix by adding an assistance sector above.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
