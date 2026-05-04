'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Clock, CheckCircle2, XCircle, ChevronRight, Ban } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { checkPendingVerificationAction, cancelVerificationAction } from '@/app/verifications/actions';
import { useToast } from '@/hooks/use-toast';
import type { PendingVerification } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PendingVerificationAlertProps {
  targetId: string;
  onUpdate?: () => void;
}

export function PendingVerificationAlert({ targetId, onUpdate }: PendingVerificationAlertProps) {
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchPending() {
      const data = await checkPendingVerificationAction(targetId);
      setPending(data);
      setIsLoading(false);
    }
    fetchPending();
  }, [targetId]);

  const handleCancel = async () => {
    if (!pending || !confirm('Are you sure you want to withdraw this approval request? Any unsaved changes linked to this request will be lost.')) return;
    
    setIsCancelling(true);
    try {
      const result = await cancelVerificationAction(pending.id);
      if (result.success) {
        toast({ title: 'Request Withdrawn', variant: 'success' });
        setPending(null);
        if (onUpdate) onUpdate();
      } else {
        toast({ title: 'Action Failed', description: result.message, variant: 'destructive' });
      }
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading || !pending) return null;

  return (
    <Alert className="border-amber-200 bg-amber-50/50 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden">
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-amber-100 text-amber-600 animate-pulse">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <AlertTitle className="text-amber-900 font-bold flex items-center gap-2">
              Modification Pending Approval
              <Badge variant="outline" className="bg-white border-amber-200 text-[10px] h-4 font-bold text-amber-700">
                {pending.status.toUpperCase()}
              </Badge>
            </AlertTitle>
            <AlertDescription className="text-amber-800 text-xs mt-0.5 leading-relaxed">
              Requested by <span className="font-bold">{pending.requestedBy.name}</span> on {new Date(pending.createdAt as any).toLocaleDateString()}.
              Existing data is locked for updates until this request is resolved.
            </AlertDescription>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCancel}
            disabled={isCancelling}
            className="h-8 text-[10px] font-bold border-amber-200 hover:bg-amber-100 text-amber-900"
          >
            {isCancelling ? <Clock className="h-3 w-3 animate-spin mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
            Withdraw Request
          </Button>
          <Button 
            variant="secondary" 
            size="sm" 
            asChild
            className="h-8 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm"
          >
            <a href={`/verifications?requestId=${pending.id}`}>
              View Details <ChevronRight className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </div>
      </div>
      
      {/* Verifier Progress Bar */}
      <div className="mt-3 pt-3 border-t border-amber-200/50 flex items-center gap-2 flex-wrap">
        <span className="text-[9px] font-bold text-amber-700/60 uppercase tracking-widest">Verifier Status:</span>
        {pending.assignedVerifiers?.map((v) => (
          <div key={v.id} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-amber-100 text-[10px]">
            {v.status === 'Approved' ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : v.status === 'Rejected' ? (
              <XCircle className="h-3 w-3 text-red-500" />
            ) : (
              <Clock className="h-3 w-3 text-amber-400" />
            )}
            <span className={cn(
              "font-medium",
              v.status === 'Approved' ? "text-green-700" : "text-muted-foreground"
            )}>{v.name}</span>
          </div>
        ))}
      </div>
    </Alert>
  );
}
