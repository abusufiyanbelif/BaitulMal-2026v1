'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
    Moon, 
    Sun, 
    Monitor, 
    Zap, 
    ZapOff, 
    Type, 
    Palette, 
    MousePointer2, 
    Info, 
    Eye,
    Droplets,
    Edit,
    Save,
    X,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { THEME_SUGGESTIONS } from '@/lib/themes';
import { cn } from '@/lib/utils';

export default function ViewportSettingsPage() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [animationsEnabled, setAnimationsEnabled] = useState(true);
    const [pendingTheme, setPendingTheme] = useState<string>('');
    const [pendingAnimations, setPendingAnimations] = useState(true);

    useEffect(() => {
        setIsMounted(true);
        const storedMotion = localStorage.getItem('app_animations');
        if (storedMotion === 'disabled') setAnimationsEnabled(false);
    }, []);

    useEffect(() => {
        if (isEditMode) {
            setPendingTheme(theme || 'light');
            setPendingAnimations(animationsEnabled);
        }
    }, [isEditMode, theme, animationsEnabled]);

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            setTheme(pendingTheme);
            setAnimationsEnabled(pendingAnimations);
            if (pendingAnimations) {
                localStorage.setItem('app_animations', 'enabled');
                document.documentElement.removeAttribute('data-animations');
            } else {
                localStorage.setItem('app_animations', 'disabled');
                document.documentElement.setAttribute('data-animations', 'disabled');
            }
            toast({ title: "Settings saved", description: "Display preferences updated.", variant: "success" });
            setIsEditMode(false);
        } catch (error) {
            toast({ title: "Save failed", variant: "destructive" });
        } finally { setIsSubmitting(false); }
    };

    if (!isMounted) return null;
    const currentThemeName = THEME_SUGGESTIONS.find(t => t.id === theme)?.name || theme || 'Default';

    return (
        <div className="space-y-6 text-primary font-normal">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">Display & UI preferences</h2>
                    <p className="text-sm text-muted-foreground font-normal">Manage themes, motion, and visual accessibility.</p>
                </div>
                {!isEditMode ? (
                    <Button onClick={() => setIsEditMode(true)} className="font-bold">
                        <Edit className="mr-2 h-4 w-4" /> Edit settings
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsEditMode(false)} className="font-bold border-primary/20 text-primary"><X className="mr-2 h-4 w-4" /> Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="font-bold shadow-md">{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save changes</Button>
                    </div>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                    <Card className={cn("transition-all duration-300 border-primary/10", isEditMode && "border-primary/40 shadow-md")}>
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="flex items-center gap-2 font-bold"><Palette className="h-5 w-5" /> Appearance mode</CardTitle></CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            {!isEditMode ? (
                                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20 border">
                                    <div className="flex items-center gap-2">{resolvedTheme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}<span className="text-sm font-bold capitalize">{resolvedTheme} mode active</span></div>
                                    <Badge variant="secondary" className="font-bold uppercase text-[10px]">{currentThemeName}</Badge>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Button variant={pendingTheme === 'light' ? 'default' : 'outline'} className="font-bold" onClick={() => setPendingTheme('light')}><Sun className="mr-2 h-4 w-4" /> Light</Button>
                                    <Button variant={pendingTheme === 'dark' ? 'default' : 'outline'} className="font-bold" onClick={() => setPendingTheme('dark')}><Moon className="mr-2 h-4 w-4" /> Dark</Button>
                                    <Button variant={pendingTheme === 'system' ? 'default' : 'outline'} className="font-bold" onClick={() => setPendingTheme('system')}><Monitor className="mr-2 h-4 w-4" /> System</Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className={cn("transition-all duration-300 border-primary/10", isEditMode && "border-primary/40 shadow-md")}>
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="flex items-center gap-2 font-bold"><Zap className="h-5 w-5" /> Motion & effects</CardTitle></CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 bg-muted/5">
                                <div className="space-y-0.5"><Label className="font-bold">UI animations</Label><p className="text-xs font-normal text-muted-foreground">Smooth transitions and loading effects.</p></div>
                                <Switch checked={isEditMode ? pendingAnimations : animationsEnabled} onCheckedChange={isEditMode ? setPendingAnimations : undefined} disabled={!isEditMode} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    {isEditMode ? (
                        <Card className="border-primary/40 shadow-md h-full overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b"><CardTitle className="flex items-center gap-2 font-bold"><Droplets className="h-5 w-5" /> Theme suggestions</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[400px]">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                                        {THEME_SUGGESTIONS.map((s) => (
                                            <Button key={s.id} variant={pendingTheme === s.id ? 'default' : 'outline'} className={cn("font-bold justify-start px-4 h-12", pendingTheme === s.id && "shadow-md scale-[1.02]")} onClick={() => setPendingTheme(s.id)}>
                                                <div className="flex items-center justify-between w-full"><span>{s.name}</span>{pendingTheme === s.id && <CheckCircle2 className="h-4 w-4" />}</div>
                                            </Button>
                                        ))}
                                    </div>
                                    <ScrollBar orientation="vertical" />
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="h-full border-primary/10 bg-white">
                            <CardHeader className="bg-primary/5 border-b"><CardTitle className="flex items-center gap-2 font-bold"><Info className="h-5 w-5" /> Technical audit</CardTitle></CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-dashed"><div className="flex items-center gap-2"><Palette className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold uppercase tracking-tight">Active theme</span></div><Badge variant="outline" className="font-bold text-primary">{currentThemeName}</Badge></div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed"><div className="flex items-center gap-2"><Type className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold uppercase tracking-tight">Typography</span></div><div className="flex gap-1"><Badge variant="secondary" className="font-bold text-[10px]">SPACE GROTESK</Badge><Badge variant="secondary" className="font-bold text-[10px]">INTER</Badge></div></div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed"><div className="flex items-center gap-2"><MousePointer2 className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold uppercase tracking-tight">Transitions</span></div><span className="text-xs font-mono font-bold text-primary">{animationsEnabled ? '200ms' : '0.01ms'}</span></div>
                                <div className="flex justify-between items-center py-2"><div className="flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold uppercase tracking-tight">Accessibility</span></div><Badge variant="success" className="text-[9px] font-bold">OPTIMIZED</Badge></div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}