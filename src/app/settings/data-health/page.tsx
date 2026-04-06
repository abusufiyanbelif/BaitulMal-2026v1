'use client';

import { useState, useCallback } from 'react';
import { useSession } from '@/hooks/use-session';
import { BrandedLoader } from '@/components/branded-loader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { scanDataHealthAction, fixDataIssuesAction, recalculateAllCollectedAmountsAction } from './actions';
import type { DataIssue, ScanResult } from './actions';
import { cn } from '@/lib/utils';
import {
    AlertTriangle,
    CheckCircle2,
    Info,
    Loader2,
    RefreshCw,
    ShieldAlert,
    Wrench,
    Database,
    ChevronDown,
    ChevronRight,
    Calculator,
    Filter,
    Search,
    X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SEVERITY_CONFIG = {
    critical: { label: 'Critical', color: 'bg-red-100 text-red-800 border-red-200', icon: ShieldAlert, barColor: 'bg-red-500', textColor: 'text-red-700' },
    warning: { label: 'Warning', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertTriangle, barColor: 'bg-amber-500', textColor: 'text-amber-700' },
    info: { label: 'Info', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Info, barColor: 'bg-blue-500', textColor: 'text-blue-600' },
};

const ISSUE_TYPE_LABELS: Record<string, string> = {
    missing_field: 'Missing Field',
    wrong_value: 'Wrong Value',
    orphaned_link: 'Orphaned Link',
    stale_status: 'Stale Status',
    calculation_drift: 'Calculation Drift',
};

function IssueRow({
    issue,
    isSelected,
    onToggle,
}: {
    issue: DataIssue;
    isSelected: boolean;
    onToggle: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const cfg = SEVERITY_CONFIG[issue.severity];
    const Icon = cfg.icon;

    return (
        <div className={cn(
            'border rounded-xl overflow-hidden transition-all duration-200',
            isSelected ? 'border-primary/40 bg-primary/[0.02]' : 'border-primary/10 bg-white',
            'hover:border-primary/30'
        )}>
            <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                {issue.canAutoFix && (
                    <div onClick={e => { e.stopPropagation(); onToggle(issue.id); }}>
                        <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggle(issue.id)}
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>
                )}
                {!issue.canAutoFix && <div className="w-4 h-4 shrink-0" />}

                <div className={cn('p-1.5 rounded-lg', cfg.color.split(' ')[0])}>
                    <Icon className={cn('h-3.5 w-3.5', cfg.textColor)} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-primary truncate">{issue.description}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge className={cn('font-bold text-[9px] h-4 border', cfg.color)}>{cfg.label}</Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">{issue.collection}/{issue.docId.slice(-8)}</span>
                        <span className="text-[10px] text-primary/50">·</span>
                        <span className="text-[10px] font-bold text-primary/60">{issue.field}</span>
                        <span className="text-[10px] text-primary/50">·</span>
                        <span className="text-[10px] text-muted-foreground">{ISSUE_TYPE_LABELS[issue.issueType]}</span>
                        {!issue.canAutoFix && (
                            <Badge variant="outline" className="text-[9px] font-bold border-orange-200 text-orange-600 h-4">Manual Review</Badge>
                        )}
                    </div>
                </div>

                <div className="shrink-0 text-primary/40">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
            </div>

            {expanded && (
                <div className="border-t border-primary/5 p-4 bg-primary/[0.01] grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-150">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current Value</p>
                        <pre className="text-[11px] font-mono bg-red-50 border border-red-100 p-2 rounded-lg whitespace-pre-wrap overflow-auto max-h-28 text-red-700">
                            {JSON.stringify(issue.currentValue, null, 2) ?? 'undefined'}
                        </pre>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Suggested Fix</p>
                        <pre className="text-[11px] font-mono bg-green-50 border border-green-100 p-2 rounded-lg whitespace-pre-wrap overflow-auto max-h-28 text-green-700">
                            {JSON.stringify(issue.suggestedValue, null, 2)}
                        </pre>
                    </div>
                    <div className="sm:col-span-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Target Document</p>
                        <p className="text-[11px] font-mono text-primary/70 bg-primary/5 rounded-lg px-3 py-1.5 border border-primary/10">
                            <span className="font-bold">{issue.collection}</span>/<span className="opacity-70">{issue.docId}</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DataHealthPage() {
    const { userProfile, isLoading: sessionLoading } = useSession();
    const { toast } = useToast();

    const [isScanning, setIsScanning] = useState(false);
    const [isFixing, setIsFixing] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [filterSeverity, setFilterSeverity] = useState<string>('all');
    const [filterModule, setFilterModule] = useState<string>('all');
    const [filterAutofix, setFilterAutofix] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const handleScan = useCallback(async () => {
        setIsScanning(true);
        setSelectedIds([]);
        setScanResult(null);
        try {
            const result = await scanDataHealthAction();
            setScanResult(result);
            if (result.success) {
                toast({
                    title: 'Scan Complete',
                    description: result.message,
                    variant: result.issues.length > 0 ? 'default' : 'success'
                });
            } else {
                toast({ title: 'Scan Failed', description: result.message, variant: 'destructive' });
            }
        } finally {
            setIsScanning(false);
        }
    }, [toast]);

    const handleFixSelected = async () => {
        if (!scanResult || selectedIds.length === 0) return;
        setIsFixing(true);
        try {
            const result = await fixDataIssuesAction(selectedIds, scanResult.issues);
            if (result.success) {
                toast({ title: 'Fix Applied', description: result.message, variant: 'success' });
                // Re-run scan to refresh
                await handleScan();
            } else {
                toast({ title: 'Fix Failed', description: result.message, variant: 'destructive' });
            }
        } finally {
            setIsFixing(false);
        }
    };

    const handleRecalculate = async () => {
        setIsRecalculating(true);
        try {
            const result = await recalculateAllCollectedAmountsAction();
            toast({ title: result.success ? 'Recalculation Complete' : 'Failed', description: result.message, variant: result.success ? 'success' : 'destructive' });
        } finally {
            setIsRecalculating(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const allIssues = scanResult?.issues || [];

    const modules = Array.from(new Set(allIssues.map(i => i.module))).sort();

    const filtered = allIssues.filter(issue => {
        if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
        if (filterModule !== 'all' && issue.module !== filterModule) return false;
        if (filterAutofix === 'auto' && !issue.canAutoFix) return false;
        if (filterAutofix === 'manual' && issue.canAutoFix) return false;
        if (searchTerm && !issue.description.toLowerCase().includes(searchTerm.toLowerCase()) && !issue.field.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const autoFixable = filtered.filter(i => i.canAutoFix);
    const allAutoFixableSelected = autoFixable.length > 0 && autoFixable.every(i => selectedIds.includes(i.id));

    const toggleSelectAllAutoFix = () => {
        if (allAutoFixableSelected) {
            setSelectedIds(prev => prev.filter(id => !autoFixable.map(i => i.id).includes(id)));
        } else {
            setSelectedIds(prev => Array.from(new Set([...prev, ...autoFixable.map(i => i.id)])));
        }
    };

    const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
    const warningCount = allIssues.filter(i => i.severity === 'warning').length;
    const infoCount = allIssues.filter(i => i.severity === 'info').length;

    if (sessionLoading) return <BrandedLoader />;
    if (userProfile?.role !== 'Admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
                <ShieldAlert className="h-12 w-12 text-destructive/50" />
                <h2 className="text-xl font-bold text-primary">Admin Access Required</h2>
                <p className="text-sm text-muted-foreground">Only Administrators can access the Data Health console.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-primary font-normal">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Database className="h-6 w-6 text-primary" />
                        Data Health Console
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Scan all Firestore collections for integrity issues and apply safe fixes.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        onClick={handleRecalculate}
                        disabled={isRecalculating || isScanning}
                        className="font-bold border-primary/20 text-primary active:scale-95 transition-transform"
                    >
                        {isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                        Recalculate Totals
                    </Button>
                    <Button
                        onClick={handleScan}
                        disabled={isScanning || isFixing}
                        className="font-bold shadow-md active:scale-95 transition-transform"
                    >
                        {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        {isScanning ? 'Scanning...' : 'Run Health Scan'}
                    </Button>
                </div>
            </div>

            {/* Pre-scan CTA */}
            {!scanResult && !isScanning && (
                <Card className="border-dashed border-primary/20 bg-primary/[0.01]">
                    <CardContent className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                        <div className="p-4 rounded-full bg-primary/10 text-primary">
                            <Database className="h-10 w-10" />
                        </div>
                        <h3 className="text-xl font-bold tracking-tight">Run a Health Scan</h3>
                        <p className="text-sm text-muted-foreground max-w-md font-normal">
                            Scan all collections (Donations, Campaigns, Leads, Beneficiaries, Donors, Settings)
                            to detect missing fields, wrong defaults, and stale data.
                        </p>
                        <Button onClick={handleScan} className="font-bold shadow-md px-8 mt-2 bg-primary text-white">
                            <RefreshCw className="mr-2 h-4 w-4" /> Run Health Scan
                        </Button>
                    </CardContent>
                </Card>
            )}

            {isScanning && (
                <Card className="border-primary/10 bg-white">
                    <CardContent className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <h3 className="text-lg font-bold">Scanning All Collections...</h3>
                        <p className="text-sm text-muted-foreground">This may take a few seconds depending on data size.</p>
                    </CardContent>
                </Card>
            )}

            {scanResult && !isScanning && (
                <>
                    {/* Scan Summary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in-up">
                        <Card className="bg-white border-primary/10 shadow-sm">
                            <CardContent className="p-4 text-center">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Issues</p>
                                <p className="text-3xl font-black text-primary mt-1">{allIssues.length}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-white border-red-100 shadow-sm">
                            <CardContent className="p-4 text-center">
                                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Critical</p>
                                <p className="text-3xl font-black text-red-600 mt-1">{criticalCount}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-white border-amber-100 shadow-sm">
                            <CardContent className="p-4 text-center">
                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Warnings</p>
                                <p className="text-3xl font-black text-amber-600 mt-1">{warningCount}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-white border-blue-100 shadow-sm">
                            <CardContent className="p-4 text-center">
                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Info</p>
                                <p className="text-3xl font-black text-blue-600 mt-1">{infoCount}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Scanned Record Counts */}
                    <Card className="border-primary/10 bg-white shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Database className="h-4 w-4 opacity-50" /> Records Scanned
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-3">
                                {Object.entries(scanResult.scannedCounts).map(([col, count]) => (
                                    <div key={col} className="flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10">
                                        <span className="text-xs font-bold text-primary capitalize">{col}</span>
                                        <Badge variant="secondary" className="font-mono text-[10px] font-bold h-4">{count}</Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {allIssues.length === 0 ? (
                        <Card className="border-green-200 bg-green-50">
                            <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                                <div className="p-4 rounded-full bg-green-100 text-green-600">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                                <h3 className="text-xl font-bold text-green-800">All Clear!</h3>
                                <p className="text-sm text-green-700 font-normal">No data integrity issues found across all collections.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-primary/10 bg-white shadow-sm">
                            <CardHeader className="border-b bg-primary/[0.02]">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <CardTitle className="text-base font-bold">
                                        Issues ({filtered.length}{filtered.length !== allIssues.length ? ` of ${allIssues.length}` : ''})
                                    </CardTitle>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        {selectedIds.length > 0 && (
                                            <Button
                                                size="sm"
                                                onClick={handleFixSelected}
                                                disabled={isFixing}
                                                className="font-bold h-8 text-xs bg-green-600 hover:bg-green-700 text-white shadow-md active:scale-95 transition-transform"
                                            >
                                                {isFixing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wrench className="mr-1 h-3 w-3" />}
                                                Fix {selectedIds.length} Selected
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={toggleSelectAllAutoFix}
                                            disabled={autoFixable.length === 0}
                                            className="font-bold h-8 text-xs border-primary/20 text-primary active:scale-95 transition-transform"
                                        >
                                            {allAutoFixableSelected ? <X className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                                            {allAutoFixableSelected ? 'Deselect All' : `Select All Auto-Fix (${autoFixable.length})`}
                                        </Button>
                                    </div>
                                </div>

                                {/* Filters */}
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                        <Input
                                            placeholder="Search issues..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="pl-7 h-8 text-xs font-normal border-primary/10 w-48"
                                        />
                                    </div>
                                    <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                                        <SelectTrigger className="h-8 text-xs font-bold border-primary/10 w-36">
                                            <Filter className="h-3 w-3 mr-1" />
                                            <SelectValue placeholder="Severity" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all" className="text-xs font-bold">All Severities</SelectItem>
                                            <SelectItem value="critical" className="text-xs font-bold text-red-600">Critical</SelectItem>
                                            <SelectItem value="warning" className="text-xs font-bold text-amber-600">Warning</SelectItem>
                                            <SelectItem value="info" className="text-xs font-bold text-blue-600">Info</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={filterModule} onValueChange={setFilterModule}>
                                        <SelectTrigger className="h-8 text-xs font-bold border-primary/10 w-44">
                                            <SelectValue placeholder="Module" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all" className="text-xs font-bold">All Modules</SelectItem>
                                            {modules.map(m => <SelectItem key={m} value={m} className="text-xs font-bold">{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select value={filterAutofix} onValueChange={setFilterAutofix}>
                                        <SelectTrigger className="h-8 text-xs font-bold border-primary/10 w-40">
                                            <SelectValue placeholder="Fix Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all" className="text-xs font-bold">All Types</SelectItem>
                                            <SelectItem value="auto" className="text-xs font-bold">Auto-Fixable</SelectItem>
                                            <SelectItem value="manual" className="text-xs font-bold">Manual Review</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>

                            <CardContent className="p-4">
                                <ScrollArea className="h-[560px] pr-2">
                                    <div className="space-y-2">
                                        {filtered.map(issue => (
                                            <IssueRow
                                                key={issue.id}
                                                issue={issue}
                                                isSelected={selectedIds.includes(issue.id)}
                                                onToggle={toggleSelect}
                                            />
                                        ))}
                                        {filtered.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                                <CheckCircle2 className="h-10 w-10 text-primary/20 mb-3" />
                                                <p className="text-sm font-bold text-primary/40">No issues match the current filters.</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
