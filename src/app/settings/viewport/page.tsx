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
    Type,
    Table as TableIcon
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { THEME_SUGGESTIONS } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranding } from '@/hooks/use-branding';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { SUPPORTED_HEADING_FONTS, SUPPORTED_BODY_FONTS, FONT_SCALE_OPTIONS } from '@/components/font-theme-sync';

/**
 * A detailed preview component that applies the selected theme class locally.
 * Handles dual-class logic for dark themes during simulation.
 */
function ComponentPreview({ themeId }: { themeId: string }) {
    const isDark = THEME_SUGGESTIONS.find(t => t.id === themeId)?.isDark;
    
    return (
        <div 
            data-theme={themeId}
            className={cn(
                "rounded-xl border shadow-2xl overflow-hidden transition-all duration-500", 
                themeId,
                isDark && "dark"
            )} style={{ transform: 'scale(0.95)' }}>
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
                            <p className="text-xs text-muted-foreground leading-relaxed font-normal">Observe How Colors And Styles Change When You Select A Different Theme.</p>
                        </div>

                        {/* Mock Financial Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <Card className="p-3 border-primary/10 bg-card/50 backdrop-blur-sm shadow-sm">
                                <p className="text-[8px] font-bold capitalize text-muted-foreground tracking-widest">Collected</p>
                                <p className="text-sm font-bold text-primary font-mono">₹45,000</p>
                            </Card>
                            <Card className="p-3 border-primary/10 bg-card/50 backdrop-blur-sm shadow-sm">
                                <p className="text-[8px] font-bold capitalize text-muted-foreground tracking-widest">Target</p>
                                <p className="text-sm font-bold opacity-60 font-mono">₹1,00,000</p>
                            </Card>
                        </div>

                        {/* Mock Progress */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold capitalize tracking-tight">
                                <span className="text-primary">Campaign Progress</span>
                                <span className="text-foreground/60">45%</span>
                            </div>
                            <Progress value={45} className="h-1.5" />
                        </div>

                        {/* Mock Table */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold capitalize text-muted-foreground flex items-center gap-1 tracking-widest">
                                <TableIcon className="h-3 w-3" /> Recent Activity
                            </p>
                            <div className="border border-primary/10 rounded-md overflow-hidden bg-card shadow-sm">
                                <Table>
                                    <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                                        <TableRow className="border-b border-primary/10">
                                            <TableHead className="h-7 text-[9px] font-bold text-[hsl(var(--table-header-fg))]">Donor</TableHead>
                                            <TableHead className="h-7 text-[9px] font-bold text-right text-[hsl(var(--table-header-fg))]">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="h-8 border-b border-primary/10 hover:bg-[hsl(var(--table-row-hover))]">
                                            <TableCell className="py-1 text-[10px] font-medium bg-transparent">Member A</TableCell>
                                            <TableCell className="py-1 text-right font-mono text-[10px] font-bold text-primary bg-transparent">₹500</TableCell>
                                        </TableRow>
                                        <TableRow className="h-8 border-none hover:bg-[hsl(var(--table-row-hover))]">
                                            <TableCell className="py-1 text-[10px] font-medium bg-transparent">Member B</TableCell>
                                            <TableCell className="py-1 text-right font-mono text-[10px] font-bold text-primary bg-transparent">₹1,200</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Mock Interactive */}
                        <div className="space-y-3 pb-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="default" className="text-[8px] font-bold capitalize shadow-sm">Active</Badge>
                                <Badge variant="eligible" className="text-[8px] font-bold capitalize shadow-sm">Verified</Badge>
                                <Badge variant="outline" className="text-[8px] font-bold capitalize border-primary/20 text-primary">Pending</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Button size="sm" className="h-8 text-[10px] font-bold shadow-md">Primary Action</Button>
                                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5">Secondary</Button>
                            </div>
                        </div>
                    </div>
                    <ScrollBar />
                </ScrollArea>
                
                <div className="bg-muted/20 border-t border-primary/10 p-3 text-center">
                    <p className="text-[8px] text-muted-foreground font-normal">© 2026 Your Organization. All Rights Reserved.</p>
                </div>
            </div>
        </div>
    );
}

export default function ViewportSettingsPage() {
    const firestore = useFirestore();
    const { brandingSettings } = useBranding();
    const { theme, setTheme, resolvedTheme } = useTheme();
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [animationsEnabled, setAnimationsEnabled] = useState(true);
    const [smoothScrolling, setSmoothScrolling] = useState(true);
    const [reducedMotion, setReducedMotion] = useState(false);

    const [headingFont, setHeadingFont] = useState('Space Grotesk');
    const [bodyFont, setBodyFont] = useState('Inter');
    const [fontScale, setFontScale] = useState<'Compact' | 'Normal' | 'Large'>('Normal');

    const [pendingTheme, setPendingTheme] = useState<string>('');
    const [pendingAnimations, setPendingAnimations] = useState(true);
    const [pendingSmoothScroll, setPendingSmoothScroll] = useState(true);
    const [pendingReducedMotion, setPendingReducedMotion] = useState(false);
    const [pendingHeadingFont, setPendingHeadingFont] = useState('Space Grotesk');
    const [pendingBodyFont, setPendingBodyFont] = useState('Inter');
    const [pendingFontScale, setPendingFontScale] = useState<'Compact' | 'Normal' | 'Large'>('Normal');

    useEffect(() => {
        setIsMounted(true);
        setAnimationsEnabled(localStorage.getItem('app_animations') !== 'disabled');
        setSmoothScrolling(localStorage.getItem('app_smooth_scroll') !== 'disabled');
        setReducedMotion(localStorage.getItem('app_reduced_motion') === 'enabled');
        setPendingTheme(theme || 'bms3-a');
    }, [theme]);

    useEffect(() => {
        if (brandingSettings) {
            const hFont = brandingSettings.headingFont || 'Space Grotesk';
            const bFont = brandingSettings.bodyFont || 'Inter';
            const scale = (brandingSettings.fontScale as 'Compact' | 'Normal' | 'Large') || 'Normal';
            setHeadingFont(hFont);
            setBodyFont(bFont);
            setFontScale(scale);
            setPendingHeadingFont(hFont);
            setPendingBodyFont(bFont);
            setPendingFontScale(scale);
        }
    }, [brandingSettings]);

    const handleCancel = () => {
        setIsEditMode(false);
        if (theme) setTheme(theme);
        setPendingTheme(theme || 'bms3-a');
        setPendingHeadingFont(headingFont);
        setPendingBodyFont(bodyFont);
        setPendingFontScale(fontScale);
        setPendingAnimations(animationsEnabled);
        setPendingSmoothScroll(smoothScrolling);
        setPendingReducedMotion(reducedMotion);
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            // Apply theme globally via next-themes
            setTheme(pendingTheme);
            
            // Sync local state
            setAnimationsEnabled(pendingAnimations);
            setSmoothScrolling(pendingSmoothScroll);
            setReducedMotion(pendingReducedMotion);
            setHeadingFont(pendingHeadingFont);
            setBodyFont(pendingBodyFont);
            setFontScale(pendingFontScale);

            // Save preferences to local storage
            localStorage.setItem('app_animations', pendingAnimations ? 'enabled' : 'disabled');
            localStorage.setItem('app_smooth_scroll', pendingSmoothScroll ? 'enabled' : 'disabled');
            localStorage.setItem('app_reduced_motion', pendingReducedMotion ? 'enabled' : 'disabled');

            // Apply attributes to root for CSS selectors
            document.documentElement.setAttribute('data-animations', pendingAnimations ? 'enabled' : 'disabled');
            document.documentElement.setAttribute('data-smooth-scroll', pendingSmoothScroll ? 'enabled' : 'disabled');
            document.documentElement.setAttribute('data-motion-reduced', pendingReducedMotion ? 'enabled' : 'disabled');

            // Save typography to Firestore settings/branding
            if (firestore) {
                await setDoc(doc(firestore, 'settings', 'branding'), {
                    headingFont: pendingHeadingFont,
                    bodyFont: pendingBodyFont,
                    fontScale: pendingFontScale,
                }, { merge: true });
            }

            toast({ title: "Settings Saved", description: "Display, UI & Typography Preferences Updated Successfully.", variant: "success" });
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
                    <p className="text-sm text-muted-foreground font-normal">Manage themes, typography, motion, and visual accessibility.</p>
                </div>
                {!isEditMode ? (
                    <Button onClick={() => setIsEditMode(true)} className="font-bold shadow-md transition-transform active:scale-95">
                        <Edit className="mr-2 h-4 w-4" /> Edit Display Settings
                    </Button>
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleCancel} className="font-bold border-primary/20 text-primary transition-transform active:scale-95"><X className="mr-2 h-4 w-4" /> Cancel</Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="font-bold shadow-md active:scale-95 transition-transform bg-primary text-white">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                            Save All Changes
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-6">
                    {/* Card 1: Appearance Palette */}
                    <Card className={cn("transition-all duration-300 border-primary/10", isEditMode && "border-primary/40 shadow-md bg-white")}>
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
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
                                            <p className="text-[10px] text-muted-foreground font-normal capitalize tracking-tighter">System Preferences Prioritized</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="font-bold capitalize text-[10px] px-3 py-1 border-primary/20 text-primary bg-white">{currentThemeName}</Badge>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-fade-in-up">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <Button variant={pendingTheme === 'light' ? 'default' : 'outline'} className="font-bold h-11" onClick={() => { setPendingTheme('light'); setTheme('light'); }}><Sun className="mr-2 h-4 w-4" /> Light Mode</Button>
                                        <Button variant={pendingTheme === 'dark' ? 'default' : 'outline'} className="font-bold h-11" onClick={() => { setPendingTheme('dark'); setTheme('dark'); }}><Moon className="mr-2 h-4 w-4" /> Dark Mode</Button>
                                        <Button variant={pendingTheme === 'system' ? 'default' : 'outline'} className="font-bold h-11" onClick={() => { setPendingTheme('system'); setTheme('system'); }}><Monitor className="mr-2 h-4 w-4" /> System Default</Button>
                                    </div>
                                    
                                    <Separator className="bg-primary/10" />
                                    
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest">Select Organization Color Theme</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {THEME_SUGGESTIONS.map((s) => (
                                                <Button 
                                                    key={s.id} 
                                                    variant={pendingTheme === s.id ? 'default' : 'outline'} 
                                                    className={cn("font-normal justify-between px-4 h-12 transition-all group overflow-hidden relative", pendingTheme === s.id && "shadow-lg scale-[1.02] border-primary/40")} 
                                                    onClick={() => {
                                                        setPendingTheme(s.id);
                                                        setTheme(s.id);
                                                    }}
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

                    {/* Card 2: Font & Typography Style Settings */}
                    <Card className={cn("transition-all duration-300 border-primary/10 bg-white", isEditMode && "border-primary/40 shadow-md")}>
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                            <CardTitle className="flex items-center gap-2 font-bold text-base">
                                <Type className="h-5 w-5 text-primary" /> Font & Typography Style Settings
                            </CardTitle>
                            <CardDescription className="font-normal text-xs text-primary/60">
                                Configure heading font families, body fonts, and font sizes dynamically across all pages and components.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-primary uppercase tracking-wider">Heading Font Style</Label>
                                    <Select 
                                        value={isEditMode ? pendingHeadingFont : headingFont} 
                                        onValueChange={(val) => {
                                            setPendingHeadingFont(val);
                                            const fontMatch = SUPPORTED_HEADING_FONTS.find(f => f.id === val);
                                            if (fontMatch?.googleName) {
                                                const elementId = `google-font-${val.replace(/\s+/g, '-').toLowerCase()}`;
                                                if (!document.getElementById(elementId)) {
                                                    const link = document.createElement('link');
                                                    link.id = elementId;
                                                    link.rel = 'stylesheet';
                                                    link.href = `https://fonts.googleapis.com/css2?family=${fontMatch.googleName}&display=swap`;
                                                    document.head.appendChild(link);
                                                }
                                            }
                                        }}
                                        disabled={!isEditMode}
                                    >
                                        <SelectTrigger className="h-11 bg-white/70 rounded-xl border-primary/10 font-bold text-xs">
                                            <SelectValue placeholder="Select Heading Font" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SUPPORTED_HEADING_FONTS.map(font => (
                                                <SelectItem key={font.id} value={font.id} className="font-bold text-xs">
                                                    {font.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">Applies to all headlines, card titles, section headers (h1-h6).</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-primary uppercase tracking-wider">Body Font Style</Label>
                                    <Select 
                                        value={isEditMode ? pendingBodyFont : bodyFont} 
                                        onValueChange={(val) => {
                                            setPendingBodyFont(val);
                                            const fontMatch = SUPPORTED_BODY_FONTS.find(f => f.id === val);
                                            if (fontMatch?.googleName) {
                                                const elementId = `google-font-${val.replace(/\s+/g, '-').toLowerCase()}`;
                                                if (!document.getElementById(elementId)) {
                                                    const link = document.createElement('link');
                                                    link.id = elementId;
                                                    link.rel = 'stylesheet';
                                                    link.href = `https://fonts.googleapis.com/css2?family=${fontMatch.googleName}&display=swap`;
                                                    document.head.appendChild(link);
                                                }
                                            }
                                        }}
                                        disabled={!isEditMode}
                                    >
                                        <SelectTrigger className="h-11 bg-white/70 rounded-xl border-primary/10 font-bold text-xs">
                                            <SelectValue placeholder="Select Body Font" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SUPPORTED_BODY_FONTS.map(font => (
                                                <SelectItem key={font.id} value={font.id} className="font-bold text-xs">
                                                    {font.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">Applies to paragraph text, table contents, and descriptions.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-primary uppercase tracking-wider">Font Size Scale</Label>
                                    <Select 
                                        value={isEditMode ? pendingFontScale : fontScale} 
                                        onValueChange={(val: 'Compact' | 'Normal' | 'Large') => setPendingFontScale(val)}
                                        disabled={!isEditMode}
                                    >
                                        <SelectTrigger className="h-11 bg-white/70 rounded-xl border-primary/10 font-bold text-xs">
                                            <SelectValue placeholder="Select Font Scale" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FONT_SCALE_OPTIONS.map(scale => (
                                                <SelectItem key={scale.id} value={scale.id} className="font-bold text-xs">
                                                    {scale.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground">Global root font size scaling for desktop & mobile.</p>
                                </div>
                            </div>

                            {/* Live Font Style Preview Box */}
                            <div className="p-5 rounded-2xl bg-muted/10 border border-primary/10 space-y-3">
                                <div className="flex items-center justify-between border-b border-primary/10 pb-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Live Font Style Preview</span>
                                    <Badge variant="outline" className="text-[10px] bg-white text-primary border-primary/20">
                                        Heading: {isEditMode ? pendingHeadingFont : headingFont} | Body: {isEditMode ? pendingBodyFont : bodyFont}
                                    </Badge>
                                </div>
                                <div className="space-y-1">
                                    <h3 
                                        className="text-lg font-bold text-primary tracking-tight"
                                        style={{ fontFamily: `"${isEditMode ? pendingHeadingFont : headingFont}", sans-serif` }}
                                    >
                                        Sample Headline Title (1234567890)
                                    </h3>
                                    <p 
                                        className="text-xs text-muted-foreground leading-relaxed"
                                        style={{ fontFamily: `"${isEditMode ? pendingBodyFont : bodyFont}", sans-serif` }}
                                    >
                                        This is a live demonstration of body font styling. All cards, tables, forms, and pages across the platform will reflect your selected typography settings in real-time.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Card 3: Motion & Visual Effects */}
                    <Card className={cn("transition-all duration-300 border-primary/10 bg-white", isEditMode && "border-primary/40 shadow-md")}>
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                            <CardTitle className="flex items-center gap-2 font-bold text-base"><Zap className="h-5 w-5" /> Motion & Visual Effects</CardTitle>
                            <CardDescription className="font-normal text-xs text-primary/60">Customize The Responsiveness And Fluidity Of The Organization Interface.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between space-x-2 rounded-lg border border-primary/10 p-4 bg-muted/5 transition-all hover:border-primary/20">
                                    <div className="space-y-0.5">
                                        <Label className="font-bold text-sm">UI Transitions</Label>
                                        <p className="text-[10px] font-normal text-muted-foreground capitalize tracking-tight">Fade-Ins And Scaling Effects.</p>
                                    </div>
                                    <Switch 
                                        checked={isEditMode ? pendingAnimations : animationsEnabled} 
                                        onCheckedChange={isEditMode ? setPendingAnimations : undefined} 
                                        disabled={!isEditMode} 
                                    />
                                </div>
                                <div className="flex items-center justify-between space-x-2 rounded-lg border border-primary/10 p-4 bg-muted/5 transition-all hover:border-primary/20">
                                    <div className="space-y-0.5">
                                        <Label className="font-bold text-sm">Smooth Scrolling</Label>
                                        <p className="text-[10px] font-normal text-muted-foreground capitalize tracking-tight">Fluid Navigation Between Sections.</p>
                                    </div>
                                    <Switch 
                                        checked={isEditMode ? pendingSmoothScroll : smoothScrolling} 
                                        onCheckedChange={isEditMode ? setPendingSmoothScroll : undefined} 
                                        disabled={!isEditMode} 
                                    />
                                </div>
                                <div className="flex items-center justify-between space-x-2 rounded-lg border border-primary/10 p-4 bg-muted/5 transition-all hover:border-primary/20 sm:col-span-2">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <Label className="font-bold text-sm">Reduced Motion Mode</Label>
                                            <Badge variant="secondary" className="text-[8px] h-4 font-bold tracking-tighter">Accessibility</Badge>
                                        </div>
                                        <p className="text-[10px] font-normal text-muted-foreground capitalize tracking-tight">Minimizes Non-Essential Movement For Enhanced Comfort.</p>
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
                        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 font-bold text-sm tracking-widest capitalize text-primary">
                                    <Eye className="h-4 w-4" /> Real-Time Preview
                                </CardTitle>
                                {isEditMode && <Badge variant="success" className="animate-pulse text-[10px] font-bold">Live Interaction</Badge>}
                            </div>
                            <CardDescription className="text-[10px] font-normal">Visual Simulation Of Organizational Components.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 bg-primary/[0.01]">
                            <div className="p-4">
                                <ComponentPreview 
                                    themeId={isEditMode ? pendingTheme : (theme || 'bms3-a')} 
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/5 p-3 border-t border-primary/10 flex justify-center">
                            <p className="text-[10px] font-bold text-muted-foreground capitalize tracking-tighter">
                                Currently Rendering: {currentThemeName}
                            </p>
                        </CardFooter>
                    </Card>

                    {!isEditMode && (
                        <Card className="h-fit border-primary/10 bg-white shadow-sm overflow-hidden animate-fade-in-up">
                            <CardHeader className="bg-primary/5 border-b border-primary/10">
                                <CardTitle className="flex items-center gap-2 font-bold text-base"><Info className="h-5 w-5" /> Technical Profile</CardTitle>
                                <CardDescription className="font-normal text-xs text-primary/60">Active System Visual Configuration Logs.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-primary/10">
                                    <div className="flex items-center gap-2 text-primary/70"><Palette className="h-4 w-4"/><span className="text-xs font-bold capitalize tracking-tight">Active Theme</span></div>
                                    <Badge variant="outline" className="font-bold text-primary border-primary/20 bg-white">{currentThemeName}</Badge>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-primary/10">
                                    <div className="flex items-center gap-2 text-primary/70"><Type className="h-4 w-4"/><span className="text-xs font-bold capitalize tracking-tight">Typography</span></div>
                                    <span className="text-xs font-mono font-bold text-primary">{headingFont} / {bodyFont}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-primary/10">
                                    <div className="flex items-center gap-2 text-primary/70"><Zap className="h-4 w-4"/><span className="text-xs font-bold capitalize tracking-tight">Visual Effects</span></div>
                                    <span className="text-xs font-mono font-bold text-primary">{animationsEnabled ? 'Enabled' : 'Disabled'}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-dashed border-primary/10">
                                    <div className="flex items-center gap-2 text-primary/70"><MoveHorizontal className="h-4 w-4"/><span className="text-xs font-bold capitalize tracking-tight">Scrolling Style</span></div>
                                    <span className="text-xs font-mono font-bold text-primary">{smoothScrolling ? 'Fluid' : 'Instant'}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-primary/10">
                                    <div className="flex items-center gap-2 text-primary/70"><Wind className="h-4 w-4"/><span className="text-xs font-bold capitalize tracking-tight">Motion Profile</span></div>
                                    <Badge variant={reducedMotion ? "secondary" : "success"} className="text-[9px] font-bold">{reducedMotion ? 'Reduced Motion' : 'Full Effects'}</Badge>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-muted/5 p-4 border-t border-primary/10 italic text-[10px] text-muted-foreground font-normal text-center w-full">
                                Optimized For High-Fidelity Registry Rendering.
                            </CardFooter>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
