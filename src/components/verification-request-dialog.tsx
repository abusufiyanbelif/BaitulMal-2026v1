'use client';
 
 import { useState } from 'react';
 import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
 import { collection, query, where } from 'firebase/firestore';
 import type { UserProfile, PendingVerification } from '@/lib/types';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Label } from '@/components/ui/label';
 import { Loader2, UserCheck, ShieldCheck, Users, Search } from 'lucide-react';
 import { Input } from '@/components/ui/input';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { useToast } from '@/hooks/use-toast';
 import { requestVerificationAction } from '@/app/verifications/actions';
 
 interface VerificationRequestDialogProps {
   isOpen: boolean;
   onOpenChange: (open: boolean) => void;
   payload: Omit<PendingVerification, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'assignedVerifiers' | 'requestedBy'>;
   user: { id: string, name: string };
   onSuccess?: () => void;
   isOptional?: boolean;
   onBypass?: () => void;
 }
 
 export function VerificationRequestDialog({
   isOpen,
   onOpenChange,
   payload,
   user,
   onSuccess,
   isOptional,
   onBypass
 }: VerificationRequestDialogProps) {
   const firestore = useFirestore();
   const { toast } = useToast();
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
   const [isSubmitting, setIsSubmitting] = useState(false);
 
   const usersRef = useMemoFirebase(() => {
     if (!firestore) return null;
     return query(collection(firestore, 'users'), where('status', '==', 'Active'));
   }, [firestore]);
 
   const { data: users, isLoading } = useCollection<UserProfile>(usersRef);
 
   const filteredUsers = (users || []).filter(u => 
     u.id !== user.id && ( // Don't allow self-verification
       u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       u.loginId.toLowerCase().includes(searchTerm.toLowerCase())
     )
   );
 
   const handleToggleUser = (userId: string) => {
     setSelectedUserIds(prev => 
       prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
     );
   };
 
   const handleSubmit = async () => {
     if (selectedUserIds.length === 0) {
       toast({ title: "Selection Required", description: "Please Select At Least One Organization Member To Verify This Change.", variant: "destructive" });
       return;
     }
 
     setIsSubmitting(true);
     try {
       const selectedUsers = (users || []).filter(u => selectedUserIds.includes(u.id));
       const assignedVerifiers = selectedUsers.map(u => ({ 
         id: u.id, 
         name: u.name, 
         status: 'Pending' as const 
       }));
 
       const result = await requestVerificationAction({
         ...payload,
         requestedBy: { id: user.id, name: user.name },
         assignedVerifiers
       });
 
       if (result.success) {
         toast({ title: "Verification Request Sent", description: result.message, variant: "success" });
         onOpenChange(false);
         onSuccess?.();
       } else {
         toast({ title: "Request Failed", description: result.message, variant: "destructive" });
       }
     } finally {
       setIsSubmitting(false);
     }
   };
 
   return (
     <Dialog open={isOpen} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-md rounded-[20px] border-primary/10 shadow-2xl overflow-hidden p-0">
         <DialogHeader className="bg-primary/5 p-6 border-b">
           <div className="flex items-center gap-3 mb-1">
             <div className="p-2 bg-primary/10 rounded-full text-primary">
               <ShieldCheck className="h-5 w-5" />
             </div>
             <DialogTitle className="font-bold text-primary tracking-tight">Request Verification</DialogTitle>
           </div>
           <DialogDescription className="font-normal text-primary/70">
             Choose one or more organization members to review and confirm these record changes.
           </DialogDescription>
         </DialogHeader>
 
         <div className="p-6 space-y-4">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input 
               placeholder="Search by Name or Login ID..." 
               className="pl-9 font-normal h-10 border-primary/10 text-primary"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
 
           <ScrollArea className="h-[240px] pr-4">
             {isLoading ? (
               <div className="flex items-center justify-center h-full">
                 <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
               </div>
             ) : (
               <div className="space-y-2">
                 {filteredUsers.length > 0 ? filteredUsers.map(u => (
                   <div 
                     key={u.id} 
                     onClick={() => handleToggleUser(u.id)}
                     className="flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-primary/20 hover:bg-primary/[0.02] cursor-pointer transition-all group"
                   >
                     <Checkbox 
                       checked={selectedUserIds.includes(u.id)} 
                       onCheckedChange={() => handleToggleUser(u.id)}
                       onClick={(e) => e.stopPropagation()}
                       className="data-[state=checked]:bg-primary"
                     />
                     <div className="flex-1">
                       <p className="font-bold text-sm text-primary group-hover:text-primary transition-colors">{u.name}</p>
                       <p className="text-[10px] font-mono text-muted-foreground">{u.role} | {u.loginId}</p>
                     </div>
                     <Users className="h-4 w-4 text-primary/20 group-hover:text-primary/40 transition-colors" />
                   </div>
                 )) : (
                   <p className="text-center text-xs text-muted-foreground py-10 italic">No members found matching "{searchTerm}"</p>
                 )}
               </div>
             )}
           </ScrollArea>
           
           {selectedUserIds.length > 0 && (
              <div className="bg-primary/5 p-3 rounded-xl border border-primary/10">
                <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider mb-2">Selected Verifiers ({selectedUserIds.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedUserIds.map(id => {
                    const u = users?.find(user => user.id === id);
                    return u ? (
                      <div key={id} className="bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                        {u.name}
                        <Button variant="ghost" size="icon" className="h-3 w-3 p-0 hover:bg-white/20 text-white" onClick={(e) => { e.stopPropagation(); handleToggleUser(id); }}>
                          ×
                        </Button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
           )}
         </div>
 
         <DialogFooter className="bg-primary/5 p-4 border-t gap-2 sm:gap-0 flex sm:justify-between items-center">
           <div className="flex w-full sm:w-auto">
               <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-bold border-primary/10 text-primary w-full sm:w-auto">Cancel</Button>
           </div>
           <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
               {isOptional && (
                   <Button variant="outline" onClick={() => { onBypass?.(); onOpenChange(false); }} className="font-bold border-primary border text-primary">
                       Bypass & Apply Direct
                   </Button>
               )}
               <Button onClick={handleSubmit} disabled={isSubmitting || selectedUserIds.length === 0} className="font-bold shadow-lg flex-1 sm:flex-none">
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                 Dispatch Request ({selectedUserIds.length})
               </Button>
           </div>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }
