'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
    Layout, 
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
    
    // Core states
    const [isEditMode, setIsEditMode] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Persistent setting states
    const [animationsEnabled, setAnimationsEnabled] = useState(true);
    
    // Pending states (for edit mode)
    const [pendingTheme, setPendingTheme] = useState<string>('');
    const [pendingAnimations, setPendingAnimations] = useState(true);

    // Initial load and hydration fix
    useEffect(() => {
        setIsMounted(true);
        const storedMotion = localStorage.getItem('app_animations');
        if (storedMotion === 'disabled') {
            setAnimationsEnabled(false);
        }
    }, []);

    // Sync pending states when entering edit mode
    useEffect(() => {
        if (isEditMode) {
            setPendingTheme(theme || 'light');
            setPendingAnimations(animationsEnabled);
        }
    }, [isEditMode, theme, animationsEnabled]);

    const handleSave = async () => {
        setIsSubmitting(true);
        
        try {
            // Apply Theme
            setTheme(pendingTheme);
            
            // Apply Animations
            setAnimationsEnabled(pendingAnimations);
            if (pendingAnimations) {
                localStorage.setItem('app_animations', 'enabled');
                document.documentElement.removeAttribute('data-animations');
            } else {
                localStorage.setItem('app_animations', 'disabled');
                document.documentElement.setAttribute('data-animations', 'disabled');
            }

            toast({ 
                title: "Settings Saved", 
                description: "Your display preferences have been updated.",
                variant: "success" 
            });
            
            setIsEditMode(false);
        } catch (error) {
            toast({ 
                title: "Save Failed", 
                description: "An error occurred while saving your preferences.",
                variant: "destructive" 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setIsEditMode(false);
    };

    if (!isMounted) return null;

    const currentThemeName = THEME_SUGGESTIONS.find(t => t.id === theme)?.name || theme || 'Default';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-primary">Display & UI preferences</h2>
                    <p className="text-sm font-normal text-muted-foreground">Manage themes, motion, and visual accessibility.</p>
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
                        <Button onClick={handleSave} disabled={isSubmitting} className="font-bold">
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                    {/* Appearance Mode Summary / Editor */}
                    <Card className={cn("transition-all duration-300", isEditMode && "border-primary/40 shadow-md")}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary font-bold">
                                <Palette className="h-5 w-5" /> Appearance mode
                            </CardTitle>
                            <CardDescription className="font-normal">Select your basic application interface mode.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!isEditMode ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/20 border">
                                        <div className="flex items-center gap-2">
                                            {resolvedTheme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
                                            <span className="text-sm font-bold capitalize">{resolvedTheme} Mode</span>
                                        </div>
                                        <Badge variant="secondary" className="font-bold uppercase text-[10px]">{currentThemeName}</Badge>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <Button 
                                        variant={pendingTheme === 'light' ? 'default' : 'outline'} 
                                        className="font-bold flex-1"
                                        onClick={() => setPendingTheme('light')}
                                    >
                                        <Sun className="mr-2 h-4 w-4" /> Light
                                    </Button>
                                    <Button 
                                        variant={pendingTheme === 'dark' ? 'default' : 'outline'} 
                                        className="font-bold flex-1"
                                        onClick={() => setPendingTheme('dark')}
                                    >
                                        <Moon className="mr-2 h-4 w-4" /> Dark
                                    </Button>
                                    <Button 
                                        variant={pendingTheme === 'system' ? 'default' : 'outline'} 
                                        className="font-bold flex-1"
                                        onClick={() => setPendingTheme('system')}
                                    >
                                        <Monitor className="mr-2 h-4 w-4" /> System
                                    </Button>
                                </div>
                            )}
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pt-2">
                                System Status: <span className="text-primary">{resolvedTheme} mode active</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* Motion & Effects Summary / Editor */}
                    <Card className={cn("transition-all duration-300", isEditMode && "border-primary/40 shadow-md")}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary font-bold">
                                <Zap className="h-5 w-5" /> Motion & effects
                            </CardTitle>
                            <CardDescription className="font-normal">Configure visual feedback and transitions.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4 bg-muted/5">
                                <div className="space-y-0.5">
                                    <Label className="font-bold">UI Animations</Label>
                                    <p className="text-xs font-normal text-muted-foreground">Smooth transitions and loading effects.</p>
                                </div>
                                <Switch 
                                    checked={isEditMode ? pendingAnimations : animationsEnabled} 
                                    onCheckedChange={isEditMode ? setPendingAnimations : undefined}
                                    disabled={!isEditMode}
                                />
                            </div>
                            {! (isEditMode ? pendingAnimations : animationsEnabled) && (
                                <Alert className="bg-primary/5 border-primary/20 animate-fade-in-up">
                                    <ZapOff className="h-4 w-4 text-primary" />
                                    <AlertTitle className="font-bold">Reduced motion active</AlertTitle>
                                    <AlertDescription className="font-normal text-xs">
                                        Transitions minimized for maximum performance.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Theme Suggestions Grid (Visible only in Edit Mode) */}
                <div className="space-y-6">
                    {isEditMode ? (
                        <Card className="border-primary/40 shadow-md h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary font-bold">
                                    <Droplets className="h-5 w-5" /> Theme suggestions
                                </CardTitle>
                                <CardDescription className="font-normal text-primary/70">
                                    Choose from our curated color palettes.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ScrollArea className="h-[400px] pr-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {THEME_SUGGESTIONS.map((suggestion) => (
                                            <Button
                                                key={suggestion.id}
                                                variant={pendingTheme === suggestion.id ? 'default' : 'outline'}
                                                className={cn(
                                                    "font-bold justify-start px-4 h-12 transition-all duration-300",
                                                    pendingTheme === suggestion.id && "shadow-md scale-[1.02]"
                                                )}
                                                onClick={() => setPendingTheme(suggestion.id)}
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span>{suggestion.name}</span>
                                                    {pendingTheme === suggestion.id && <CheckCircle2 className="h-4 w-4" />}
                                                </div>
                                            </Button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                            <CardFooter className="bg-muted/5 border-t p-4">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    Selected for preview: <span className="text-primary">{THEME_SUGGESTIONS.find(t => t.id === pendingTheme)?.name || pendingTheme}</span>
                                </p>
                            </CardFooter>
                        </Card>
                    ) : (
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary font-bold">
                                    <Info className="h-5 w-5" /> technical audit
                                </CardTitle>
                                <CardDescription className="font-normal">Current UI standards applied to your session.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                                        <div className="flex items-center gap-2"><Palette className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold uppercase tracking-tight">Active Theme</span></div>
                                        <Badge variant="outline" className="font-bold text-primary">{currentThemeName}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                                        <div className="flex items-center gap-2"><Type className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold uppercase tracking-tight">Typography</span></div>
                                        <div className="text-right flex flex-wrap gap-1 justify-end">
                                            <Badge variant="secondary" className="font-normal text-[10px]">SPACE GROTESK</Badge>
                                            <Badge variant="secondary" className="font-normal text-[10px]">INTER</Badge>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                                        <div className="flex items-center gap-2"><MousePointer2 className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold uppercase tracking-tight">Transitions</span></div>
                                        <span className="text-xs font-mono font-bold text-primary">{animationsEnabled ? '200ms' : '0.01ms'}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold uppercase tracking-tight">Accessibility</span></div>
                                        <Badge variant="success" className="text-[9px] font-bold">OPTIMIZED</Badge>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-primary/5 p-4 rounded-b-lg">
                                <p className="text-[10px] text-primary/60 font-normal italic">Tip: Click 'Edit Settings' above to change your visual environment.</p>
                            </CardFooter>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
