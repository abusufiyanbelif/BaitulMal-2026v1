'use client';

import { useState, useEffect, useMemo } from 'react';
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
    Palette, 
    Info, 
    Eye,
    Edit,
    Save,
    X,
    CheckCircle2,
    Loader2,
    MoveHorizontal,
    Wind,
    Table as TableIcon
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { THEME_SUGGESTIONS } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/**
 * A detailed preview component that applies the selected theme class locally.
 */
function ComponentPreview({ themeId }: { themeId: string }) {
    return (
        <div className={cn("rounded-xl border shadow-2xl overflow-hidden transition-all duration-500", themeId)} style={{ transform: 'scale(0.95)' }}>
            <div className="bg-background text-foreground min-h-[450px] flex flex-col transition-colors duration-500">
                {/* Mock Header */}
                <div className="bg-card border-b p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 bg-primary rounded flex items-center justify-center text-[10px] text-primary-foreground font-bold shadow-sm">B</div>
                        <span className="text-xs font-bold text-primary tracking-tight">Organization Name</span>
                    </div>
                    <div className="h-6 w-6 rounded-full bg-muted border border-primary/10" />
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-primary tracking-tight">Theme Preview</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed font-normal">Observe how colors and styles change when you select a different theme.</p>
                        </div>

                        {/* Mock Financial Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <Card className="p-3 border-primary/10 bg-card/50 backdrop-blur-sm shadow-sm">
                                <p className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest">Collected</p>
                                <p className="text-sm font-bold text-primary font-mono">₹45,000</p>
                            </Card>
                            <Card className="p-3 border-primary/10 bg-card/50 backdrop-blur-sm shadow-sm">
                                <p className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest">Target</p>
                                <p className="text-sm font-bold opacity-60 font-mono">₹1,00,000</p>
                            </Card>
                        </div>

                        {/* Mock Progress */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
                                <span className="text-primary">Campaign Progress</span>
                                <span className="text-foreground/60">45%</span>
                            </div>
                            <Progress value={45} className="h-1.5" />
                        </div>

                        {/* Mock Table */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1 tracking-widest">
                                <TableIcon className="h-3 w-3" /> Recent Activity
                            </p>
                            <div className="border rounded-md overflow-hidden bg-card shadow-sm">
                                <Table>
                                    <TableHeader className="bg-primary/5">
                                        <TableRow className="border-b">
                                            <TableHead className="h-7 text-[9px] font-bold text-primary">Donor</TableHead>
                                            <TableHead className="h-7 text-[9px] font-bold text-right text-primary">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="h-8 border-b hover:bg-primary/[0.02]">
                                            <TableCell className="py-1 text-[10px] font-medium">Member A</TableCell>
                                            <TableCell className="py-1 text-right font-mono text-[10px] font-bold text-primary">₹500</TableCell>
                                        </TableRow>
                                        <TableRow className="h-8 border-none hover:bg-primary/[0.02]">
                                            <TableCell className="py-1 text-[10px] font-medium">Member B</TableCell>
                                            <TableCell className="py-1 text-right font-mono text-[10px] font-bold text-primary">₹1,200</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Mock Interactive */}
                        <div className="space-y-3 pb-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="default" className="text-[8px] font-bold uppercase shadow-sm">Active</Badge>
                                <Badge variant="eligible" className="text-[8px] font-bold uppercase shadow-sm">Verified</Badge>
                                <Badge variant="outline" className="text-[8px] font-bold uppercase border-primary/20 text-primary">Pending</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button size="sm" className="h-8 text-[10px] font-bold shadow-md">Primary Action</Button>
                                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5">Secondary</Button>
                            </div>
                        </div>
                    </div>
                    <ScrollBar />
                </ScrollArea>
                
                <div className="bg-muted/20 border-t p-3 text-center">
                    <p className="text-[8px] text-muted-foreground font-normal">© 2026 Your Organization. All Rights Reserved.</p>
                </div>
            </div>
        </div>
    );
}

export default function ViewportSettingsPage() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [animationsEnabled, setAnimationsEnabled] = useState(true);
    const [smoothScrolling, setSmoothScrolling] = useState(true);
    const [reducedMotion, setReducedMotion] = useState(false);

    const [pendingTheme, setPendingTheme] = useState<string>('');
    const [pendingAnimations, setPendingAnimations] = useState(true);
    const [pendingSmoothScroll, setPendingSmoothScroll] = useState(true);
    const [pendingReducedMotion, setPendingReducedMotion] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        setAnimationsEnabled(localStorage.getItem('app_animations') !== 'disabled');
        setSmoothScrolling(localStorage.getItem('app_smooth_scroll') !== 'disabled');
        setReducedMotion(localStorage.getItem('app_reduced_motion') === 'enabled');
        setPendingTheme(theme || 'bms3-a');
    }, [theme]);

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            // Apply theme globally via next-themes
            setTheme(pendingTheme);
            
            // Sync local state
            setAnimationsEnabled(pendingAnimations);
            setSmoothScrolling(pendingSmoothScroll);
            setReducedMotion(pendingReducedMotion);

            // Save preferences to local storage
            localStorage.setItem('app_animations', pendingAnimations ? 'enabled' : 'disabled');
            localStorage.setItem('app_smooth_scroll', pendingSmoothScroll ? 'enabled' : 'disabled');
            localStorage.setItem('app_reduced_motion', pendingReducedMotion ? 'enabled' : 'disabled');

            // Apply attributes to root for CSS selectors
            document.documentElement.setAttribute('data-animations', pendingAnimations ? 'enabled' : 'disabled');
            document.documentElement.setAttribute('data-smooth-scroll', pendingSmoothScroll ? 'enabled' : 'disabled');
            document.documentElement.setAttribute('data-motion-reduced', pendingReducedMotion ? 'enabled' : 'disabled');

            toast({ title: "Settings Saved", description: "Display And Motion Preferences Updated Successfully.", variant: "success" });
            setIsEditMode(false);
        } catch (error) {
            toast({ title: "Save Failed", description: "An Error Occurred While Saving Display Settings.", variant: "destructive" });
        } finally { setIsSubmitting(false); }
    };

    if (!isMounted) return null;
    const currentThemeName = THEME_SUGGESTIONS.find(t => t.id === (isEditMode ? pendingTheme : theme))?.name || theme || 'Default';

    return (
        <div className="space-y-6 text-primary font-normal pb-10">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight">Display & UI Preferences</h2>
                    <p className="text-sm text-muted-foreground font-normal">Manage themes, motion, and visual accessibility.</p>
                </div>
                {!isEditMode ? (
                    <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md transition-transform active:scale-95">
                        <Edit className="mr-2 h-4 w-4" /> Edit Display Settings
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsEditMode(false)} className="font-bold border-primary/20 text-primary transition-transform active:scale-95"><X className="mr-2 h-4 w-4" /> Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="font-bold shadow-md active:scale-95 transition-transform bg-primary text-white">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                            Save All Changes
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-6">
                    <Card className={cn("transition-all duration-300 border-primary/10", isEditMode && "border-primary/40 shadow-md bg-white")}>
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="flex items-center gap-2 font-bold text-base"><Palette className="h-5 w-5" /> Appearance Palette</CardTitle>
                            <CardDescription className="font-normal text-xs text-primary/60">Choose A Color Scheme That Reflects Your Organization's Identity.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {!isEditMode ? (
                                <div className="flex flex-col sm:flex-row justify-between items-center p-4 rounded-xl bg-muted/10 border gap-4 border-primary/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-full bg-primary/10 text-primary">
                                            {resolvedTheme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold block capitalize tracking-tight">{resolvedTheme} Mode Active</span>
                                            <p className="text-[10px] text-muted-foreground font-normal uppercase tracking-tighter">System Preferences Prioritized</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="font-bold uppercase text-[10px] px-3 py-1 border-primary/20 text-primary bg-white">{currentThemeName}</Badge>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-fade-in-up">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <Button variant={pendingTheme === 'light' ? 'default' : 'outline'} className="font-bold h-11" onClick={() => setPendingTheme('light')}><Sun className="mr-2 h-4 w-4" /> Light Mode</Button>
                                        <Button variant={pendingTheme === 'dark' ? 'default' : 'outline'} className="font-bold h-11" onClick={() => setPendingTheme('dark')}><Moon className="mr-2 h-4 w-4" /> Dark Mode</Button>
                                        <Button variant={pendingTheme === 'system' ? 'default' : 'outline'} className="font-bold h-11" onClick={() => setPendingTheme('system')}><Monitor className="mr-2 h-4 w-4" /> System Default</Button>
                                    </div>
                                    
                                    <Separator className="bg-primary/10" />
                                    
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Institutional Color Theme</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {THEME_SUGGESTIONS.map((s) => (
                                                <Button 
                                                    key={s.id} 
                                                    variant={pendingTheme === s.id ? 'default' : 'outline'} 
                                                    className={cn("font-bold justify-between px-4 h-12 transition-all group overflow-hidden relative", pendingTheme === s.id && "shadow-lg scale-[1.02] border-primary/40")} 
                                                    onClick={() => setPendingTheme(s.id)}
                                                >
                                                    <span className="truncate relative z-10">{s.name}</span>
                                                    {pendingTheme === s.id && <CheckCircle2 className="h-4 w-4 shrink-0 relative z-10" />}
                                                    <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity", s.isDark ? "bg-black" : "bg-primary")} />
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className={cn("transition-all duration-300 border-primary/10 bg-white", isEditMode && "border-primary/40 shadow-md")}>
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="flex items-center gap-2 font-bold text-base"><Zap className="h-5 w-5" /> Motion & Visual Effects</CardTitle>
                            <CardDescription className="font-normal text-xs text-primary/60">Customize The Responsiveness And Fluidity Of The Institutional Interface.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 bg-muted/5 transition-all hover:border-primary/20">
                                    <div className="space-y-0.5">
                                        <Label className="font-bold text-sm">UI Transitions</Label>
                                        <p className="text-[10px] font-normal text-muted-foreground uppercase tracking-tight">Fade-ins and scaling effects.</p>
                                    </div>
                                    <Switch 
                                        checked={isEditMode ? pendingAnimations : animationsEnabled} 
                                        onCheckedChange={isEditMode ? setPendingAnimations : undefined} 
                                        disabled={!isEditMode} 
                                    />
                                </div>
                                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 bg-muted/5 transition-all hover:border-primary/20">
                                    <div className="space-y-0.5">
                                        <Label className="font-bold text-sm">Smooth Scrolling</Label>
                                        <p className="text-[10px] font-normal text-muted-foreground uppercase tracking-tight">Fluid navigation between sections.</p>
                                    </div>
                                    <Switch 
                                        checked={isEditMode ? pendingSmoothScroll : smoothScrolling} 
                                        onCheckedChange={isEditMode ? setPendingSmoothScroll : undefined} 
                                        disabled={!isEditMode} 
                                    />
                                </div>
                                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 bg-muted/5 transition-all hover:border-primary/20 sm:col-span-2">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <Label className="font-bold text-sm">Reduced Motion Mode</Label>
                                            <Badge variant="secondary" className="text-[8px] h-4 font-bold tracking-tighter">ACCESSIBILITY</Badge>
                                        </div>
                                        <p className="text-[10px] font-normal text-muted-foreground uppercase tracking-tight">Minimizes non-essential movement for enhanced comfort.</p>
                                    </div>
                                    <Switch 
                                        checked={isEditMode ? pendingReducedMotion : reducedMotion} 
                                        onCheckedChange={isEditMode ? setPendingReducedMotion : undefined} 
                                        disabled={!isEditMode} 
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <Card className={cn("sticky top-24 transition-all duration-500 border-primary/10 shadow-lg bg-white overflow-hidden", isEditMode ? "border-primary/20 opacity-100" : "opacity-50 grayscale pointer-events-none")}>
                        <CardHeader className="bg-primary/5 border-b pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 font-bold text-sm tracking-widest uppercase text-primary">
                                    <Eye className="h-4 w-4" /> Real-time Preview
                                </CardTitle>
                                {isEditMode && <Badge variant="success" className="animate-pulse text-[10px] font-bold">Live Interaction</Badge>}
                            </div>
                            <CardDescription className="text-[10px] font-normal">Visual simulation of organizational components.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 bg-primary/[0.01]">
                            <div className="p-4">
                                <ComponentPreview 
                                    themeId={isEditMode ? pendingTheme : (theme || 'bms3-a')} 
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/5 p-3 border-t flex justify-center">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                                Currently Rendering: {currentThemeName}
                            </p>
                        </CardFooter>
                    </Card>

                    {!isEditMode && (
                        <Card className="h-fit border-primary/10 bg-white shadow-sm overflow-hidden animate-fade-in-up">
                            <CardHeader className="bg-primary/5 border-b">
                                <CardTitle className="flex items-center gap-2 font-bold text-base"><Info className="h-5 w-5" /> Technical Profile</CardTitle>
                                <CardDescription className="font-normal text-xs text-primary/60">Active system visual configuration logs.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-primary/10">
                                    <div className="flex items-center gap-2 text-primary/70"><Palette className="h-4 w-4"/><span className="text-xs font-bold uppercase tracking-tight">Active Theme</span></div>
                                    <Badge variant="outline" className="font-bold text-primary border-primary/20 bg-white">{currentThemeName}</Badge>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-primary/10">
                                    <div className="flex items-center gap-2 text-primary/70"><Zap className="h-4 w-4"/><span className="text-xs font-bold uppercase tracking-tight">Visual Effects</span></div>
                                    <span className="text-xs font-mono font-bold text-primary">{animationsEnabled ? 'Enabled' : 'Disabled'}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-primary/10">
                                    <div className="flex items-center gap-2 text-primary/70"><MoveHorizontal className="h-4 w-4"/><span className="text-xs font-bold uppercase tracking-tight">Scrolling Style</span></div>
                                    <span className="text-xs font-mono font-bold text-primary">{smoothScrolling ? 'Fluid' : 'Instant'}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-primary/10">
                                    <div className="flex items-center gap-2 text-primary/70"><Wind className="h-4 w-4"/><span className="text-xs font-bold uppercase tracking-tight">Motion Profile</span></div>
                                    <Badge variant={reducedMotion ? "secondary" : "success"} className="text-[9px] font-bold">{reducedMotion ? 'Reduced Motion' : 'Full Effects'}</Badge>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/5 p-4 border-t italic text-[10px] text-muted-foreground font-normal text-center w-full">
                                Optimized for high-fidelity institutional rendering.
                            </CardFooter>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
