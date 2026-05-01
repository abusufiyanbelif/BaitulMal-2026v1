'use client';

import { useState, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useResourceConfig } from '@/hooks/use-resource-config';
import { collection, query, where } from 'firebase/firestore';
import type { UserProfile, PendingVerification } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, UserCheck, ShieldCheck, Users, Search, MessageCircle, Share2, ZapOff, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { requestVerificationAction } from '@/app/verifications/actions';

interface VerificationRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  payload: Omit<PendingVerification, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'assignedVerifiers' | 'requestedBy'>;
  user: { id: string, name: string };
  onSuccess?: () => void;
  isOptional?: boolean;
  onBypass?: () => void;
  minApprovals?: number;
  authorizedVerifiers?: string[];
}

function serializeData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(serializeData);
  
  const result: any = {};
  for (const key in obj) {
    const val = obj[key];
    if (val && typeof val === 'object') {
      if (val.seconds !== undefined && val.nanoseconds !== undefined) {
        // Handle Firestore Timestamps
        result[key] = new Date(val.seconds * 1000).toISOString();
      } else if (val instanceof Date) {
        result[key] = val.toISOString();
      } else {
        result[key] = serializeData(val);
      }
    } else {
      result[key] = val;
    }
  }
  return result;
}

export function VerificationRequestDialog({
  isOpen,
  onOpenChange,
  payload,
  user,
  onSuccess,
  isOptional,
  onBypass,
  minApprovals = 1,
  authorizedVerifiers = []
}: VerificationRequestDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { resourceSettings } = useResourceConfig();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usersRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('status', '==', 'Active'));
  }, [firestore]);

  const { data: users, isLoading } = useCollection<UserProfile>(usersRef);

  useEffect(() => {
    if (isOpen) {
      if (authorizedVerifiers && authorizedVerifiers.length > 0) {
        setSelectedUserIds(authorizedVerifiers.filter(id => id !== user.id));
      }
    } else {
      setSelectedUserIds([]);
      setSearchTerm('');
    }
    // We only want to sync when the dialog opens. 
    // Dependency on authorizedVerifiers.join(',') ensures we only re-run if the content actually changes.
  }, [isOpen, authorizedVerifiers?.join(',')]);

  const filteredUsers = (users || []).filter(u => {
    const isNotSelf = u.id !== user.id;
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.loginId.toLowerCase().includes(searchTerm.toLowerCase());
    
    // If authorizedVerifiers is provided and not empty, restrict to that list.
    // Otherwise, fallback to Admin or User role.
    const isAuthorized = authorizedVerifiers.length > 0 
        ? authorizedVerifiers.includes(u.id)
        : (u.role === 'Admin' || u.role === 'User');

    return isNotSelf && matchesSearch && isAuthorized;
  });

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleManualShare = (verifier: UserProfile) => {
    if (!verifier.phone) {
        toast({ title: "Phone Missing", description: `${verifier.name} does not have a phone number registered.`, variant: "destructive" });
        return;
    }

    const baseUrl = resourceSettings?.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    const message = `*BaitulMal Verification Request*\n\nHello ${verifier.name}!\n\nA verification request has been assigned to you.\n\n*Module:* ${payload.module.toUpperCase()}\n*ID:* ${payload.targetId}\n*Requested By:* ${user.name}\n\n*Link:* ${baseUrl}/verifications\n\nPlease review and confirm these changes at your earliest convenience.`;
    
    const cleanPhone = verifier.phone.replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleSubmit = async () => {
    if (selectedUserIds.length < minApprovals) {
      toast({ 
        title: "More Members Required", 
        description: `Please Select At Least ${minApprovals} Organization Member${minApprovals > 1 ? 's' : ''} To Verify This Change.`, 
        variant: "destructive" 
      });
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

      const result = await requestVerificationAction(serializeData({
        ...payload,
        requestedBy: { id: user.id, name: user.name },
        assignedVerifiers
      }));

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
      <DialogContent className="max-w-md w-[95vw] rounded-[20px] border-primary/10 shadow-2xl overflow-hidden p-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="bg-primary/5 p-6 border-b shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="font-bold text-primary tracking-tight">Request Verification</DialogTitle>
          </div>
          <DialogDescription className="font-normal text-primary/70">
            Choose {minApprovals > 1 ? `at least ${minApprovals}` : 'one or more'} organization members to review and confirm these record changes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 pb-0 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by Name or Login ID..." 
                className="pl-9 font-normal h-10 border-primary/10 text-primary focus-visible:ring-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <ScrollArea className="px-6 h-[320px] w-full">
            <div className="py-4 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary/50" />
                </div>
              ) : (
                <>
                  {filteredUsers.length > 0 ? filteredUsers.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => handleToggleUser(u.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all group cursor-pointer",
                        selectedUserIds.includes(u.id) 
                          ? "border-primary/30 bg-primary/[0.04]" 
                          : "border-transparent hover:border-primary/10 hover:bg-primary/[0.02]"
                      )}
                    >
                      <Checkbox 
                        checked={selectedUserIds.includes(u.id)} 
                        onCheckedChange={() => handleToggleUser(u.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="data-[state=checked]:bg-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-primary truncate">{u.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-tight">{u.role} | {u.loginId}</p>
                      </div>
                      <Users className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        selectedUserIds.includes(u.id) ? "text-primary/60" : "text-primary/10 group-hover:text-primary/30"
                      )} />
                    </div>
                  )) : (
                    <div className="text-center py-10">
                      <Users className="h-10 w-10 text-primary/5 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground italic">No members found matching "{searchTerm}"</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
          
          {selectedUserIds.length > 0 && (
              <div className="px-6 pb-6 pt-2 shrink-0">
                {!resourceSettings?.isAutoWhatsAppEnabled && (
                  <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800">
                    <ZapOff className="h-3 w-3 shrink-0" />
                    <p className="text-[10px] font-medium leading-tight">Automated WhatsApp is disabled. Please use manual sharing below.</p>
                  </div>
                )}
                <div className="bg-primary/5 p-3 rounded-xl border border-primary/10">
                  <p className="text-[10px] font-bold text-primary/60 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Selected Verifiers ({selectedUserIds.length})</span>
                    {selectedUserIds.length < minApprovals && (
                      <span className="text-red-500 normal-case font-normal animate-pulse">Need {minApprovals - selectedUserIds.length} more</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
                    {selectedUserIds.map(id => {
                      const u = users?.find(user => user.id === id);
                      return u ? (
                        <div key={id} className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 pr-1 rounded-full flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                          <span className="pl-1">{u.name}</span>
                          <div className="flex items-center gap-0.5">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleManualShare(u); }}
                              className="h-5 w-5 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors text-white"
                              title="Share via WhatsApp"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleToggleUser(id); }}
                              className="h-5 w-5 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors text-white"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
          )}
        </div>

        <DialogFooter className="bg-primary/5 p-4 border-t shrink-0 flex items-center justify-between gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onOpenChange(false)} 
            className="font-bold border-primary/10 text-primary h-9 px-4 hidden sm:flex"
          >
            Cancel
          </Button>
          
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
              {isOptional && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { onBypass?.(); onOpenChange(false); }} 
                    className="font-bold border-primary/20 text-primary hover:bg-primary/5 h-9 px-4 text-xs"
                  >
                      Bypass & Apply
                  </Button>
              )}
              <Button 
                size="sm"
                onClick={handleSubmit} 
                disabled={isSubmitting || selectedUserIds.length === 0} 
                className={cn(
                  "font-bold shadow-lg h-9 px-5 text-xs",
                  selectedUserIds.length < minApprovals && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                )}
                Dispatch Request ({selectedUserIds.length})
              </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
