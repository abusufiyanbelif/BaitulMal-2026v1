'use client';
 
 import { useState, useMemo } from 'react';
 import { useSession } from '@/hooks/use-session';
 import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
 import { collection, query, where, orderBy } from 'firebase/firestore';
 import type { PendingVerification } from '@/lib/types';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { ShieldCheck, Eye, CheckCircle2, XCircle, ArrowRight, Loader2, Info, Users } from 'lucide-react';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { useToast } from '@/hooks/use-toast';
 import { approveVerificationAction, rejectVerificationAction } from '@/app/verifications/actions';
 import { cn } from '@/lib/utils';
 
 export function VerificationManager() {
   const { userProfile, isLoading: isSessionLoading } = useSession();
   const firestore = useFirestore();
   const { toast } = useToast();
   const [isReviewOpen, setIsReviewOpen] = useState(false);
   const [selectedRequest, setSelectedRequest] = useState<PendingVerification | null>(null);
   const [isActionLoading, setIsActionLoading] = useState(false);
   const [isDismissed, setIsDismissed] = useState(false);
 
   const verificationsRef = useMemoFirebase(() => {
     if (!firestore || !userProfile) return null;
     
     const baseCol = collection(firestore, 'pending_verifications');
     
     // Non-Admin: strictly filter by assigned IDs to comply with security rules
     if (userProfile.role !== 'Admin') {
         return query(
           baseCol,
           where('assignedVerifierIds', 'array-contains', userProfile.id),
           where('status', 'in', ['Pending', 'Partially Approved']),
           orderBy('createdAt', 'desc')
         );
     }

     // Admin: Global list
     return query(
       baseCol,
       where('status', 'in', ['Pending', 'Partially Approved']),
       orderBy('createdAt', 'desc')
     );
   }, [firestore, userProfile]);
 
   const { data: allRequests, isLoading: isRequestsLoading } = useCollection<PendingVerification>(verificationsRef);
 
   const myTasks = useMemo(() => {
     if (!allRequests || !userProfile) return [];
     return allRequests.filter(req => 
       req.assignedVerifiers.some(v => v.id === userProfile.id && v.status === 'Pending')
     );
   }, [allRequests, userProfile]);
 
   const handleReview = (req: PendingVerification) => {
     setSelectedRequest(req);
     setIsReviewOpen(true);
   };
 
   const handleApprove = async () => {
     if (!selectedRequest || !userProfile) return;
     setIsActionLoading(true);
     try {
       const result = await approveVerificationAction(selectedRequest.id, userProfile.id);
       if (result.success) {
         toast({ title: "Verification Recorded", description: result.message, variant: "success" });
         setIsReviewOpen(false);
         setSelectedRequest(null);
       } else {
         toast({ title: "Action Failed", description: result.message, variant: "destructive" });
       }
     } finally {
       setIsActionLoading(false);
     }
   };
 
   const handleReject = async () => {
     if (!selectedRequest || !userProfile) return;
     const reason = window.prompt("Please Provide A Reason For Rejection:");
     if (reason === null) return;
 
     setIsActionLoading(true);
     try {
       const result = await rejectVerificationAction(selectedRequest.id, userProfile.id, reason);
       if (result.success) {
         toast({ title: "Change Rejected", description: result.message, variant: "success" });
         setIsReviewOpen(false);
         setSelectedRequest(null);
       } else {
         toast({ title: "Action Failed", description: result.message, variant: "destructive" });
       }
     } finally {
       setIsActionLoading(false);
     }
   };
 
   if (isSessionLoading || isRequestsLoading || myTasks.length === 0 || isDismissed) return null;
 
   return (
     <>
       <div className="fixed bottom-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-500 max-w-sm w-full font-normal">
         <Card className="border-primary/20 bg-white/95 backdrop-blur shadow-2xl overflow-hidden ring-1 ring-primary/5">
           <div className="h-1 bg-primary w-full" />
           <CardContent className="p-4 flex gap-4">
             <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
               <ShieldCheck className="h-6 w-6 text-primary animate-pulse" />
             </div>
             <div className="flex-1 space-y-2">
               <div>
                 <div className="flex items-center justify-between mb-1">
                   <h4 className="font-bold text-sm text-primary tracking-tight">Audit Tasks Pending</h4>
                   <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 border-primary/10">
                     {myTasks.length} {myTasks.length === 1 ? 'Action' : 'Actions'}
                   </Badge>
                 </div>
                 <p className="text-xs text-primary/70 leading-relaxed font-medium">
                   Members have requested your verification for {myTasks.length} record {myTasks.length === 1 ? 'update' : 'updates'}.
                 </p>
               </div>
               <div className="flex gap-2">
                 <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold flex-1 border-primary/20 text-primary hover:bg-primary/5" onClick={() => setIsDismissed(true)}>
                   Skip / Later
                 </Button>
                 <Button size="sm" className="h-8 text-[10px] font-bold flex-1 shadow-md bg-primary hover:bg-primary/90 text-white" onClick={() => handleReview(myTasks[0])}>
                   Verify Now <ArrowRight className="ml-1 h-3 w-3" />
                 </Button>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
         <DialogContent className="max-w-2xl rounded-[24px] border-primary/10 shadow-2xl p-0 overflow-hidden font-normal">
           <DialogHeader className="bg-primary/5 p-8 border-b space-y-2">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm border border-primary/10">
                   <ShieldCheck className="h-7 w-7" />
                 </div>
                 <div>
                   <DialogTitle className="text-2xl font-bold text-primary tracking-tight">Verification Review</DialogTitle>
                   <DialogDescription className="font-medium text-primary/60 text-sm">Reviewing update request for {selectedRequest?.module} record.</DialogDescription>
                 </div>
               </div>
               <Badge variant="outline" className="bg-white border-primary/20 text-primary font-bold px-3 py-1 text-xs">{selectedRequest?.status}</Badge>
             </div>
           </DialogHeader>
 
           <ScrollArea className="max-h-[60vh] p-8">
             <div className="space-y-6">
               <div className="flex items-center gap-4 bg-primary/[0.03] p-4 rounded-2xl border border-primary/5">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xl shadow-sm border border-primary/10">
                    {selectedRequest?.requestedBy.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-primary/50 uppercase tracking-widest">Requested By</p>
                    <p className="text-lg font-bold text-primary">{selectedRequest?.requestedBy.name}</p>
                    <p className="text-xs font-medium text-primary/60 italic">"I have updated this {selectedRequest?.module} record. Please verify."</p>
                  </div>
               </div>
 
               <div className="space-y-4">
                 <h4 className="font-bold text-sm text-primary/80 flex items-center gap-2 border-b border-primary/10 pb-2">Proposed Changes Breakdown</h4>
                 <div className="grid gap-3">
                    {selectedRequest && Object.entries(selectedRequest.newValue).map(([key, value]) => {
                      if (['id', 'updatedAt', 'createdAt', 'createdById', 'createdByName'].includes(key)) return null;
                      if (typeof value === 'object' && value !== null) return null;
                      if (selectedRequest.originalValue && selectedRequest.originalValue[key] === value) return null;
 
                      return (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white border border-primary/10 hover:border-primary/30 transition-colors shadow-sm group">
                          <span className="text-[11px] font-bold text-primary/40 uppercase tracking-wider group-hover:text-primary transition-colors">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <div className="flex items-center gap-3">
                            {selectedRequest.originalValue && (
                              <>
                                <span className="text-xs line-through text-destructive/50 font-medium">{String(selectedRequest.originalValue[key] ?? 'N/A')}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              </>
                            )}
                            <span className="text-sm font-bold text-primary bg-primary/5 px-3 py-1 rounded-lg border border-primary/10">{String(value)}</span>
                          </div>
                        </div>
                      )
                    })}
                 </div>
               </div>
 
               <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-4 shadow-inner">
                 <h4 className="font-bold text-sm text-primary/80 flex items-center gap-2 mb-2">
                   <Users className="h-4 w-4" /> Sign-off Status
                 </h4>
                 <div className="grid gap-3">
                    {selectedRequest?.assignedVerifiers.map((v, idx) => (
                      <div key={v.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-primary/10 shadow-sm">
                        <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">{v.name.charAt(0)}</div>
                           <span className="text-sm font-bold text-primary">{v.name} {v.id === userProfile?.id && "(You)"}</span>
                        </div>
                        <Badge variant={v.status === 'Approved' ? 'success' : 'secondary'} className="text-[10px] font-bold px-2 py-0.5">
                          {v.status === 'Approved' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          {v.status}
                        </Badge>
                      </div>
                    ))}
                 </div>
               </div>
             </div>
           </ScrollArea>
 
           <DialogFooter className="bg-primary/5 p-8 border-t gap-3 sm:gap-0">
             <Button 
               variant="outline" 
               className="font-bold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors px-6 h-12 rounded-xl"
               onClick={handleReject}
               disabled={isActionLoading}
             >
               <XCircle className="mr-2 h-5 w-5 opacity-70" /> Reject Update
             </Button>
             <Button 
               className="font-bold shadow-xl bg-primary hover:bg-primary/90 text-white px-8 h-12 rounded-xl transition-all active:scale-95"
               onClick={handleApprove}
               disabled={isActionLoading}
             >
               {isActionLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
               Confirm and Apply
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     </>
   );
 }