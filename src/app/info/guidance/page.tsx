'use client';

import { useGuidance } from '@/hooks/use-guidance';
import { useInfoSettings } from '@/hooks/use-info-settings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    ArrowLeft, 
    Hospital, 
    BookOpen, 
    Phone, 
    MapPin, 
    ExternalLink, 
    Info, 
    ChevronRight,
    Search,
    Stethoscope,
    Building2,
    HeartHandshake,
    AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BrandedLoader } from '@/components/branded-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { usePageHit } from '@/hooks/use-page-hit';

export default function GuidancePublicPage() {
    const { guidanceData, isLoading: isDataLoading } = useGuidance();
    const { infoSettings, isLoading: isSettingsLoading } = useInfoSettings();
    const [searchTerm, setSearchTerm] = useState('');
    
    usePageHit('guidance_directory');

    const isLoading = isDataLoading || isSettingsLoading;

    const filteredCategories = useMemo(() => {
        if (!guidanceData?.categories) return [];
        
        const term = searchTerm.toLowerCase();
        return guidanceData.categories.map(cat => ({
            ...cat,
            resources: cat.resources.filter(res => 
                !res.isHidden && (
                    res.name.toLowerCase().includes(term) ||
                    (res.subtitle || '').toLowerCase().includes(term) ||
                    (res.description || '').toLowerCase().includes(term) ||
                    (res.address || '').toLowerCase().includes(term)
                )
            )
        })).filter(cat => cat.resources.length > 0);
    }, [guidanceData, searchTerm]);

    if (isLoading) return <BrandedLoader />;

    if (!guidanceData?.isPublic || !infoSettings?.isGuidanceDirectoryPublic) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center font-normal">
                <h1 className="text-2xl font-bold text-primary">Page Not Available</h1>
                <p className="text-muted-foreground mt-2">This guidance directory is not currently public.</p>
                <Button asChild className="mt-6 font-bold" variant="outline">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back Home
                    </Link>
                </Button>
            </main>
        );
    }

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-10 text-primary font-normal">
            <div className="mb-4">
                <Button variant="outline" asChild className="transition-transform active:scale-95 font-bold border-primary/20">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back To Home
                    </Link>
                </Button>
            </div>

            <section className="text-center space-y-4 animate-fade-in-up">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-2">
                    <BookOpen className="h-8 w-8" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tighter capitalize">{guidanceData.title}</h1>
                <p className="text-muted-foreground text-lg max-w-3xl mx-auto font-normal leading-relaxed italic">
                    {guidanceData.description}
                </p>
            </section>

            <div className="max-w-4xl mx-auto space-y-8">
                <div className="relative animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                    <Input 
                        placeholder="Search resources, hospitals, or schemes..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-12 text-base rounded-xl border-primary/10 focus-visible:ring-primary shadow-sm"
                    />
                </div>

                {filteredCategories.length > 0 ? (
                    <div className="space-y-12">
                        {filteredCategories.map((cat, catIdx) => (
                            <div key={cat.id} className="space-y-6 animate-fade-in-up" style={{ animationDelay: `${300 + catIdx * 100}ms` }}>
                                <div className="flex items-center gap-3 border-b border-primary/10 pb-2">
                                    <Badge variant="secondary" className="font-bold rounded-lg h-10 w-10 flex items-center justify-center p-0 shrink-0">
                                        {cat.resources.length}
                                    </Badge>
                                    <h2 className="text-2xl font-bold tracking-tight">{cat.name}</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {cat.resources.map((res) => (
                                        <Card key={res.id} className="group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white border-primary/5 overflow-hidden flex flex-col h-full">
                                            <CardHeader className="bg-primary/[0.02] border-b pb-4">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="space-y-1">
                                                        <CardTitle className="text-lg font-bold text-primary group-hover:text-primary/80 transition-colors">{res.name}</CardTitle>
                                                        {res.subtitle && <p className="text-sm font-bold text-muted-foreground tracking-tight">{res.subtitle}</p>}
                                                    </div>
                                                    <div className="p-2 rounded-lg bg-white border border-primary/10 text-primary shadow-sm">
                                                        {cat.id.includes('hospital') ? <Hospital className="h-5 w-5"/> : <Building2 className="h-5 w-5"/>}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-6 space-y-4 flex-1">
                                                {res.description && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-muted-foreground capitalize tracking-widest flex items-center gap-1.5">
                                                            <Info className="h-3 w-3" /> Guidance & Scope
                                                        </p>
                                                        <p className="text-sm font-normal text-primary/80 leading-relaxed italic border-l-2 border-primary/20 pl-3">
                                                            {res.description}
                                                        </p>
                                                    </div>
                                                )}
                                                
                                                <div className="space-y-2 pt-2">
                                                    {res.phone && (
                                                        <a href={`tel:${res.phone}`} className="flex items-center gap-2 text-sm font-bold text-primary hover:underline transition-all">
                                                            <Phone className="h-4 w-4 opacity-60" /> {res.phone}
                                                        </a>
                                                    )}
                                                    {res.address && (
                                                        <div className="flex items-start gap-2 text-xs font-normal text-muted-foreground">
                                                            <MapPin className="h-4 w-4 mt-0.5 opacity-40 shrink-0" />
                                                            <span className="leading-relaxed">{res.address}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                            {res.link && (
                                                <CardFooter className="bg-primary/5 p-3 mt-auto">
                                                    <Button variant="ghost" asChild className="w-full font-bold text-xs h-8 hover:bg-white hover:text-primary transition-all">
                                                        <a href={res.link} target="_blank" rel="noopener noreferrer">
                                                            Official Website <ExternalLink className="ml-2 h-3 w-3" />
                                                        </a>
                                                    </Button>
                                                </CardFooter>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/10">
                        <Stethoscope className="h-16 w-16 mx-auto text-primary/20 mb-4" />
                        <p className="text-lg font-bold text-primary/60 tracking-widest capitalize">No Matches Discovered.</p>
                        <p className="text-sm text-muted-foreground font-normal mt-2">Try refining your search terms.</p>
                    </div>
                )}
            </div>

            <section className="max-w-4xl mx-auto pt-12">
                <Card className="bg-primary/[0.02] border-primary/20 border-2 border-dashed shadow-none">
                    <CardContent className="p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                        <div className="p-4 rounded-full bg-primary/10 text-primary">
                            <HeartHandshake className="h-10 w-10" />
                        </div>
                        <div className="space-y-2 flex-1">
                            <h3 className="text-xl font-bold tracking-tight">Need Further Clarification?</h3>
                            <p className="text-sm font-normal text-muted-foreground leading-relaxed">
                                Our volunteers can guide you on how to best approach these external resources for medical or educational assistance.
                            </p>
                        </div>
                        <Button asChild className="font-bold shadow-md h-12 px-8 rounded-xl active:scale-95 transition-transform shrink-0">
                            <Link href="/info/members">Contact Our Team</Link>
                        </Button>
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
