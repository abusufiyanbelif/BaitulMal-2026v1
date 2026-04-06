import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Lightbulb, Save, Info, AlertTriangle } from 'lucide-react';
import type { Campaign, Lead, Donation } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BulkLinkInitiativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'link' | 'unlink';
  selectedDonations: Donation[];
  allDonations: Donation[];
  campaigns: Campaign[];
  leads: Lead[];
  onConfirm: (initiativeContext?: { id: string; type: 'campaign' | 'lead'; name: string }, splitOptions?: { shouldSplit: boolean; fillAmount: number }) => Promise<void>;
  isSubmitting: boolean;
}

export function BulkLinkInitiativeDialog({ open, onOpenChange, mode, selectedDonations, allDonations, campaigns, leads, onConfirm, isSubmitting }: BulkLinkInitiativeDialogProps) {
  const [selectedInitiative, setSelectedInitiative] = useState<string>('');
  const [shouldSplit, setShouldSplit] = useState(true);

  const totalSelectedAmount = useMemo(() => {
    return selectedDonations.reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [selectedDonations]);

  const currentlyLinkedAmount = useMemo(() => {
    return selectedDonations.reduce((sum, d) => {
        const hasLinks = d.linkSplit && d.linkSplit.length > 0 && !d.linkSplit.some(l => l.linkId === 'unallocated');
        return sum + (hasLinks ? (d.amount || 0) : 0);
    }, 0);
  }, [selectedDonations]);

  const selectedInitiativeData = useMemo(() => {
      if (!selectedInitiative) return null;
      const [type, id] = selectedInitiative.split('_');
      if (type === 'campaign') return campaigns.find(c => c.id === id);
      if (type === 'lead') return leads.find(l => l.id === id);
      return null;
  }, [selectedInitiative, campaigns, leads]);

  const targetDiff = useMemo(() => {
      if (!selectedInitiativeData) return null;
      const target = selectedInitiativeData.targetAmount || 0;
      const collected = selectedInitiativeData.collectedAmount || 0;
      const remaining = target - collected;
      const isOver = totalSelectedAmount > remaining && remaining > 0;
      return { target, collected, remaining, isOver };
  }, [selectedInitiativeData, totalSelectedAmount]);

  const unlinkedSuggestions = useMemo(() => {
      return allDonations
          .filter(d => (!d.linkSplit || d.linkSplit.length === 0 || d.linkSplit.some(l => l.linkId === 'unallocated')))
          .sort((a, b) => (b.amount || 0) - (a.amount || 0))
          .slice(0, 5);
  }, [allDonations]);

  const handleApply = async () => {
      if (mode === 'unlink') {
          await onConfirm(undefined);
          return;
      }
      if (!selectedInitiative) return;
      const [type, id] = selectedInitiative.split('_');
      const name = selectedInitiativeData?.name || 'Unknown';
      
      const splitOptions = (targetDiff?.isOver && shouldSplit) 
        ? { shouldSplit: true, fillAmount: targetDiff.remaining }
        : undefined;

      await onConfirm({ id, type: type as 'campaign' | 'lead', name }, splitOptions);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!isSubmitting) onOpenChange(val); }}>
      <DialogContent className="max-w-xl rounded-[16px] border-primary/10 shadow-2xl">
        <DialogHeader className="bg-primary/5 p-6 border-b">
          <DialogTitle className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <FolderKanban className="h-5 w-5 opacity-80" /> {mode === 'link' ? 'Bulk Allocate to Initiative' : 'Bulk Unlink from Content'}
          </DialogTitle>
          <DialogDescription className="text-xs font-normal">
            {mode === 'link' ? 'Redirecting' : 'Clearing associations for'} {selectedDonations.length} total donations.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
            <div className="bg-primary/[0.02] border border-primary/10 rounded-[12px] p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-primary/80">Total Selected Pool:</span>
                    <span className="font-mono font-black text-primary">₹{totalSelectedAmount.toFixed(2)}</span>
                </div>
                {currentlyLinkedAmount > 0 && (
                    <div className="flex justify-between items-start text-xs text-amber-600 font-bold bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mr-2" />
                        <span>Warning: ₹{currentlyLinkedAmount.toFixed(2)} of this pool is already linked to other initiatives. Continuing will forcibly overwrite their allocations to 100% for the new target.</span>
                    </div>
                )}
            </div>

            {mode === 'unlink' && (
                <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-4 text-amber-800 text-xs font-bold flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>All selected donations will be stripped of their current allocations and dropped back into the Unallocated General pool. Use this action if they were mapped erroneously.</p>
                </div>
            )}

            {mode === 'link' && (
                <>
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-primary">Select Target Initiative</label>
                        <Select value={selectedInitiative} onValueChange={setSelectedInitiative} disabled={isSubmitting}>
                            <SelectTrigger className="w-full h-10 border-primary/20 text-sm font-bold bg-white">
                                <SelectValue placeholder="Choose a Campaign or Lead..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px] border-primary/10">
                                {campaigns.length > 0 && (
                                    <div className="px-2 py-1.5 text-xs font-black text-primary/40 uppercase tracking-widest">Active Campaigns</div>
                                )}
                                {campaigns.map(c => (
                                    <SelectItem key={`campaign_${c.id}`} value={`campaign_${c.id}`} className="font-bold text-primary">
                                        {c.name}
                                    </SelectItem>
                                ))}
                                {leads.length > 0 && (
                                    <div className="px-2 py-1.5 text-xs font-black text-primary/40 uppercase tracking-widest mt-2 border-t border-primary/5">Active Leads</div>
                                )}
                                {leads.map(l => (
                                    <SelectItem key={`lead_${l.id}`} value={`lead_${l.id}`} className="font-bold text-primary">
                                        {l.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {targetDiff && (
                        <div className="bg-blue-50/50 border border-blue-100 rounded-[12px] p-4 space-y-3 animate-fade-in-up">
                            <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-1">
                                <Info className="h-3.5 w-3.5" /> Projection Impact
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] uppercase font-bold tracking-tight text-blue-800/60">Current Remaining Need</p>
                                    <p className="font-mono text-sm font-bold text-blue-900">₹{Math.max(0, targetDiff.remaining).toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold tracking-tight text-blue-800/60">After Allocation</p>
                                    <p className="font-mono text-sm font-black text-green-700">₹{Math.max(0, targetDiff.remaining - (targetDiff.isOver && shouldSplit ? targetDiff.remaining : totalSelectedAmount)).toFixed(2)}</p>
                                </div>
                            </div>

                            {targetDiff.isOver && targetDiff.remaining > 0 && (
                                <div className="mt-4 p-3 bg-white/60 border border-blue-200 rounded-lg space-y-2">
                                     <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id="split-to-fill" 
                                            checked={shouldSplit} 
                                            onCheckedChange={(checked: boolean) => setShouldSplit(!!checked)} 
                                        />
                                        <label htmlFor="split-to-fill" className="text-xs font-bold text-blue-900 cursor-pointer">
                                            Split to Fill (Allocate only ₹{targetDiff.remaining.toFixed(2)})
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-blue-800/60 font-medium ml-6">
                                        If enabled, the remaining ₹{(totalSelectedAmount - targetDiff.remaining).toFixed(2)} will stay in the Unallocated pool.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'link' && unlinkedSuggestions.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-primary/40 uppercase tracking-widest flex items-center gap-1">
                                <Lightbulb className="h-3.5 w-3.5" /> High-Value Suggestions
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {unlinkedSuggestions.map(d => (
                                    <Badge key={d.id} variant="secondary" className="font-mono text-[10px] py-1 border-primary/5">
                                        ₹{d.amount.toLocaleString()}
                                    </Badge>
                                ))}
                            </div>
                            <p className="text-[9px] text-muted-foreground italic">These large unlinked donations could help fulfill this cause quickly.</p>
                        </div>
                    )}
                </>
            )}
        </div>

        <DialogFooter className="bg-primary/5 p-4 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="font-bold text-primary border-primary/20">
                Cancel
            </Button>
            <Button onClick={handleApply} disabled={(mode === 'link' && !selectedInitiative) || isSubmitting} className={cn("font-bold shadow-md rounded-[12px] text-white", mode === 'link' ? "bg-primary" : "bg-destructive hover:bg-destructive/90")}>
                {isSubmitting ? 'Processing...' : mode === 'link' ? 'Confirm Allocation' : 'Confirm Unlink'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
