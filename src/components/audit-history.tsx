'use client';
 
import React from 'react';
import { useCollection, collection, query, where, orderBy, useFirestore, type DocumentData } from '@/firebase';
import type { AuditLog } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, User, ChevronRight, History, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
 
interface AuditHistoryProps {
  targetId: string;
  module?: AuditLog['module'];
  title?: string;
}
 
export function AuditHistory({ targetId, module, title = "Organization Audit Trail" }: AuditHistoryProps) {
    const firestore = useFirestore();
    const auditQuery = React.useMemo(() => {
        if (!firestore) return null;
        const base = query(
            collection(firestore, 'audit_logs'),
            where('targetId', '==', targetId),
            orderBy('timestamp', 'desc')
        );
        return base;
    }, [firestore, targetId]);
 
    const { data: logs, isLoading } = useCollection<AuditLog>(auditQuery);
 
    const getActionColor = (action: AuditLog['action']) => {
        switch (action) {
            case 'APPROVE': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'REJECT': return 'bg-destructive/10 text-destructive border-destructive/20';
            case 'CREATE': return 'bg-primary/10 text-primary border-primary/20';
            case 'DELETE': return 'bg-destructive/10 text-destructive border-destructive/20';
            case 'UPDATE': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
            case 'LINK':
            case 'MAP': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
            case 'UNLINK':
            case 'UNMAP': return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
            default: return 'bg-muted text-muted-foreground';
        }
    };
 
    if (isLoading) {
        return (
            <Card className="border-primary/10 shadow-sm bg-white">
                <CardHeader className="bg-primary/5 border-b py-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2"><History className="h-4 w-4 opacity-40"/> {title}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </CardContent>
            </Card>
        );
    }
 
    return (
        <Card className="border-primary/10 shadow-sm bg-white overflow-hidden transition-all duration-300 hover:shadow-md">
            <CardHeader className="bg-primary/5 border-b py-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2 tracking-tight capitalize">
                    <History className={cn("h-4 w-4", logs && logs.length > 0 ? "text-primary" : "opacity-40")}/> 
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="max-h-[400px]">
                    {logs && logs.length > 0 ? (
                        <div className="divide-y divide-primary/5">
                            {logs.map((log) => (
                                <div key={log.id} className="p-4 space-y-2 transition-colors hover:bg-primary/[0.02]">
                                    <div className="flex items-center justify-between gap-2">
                                        <Badge variant="outline" className={cn("text-[9px] font-bold tracking-tighter", getActionColor(log.action))}>
                                            {log.action}
                                        </Badge>
                                        <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-mono">
                                            <Clock className="h-3 w-3" />
                                            {log.timestamp ? ( (log.timestamp as any).toDate?.().toLocaleString() || new Date(log.timestamp as any).toLocaleString() ) : 'Pending...'}
                                        </div>
                                    </div>
                                    
                                    <p className="text-xs font-bold text-primary leading-snug">
                                        {log.description}
                                    </p>
                                    
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                                        <div className="flex items-center gap-1 font-bold">
                                            <User className="h-3 w-3" />
                                            {log.performedBy.name}
                                        </div>
                                        {log.changes && log.changes.length > 0 && (
                                            <div className="text-primary/60 font-bold tracking-tight">
                                                {log.changes.length} fields modified
                                            </div>
                                        )}
                                    </div>
                                    
                                    {log.changes && log.changes.length > 0 && (
                                        <div className="mt-2 pl-2 border-l-2 border-primary/10 space-y-1">
                                            {log.changes.map((c, i) => (
                                                <div key={i} className="text-[10px] flex items-center gap-1 flex-wrap">
                                                    <span className="font-bold text-muted-foreground opacity-60 uppercase tracking-tighter">{c.field}:</span>
                                                    <span className="line-through text-destructive/60">{JSON.stringify(c.old)}</span>
                                                    <ChevronRight className="h-2.5 w-2.5 opacity-40" />
                                                    <span className="text-primary font-bold">{JSON.stringify(c.new)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center space-y-2 opacity-40">
                            <Activity className="h-8 w-8 mx-auto" />
                            <p className="text-xs font-bold tracking-tight capitalize">No administrative history found for this record.</p>
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
