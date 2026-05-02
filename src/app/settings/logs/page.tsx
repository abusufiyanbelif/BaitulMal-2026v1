'use client';

import React, { useState, useEffect } from 'react';
import { 
    Terminal, 
    FileText, 
    Trash2, 
    RefreshCw, 
    AlertCircle, 
    ShieldCheck, 
    Database, 
    ChevronRight,
    Clock,
    Download,
    Eye,
    BookOpen,
    History,
    Archive,
    Folder,
    Activity,
    Cpu,
    Zap,
    Server
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useLogger } from '@/hooks/use-logger';
import { useSession } from '@/hooks/use-session';

const CATEGORIES = [
    { id: 'logs', name: 'System Logs', icon: Terminal },
    { id: 'docs', name: 'Institutional Docs', icon: BookOpen },
    { id: 'health', name: 'System Health', icon: Activity }
];

const DIRECTORIES = {
    logs: [
        { id: 'runtime', name: 'Runtime Trace', icon: Clock },
        { id: 'build', name: 'Build Archive', icon: Archive }
    ],
    docs: [
        { id: 'releases', name: 'Releases', icon: FileText },
        { id: 'history', name: 'History', icon: History },
        { id: 'architecture', name: 'Architecture', icon: Database }
    ]
} as any;

export default function LogManagementPage() {
    const { userProfile } = useSession();
    const [activeCategory, setActiveCategory] = useState('logs');
    const [activeSubDir, setActiveSubDir] = useState('runtime');
    const [logs, setLogs] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [healthData, setHealthData] = useState<any>(null);
    const { info } = useLogger();

    const fetchHealth = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/health');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setHealthData(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFiles = async (category: string, dir: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/logs?category=${category}&dir=${dir}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setLogs(data.files || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const viewFile = async (fileName: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin/logs?category=${activeCategory}&dir=${activeSubDir}&file=${fileName}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setFileContent(data.content);
            setSelectedFile(fileName);
            info(`Viewed ${activeCategory} file: ${fileName}`, { dir: activeSubDir });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteFile = async (fileName: string) => {
        if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;
        try {
            const res = await fetch(`/api/admin/logs?category=${activeCategory}&dir=${activeSubDir}&file=${fileName}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            fetchFiles(activeCategory, activeSubDir);
            if (selectedFile === fileName) {
                setSelectedFile(null);
                setFileContent(null);
            }
            info(`Deleted ${activeCategory} file: ${fileName}`, { dir: activeSubDir });
        } catch (err: any) {
            setError(err.message);
        }
    };

    useEffect(() => {
        if (userProfile?.role === 'Admin') {
            if (activeCategory === 'health') {
                fetchHealth();
            } else {
                fetchFiles(activeCategory, activeSubDir);
            }
        }
    }, [activeCategory, activeSubDir, userProfile]);

    const handleCategoryChange = (cat: string) => {
        setActiveCategory(cat);
        if (cat !== 'health') {
            setActiveSubDir(DIRECTORIES[cat][0].id);
        }
        setSelectedFile(null);
        setFileContent(null);
    };

    if (userProfile?.role !== 'Admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
                <AlertCircle className="h-16 w-16 text-destructive mb-4" />
                <h1 className="text-2xl font-black text-primary">Access Denied</h1>
                <p className="text-slate-500 font-bold">Diagnostics are restricted to Full Administrators only.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Terminal className="h-6 w-6 text-emerald-600" />
                        <h1 className="text-3xl font-black text-primary tracking-tight">Institutional Diagnostics</h1>
                    </div>
                    <p className="text-slate-500 font-bold">Audit system logs and manage generated documentation.</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">Full Admin Authority</span>
                </div>
            </div>

            <Separator className="bg-slate-200" />

            {/* Main Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar: Categories & Directories */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Category Selection */}
                    <div className="grid grid-cols-3 gap-2">
                        {CATEGORIES.map(cat => (
                            <Button 
                                key={cat.id}
                                variant={activeCategory === cat.id ? 'default' : 'outline'}
                                onClick={() => handleCategoryChange(cat.id)}
                                className={`h-12 font-black text-[10px] uppercase tracking-widest gap-2 ${activeCategory === cat.id ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'}`}
                            >
                                <cat.icon className="h-4 w-4" />
                                {cat.name}
                            </Button>
                        ))}
                    </div>

                    {/* Sub-Directory Selection */}
                    <Card className="border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-slate-50 py-3 px-4 border-b">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Repositories</CardTitle>
                        </CardHeader>
                        <div className="p-1 space-y-0.5">
                            {DIRECTORIES[activeCategory].map((dir: any) => (
                                <div 
                                    key={dir.id}
                                    onClick={() => { setActiveSubDir(dir.id); setSelectedFile(null); setFileContent(null); }}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${activeSubDir === dir.id ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <dir.icon className={`h-4 w-4 ${activeSubDir === dir.id ? 'text-emerald-600' : 'text-slate-400'}`} />
                                    <span className="text-xs font-black tracking-tight">{dir.name}</span>
                                    {activeSubDir === dir.id && <ChevronRight className="h-4 w-4 ml-auto opacity-50" />}
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* File List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-primary uppercase tracking-widest">Available Files</h3>
                            <Button variant="ghost" size="sm" onClick={() => fetchFiles(activeCategory, activeSubDir)} className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>

                        <Card className="border-slate-200 shadow-sm overflow-hidden">
                            <ScrollArea className="h-[400px]">
                                <div className="p-2 space-y-1">
                                    {logs.length === 0 ? (
                                        <div className="p-8 text-center space-y-2">
                                            <Folder className="h-8 w-8 text-slate-200 mx-auto" />
                                            <p className="text-xs font-bold text-slate-400">No files found here.</p>
                                        </div>
                                    ) : (
                                        logs.map(file => (
                                            <div 
                                                key={file.name}
                                                onClick={() => viewFile(file.name)}
                                                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${selectedFile === file.name ? 'bg-emerald-50 border-emerald-100' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <FileText className={`h-5 w-5 shrink-0 ${selectedFile === file.name ? 'text-emerald-600' : 'text-slate-400'}`} />
                                                    <div className="space-y-0.5 overflow-hidden">
                                                        <p className={`text-[11px] font-black leading-none truncate ${selectedFile === file.name ? 'text-emerald-700' : 'text-slate-700'}`}>{file.name}</p>
                                                        <p className="text-[9px] font-bold text-slate-400">{(file.size / 1024).toFixed(1)} KB • {new Date(file.mtime).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={(e) => { e.stopPropagation(); deleteFile(file.name); }}
                                                    className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0 text-slate-300 hover:text-destructive hover:bg-destructive/5"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </Card>
                    </div>
                </div>

                {/* Main Content: File Viewer or Health View */}
                <div className="lg:col-span-8 space-y-6">
                    {activeCategory === 'health' ? (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="border-slate-200 shadow-sm overflow-hidden">
                                    <CardHeader className="bg-slate-50 py-4 flex flex-row items-center justify-between">
                                        <CardTitle className="text-sm font-black text-primary tracking-tight uppercase">Infrastructure Status</CardTitle>
                                        <Server className="h-4 w-4 text-emerald-600" />
                                    </CardHeader>
                                    <CardContent className="pt-6 space-y-4">
                                        {healthData?.services.map((service: any) => (
                                            <div key={service.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-2 w-2 rounded-full ${service.status === 'Online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                                    <div>
                                                        <p className="text-xs font-black text-primary">{service.name}</p>
                                                        <p className="text-[10px] font-bold text-slate-400">{service.message}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className={`text-[9px] font-black uppercase ${service.status === 'Online' ? 'text-green-600 border-green-100 bg-green-50' : 'text-red-600 border-red-100 bg-red-50'}`}>
                                                    {service.status}
                                                </Badge>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-200 shadow-sm overflow-hidden">
                                    <CardHeader className="bg-slate-50 py-4 flex flex-row items-center justify-between">
                                        <CardTitle className="text-sm font-black text-primary tracking-tight uppercase">Resource Utilization</CardTitle>
                                        <Cpu className="h-4 w-4 text-emerald-600" />
                                    </CardHeader>
                                    <CardContent className="pt-6 space-y-6">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Memory Usage</p>
                                                <p className="text-xs font-black text-primary">{healthData ? (healthData.system.memory.rss / (1024 * 1024)).toFixed(1) : 0} MB</p>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-emerald-500 transition-all duration-1000" 
                                                    style={{ width: `${Math.min(100, (healthData?.system.memory.rss / healthData?.system.totalMem) * 10000)}%` }} 
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">System Uptime</p>
                                                <p className="text-sm font-black text-primary">
                                                    {healthData ? Math.floor(healthData.system.uptime / 3600) : 0}h {healthData ? Math.floor((healthData.system.uptime % 3600) / 60) : 0}m
                                                </p>
                                            </div>
                                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CPU Load (1m)</p>
                                                <p className="text-sm font-black text-primary">{healthData?.system.loadAvg[0].toFixed(2) || '0.00'}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="border-slate-200 shadow-sm overflow-hidden">
                                <CardHeader className="bg-slate-50 py-4">
                                    <CardTitle className="text-sm font-black text-primary tracking-tight uppercase">Environmental Parameters</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 border-t">
                                        <div className="p-6">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Node Version</p>
                                            <p className="text-lg font-black text-primary">{healthData?.system.nodeVersion}</p>
                                        </div>
                                        <div className="p-6">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Platform</p>
                                            <p className="text-lg font-black text-primary capitalize">{healthData?.system.platform}</p>
                                        </div>
                                        <div className="p-6">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Database Latency</p>
                                            <p className="text-lg font-black text-emerald-600">{healthData?.database.latency}ms</p>
                                        </div>
                                        <div className="p-6">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Heartbeat</p>
                                            <div className="flex items-center gap-2">
                                                <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500 animate-pulse" />
                                                <p className="text-lg font-black text-primary">Active</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : selectedFile ? (
                        <Card className="border-slate-200 shadow-xl overflow-hidden bg-[#0a0a0a] ring-1 ring-white/10">
                            <CardHeader className="bg-white border-b flex flex-row items-center justify-between px-6 py-4">
                                <div className="space-y-0.5 overflow-hidden">
                                    <CardTitle className="text-sm font-black text-primary tracking-tight truncate">{selectedFile}</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-emerald-600 border-emerald-100 bg-emerald-50/50">{activeCategory} / {activeSubDir}</Badge>
                                        <span className="text-[10px] font-bold text-slate-400">Diagnostic Preview</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button variant="outline" size="sm" className="h-9 font-bold text-xs" onClick={() => window.print()}>
                                        <Download className="h-4 w-4 mr-2" /> Export
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-9 font-bold text-xs" onClick={() => { setSelectedFile(null); setFileContent(null); }}>
                                        Close
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[700px] w-full">
                                    <pre className="p-6 text-xs font-mono text-emerald-500/90 leading-relaxed selection:bg-emerald-500/20 whitespace-pre-wrap">
                                        {fileContent}
                                    </pre>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full min-h-[500px] space-y-6 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-emerald-400/20 blur-xl rounded-full" />
                                <Database className="relative h-16 w-16 text-emerald-600" />
                            </div>
                            <div className="text-center space-y-2 max-w-sm">
                                <h3 className="text-xl font-black text-primary tracking-tight">Institutional Repository</h3>
                                <p className="text-sm font-bold text-slate-500">Select a system log or documentation file to inspect the technical truth of the application.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
