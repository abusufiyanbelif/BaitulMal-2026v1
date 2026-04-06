'use client';
 
 import React from 'react';
 import { useFirestore, useCollection, collection, query, where, useMemoFirebase } from '@/firebase';
 import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
 import { AlertCircle, Clock } from 'lucide-react';
 import { Badge } from '@/components/ui/badge';
 import { useSession } from '@/hooks/use-session';
 
 interface PendingUpdateWarningProps {
     targetId: string;
     module: string;
 }
 
 export function PendingUpdateWarning({ targetId, module }: PendingUpdateWarningProps) {
     const firestore = useFirestore();
     const { userProfile } = useSession();
     
     const q = useMemoFirebase(() => {
         if (!firestore || !targetId || !userProfile) return null;
         return query(
             collection(firestore, 'pending_verifications'),
             where('targetId', '==', targetId),
             where('status', '==', 'pending')
         );
     }, [firestore, targetId, userProfile]);
 
     const { data: pendingRequests, isLoading } = useCollection<any>(q);
 
     if (!userProfile || isLoading || !pendingRequests || pendingRequests.length === 0) return null;
 
     return (
         <div className="animate-fade-in-up">
             <Alert variant="warning" className="bg-amber-50 border-amber-200 text-amber-800 rounded-2xl shadow-sm">
                 <AlertCircle className="h-4 w-4 text-amber-600" />
                 <AlertTitle className="font-bold flex items-center gap-2">
                     Pending Transaction Integrity Review
                     <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 font-bold text-[10px] animate-pulse">
                         Awaiting Approval
                     </Badge>
                 </AlertTitle>
                 <AlertDescription className="font-normal text-amber-700/80 mt-1 flex flex-col gap-1">
                     <p>This record has {pendingRequests.length} suggested update{pendingRequests.length > 1 ? 's' : ''} currently under institutional review.</p>
                     <div className="flex items-center gap-1.5 text-[10px] font-bold opacity-70">
                         <Clock className="h-3 w-3" />
                         Public display values will remain locked until a verifier confirms the changes.
                     </div>
                 </AlertDescription>
             </Alert>
         </div>
     );
 }
