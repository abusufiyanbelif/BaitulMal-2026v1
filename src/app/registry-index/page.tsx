'use client';

import React, { useState } from 'react';
import Link from 'next/link';

import { 
    Search, 
    ArrowRight, 
    ArrowLeft, 
    Home, 
    ChevronRight, 
    Calendar, 
    Info, 
    ExternalLink,
    Compass,
    Navigation2,
    LayoutGrid,
    Clock,
    Sparkles,
    Database,
    Zap,
    Table2,
    ShieldCheck,
    FileCode2,
    CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import registryData from '@/lib/registry-index.json';
import versionData from '@/lib/version.json';
import { cn } from '@/lib/utils';

// Purpose: Administrative Registry Index and Navigational Map

export default function RegistryIndexPage() {
    const [searchQuery, setSearchQuery] = useState('');
    
    const pages = (registryData.pages || []) as any[];
    const docs = registryData.docs || { releases: [], userGuides: [], architecture: [] };

    const filteredPages = pages.filter(page => 
        page.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (page.collections && page.collections.some((c: string) => c.toLowerCase().includes(searchQuery.toLowerCase()))) ||
        (page.fields && page.fields.some((f: string) => f.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    const filteredGuides = docs.userGuides.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredArch = docs.architecture.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 md:p-12 font-sans selection:bg-emerald-100">
            <div className="max-w-7xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                
                {/* Header Section */}
                <div className="relative overflow-hidden bg-white p-10 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                    <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none">
                        <Navigation2 className="h-48 w-48 text-emerald-600 rotate-12" />
                    </div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200">
                                    <Compass className="h-8 w-8 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">Registry Index Map</h1>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-black uppercase">Deep Scan Active</Badge>
                                        <span className="text-slate-400 text-xs font-bold">• Institutional Technical Hub</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-slate-500 font-medium max-w-2xl text-lg leading-relaxed">
                                A comprehensive multi-dimensional map of the BaitulMal 2026v1 platform, integrating architecture, operational guides, and real-time interface metadata.
                            </p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                            <Link href="/">
                                <Button variant="outline" className="h-14 px-8 rounded-2xl border-slate-200 hover:bg-slate-50 font-bold text-slate-700 text-sm">
                                    <Home className="h-5 w-5 mr-3" /> Home
                                </Button>
                            </Link>
                            <Button 
                                variant="default" 
                                className="h-14 px-8 rounded-2xl bg-slate-900 hover:bg-emerald-600 shadow-xl transition-all duration-300 font-bold text-sm"
                                onClick={() => window.history.back()}
                            >
                                <ArrowLeft className="h-5 w-5 mr-3" /> Return back
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Dashboard Stats & Search */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Search Bar */}
                    <div className="lg:col-span-8 relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-sky-500 rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative bg-white rounded-[1.8rem] shadow-sm border border-slate-100 flex items-center p-2 h-20">
                            <Search className="ml-6 h-6 w-6 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <Input 
                                placeholder="Search by route, collection, field, or purpose..." 
                                className="border-none focus-visible:ring-0 text-xl font-medium placeholder:text-slate-300 h-full px-6"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <div className="hidden md:flex gap-2 mr-4">
                                <Badge className="bg-slate-50 text-slate-400 border-none font-bold">⌘ K</Badge>
                            </div>
                        </div>
                    </div>

                    {/* Stats Panel */}
                    <div className="lg:col-span-4 grid grid-cols-2 gap-4">
                        <Card className="rounded-[1.8rem] border-none shadow-sm bg-white p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div className="p-2 bg-emerald-50 rounded-xl w-fit mb-4">
                                <FileCode2 className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Endpoints</p>
                                <p className="text-3xl font-black text-slate-900 leading-none">{pages.length}</p>
                            </div>
                        </Card>
                        <Card className="rounded-[1.8rem] border-none shadow-sm bg-white p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div className="p-2 bg-sky-50 rounded-xl w-fit mb-4">
                                <CheckCircle2 className="h-6 w-6 text-sky-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Guides</p>
                                <p className="text-3xl font-black text-slate-900 leading-none">{docs.userGuides.length}</p>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Architecture Insights Section */}
                <section className="space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-1.5 bg-sky-500 rounded-full" />
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">🏗️ System Architecture & Data Maps</h2>
                        </div>
                        <Badge variant="outline" className="rounded-full border-sky-100 bg-sky-50 text-sky-700 font-bold px-4">Core Infrastructure</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredArch.map((doc, idx) => (
                            <Card key={idx} className="group rounded-[2rem] border-none shadow-sm bg-white hover:bg-sky-50/50 transition-all duration-500 border-l-8 border-sky-500 hover:shadow-xl hover:-translate-y-1">
                                <CardContent className="p-8 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="p-3 bg-sky-50 rounded-2xl group-hover:bg-white transition-colors">
                                            <Database className="h-6 w-6 text-sky-600" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</p>
                                            <p className="text-xs font-bold text-sky-600">Technical Spec</p>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <h3 className="text-xl font-black text-slate-900 group-hover:text-sky-700 transition-colors">{doc.name}</h3>
                                        <p className="text-sm font-medium text-slate-500 leading-relaxed">Integrated technical mapping for institutional data integrity and scale.</p>
                                    </div>
                                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400">v2026.1.0</span>
                                        <Button variant="ghost" size="sm" className="rounded-full text-sky-600 font-bold hover:bg-sky-100">
                                            Open Spec <ExternalLink className="ml-2 h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* Main Application Registry Section */}
                <section className="space-y-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-1.5 bg-emerald-500 rounded-full" />
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">📱 Application Modules & Deep Metadata</h2>
                        </div>
                        <Badge variant="outline" className="rounded-full border-emerald-100 bg-emerald-50 text-emerald-700 font-bold px-4">Interactive Registry</Badge>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                        {filteredPages.map((page) => (
                            <Card key={page.id} className="group rounded-[2.5rem] border-none shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.06)] transition-all duration-700 bg-white overflow-hidden flex flex-col md:flex-row">
                                {/* Left Visual Panel */}
                                <div className="md:w-1/3 bg-slate-50 p-8 flex flex-col justify-between border-r border-slate-100 group-hover:bg-emerald-50/30 transition-colors duration-700">
                                    <div className="space-y-6">
                                        <Badge className="rounded-xl bg-slate-900 text-white font-black text-[10px] px-3 py-1 uppercase shadow-lg shadow-slate-200">
                                            MOD-00{page.id}
                                        </Badge>
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase group-hover:text-emerald-700 transition-colors">{page.name}</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{page.purpose}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-8">
                                        <Link href={page.route} className="block">
                                            <Button className="w-full h-12 rounded-[1.2rem] bg-white border border-slate-200 text-slate-900 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 shadow-sm transition-all duration-300 font-black text-xs uppercase tracking-wider">
                                                Go to Live View
                                            </Button>
                                        </Link>
                                        <div className="flex gap-2">
                                            {page.prev && (
                                                <Link href={page.prev} className="flex-1">
                                                    <Button variant="ghost" size="sm" className="w-full rounded-xl text-[9px] font-black uppercase text-slate-400 hover:text-emerald-600 hover:bg-emerald-50">
                                                        <ArrowLeft className="mr-1 h-3 w-3" /> Prev
                                                    </Button>
                                                </Link>
                                            )}
                                            {page.next && (
                                                <Link href={page.next} className="flex-1">
                                                    <Button variant="ghost" size="sm" className="w-full rounded-xl text-[9px] font-black uppercase text-slate-400 hover:text-emerald-600 hover:bg-emerald-50">
                                                        Next <ArrowRight className="ml-1 h-3 w-3" />
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Data Panel */}
                                <div className="flex-1 p-8 md:p-10 space-y-8">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3 text-slate-300">
                                            <Clock className="h-4 w-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Last Sync: {new Date(page.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                        <Badge variant="outline" className="rounded-lg text-[9px] font-black border-slate-100 text-slate-400">{page.route}</Badge>
                                    </div>

                                    <Separator className="bg-slate-50" />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                        {/* Firestore Mapping */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-emerald-600">
                                                <Database className="h-4 w-4" />
                                                <h4 className="text-[10px] font-black uppercase tracking-wider">Firestore Collections</h4>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {page.collections && page.collections.length > 0 ? (
                                                    page.collections.map((c: string) => (
                                                        <Badge key={c} variant="secondary" className="bg-slate-50 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-md border-none">
                                                            {c}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] italic text-slate-400">No direct collections</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Field Mapping */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-sky-600">
                                                <Table2 className="h-4 w-4" />
                                                <h4 className="text-[10px] font-black uppercase tracking-wider">Mapped Fields</h4>
                                            </div>
                                            <ScrollArea className="h-24 pr-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {page.fields && page.fields.length > 0 ? (
                                                        page.fields.map((f: string) => (
                                                            <Badge key={f} variant="outline" className="text-[8px] font-bold text-slate-400 border-slate-100 rounded-md">
                                                                {f}
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] italic text-slate-400">No distinct UI fields</span>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </div>

                                    {/* Action items */}
                                    <div className="pt-2">
                                        <div className="flex items-center gap-2 text-amber-600 mb-4">
                                            <Zap className="h-4 w-4" />
                                            <h4 className="text-[10px] font-black uppercase tracking-wider">Available Interactions</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {page.actions && page.actions.length > 0 ? (
                                                page.actions.map((a: string) => (
                                                    <div key={a} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 group/action hover:bg-amber-50 hover:border-amber-100 transition-all duration-300">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover/action:bg-amber-400 transition-colors" />
                                                        <span className="text-[10px] font-black text-slate-600 group-hover/action:text-amber-700">{a}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-[10px] italic text-slate-400">Standard view-only module</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* Guides Grid */}
                <section className="space-y-10 pt-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-1.5 bg-amber-500 rounded-full" />
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">📘 Operational User Guides</h2>
                        </div>
                        <Badge variant="outline" className="rounded-full border-amber-100 bg-amber-50 text-amber-700 font-bold px-4">Documentation Engine v1.1</Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {filteredGuides.map((guide, idx) => (
                            <div key={idx} className="relative group overflow-hidden p-6 rounded-[1.8rem] bg-white border border-slate-100 hover:border-amber-200 transition-all duration-500 cursor-pointer hover:shadow-xl hover:-translate-y-1">
                                <div className="absolute -top-4 -right-4 h-16 w-16 bg-amber-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                <div className="relative z-10 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="p-3 bg-amber-50 rounded-2xl group-hover:bg-amber-100 transition-colors">
                                            <Sparkles className="h-5 w-5 text-amber-600" />
                                        </div>
                                        <ExternalLink className="h-4 w-4 text-slate-200 group-hover:text-amber-400 transition-colors" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">User Guide</p>
                                        <h4 className="text-sm font-black text-slate-800 group-hover:text-amber-700 transition-colors line-clamp-1">{guide.name}</h4>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Modern Footer Section */}
                <footer className="pt-20 pb-12">
                    <div className="flex flex-col items-center justify-center space-y-8">
                        <div className="flex items-center gap-4">
                            <Separator className="w-16 md:w-32 bg-slate-200" />
                            <div className="p-4 bg-white rounded-full shadow-lg border border-slate-100">
                                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                            </div>
                            <Separator className="w-16 md:w-32 bg-slate-200" />
                        </div>
                        
                        <div className="text-center space-y-2">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em]">Institutional Intelligence Ledger</p>
                            <p className="text-xs font-bold text-slate-300 tracking-wide">BaitulMal 2026v1 Infrastructure • Secure Operational Environment</p>
                        </div>
                        
                        <div className="flex items-center gap-6">
                            <Badge variant="outline" className="border-none shadow-none bg-transparent text-[9px] font-black text-slate-400 hover:text-emerald-600 transition-colors">v{versionData.version}</Badge>
                            <span className="text-slate-200">|</span>
                            <Badge variant="outline" className="border-none shadow-none bg-transparent text-[9px] font-black text-slate-400 hover:text-emerald-600 transition-colors">Audit Trail Verified</Badge>
                            <span className="text-slate-200">|</span>
                            <Badge variant="outline" className="border-none shadow-none bg-transparent text-[9px] font-black text-slate-400 hover:text-emerald-600 transition-colors">Encryption Level 4</Badge>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
