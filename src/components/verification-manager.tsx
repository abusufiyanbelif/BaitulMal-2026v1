'use client';
 
 import { useState, useMemo } from 'react';
 import { useSession } from '@/hooks/use-session';
 import { useCollection, useFirestore, useMemoFirebase, useDoc, collection, query, where, orderBy, doc } from '@/firebase';
 import type { PendingVerification } from '@/lib/types';
 import { Card, CardContent } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { ShieldCheck, ArrowRight, Loader2, Users, CheckCircle2, XCircle, Clock } from 'lucide-react';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { useToast } from '@/hooks/use-toast';
 import { approveVerificationAction, rejectVerificationAction } from '@/app/verifications/actions';
 import { cn, generateChanges } from '@/lib/utils';
 import { Label } from '@/components/ui/label';
 import { Input } from '@/components/ui/input';
 import { MessageSquare } from 'lucide-react';
 
 function DiffItem({ label, oldVal, newVal, operation }: { label: string, oldVal?: any, newVal?: any, operation: 'CREATE' | 'UPDATE' | 'DELETE' }) {
  const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);
  if (operation === 'UPDATE' && !isChanged) return null;

  const formatValue = (v: any): string => {
    if (v === null || v === undefined) return 'Baseline';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'object') {
      if (Array.isArray(v)) {
        return v.length > 0 ? `${v.length} Elements` : 'EMPTY_LIST';
      }
      return 'OBJECT_REF';
    }
    return String(v);
  };

  return (
    <div className="p-4 bg-white rounded-2xl border border-primary/5 shadow-sm group hover:border-primary/20 transition-all overflow-hidden relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em]">
          {label.replace(/([A-Z])/g, ' $1').trim()}
        </span>
        <Badge variant="outline" className="text-[8px] font-black h-4 px-2 tracking-widest opacity-40 border-primary/10">MODIFIED</Badge>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] items-center gap-3">
        {operation !== 'CREATE' && (
          <div className="p-3 bg-red-50/40 rounded-xl border border-red-100/40 text-[10px] font-bold text-red-700/60 truncate shadow-inner">
            {formatValue(oldVal)}
          </div>
        )}
        
        {operation === 'UPDATE' && (
          <div className="flex justify-center">
            <ArrowRight className="h-3 w-3 text-primary/20" />
          </div>
        )}

        {operation !== 'DELETE' && (
          <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100/40 text-[10px] font-black text-emerald-800 truncate shadow-inner">
            {formatValue(newVal)}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Verification Manager - Floating organization feedback for pending approvals.
 * Title Case standard applied.
 */
 export function VerificationManager() {
   const { userProfile, isLoading: isSessionLoading } = useSession();
   const firestore = useFirestore();
   const { toast } = useToast();
   const [isReviewOpen, setIsReviewOpen] = useState(false);
   const [selectedRequest, setSelectedRequest] = useState<PendingVerification | null>(null);
   const [isActionLoading, setIsActionLoading] = useState(false);
    const [approvalComment, setApprovalComment] = useState('');
   const [isDismissed, setIsDismissed] = useState(false);
 
   const verificationsRef = useMemoFirebase(() => {
     if (!firestore || !userProfile) return null;
     
     const baseCol = collection(firestore, 'pending_verifications');
     
     // SECURITY COMPLIANT QUERY:
     // If not an Admin, we MUST filter by assignedVerifierIds to match the security rules.
     if (userProfile.role !== 'Admin') {
         return query(
           baseCol,
           where('assignedVerifierIds', 'array-contains', userProfile.id),
           where('status', 'in', ['Pending', 'Partially Approved']),
           orderBy('createdAt', 'desc')
         );
     }
 
     // Admin: Can query globally
     return query(
       baseCol,
       where('status', 'in', ['Pending', 'Partially Approved']),
       orderBy('createdAt', 'desc')
     );
   }, [firestore, userProfile]);
 
   const { data: allRequests, isLoading: isRequestsLoading } = useCollection<PendingVerification>(verificationsRef);
 
    // Config Refs
    const campaignConfigRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'campaign_config') : null, [firestore]);
    const leadConfigRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'lead_config') : null, [firestore]);
    const donationConfigRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donation_config') : null, [firestore]);
    const beneficiaryConfigRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'beneficiary_config') : null, [firestore]);
    const donorConfigRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'donor_config') : null, [firestore]);
    const userConfigRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'user_config') : null, [firestore]);

    const { data: campaignConfig } = useDoc<any>(campaignConfigRef);
    const { data: leadConfig } = useDoc<any>(leadConfigRef);
    const { data: donationConfig } = useDoc<any>(donationConfigRef);
    const { data: beneficiaryConfig } = useDoc<any>(beneficiaryConfigRef);
    const { data: donorConfig } = useDoc<any>(donorConfigRef);
    const { data: userConfig } = useDoc<any>(userConfigRef);

    const moduleConfigs: Record<string, any> = useMemo(() => ({
        'campaigns': campaignConfig,
        'leads': leadConfig,
        'donations': donationConfig,
        'beneficiaries': beneficiaryConfig,
        'donors': donorConfig,
        'users': userConfig
    }), [campaignConfig, leadConfig, donationConfig, beneficiaryConfig, donorConfig, userConfig]);

   const myTasks = useMemo(() => {
     if (!allRequests || !userProfile) return [];

     // Filter based on In-App Notification toggle
     const filteredRequests = allRequests.filter(req => {
         const config = moduleConfigs[req.module];
         return config?.enableInAppNotifications !== false;
     });

     // For admins, show all except self-requested. For members, show where they haven't approved yet.
     const othersRequests = filteredRequests.filter(req => req.requestedBy.id !== userProfile.id);

     if (userProfile.role === 'Admin') return othersRequests;
     return othersRequests.filter(req => 
       req.assignedVerifiers.some(v => v.id === userProfile.id && v.status === 'Pending')
     );
   }, [allRequests, userProfile, moduleConfigs]);

   const operationType = useMemo(() => {
     if (!selectedRequest) return 'UPDATE';
     const hasOld = selectedRequest.originalValue && Object.keys(selectedRequest.originalValue).length > 0;
     const hasNew = selectedRequest.newValue && Object.keys(selectedRequest.newValue).length > 0;
     
     if (!hasOld && hasNew) return 'CREATE';
     if (hasOld && !hasNew) return 'DELETE';
     return 'UPDATE';
   }, [selectedRequest]);
 
   const handleReview = (req: PendingVerification) => {
     setSelectedRequest(req);
     setIsReviewOpen(true);
   };
 
   const handleApprove = async () => {
     if (!selectedRequest || !userProfile) return;
     setIsActionLoading(true);
     try {
       const result = await approveVerificationAction(selectedRequest.id, userProfile.id, approvalComment);
       if (result.success) {
         toast({ title: "Verification Recorded", description: result.message, variant: "success" });
         setIsReviewOpen(false);
         setSelectedRequest(null);
          setApprovalComment('');
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
       <div className="fixed bottom-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-500 max-w-sm w-full">
         <Card className="border-primary/20 bg-white/95 backdrop-blur shadow-2xl overflow-hidden ring-1 ring-primary/5 rounded-2xl">
           <div className="h-1 bg-primary w-full" />
           <CardContent className="p-4 flex gap-4">
             <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10 shadow-sm">
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
                   Members Have Requested Your Verification For {myTasks.length} Record {myTasks.length === 1 ? 'Update' : 'Updates'}.
                 </p>
               </div>
               <div className="flex gap-2">
                 <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold flex-1 border-primary/20 text-primary hover:bg-primary/5 rounded-xl transition-all" onClick={() => setIsDismissed(true)}>
                   Skip / Later
                 </Button>
                 <Button size="sm" className="h-8 text-[10px] font-bold flex-1 shadow-md bg-primary hover:bg-primary/90 text-white rounded-xl transition-all" onClick={() => handleReview(myTasks[0])}>
                   Verify Now <ArrowRight className="ml-1 h-3 w-3" />
                 </Button>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
         <DialogContent className="w-[95vw] sm:max-w-2xl h-[90vh] max-h-[90vh] flex flex-col rounded-[24px] border-primary/10 shadow-2xl p-0 overflow-hidden font-normal">
            <DialogHeader className="bg-primary/5 p-8 border-b space-y-2 shrink-0">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm border border-primary/10">
                   <ShieldCheck className="h-7 w-7" />
                 </div>
                 <div>
                   <DialogTitle className="text-2xl font-bold text-primary tracking-tight">Verification Review</DialogTitle>
                   <DialogDescription className="font-medium text-primary/60 text-sm">
                     Reviewing <span className="text-primary font-bold">{operationType}</span> Request For {selectedRequest?.module} Record.
                   </DialogDescription>
                 </div>
               </div>
               <Badge variant={operationType === 'DELETE' ? 'destructive' : operationType === 'CREATE' ? 'eligible' : 'outline'} className="font-bold px-3 py-1 text-xs capitalize">
                 {operationType}
               </Badge>
             </div>
           </DialogHeader>
 
           <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
             <div className="space-y-6">
               <div className="flex items-center gap-4 bg-primary/[0.03] p-4 rounded-2xl border border-primary/5">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xl shadow-sm border border-primary/10">
                    {selectedRequest?.requestedBy.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                     <p className="text-[10px] font-bold text-primary/50 uppercase tracking-widest">Requested By</p>
                     <p className="text-lg font-bold text-primary">{selectedRequest?.requestedBy.name}</p>
                     <p className="text-xs font-medium text-primary/60 italic">
                       {operationType === 'CREATE' ? 'I am creating a new record.' : operationType === 'DELETE' ? 'I am requesting to remove this record.' : 'I have modified some fields in this record.'}
                     </p>
                   </div>
                </div>

                {(selectedRequest?.description || selectedRequest?.requesterComment || (selectedRequest?.approverComments && selectedRequest.approverComments.length > 0)) && (
                    <div className="p-6 bg-primary/[0.03] rounded-3xl border border-primary/5 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 h-full w-1 bg-primary group-hover:w-2 transition-all" />
                        <div className="flex items-center gap-2 mb-4 text-primary font-bold text-[10px] uppercase tracking-[0.2em] opacity-50">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Audit Trail & Narrative
                        </div>
                        <div className="space-y-4">
                            {selectedRequest?.description && (
                                <div>
                                    <p className="text-[10px] font-black text-primary/40 uppercase mb-1">Request Summary</p>
                                    <p className="text-sm font-bold text-primary/80 leading-relaxed">{selectedRequest.description}</p>
                                </div>
                            )}
                            {selectedRequest?.requesterComment && (
                                <div className="pt-3 border-t border-primary/5">
                                    <p className="text-[10px] font-black text-primary/40 uppercase mb-1">Requester Note</p>
                                    <p className="text-sm font-medium text-primary/70 bg-white/40 p-3 rounded-xl border border-primary/5 italic">
                                        "{selectedRequest.requesterComment}"
                                    </p>
                                </div>
                            )}
                            {selectedRequest?.approverComments && selectedRequest.approverComments.length > 0 && (
                                <div className="pt-3 border-t border-primary/5 space-y-3">
                                    <p className="text-[10px] font-black text-primary/40 uppercase mb-2">Reviewer Feedback</p>
                                    {selectedRequest.approverComments.map((ac, idx) => (
                                        <div key={idx} className="flex gap-3 items-start">
                                            <div className={cn(
                                                "h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                                                ac.status === 'Approved' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                            )}>
                                                {ac.verifierName.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold text-primary">{ac.verifierName}</span>
                                                    <Badge variant={ac.status === 'Approved' ? 'eligible' : 'destructive'} className="text-[8px] h-3.5 px-1 font-black">{ac.status.toUpperCase()}</Badge>
                                                </div>
                                                <p className="text-[11px] text-primary/60 font-medium leading-normal">{ac.comment}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
 
               <div className="space-y-4">
                 <h4 className="font-bold text-sm text-primary/80 flex items-center gap-2 border-b border-primary/10 pb-2 capitalize tracking-tight">Proposed Modifications Breakdown</h4>
                 <div className="grid gap-3">
                    {selectedRequest && (
                      <>
                        {Object.entries(operationType === 'DELETE' ? (selectedRequest.originalValue || {}) : (selectedRequest.newValue || {})).map(([key, value]) => {
                          if (['id', 'updatedAt', 'createdAt', 'createdById', 'createdByName', 'assignedVerifiers', 'assignedVerifierIds', 'requestedBy', 'status', 'module', 'targetId', 'targetCollection', 'revalidatePath'].includes(key)) return null;
                          
                          return (
                            <DiffItem 
                              key={key} 
                              label={key} 
                              oldVal={selectedRequest.originalValue?.[key]} 
                              newVal={selectedRequest.newValue?.[key]} 
                              operation={operationType as any} 
                            />
                          );
                        })}

                        
                      </>
                    )}
                 </div>
               </div>
 
               <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-4 shadow-inner">
                 <h4 className="font-bold text-sm text-primary/80 flex items-center gap-2 mb-2 capitalize tracking-tight">
                   <Users className="h-4 w-4" /> Sign-Off Status
                 </h4>
                 <div className="grid gap-3">
                    {selectedRequest?.assignedVerifiers.map((v, idx) => (
                      <div key={v.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-primary/10 shadow-sm">
                        <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">{v.name.charAt(0)}</div>
                           <span className="text-sm font-bold text-primary">{v.name} {v.id === userProfile?.id && "(You)"}</span>
                        </div>
                        <Badge variant={v.status === 'Approved' ? 'eligible' : 'outline'} className="text-[10px] font-bold px-2 py-0.5 capitalize">
                          {v.status === 'Approved' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}
                          {v.status}
                        </Badge>
                      </div>
                    ))}
                 </div>
               </div>
             </div>
            </div>
 
           <DialogFooter className="bg-primary/5 p-8 border-t gap-4 flex-col sm:flex-row justify-between items-end shrink-0">
               <div className="w-full sm:w-64 space-y-1.5">
                   <Label className="text-[9px] font-black text-primary/40 uppercase tracking-widest ml-1">Approval Feedback (Optional)</Label>
                   <Input 
                       placeholder="Add a note for the requester..." 
                       value={approvalComment}
                       onChange={(e) => setApprovalComment(e.target.value)}
                       className="h-10 rounded-xl border-primary/10 text-xs font-bold bg-white focus-visible:ring-primary/20"
                   />
               </div>
               <div className="flex gap-3 w-full sm:w-auto">
                 <Button 
                   variant="outline" 
                   className="font-bold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors px-6 h-10 rounded-xl text-xs"
                   onClick={handleReject}
                   disabled={isActionLoading}
                 >
                   <XCircle className="mr-2 h-4 w-4 opacity-70" /> Reject Update
                 </Button>
                 <Button 
                   className="font-bold shadow-xl bg-primary hover:bg-primary/90 text-white px-8 h-10 rounded-xl transition-all active:scale-95 text-xs"
                   onClick={handleApprove}
                   disabled={isActionLoading}
                 >
                   {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                   Confirm And Apply
                 </Button>
               </div>
            </DialogFooter>
         </DialogContent>
       </Dialog>
     </>
   );
 }
