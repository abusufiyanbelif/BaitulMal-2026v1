'use client';

import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Globe, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getUserSessionsAction } from '@/app/settings/auth-actions';

interface Session {
    id: string;
    userAgent: string;
    ip: string;
    loginAt: number;
    status: 'Active' | 'Revoked';
}

interface SessionTableProps {
    userId: string;
    refreshKey: number;
}

export function SessionTable({ userId, refreshKey }: SessionTableProps) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(0);
    const sessionsPerPage = 3;

    useEffect(() => {
        async function fetchSessions() {
            setIsLoading(true);
            const res = await getUserSessionsAction(userId);
            if (res.success) {
                setSessions(res.sessions as Session[]);
            }
            setIsLoading(false);
        }
        if (userId) fetchSessions();
    }, [userId, refreshKey]);

    const getDeviceIcon = (userAgent: string) => {
        const ua = userAgent.toLowerCase();
        if (ua.includes('mobi') || ua.includes('android') || ua.includes('iphone')) return <Smartphone className="h-4 w-4" />;
        if (ua.includes('win') || ua.includes('mac') || ua.includes('linux')) return <Monitor className="h-4 w-4" />;
        return <Globe className="h-4 w-4" />;
    };

    const getDeviceName = (userAgent: string) => {
        if (userAgent.includes('Windows')) return 'Windows PC';
        if (userAgent.includes('Macintosh')) return 'macOS Device';
        if (userAgent.includes('iPhone')) return 'iPhone';
        if (userAgent.includes('Android')) return 'Android Device';
        return 'Web Browser';
    };

    const totalPages = Math.ceil(sessions.length / sessionsPerPage);
    const currentSessions = sessions.slice(page * sessionsPerPage, (page + 1) * sessionsPerPage);

    if (isLoading) {
        return <div className="flex items-center justify-center p-8 text-xs font-bold text-white/40 animate-pulse">Loading Session History...</div>;
    }

    if (sessions.length === 0) {
        return <div className="p-8 text-center text-xs font-bold text-white/20">No session history available.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-white/10">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 px-4">Device</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 px-4">Location/IP</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 px-4">Last Active</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-white/40 h-10 px-4 text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentSessions.map((session) => (
                            <TableRow key={session.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                                <TableCell className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60">
                                            {getDeviceIcon(session.userAgent)}
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-bold text-white">{getDeviceName(session.userAgent)}</p>
                                            <p className="text-[9px] text-white/40 font-mono truncate max-w-[120px]">{session.userAgent}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5 text-white/60">
                                            <MapPin className="h-3 w-3" />
                                            <span className="text-[10px] font-bold">{session.ip}</span>
                                        </div>
                                        <p className="text-[9px] text-white/30">Verified Access</p>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                    <div className="flex items-center gap-1.5 text-white/60">
                                        <Clock className="h-3 w-3" />
                                        <span className="text-[10px] font-bold">{new Date(session.loginAt).toLocaleString()}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-right">
                                    <Badge 
                                        className={session.status === 'Active' 
                                            ? "bg-green-500/20 text-green-400 border-green-500/20" 
                                            : "bg-white/5 text-white/40 border-white/10"}
                                    >
                                        {session.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        Page {page + 1} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg border-white/10 bg-transparent text-white/60 hover:bg-white/5"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg border-white/10 bg-transparent text-white/60 hover:bg-white/5"
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page === totalPages - 1}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
