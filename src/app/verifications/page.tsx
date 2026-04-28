'use client';

import React, { useState } from 'react';
import { 
    useFirestore, 
    useCollection, 
    useMemoFirebase, 
    collection,
    query,
    orderBy,
    where
} from '@/firebase';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { BrandedLoader } from '@/components/branded-loader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    ShieldCheck, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    ArrowRight, 
    User, 
    Info, 
    Eye,
    Check,
    X,
    MessageSquare,
    History,
    IndianRupee,
    FolderKanban,
    Lightbulb,
    Users,
    HeartHandshake,
    Ban,
    Lock,
    Activity,
    ChevronRight
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { approveVerificationAction, rejectVerificationAction, cancelVerificationAction } from './actions';
import type { PendingVerification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function VerificationsPage() {
    const firestore = useFirestore();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const targetRequestId = searchParams.get('requestId');
    
    const [selectedRequest, setSelectedRequest] = useState<PendingVerification | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

    const verificationsRef = useMemoFirebase(() => {
        if (!firestore || !userProfile) return null;
        
        const baseCol = collection(firestore, 'pending_verifications');
        
        if (userProfile.role === 'Admin') {
            return query(baseCol, orderBy('createdAt', 'desc'));
        }

        return query(
            baseCol, 
            where('assignedVerifierIds', 'array-contains', userProfile.id),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, userProfile]);

    const { data: verifications, isLoading: isVerificationsLoading } = useCollection<PendingVerification>(verificationsRef);

    React.useEffect(() => {
        if (!isVerificationsLoading && verifications && targetRequestId) {
            const found = verifications.find(v => v.id === targetRequestId);
            if (found) {
                setSelectedRequest(found);
                setIsDetailOpen(true);
            }
        }
    }, [isVerificationsLoading, verifications, targetRequestId]);

    const handleApprove = async (requestId: string) => {
        if (!userProfile) return;
        setIsActionLoading(true);
        try {
            const res = await approveVerificationAction(requestId, userProfile.id);
            if (res.success) {
                toast({ title: "Approved", description: res.message, variant: "success" });
                setIsDetailOpen(false);
            } else {
                toast({ title: "Approval Failed", description: res.message, variant: "destructive" });
            }
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!userProfile || !selectedRequest) return;
        setIsActionLoading(true);
        try {
            const res = await rejectVerificationAction(selectedRequest.id, userProfile.id, rejectionReason);
            if (res.success) {
                toast({ title: "Rejected", description: res.message, variant: "success" });
                setIsRejectDialogOpen(false);
                setIsDetailOpen(false);
                setRejectionReason('');
            } else {
                toast({ title: "Rejection Failed", description: res.message, variant: "destructive" });
            }
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleWithdraw = async (requestId: string) => {
        if (!confirm('Are you sure you want to withdraw this request?')) return;
        setIsActionLoading(true);
        try {
            const res = await cancelVerificationAction(requestId);
            if (res.success) {
                toast({ title: "Withdrawn", description: res.message, variant: "success" });
            } else {
                toast({ title: "Failed", description: res.message, variant: "destructive" });
            }
        } finally {
            setIsActionLoading(false);
        }
    };

    const isLoading = isProfileLoading || isVerificationsLoading;

    if (isLoading) return <BrandedLoader message="Syncing Verification Pipeline..." />;

    const myPendingRequests = (verifications || []).filter(v => 
        v.status !== 'Approved' && v.status !== 'Rejected' && 
        v.assignedVerifiers.some(av => av.id === userProfile?.id && av.status === 'Pending')
    );

    const allRequests = targetRequestId 
        ? (verifications || []).filter(v => v.id === targetRequestId) 
        : (verifications || []);

    return (
        <main className="container mx-auto p-4 md:p-8 text-primary font-normal relative min-h-screen">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
            <div className="absolute top-40 -right-20 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -z-10 animate-pulse" />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                <div className="space-y-1.5">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter flex items-center gap-3 text-primary">
                        <ShieldCheck className="h-9 w-9 text-primary" />
                        Verification Pipeline
                    </h1>
                    <p className="text-sm font-bold opacity-70 leading-relaxed max-w-2xl">Audit and authorize modifications across the institutional cloud registry.</p>
                </div>
                
                <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md p-2 rounded-2xl border border-primary/5 shadow-sm animate-fade-in-up">
                    <div className="px-4 py-1 text-center border-r border-primary/10">
                        <p className="text-[10px] uppercase font-bold opacity-40 tracking-widest">Awaiting Me</p>
                        <p className="text-xl font-bold text-primary">{myPendingRequests.length}</p>
                    </div>
                    <div className="px-4 py-1 text-center">
                        <p className="text-[10px] uppercase font-bold opacity-40 tracking-widest">System Total</p>
                        <p className="text-xl font-bold text-primary">{allRequests.length}</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="assigned" className="w-full space-y-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <TabsList className="bg-white/50 backdrop-blur-md p-1 border border-primary/10 rounded-2xl h-12 shadow-sm">
                    <TabsTrigger value="assigned" className="rounded-xl px-6 font-bold h-10 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                        My Assignments
                    </TabsTrigger>
                    <TabsTrigger value="all" className="rounded-xl px-6 font-bold h-10 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                        Full Audit Trail
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="assigned" className="space-y-6 outline-none">
                    {myPendingRequests.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {myPendingRequests.map((v, idx) => (
                                <VerificationCard 
                                    key={v.id} 
                                    request={v} 
                                    index={idx}
                                    onView={() => { setSelectedRequest(v); setIsDetailOpen(true); }} 
                                    onWithdraw={v.requestedBy.id === userProfile?.id ? () => handleWithdraw(v.id) : undefined}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-center bg-primary/5 rounded-[32px] border-2 border-dashed border-primary/10 animate-fade-in-zoom">
                            <div className="relative mb-6">
                                <CheckCircle2 className="h-16 w-16 text-primary/10" />
                                <div className="absolute inset-0 animate-ping rounded-full border-2 border-primary/20 scale-150 opacity-0" />
                            </div>
                            <h3 className="font-bold text-xl text-primary tracking-tight">Queue All Clear</h3>
                            <p className="text-muted-foreground text-sm max-w-xs font-bold opacity-60 mt-2 leading-relaxed">No pending verifications currently require your authorization.</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="all" className="space-y-6 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {allRequests.map((v, idx) => (
                            <VerificationCard 
                                key={v.id} 
                                request={v} 
                                index={idx}
                                onView={() => { setSelectedRequest(v); setIsDetailOpen(true); }} 
                                onWithdraw={v.requestedBy.id === userProfile?.id && (v.status === 'Pending' || v.status === 'Partially Approved') ? () => handleWithdraw(v.id) : undefined}
                            />
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-3xl rounded-[32px] border-primary/10 shadow-2xl overflow-hidden p-0 gap-0">
                    <DialogHeader className="bg-primary/5 p-8 border-b relative">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <ShieldCheck className="h-32 w-32" />
                        </div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                             <Badge className="bg-primary/10 text-primary hover:bg-primary/20 capitalize font-bold border-0 px-4 h-7 rounded-full">
                                {selectedRequest?.module} Auditor View
                            </Badge>
                            <Badge variant={selectedRequest?.status === 'Approved' ? 'eligible' : selectedRequest?.status === 'Rejected' ? 'destructive' : 'outline'} className="capitalize font-bold px-4 h-7 rounded-full shadow-sm">
                                {selectedRequest?.status}
                            </Badge>
                        </div>
                        <DialogTitle className="text-3xl font-bold text-primary tracking-tighter leading-tight relative z-10">Verification Audit Report</DialogTitle>
                        <DialogDescription className="font-bold opacity-60 text-primary relative z-10 mt-2">
                            Authored by {selectedRequest?.requestedBy.name} • {selectedRequest?.createdAt ? new Date((selectedRequest.createdAt as any).seconds * 1000).toLocaleString() : 'N/A'}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[60vh]">
                        <div className="p-8 space-y-8">
                            {selectedRequest?.description && (
                                <div className="p-5 bg-primary/[0.03] rounded-2xl border border-primary/5 relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 h-full w-1 bg-primary group-hover:w-2 transition-all" />
                                    <div className="flex items-center gap-2 mb-3 text-primary font-bold text-[10px] uppercase tracking-[0.2em] opacity-50">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        Request Narrative
                                    </div>
                                    <p className="text-sm font-bold text-primary/80 leading-relaxed">{selectedRequest.description}</p>
                                </div>
                            )}

                            <div className="space-y-5">
                                <h3 className="font-bold text-xs text-primary uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    Data State Comparison
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Institutional Baseline</Label>
                                        </div>
                                        <div className="p-5 bg-muted/20 rounded-2xl text-[11px] font-mono whitespace-pre-wrap border border-primary/5 overflow-auto max-h-52 shadow-inner">
                                            {JSON.stringify(selectedRequest?.originalValue, null, 2)}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                            <Label className="text-[10px] font-bold text-primary uppercase tracking-widest">Proposed Modification</Label>
                                        </div>
                                        <div className="p-5 bg-primary/[0.04] rounded-2xl text-[11px] font-mono whitespace-pre-wrap border border-primary/10 overflow-auto max-h-52 text-primary font-bold shadow-inner">
                                            {JSON.stringify(selectedRequest?.newValue, null, 2)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <h3 className="font-bold text-xs text-primary uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                                    <Activity className="h-4 w-4" />
                                    Authorization Quorum
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {selectedRequest?.assignedVerifiers.map((av, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl border border-primary/5 bg-white shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-bold text-sm">
                                                    {av.name.charAt(0)}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <span className="font-bold text-sm text-primary block">{av.name}</span>
                                                    <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Verifier</span>
                                                </div>
                                            </div>
                                            <Badge variant={av.status === 'Approved' ? 'eligible' : av.status === 'Rejected' ? 'destructive' : 'outline'} className="capitalize font-bold text-[10px] px-3 h-6 rounded-full">
                                                {av.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="bg-primary/5 p-8 border-t gap-4 flex-col sm:flex-row justify-between w-full">
                        <Button variant="ghost" onClick={() => setIsDetailOpen(false)} className="font-bold border-primary/10 text-primary h-12 rounded-2xl px-6 hover:bg-white/50">Dismiss Auditor</Button>
                        
                        {selectedRequest?.status !== 'Approved' && selectedRequest?.status !== 'Rejected' && 
                         selectedRequest?.assignedVerifiers.some(av => av.id === userProfile?.id && av.status === 'Pending') && (
                            <div className="flex gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setIsRejectDialogOpen(true)} 
                                    disabled={isActionLoading}
                                    className="font-bold h-12 rounded-2xl px-6 border-destructive/20 text-destructive hover:bg-destructive/10"
                                >
                                    <Ban className="mr-2 h-4 w-4" /> Reject
                                </Button>
                                <Button 
                                    onClick={() => handleApprove(selectedRequest.id)} 
                                    disabled={isActionLoading}
                                    className="bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-2xl px-8 shadow-xl hover:shadow-primary/20 transition-all active:scale-95"
                                >
                                    {isActionLoading ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                    Verify State
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent className="max-w-md rounded-[32px] border-primary/10 shadow-2xl p-8">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-primary text-2xl tracking-tighter">Reject Modification</DialogTitle>
                        <DialogDescription className="font-bold opacity-60 text-primary mt-2 leading-relaxed">
                            Specify the reasons for declining this update. This narrative will be logged in the permanent audit trail.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <Textarea 
                            placeholder="Type rejection reason here..." 
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="border-primary/10 font-bold focus:shadow-lg rounded-[20px] bg-primary/[0.02] p-5 text-sm"
                            rows={5}
                        />
                    </div>
                    <DialogFooter className="gap-3">
                        <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)} className="font-bold rounded-xl h-11 px-6">Cancel</Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleReject} 
                            disabled={isActionLoading || !rejectionReason.trim()}
                            className="font-bold rounded-xl h-11 px-6 shadow-lg shadow-destructive/20 active:scale-95 transition-all"
                        >
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}

function VerificationCard({ request, index, onView, onWithdraw }: { request: PendingVerification, index: number, onView: () => void, onWithdraw?: () => void }) {
    const statusColor = {
        'Pending': 'bg-amber-100 text-amber-800 border-amber-200',
        'Partially Approved': 'bg-blue-100 text-blue-800 border-blue-200',
        'Approved': 'bg-emerald-100 text-emerald-800 border-emerald-200',
        'Rejected': 'bg-red-100 text-red-800 border-red-200'
    }[request.status];

    const moduleIcon = {
        'donations': IndianRupee,
        'beneficiaries': Users,
        'campaigns': FolderKanban,
        'leads': Lightbulb,
        'donors': HeartHandshake,
        'users': User,
    }[request.module] || Info;

    const Icon = moduleIcon;
    const approvedCount = request.assignedVerifiers.filter(v => v.status === 'Approved').length;
    const totalCount = request.assignedVerifiers.length;

    return (
        <Card 
            className="overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border-primary/5 group bg-white rounded-[24px] animate-fade-in-up"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
        >
            <div className={cn("h-1.5 w-full", 
                request.status === 'Approved' ? 'bg-emerald-500' : 
                request.status === 'Rejected' ? 'bg-red-500' : 'bg-amber-400'
            )} />
            <CardHeader className="pb-4 border-b border-primary/5 bg-primary/[0.02] p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white rounded-2xl text-primary shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                        <Icon className="h-5 w-5" />
                    </div>
                    <Badge className={cn("font-bold text-[10px] uppercase border-0 px-3 h-6 rounded-full shadow-sm tracking-widest", statusColor)}>
                        {request.status}
                    </Badge>
                </div>
                <CardTitle className="text-base font-bold text-primary group-hover:text-primary transition-colors line-clamp-2 leading-tight tracking-tight min-h-[3rem]">
                    {request.description || `${request.module.toUpperCase()} Modification`}
                </CardTitle>
                <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[8px]">
                            {request.requestedBy.name.charAt(0)}
                        </div>
                        <span className="text-[10px] font-bold text-primary opacity-60">{request.requestedBy.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {request.createdAt ? new Date((request.createdAt as any).seconds * 1000).toLocaleDateString() : 'N/A'}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-5 font-normal p-6">
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span>Quorum Status</span>
                        <span className="text-primary">{approvedCount} / {totalCount} Verified</span>
                    </div>
                    <div className="h-1.5 w-full bg-primary/5 rounded-full overflow-hidden flex gap-0.5">
                        {request.assignedVerifiers.map((av, i) => (
                            <div 
                                key={i} 
                                className={cn(
                                    "h-full flex-1 transition-all duration-500",
                                    av.status === 'Approved' ? "bg-emerald-500" :
                                    av.status === 'Rejected' ? "bg-red-500" : "bg-primary/10"
                                )}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button 
                        variant="ghost" 
                        className="flex-1 font-bold text-xs h-11 border-primary/10 hover:bg-primary hover:text-white transition-all rounded-xl group/btn"
                        onClick={onView}
                    >
                        Review Audit 
                        <ChevronRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                    {onWithdraw && (
                        <Button 
                            variant="outline"
                            className="font-bold text-xs h-11 w-11 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 transition-all p-0"
                            onClick={onWithdraw}
                        >
                            <Ban className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
