'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Loader2, 
    MessageSquare, 
    Smartphone, 
    AlertCircle, 
    CheckCircle2, 
    XCircle,
    Clock,
    User,
    ChevronRight,
    Send,
    BarChart3,
    Search,
    Filter,
    Trash2,
    Eraser,
    CheckSquare,
    Square,
    RefreshCcw
} from 'lucide-react';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu';
import { BrandedLoader } from '@/components/branded-loader';
import type { MessageLog } from '@/lib/types';
import { cn, getNestedValue } from '@/lib/utils';
import { format } from 'date-fns';
import { deleteMessageLogsAction, clearAllMessageLogsAction, retryMessageAction } from './actions';

export default function MessageModulePage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const firestore = useFirestore();
    const { toast } = useToast();

    // State for filtering and selection
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Sent' | 'Failed'>('All');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [retryingId, setRetryingId] = useState<string | null>(null);

    const logsRef = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'message_logs'), orderBy('timestamp', 'desc'), limit(100)) : null, 
    [firestore]);

    const { data: rawLogs, isLoading: isLogsLoading } = useCollection<MessageLog>(logsRef);

    const canReadMessages = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.messages.read', false);
    const canManageMessages = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.messages.update', false);

    // Clientside filtering
    const filteredLogs = useMemo(() => {
        if (!rawLogs) return [];
        return rawLogs.filter(log => {
            const matchesSearch = 
                log.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.metadata?.moduleId?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesStatus = statusFilter === 'All' || log.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
    }, [rawLogs, searchTerm, statusFilter]);

    const stats = useMemo(() => ({
        total: rawLogs?.length || 0,
        sent: rawLogs?.filter(l => l.status === 'Sent').length || 0,
        failed: rawLogs?.filter(l => l.status === 'Failed').length || 0,
    }), [rawLogs]);

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredLogs.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredLogs.map(l => l.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0 || !confirm(`Are you sure you want to delete ${selectedIds.length} message logs?`)) return;
        setIsDeleting(true);
        try {
            const res = await deleteMessageLogsAction(selectedIds);
            if (res.success) {
                toast({ title: "Logs Deleted", description: res.message, variant: "success" });
                setSelectedIds([]);
            } else {
                toast({ title: "Action Failed", description: res.message, variant: "destructive" });
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const handleClearAll = async () => {
        if (!confirm("CRITICAL ACTION: Are you sure you want to clear the message log database? This cannot be undone.")) return;
        setIsDeleting(true);
        try {
            const res = await clearAllMessageLogsAction();
            if (res.success) {
                toast({ title: "Database Cleaned", description: res.message, variant: "success" });
                setSelectedIds([]);
            } else {
                toast({ title: "Action Failed", description: res.message, variant: "destructive" });
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRetry = async (logId: string) => {
        setRetryingId(logId);
        try {
            const res = await retryMessageAction(logId);
            if (res.success) {
                toast({ title: "Message Retried", description: "The notification has been re-dispatched.", variant: "success" });
            } else {
                toast({ title: "Retry Failed", description: res.message, variant: "destructive" });
            }
        } finally {
            setRetryingId(null);
        }
    };

    if (isSessionLoading || isLogsLoading) {
        return <BrandedLoader message="Syncing Message Stream..." />;
    }

    if (!canReadMessages) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-bold text-primary">Access Restricted</h3>
                <p className="text-sm text-muted-foreground">You do not have administrative clearance to view the Messaging Stream.</p>
                <Button variant="outline" className="mt-6" asChild>
                    <a href="/dashboard">Return to Dashboard</a>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-primary font-normal pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-primary">Messaging Dashboard</h2>
                    <p className="text-sm text-muted-foreground font-normal">Real-time monitoring of all system-generated notifications and alerts.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="font-bold border-primary/10 shadow-sm transition-transform active:scale-95" asChild>
                        <a href="/settings/resources">API Resources</a>
                    </Button>
                    <Button variant="outline" className="font-bold border-primary/10 shadow-sm transition-transform active:scale-95" asChild>
                        <a href="/messages/templateconfig">Message Templates</a>
                    </Button>
                    {canManageMessages && (
                        <Button 
                            variant="destructive" 
                            onClick={handleClearAll} 
                            disabled={isDeleting || stats.total === 0}
                            className="font-bold shadow-md transition-transform active:scale-95"
                        >
                            <Eraser className="mr-2 h-4 w-4" /> 
                            Clear All
                        </Button>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up">
                <Card className="border-primary/10 shadow-sm bg-white overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Send className="h-12 w-12" />
                    </div>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total Dispatched</CardDescription>
                        <CardTitle className="text-3xl font-bold text-primary">{stats.total}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <p className="text-[10px] text-muted-foreground italic">Current dataset size</p>
                    </CardContent>
                </Card>
                <Card className="border-primary/10 shadow-sm bg-white overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                    </div>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60 text-green-600/60">Success Rate</CardDescription>
                        <CardTitle className="text-3xl font-bold text-green-600">
                            {stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0}%
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <p className="text-[10px] text-muted-foreground italic">{stats.sent} successful deliveries</p>
                    </CardContent>
                </Card>
                <Card className="border-primary/10 shadow-sm bg-white overflow-hidden relative group border-red-100">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                        <AlertCircle className="h-12 w-12 text-red-500" />
                    </div>
                    <CardHeader className="p-4 pb-2">
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60 text-red-600/60">Dispatch Failures</CardDescription>
                        <CardTitle className="text-3xl font-bold text-red-600">{stats.failed}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <p className="text-[10px] text-muted-foreground italic">Requires review</p>
                    </CardContent>
                </Card>
            </div>

            {/* Toolbar */}
            <Card className="border-primary/10 shadow-sm bg-white p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search recipient, content, or module..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-10 border-primary/10 font-normal focus:shadow-md transition-all"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-10 font-bold border-primary/10 flex-1 md:flex-none">
                                    <Filter className="mr-2 h-4 w-4" /> 
                                    {statusFilter === 'All' ? 'All Status' : statusFilter}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-xl">
                                <DropdownMenuLabel className="text-[10px] uppercase opacity-40 font-bold">Filter By Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem checked={statusFilter === 'All'} onCheckedChange={() => setStatusFilter('All')}>All Activity</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={statusFilter === 'Sent'} onCheckedChange={() => setStatusFilter('Sent')}>Success Only</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={statusFilter === 'Failed'} onCheckedChange={() => setStatusFilter('Failed')}>Failures Only</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {selectedIds.length > 0 && canManageMessages && (
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={handleDeleteSelected}
                                disabled={isDeleting}
                                className="h-10 font-bold animate-fade-in flex-1 md:flex-none"
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> 
                                Delete ({selectedIds.length})
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {/* Logs List */}
            <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-primary/5 border-b p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Checkbox 
                                checked={selectedIds.length === filteredLogs.length && filteredLogs.length > 0} 
                                onCheckedChange={toggleSelectAll}
                                className="border-primary/20 data-[state=checked]:bg-primary"
                            />
                            <div className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-primary/60" />
                                <CardTitle className="text-sm font-bold">Recent Message Activity</CardTitle>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono bg-white">LIVE FEED</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[550px]">
                        <div className="divide-y divide-primary/5">
                            {filteredLogs.map(log => (
                                <div key={log.id} className={cn(
                                    "p-4 transition-colors group relative",
                                    selectedIds.includes(log.id) ? "bg-primary/[0.03]" : "hover:bg-primary/[0.01]"
                                )}>
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1">
                                            <Checkbox 
                                                checked={selectedIds.includes(log.id)} 
                                                onCheckedChange={() => toggleSelectOne(log.id)}
                                                className="border-primary/20 data-[state=checked]:bg-primary"
                                            />
                                        </div>
                                        <div className={cn(
                                            "mt-1 p-2 rounded-lg shrink-0",
                                            log.status === 'Sent' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                                        )}>
                                            {log.status === 'Sent' ? <Smartphone className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-primary">{log.recipient}</span>
                                                    <Badge variant="outline" className="text-[9px] font-normal opacity-60">{log.type}</Badge>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {log.timestamp ? format((log.timestamp as any).toDate(), 'HH:mm • MMM d') : '...'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-primary/80 line-clamp-2 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                                            
                                            {log.status === 'Failed' && (
                                                <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                                                    <div className="flex items-center gap-2 text-red-600 text-[10px] font-bold">
                                                        <XCircle className="h-3 w-3" />
                                                        {log.error || 'Unknown gateway failure'}
                                                    </div>
                                                    {canManageMessages && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleRetry(log.id)}
                                                            disabled={retryingId === log.id}
                                                            className="h-7 text-[9px] font-bold border-red-200 text-red-600 hover:bg-red-100 transition-colors shadow-none"
                                                        >
                                                            {retryingId === log.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCcw className="h-3 w-3 mr-1" />}
                                                            Retry Message
                                                        </Button>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-primary/5">
                                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/5 rounded-md text-[9px] text-primary/60 font-bold uppercase tracking-tight">
                                                    <Badge variant="outline" className="h-3.5 border-none p-0 text-[9px]">{log.metadata?.moduleId || 'SYSTEM'}</Badge>
                                                </div>
                                                {log.metadata?.recordId && (
                                                    <span className="text-[9px] font-mono text-muted-foreground">REF: {log.metadata.recordId}</span>
                                                )}
                                                {log.metadata?.templateId && (
                                                    <span className="text-[9px] font-mono text-muted-foreground">TP: {log.metadata.templateId}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredLogs.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <MessageSquare className="h-12 w-12 text-primary/5 mb-2" />
                                    <p className="text-xs text-muted-foreground italic">
                                        {searchTerm || statusFilter !== 'All' ? 'No matches found for current filters.' : 'No message history available.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
