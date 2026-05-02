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
    Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import registryData from '@/lib/registry-index.json';
import { cn } from '@/lib/utils';

// Purpose: Administrative Registry Index and Navigational Map

export default function RegistryIndexPage() {
    const [searchQuery, setSearchQuery] = useState('');
    
    const pages = registryData.pages || [];
    const docs = registryData.docs || { releases: [], userGuides: [], architecture: [] };

    const filteredPages = pages.filter(page => 
        page.route.toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredGuides = docs.userGuides.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredArch = docs.architecture.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-12 font-sans">
            <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 text-emerald-600">
                            <Compass className="h-6 w-6 animate-pulse" />
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Institutional Registry Index</h1>
                        </div>
                        <p className="text-slate-500 font-medium max-w-md">
                            Centralized documentation hub for BaitulMal 2026v1 infrastructure, architecture, and user guides.
                        </p>
                    </div>
                    
                    <div className="flex gap-3 w-full md:w-auto">
                        <Link href="/">
                            <Button variant="outline" className="rounded-xl border-slate-200 hover:bg-slate-50">
                                <Home className="h-4 w-4 mr-2" /> Home
                            </Button>
                        </Link>
                        <Button 
                            variant="default" 
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-100"
                            onClick={() => window.history.back()}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back
                        </Button>
                    </div>
                </div>

                {/* Search & Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-3 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input 
                            placeholder="Search pages, guides, or architecture..." 
                            className="pl-12 h-14 rounded-2xl border-none shadow-sm focus-visible:ring-emerald-500 transition-all text-lg"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                        <CardContent className="p-4 flex items-center justify-between h-full">
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Assets</p>
                                <p className="text-2xl font-black text-emerald-600">{pages.length + docs.userGuides.length + docs.architecture.length + docs.releases.length}</p>
                            </div>
                            <LayoutGrid className="h-8 w-8 text-emerald-100" />
                        </CardContent>
                    </Card>
                </div>

                {/* Architecture & Engineering Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-1.5 bg-sky-500 rounded-full" />
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">🏗️ Architecture & Engineering</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredArch.map((doc, idx) => (
                            <Card key={idx} className="rounded-2xl border-none shadow-sm bg-sky-50/30 hover:bg-sky-50 transition-colors border-l-4 border-sky-500">
                                <CardContent className="p-6 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-slate-800">{doc.name}</p>
                                        <p className="text-[9px] font-medium text-slate-400 uppercase">System Specification</p>
                                    </div>
                                    <Info className="h-5 w-5 text-sky-400" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <Separator className="bg-slate-100" />

                {/* Registry Grid Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-1.5 bg-emerald-500 rounded-full" />
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">📱 Application Modules</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPages.map((page) => (
                            <Card key={page.id} className="group rounded-3xl border-none shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-1 bg-white overflow-hidden">
                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="rounded-lg font-mono text-[9px] uppercase border-slate-100 bg-slate-50/50 text-slate-500">
                                            ID: {String(page.id).padStart(3, '0')}
                                        </Badge>
                                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Clock className="h-3 w-3 text-slate-300" />
                                            <span className="text-[8px] font-bold text-slate-400">{new Date(page.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <CardTitle className="text-lg font-black text-slate-800 break-all leading-tight group-hover:text-emerald-600 transition-colors">
                                        {page.route}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <p className="text-xs font-medium text-slate-500 line-clamp-2 min-h-[2.5rem]">
                                        {page.purpose}
                                    </p>
                                    
                                    <Separator className="bg-slate-100" />
                                    
                                    {/* Navigational Controls */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <Link href={page.route} className="flex-1">
                                                <Button className="w-full h-10 rounded-xl bg-slate-900 hover:bg-emerald-600 transition-all font-bold text-xs uppercase tracking-wider shadow-sm group-hover:shadow-emerald-100">
                                                    Go to Page <ChevronRight className="ml-2 h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {page.prev && (
                                                <Link href={page.prev} className="flex-1">
                                                    <Button variant="ghost" className="w-full h-8 rounded-lg text-[9px] font-black uppercase text-slate-400 hover:text-emerald-600 hover:bg-emerald-50">
                                                        <ArrowLeft className="mr-1.5 h-3 w-3" /> Prev
                                                    </Button>
                                                </Link>
                                            )}
                                            {page.next && (
                                                <Link href={page.next} className="flex-1">
                                                    <Button variant="ghost" className="w-full h-8 rounded-lg text-[9px] font-black uppercase text-slate-400 hover:text-emerald-600 hover:bg-emerald-50">
                                                        Next <ArrowRight className="ml-1.5 h-3 w-3" />
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <Separator className="bg-slate-100" />

                {/* User Guides Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-1.5 bg-amber-500 rounded-full" />
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">📘 User Documentation</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {filteredGuides.map((guide, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-white border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all group cursor-pointer">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-amber-600 uppercase">Guide</p>
                                        <p className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{guide.name}</p>
                                    </div>
                                    <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-amber-500" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer Disclaimer */}
                <div className="text-center py-12 space-y-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                        Institutional Registry System • {new Date().getFullYear()}
                    </p>
                    <div className="flex items-center justify-center gap-4 text-slate-300">
                        <Separator className="w-24 bg-slate-200" />
                        <Info className="h-4 w-4" />
                        <Separator className="w-24 bg-slate-200" />
                    </div>
                </div>
            </div>
        </div>
    );
}
