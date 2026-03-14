'use client';

import { useGuidingPrinciples } from '@/hooks/use-guiding-principles';
import { useInfoSettings } from '@/hooks/use-info-settings';
import { defaultGuidingPrinciples } from '@/lib/guiding-principles-default';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Award, CheckCircle2, ShieldCheck, Loader2, GraduationCap, HeartPulse, Utensils, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import type { FocusArea } from '@/lib/types';

const FocusAreaIcon = ({ type }: { type: FocusArea['icon'] }) => {
    switch (type) {
        case 'Education': return <GraduationCap className="h-5 w-5" />;
        case 'Healthcare': return <HeartPulse className="h-5 w-5" />;
        case 'Relief': return <Utensils className="h-5 w-5" />;
        default: return <HelpCircle className="h-5 w-5" />;
    }
};

export default function GuidingPrinciplesPage() {
    const { guidingPrinciplesData, isLoading: isContentLoading } = useGuidingPrinciples();
    const { infoSettings, isLoading: isInfoLoading } = useInfoSettings();

    const isLoading = isContentLoading || isInfoLoading;
    const data = guidingPrinciplesData || defaultGuidingPrinciples;
    const visiblePrinciples = data.principles?.filter(p => !p.isHidden && p.text?.trim()) || [];
    const visibleFocusAreas = data.focusAreas?.filter(f => !f.isHidden) || [];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!infoSettings?.isGuidingPrinciplesPublic) {
        return (
            <main className="container mx-auto p-4 md:p-8 text-center">
                <h1 className="text-2xl font-bold text-primary">Page Not Available</h1>
                <p className="text-muted-foreground mt-2 font-normal">This informational page is not currently public.</p>
                <Button asChild className="mt-6 font-bold" variant="outline">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Go Back to Home
                    </Link>
                </Button>
            </main>
        );
    }

    return (
        <main className="container mx-auto p-4 md:p-8 space-y-12 text-primary">
            <div className="mb-4">
                <Button variant="outline" asChild className="font-bold border-primary/20">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
            </div>

            <section className="max-w-4xl mx-auto space-y-10 animate-fade-in-up">
                <div className="space-y-4 text-center">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 text-primary mb-2">
                        <Award className="h-8 w-8" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase">{data.title}</h1>
                    <p className="text-lg leading-relaxed font-normal opacity-80 max-w-2xl mx-auto">
                        {data.description}
                    </p>
                </div>

                <Card className="shadow-2xl border-primary/10 overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 p-8 border-b border-primary/10">
                        <CardTitle className="text-2xl font-bold flex items-center gap-3">
                            <ShieldCheck className="h-7 w-7 text-primary" />
                            Operational Standards
                        </CardTitle>
                        <CardDescription className="text-primary/70 font-normal">
                            Fundamental rules that ensure our impact is consistent and ethical.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 md:p-12">
                        {/* Dynamic Focus Areas / Core Pillars */}
                        {visibleFocusAreas.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
                                {visibleFocusAreas.map((area) => (
                                    <div key={area.id} className="p-4 rounded-xl bg-primary/[0.02] border border-primary/5 space-y-3 transition-all hover:bg-white hover:shadow-md">
                                        <div className="p-2 rounded-lg bg-primary/10 text-primary w-fit">
                                            <FocusAreaIcon type={area.icon} />
                                        </div>
                                        <h4 className="font-bold text-sm">{area.title}</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed font-normal">{area.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {visibleFocusAreas.length > 0 && <Separator className="mb-12 opacity-10" />}

                        <div className="grid gap-8">
                            {visiblePrinciples.map((principle, index) => (
                                <div key={principle.id} className="flex gap-6 group">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20 transition-colors group-hover:bg-primary group-hover:text-white">
                                            {index + 1}
                                        </div>
                                        {index !== visiblePrinciples.length - 1 && (
                                            <div className="w-0.5 h-full bg-muted/30 group-hover:bg-primary/20 transition-colors" />
                                        )}
                                    </div>
                                    <div className="pt-1 space-y-2 flex-1">
                                        <p className="text-lg font-normal leading-relaxed text-foreground/90">
                                            {principle.text}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/5 p-8 border-t border-primary/5 italic text-sm text-center justify-center text-muted-foreground font-normal">
                        These principles are reviewed regularly by our core management team.
                    </CardFooter>
                </Card>
            </section>

            <section className="max-w-4xl mx-auto text-center space-y-6 pt-12">
                <h2 className="text-2xl font-bold">Interested in helping?</h2>
                <p className="text-muted-foreground font-normal">Our impact is only possible through the generosity of our community.</p>
                <div className="flex justify-center gap-4">
                    <Button asChild size="lg" className="font-bold">
                        <Link href="/campaign-public">Support a Campaign</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="font-bold border-primary/20 text-primary">
                        <Link href="/info/donation-info">View Donation Types</Link>
                    </Button>
                </div>
            </section>
        </main>
    );
}
