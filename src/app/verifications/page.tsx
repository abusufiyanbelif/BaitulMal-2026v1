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
    History
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { approveVerificationAction, rejectVerificationAction } from './actions';
import type { PendingVerification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function VerificationsPage() {
    const firestore = useFirestore();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { toast } = useToast();
    const [selectedRequest, setSelectedRequest] = useState<PendingVerification | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

    const verificationsRef = useMemoFirebase(() => {
        if (!firestore || !userProfile) return null;
        
        const baseCol = collection(firestore, 'pending_verifications');
        
        // SECURITY COMPLIANT QUERY:
        // If not an Admin, we MUST filter by assignedVerifierIds to match the security rules.
        // This ensures the query result is consistent with the mandatory rule constraints.
        if (userProfile.role !== 'Admin') {
            return query(
                baseCol, 
                where('assignedVerifierIds', 'array-contains', userProfile.id),
                orderBy('createdAt', 'desc')
            );
        }

        // Admin: Can query globally for audit purposes
        return query(baseCol, orderBy('createdAt', 'desc'));
    }, [firestore, userProfile]);

    const { data: verifications, isLoading: isVerificationsLoading } = useCollection<PendingVerification>(verificationsRef);

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

    const isLoading = isProfileLoading || isVerificationsLoading;

    if (isLoading) return <BrandedLoader message="Loading Verification Pipeline..." />;

    const myPendingRequests = (verifications || []).filter(v => 
        v.status !== 'Approved' && v.status !== 'Rejected' && 
        v.assignedVerifiers.some(av => av.id === userProfile?.id && av.status === 'Pending')
    );

    const allRequests = verifications || [];

    return (
        <main className="container mx-auto p-4 md:p-8 text-primary font-normal">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <ShieldCheck className="h-8 w-8 text-primary" />
                        Verification Pipeline
                    </h1>
                    <p className="text-muted-foreground font-normal text-sm">Audit and approve organization record changes.</p>
                </div>
            </div>

            <Tabs defaultValue="assigned" className="w-full space-y-6">
                <TabsList className="bg-primary/5 p-1 border border-primary/10">
                    <TabsTrigger value="assigned" className="font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
                        Assigned to Me ({myPendingRequests.length})
                    </TabsTrigger>
                    <TabsTrigger value="all" className="font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
                        All Requests ({allRequests.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="assigned" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {myPendingRequests.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {myPendingRequests.map(v => (
                                <VerificationCard 
                                    key={v.id} 
                                    request={v} 
                                    onView={() => { setSelectedRequest(v); setIsDetailOpen(true); }} 
                                />
                            ))}
                        </div>
                    ) : (
                        <Card className="border-dashed border-primary/20 bg-primary/[0.01]">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <CheckCircle2 className="h-12 w-12 text-primary/20 mb-4" />
                                <h3 className="font-bold text-lg text-primary">Pipeline Clear</h3>
                                <p className="text-muted-foreground text-sm max-w-xs font-normal">No pending verifications currently assigned to you. Great work!</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="all" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {allRequests.map(v => (
                            <VerificationCard 
                                key={v.id} 
                                request={v} 
                                onView={() => { setSelectedRequest(v); setIsDetailOpen(true); }} 
                            />
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-2xl rounded-[20px] border-primary/10 shadow-2xl overflow-hidden p-0">
                    <DialogHeader className="bg-primary/5 p-6 border-b">
                        <div className="flex items-center justify-between mb-2">
                             <Badge className="bg-primary/10 text-primary hover:bg-primary/20 capitalize font-bold border-0">
                                {selectedRequest?.module} Update Request
                            </Badge>
                            <Badge variant={selectedRequest?.status === 'Approved' ? 'eligible' : selectedRequest?.status === 'Rejected' ? 'destructive' : 'outline'} className="capitalize font-bold">
                                {selectedRequest?.status}
                            </Badge>
                        </div>
                        <DialogTitle className="text-2xl font-bold text-primary tracking-tight">Record Change Audit</DialogTitle>
                        <DialogDescription className="font-normal text-muted-foreground">
                            Requested by {selectedRequest?.requestedBy.name} on {selectedRequest?.createdAt ? new Date((selectedRequest.createdAt as any).seconds * 1000).toLocaleString() : 'N/A'}
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="max-h-[60vh]">
                        <div className="p-6 space-y-6">
                            {selectedRequest?.description && (
                                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                                    <div className="flex items-center gap-2 mb-2 text-primary font-bold text-xs uppercase tracking-wider">
                                        <MessageSquare className="h-3 w-3" />
                                        Request Description
                                    </div>
                                    <p className="text-sm font-normal text-primary/80">{selectedRequest.description}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="font-bold text-sm text-primary uppercase tracking-widest flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    Data Comparison
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Original State</Label>
                                        <pre className="p-4 bg-muted/30 rounded-xl text-[11px] font-mono whitespace-pre-wrap border border-primary/5 overflow-auto max-h-40">
                                            {JSON.stringify(selectedRequest?.originalValue, null, 2)}
                                        </pre>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-primary uppercase">Proposed State</Label>
                                        <pre className="p-4 bg-primary/[0.03] rounded-xl text-[11px] font-mono whitespace-pre-wrap border border-primary/10 overflow-auto max-h-40 text-primary">
                                            {JSON.stringify(selectedRequest?.newValue, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="font-bold text-sm text-primary uppercase tracking-widest flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4" />
                                    Verifier Status
                                </h3>
                                <div className="space-y-2">
                                    {selectedRequest?.assignedVerifiers.map((av, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-primary/5 bg-white">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                    {av.name.charAt(0)}
                                                </div>
                                                <span className="font-bold text-sm text-primary">{av.name}</span>
                                            </div>
                                            <Badge variant={av.status === 'Approved' ? 'eligible' : av.status === 'Rejected' ? 'destructive' : 'outline'} className="capitalize font-bold text-[10px]">
                                                {av.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="bg-primary/5 p-6 border-t gap-3 sm:gap-1 flex justify-between w-full">
                        <div className="flex-1">
                            <Button variant="ghost" onClick={() => setIsDetailOpen(false)} className="font-bold border-primary/10 text-primary">Close</Button>
                        </div>
                        {selectedRequest?.status !== 'Approved' && selectedRequest?.status !== 'Rejected' && 
                         selectedRequest?.assignedVerifiers.some(av => av.id === userProfile?.id && av.status === 'Pending') && (
                            <div className="flex gap-2">
                                <Button 
                                    variant="destructive" 
                                    onClick={() => setIsRejectDialogOpen(true)} 
                                    disabled={isActionLoading}
                                    className="font-bold shadow-md"
                                >
                                    <X className="mr-2 h-4 w-4" /> Reject
                                </Button>
                                <Button 
                                    onClick={() => handleApprove(selectedRequest.id)} 
                                    disabled={isActionLoading}
                                    className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg"
                                >
                                    {isActionLoading ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                    Approve Update
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent className="max-w-md rounded-[20px] border-primary/10 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-primary">Provide Rejection Reason</DialogTitle>
                        <DialogDescription className="font-normal">
                            Please explain why you are rejecting this update request. This will be shared with the requester.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea 
                            placeholder="Type reason here..." 
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="border-primary/10 font-normal focus:shadow-md"
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)} className="font-bold">Cancel</Button>
                        <Button 
                            variant="destructive" 
                            onClick={handleReject} 
                            disabled={isActionLoading || !rejectionReason.trim()}
                            className="font-bold"
                        >
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}

function VerificationCard({ request, onView }: { request: PendingVerification, onView: () => void }) {
    const statusColor = {
        'Pending': 'bg-orange-100 text-orange-800 border-orange-200',
        'Partially Approved': 'bg-blue-100 text-blue-800 border-blue-200',
        'Approved': 'bg-green-100 text-green-800 border-green-200',
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

    return (
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-primary/10 group bg-white">
            <div className={cn("h-1 w-full", 
                request.status === 'Approved' ? 'bg-green-500' : 
                request.status === 'Rejected' ? 'bg-red-500' : 'bg-orange-400'
            )} />
            <CardHeader className="pb-3 border-b border-primary/5 bg-primary/[0.02]">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-primary/5 rounded-lg text-primary group-hover:scale-110 transition-transform">
                        <Icon className="h-4 w-4" />
                    </div>
                    <Badge className={cn("font-bold text-[10px] uppercase border-0", statusColor)}>
                        {request.status}
                    </Badge>
                </div>
                <CardTitle className="text-sm font-bold text-primary group-hover:text-primary transition-colors truncate">
                    {request.description || `${request.module.toUpperCase()} Update`}
                </CardTitle>
                <CardDescription className="text-[10px] font-normal flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {request.createdAt ? new Date((request.createdAt as any).seconds * 1000).toLocaleDateString() : 'N/A'}
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 font-normal">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Requester</span>
                    <span className="font-bold text-primary">{request.requestedBy.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Verifiers</span>
                    <div className="flex -space-x-2">
                        {request.assignedVerifiers.map((av, i) => (
                            <div key={i} title={av.name} className="h-6 w-6 rounded-full border-2 border-white bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary shadow-sm">
                                {av.name.charAt(0)}
                            </div>
                        ))}
                    </div>
                </div>
                <Button 
                    variant="ghost" 
                    className="w-full mt-2 font-bold text-xs h-9 border-primary/10 hover:bg-primary hover:text-white transition-all group-hover:shadow-md"
                    onClick={onView}
                >
                    Review Details <Eye className="ml-2 h-3.5 w-3.5" />
                </Button>
            </CardContent>
        </Card>
    );
}