'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    CheckCircle2,
    Eye
} from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function ViewportSettingsPage() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);
    const [animationsEnabled, setAnimationsEnabled] = useState(true);

    // Hydration fix
    useEffect(() => {
        setIsMounted(true);
        const storedMotion = localStorage.getItem('app_animations');
        if (storedMotion === 'disabled') {
            setAnimationsEnabled(false);
            document.documentElement.setAttribute('data-animations', 'disabled');
        }
    }, []);

    const toggleAnimations = (enabled: boolean) => {
        setAnimationsEnabled(enabled);
        if (enabled) {
            localStorage.setItem('app_animations', 'enabled');
            document.documentElement.removeAttribute('data-animations');
            toast({ title: "Animations enabled", variant: "success" });
        } else {
            localStorage.setItem('app_animations', 'disabled');
            document.documentElement.setAttribute('data-animations', 'disabled');
            toast({ title: "Animations disabled", description: "Transitions have been reduced.", variant: "default" });
        }
    };

    if (!isMounted) return null;

    return (
        <div className="space-y-6 animate-fade-in-zoom">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-primary">Display & UI preferences</h2>
                    <p className="text-sm font-normal text-muted-foreground">Manage themes, motion, and visual accessibility.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Theme & Motion Control */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary font-bold">
                                <Palette className="h-5 w-5" /> Appearance theme
                            </CardTitle>
                            <CardDescription className="font-normal">Select your preferred application color scheme.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Button 
                                    variant={theme === 'light' ? 'default' : 'outline'} 
                                    className="font-bold flex-1"
                                    onClick={() => setTheme('light')}
                                >
                                    <Sun className="mr-2 h-4 w-4" /> Light
                                </Button>
                                <Button 
                                    variant={theme === 'dark' ? 'default' : 'outline'} 
                                    className="font-bold flex-1"
                                    onClick={() => setTheme('dark')}
                                >
                                    <Moon className="mr-2 h-4 w-4" /> Dark
                                </Button>
                                <Button 
                                    variant={theme === 'system' ? 'default' : 'outline'} 
                                    className="font-bold flex-1"
                                    onClick={() => setTheme('system')}
                                >
                                    <Monitor className="mr-2 h-4 w-4" /> System
                                </Button>
                            </div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pt-2">
                                Current active: <span className="text-primary">{resolvedTheme} mode</span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary font-bold">
                                <Zap className="h-5 w-5" /> Motion & effects
                            </CardTitle>
                            <CardDescription className="font-normal">Configure visual feedback and transitions.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="font-bold">UI Animations</Label>
                                    <p className="text-xs font-normal text-muted-foreground">Enable smooth transitions and loading effects.</p>
                                </div>
                                <Switch 
                                    checked={animationsEnabled} 
                                    onCheckedChange={toggleAnimations} 
                                />
                            </div>
                            {!animationsEnabled && (
                                <Alert className="bg-primary/5 border-primary/20">
                                    <ZapOff className="h-4 w-4 text-primary" />
                                    <AlertTitle className="font-bold">Reduced motion active</AlertTitle>
                                    <AlertDescription className="font-normal text-xs">
                                        Transitions have been minimized to 0.01ms for maximum performance and accessibility.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* UI/UX Audit & Preview */}
                <div className="space-y-6">
                    <Card className="bg-primary/5 border-primary/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary font-bold">
                                <Layout className="h-5 w-5" /> Live component preview
                            </CardTitle>
                            <CardDescription className="font-normal text-primary/70">Test the current theme and motion settings below.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="p-6 rounded-lg bg-background border shadow-sm space-y-4">
                                <h3 className="text-lg font-bold text-primary">Space Grotesk Heading</h3>
                                <p className="text-sm font-normal text-foreground leading-normal">
                                    This is a sample of Inter body text at 14px. It follows the sentence-case standard for professional clarity.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    <Button className="btn-primary">Primary action</Button>
                                    <Button variant="outline" className="font-bold border-primary/20 text-primary">Secondary choice</Button>
                                    <Badge className="bg-accent text-accent-foreground font-bold">Accent highlight</Badge>
                                    <Badge variant="success" className="font-bold">Success state</Badge>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold uppercase opacity-60">Interactive hover</Label>
                                    <div className="h-12 w-full rounded border bg-card flex items-center justify-center interactive-hover cursor-pointer font-bold text-xs text-primary">
                                        -1px Lift Effect
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-bold uppercase opacity-60">Loading state</Label>
                                    <div className="h-12 w-full rounded border bg-card flex items-center justify-center p-4">
                                        <div className="h-1 w-full bg-primary/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary animate-shimmer" style={{ width: '40%' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-primary font-bold">
                                <Info className="h-5 w-5" /> Configuration audit
                            </CardTitle>
                            <CardDescription className="font-normal">Technical standards currently applied to the application.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="w-full">
                                <div className="space-y-3 min-w-[300px]">
                                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                                        <div className="flex items-center gap-2"><Type className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold">Typography</span></div>
                                        <div className="text-right space-y-1">
                                            <Badge variant="secondary" className="font-normal">Space Grotesk (H)</Badge>
                                            <Badge variant="secondary" className="font-normal ml-1">Inter (B)</Badge>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                                        <div className="flex items-center gap-2"><Layout className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold">Hierarchy</span></div>
                                        <div className="text-right"><span className="text-[10px] font-bold text-muted-foreground">BOLD HEADERS / NORMAL DESC</span></div>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-dashed">
                                        <div className="flex items-center gap-2"><MousePointer2 className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold">Transitions</span></div>
                                        <div className="text-right"><span className="text-xs font-mono">200ms ease-in-out</span></div>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground"/><span className="text-xs font-bold">Accessibility</span></div>
                                        <div className="text-right"><Badge variant="outline" className="text-[10px] font-bold">SCROLL-SAFE TABLES</Badge></div>
                                    </div>
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
