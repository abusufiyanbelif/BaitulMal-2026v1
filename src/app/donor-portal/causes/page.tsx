'use client';

import { usePublicData } from '@/hooks/use-public-data';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Target, 
    TrendingUp, 
    Users, 
    ArrowRight, 
    Calendar,
    ChevronRight,
    Heart,
    Zap,
    Filter,
    ShieldCheck,
    Clock
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { PurposePlaceholder } from '@/components/purpose-placeholder';

export default function DonorCausesPage() {
    const { isLoading, campaignsWithProgress, leadsWithProgress } = usePublicData();
    const [filter, setFilter] = useState<'All' | 'Campaigns' | 'Appeals'>('All');

    const allCauses = useMemo(() => {
        const causes = [
            ...campaignsWithProgress.map(c => ({ ...c, type: 'Campaign' as const })),
            ...leadsWithProgress.map(l => ({ ...l, type: 'Appeal' as const }))
        ];
        return causes.sort((a, b) => (b.progress || 0) - (a.progress || 0));
    }, [campaignsWithProgress, leadsWithProgress]);

    const filteredCauses = useMemo(() => {
        if (filter === 'All') return allCauses;
        return allCauses.filter(c => {
            if (filter === 'Campaigns') return c.type === 'Campaign';
            if (filter === 'Appeals') return c.type === 'Appeal';
            return true;
        });
    }, [allCauses, filter]);

    if (isLoading) return <BrandedLoader message="Discovering Active Organization Initiatives..." />;

    return (
        <div className="space-y-8 animate-fade-in-up pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900 p-8 rounded-3xl shadow-2xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="space-y-2 z-10">
                    <h1 className="text-3xl font-black tracking-tight">Active Causes</h1>
                    <p className="text-white/40 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
                        <Target className="h-3 w-3 text-primary" /> Direct Impact Discovery Workspace
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 z-10">
                    {(['All', 'Campaigns', 'Appeals'] as const).map((f) => (
                        <button 
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${filter === f ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredCauses.map((cause) => (
                    <Card key={cause.id} className="border-none shadow-xl shadow-slate-200/40 bg-white rounded-[32px] overflow-hidden flex flex-col group hover:shadow-2xl transition-all duration-500 border border-transparent hover:border-slate-100">
                        <div className="relative h-56 w-full overflow-hidden">
                            {(cause.imageUrl && (cause as any).showCustomImage !== false) ? (
                                <img 
                                    src={cause.imageUrl} 
                                    alt={cause.name} 
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                />
                            ) : (
                                <PurposePlaceholder 
                                    purpose={(cause as any).purpose || (cause as any).category} 
                                    category={(cause as any).category} 
                                />
                            )}
                            <div className="absolute top-4 left-4">
                                <Badge className={`${cause.type === 'Campaign' ? 'bg-indigo-600' : 'bg-primary'} text-white font-black text-[9px] uppercase tracking-widest border-none shadow-xl px-3 py-1`}>
                                    {cause.type}
                                </Badge>
                            </div>
                            <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                                <p className="text-white font-black text-base line-clamp-1 tracking-tight">{cause.name}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <ShieldCheck className="h-3 w-3 text-primary" />
                                    <span className="text-[8px] font-bold text-white/60 uppercase tracking-widest">Verified Organization Cause</span>
                                </div>
                            </div>
                        </div>

                        <CardContent className="pt-8 flex-grow space-y-8">
                            <div className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Funding Progress</p>
                                        <p className="text-sm font-black text-slate-900 font-mono">{formatCurrency(cause.collected || 0)} <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">Raised</span></p>
                                    </div>
                                    <p className="text-xs font-black text-primary font-mono bg-primary/5 px-2 py-1 rounded-lg">{Math.round(cause.progress || 0)}%</p>
                                </div>
                                <Progress value={cause.progress} className="h-2 bg-slate-50 overflow-hidden rounded-full">
                                    <div className="h-full bg-primary transition-all duration-1000 ease-out shadow-sm" style={{ width: `${cause.progress}%` }} />
                                </Progress>
                                <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    <span>Goal: {formatCurrency(cause.targetAmount || 0)}</span>
                                    <span>Remaining: {formatCurrency(Math.max(0, (cause.targetAmount || 0) - (cause.collected || 0)))}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Timeline</span>
                                        <span className="text-[10px] font-bold text-slate-700 uppercase">{cause.endDate ? formatDate(cause.endDate, { dateStyle: 'medium' }) : 'Continuous'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 justify-end">
                                    <div className="flex flex-col text-right">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Allocation</span>
                                        <span className="text-[10px] font-bold text-slate-700 uppercase">{cause.type === 'Campaign' ? 'Community' : 'Individual'}</span>
                                    </div>
                                    <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                        <Users className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed font-medium">
                                {cause.description || 'This organization initiative is verified for direct impact and follows strict administrative audit protocols.'}
                            </p>
                        </CardContent>

                        <CardFooter className="p-8 pt-0 gap-4">
                            <Button asChild variant="outline" className="flex-1 font-black text-[10px] uppercase tracking-widest border-slate-200 rounded-2xl h-14 hover:bg-slate-50 transition-all">
                                <Link href={cause.type === 'Campaign' ? `/campaign-public/${cause.id}/summary` : `/leads-public/${cause.id}/summary`}>
                                    View Audit Summary
                                </Link>
                            </Button>
                            <Button asChild className="flex-1 font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-primary/30 rounded-2xl h-14 group">
                                <Link href={`/donate?${cause.type === 'Campaign' ? 'campaignId' : 'leadId'}=${cause.id}`}>
                                    Contribute Now <Heart className="ml-2 h-4 w-4 fill-white group-hover:scale-125 transition-transform" />
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}

                {filteredCauses.length === 0 && (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center space-y-6 opacity-40">
                        <div className="h-24 w-24 bg-slate-100 rounded-[32px] flex items-center justify-center">
                            <Zap className="h-10 w-10 text-slate-300" />
                        </div>
                        <div className="text-center">
                            <p className="font-black text-sm uppercase tracking-widest text-slate-900">No Active Initiatives</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Please check back later for new causes.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
