
'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, Info } from 'lucide-react';
import type { Campaign } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CopyCampaignDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    campaign: Campaign | null;
    onCopyConfirm: (options: { newName: string; copyBeneficiaries: boolean; copyDonations: boolean; copyRationLists: boolean; }) => Promise<void>;
}

export function CopyCampaignDialog({ open, onOpenChange, campaign, onCopyConfirm }: CopyCampaignDialogProps) {
    const [newName, setNewName] = useState('');
    const [copyBeneficiaries, setCopyBeneficiaries] = useState(false);
    const [copyDonations, setCopyDonations] = useState(false);
    const [copyRationLists, setCopyRationLists] = useState(true);
    const [isCopying, setIsCopying] = useState(false);

    useEffect(() => {
        if (campaign) {
            setNewName(`Copy of ${campaign.name}`);
        } else {
            setNewName('');
            setCopyBeneficiaries(false);
            setCopyDonations(false);
            setCopyRationLists(true);
        }
    }, [campaign]);
    
    const handleConfirm = async () => {
        if (!campaign || !newName) return;
        setIsCopying(true);
        await onCopyConfirm({ newName, copyBeneficiaries, copyDonations, copyRationLists });
        setIsCopying(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden border-primary/10 rounded-[16px]">
                <DialogHeader className="bg-primary/5 p-6 border-b shrink-0">
                    <DialogTitle className="text-xl font-bold tracking-tight text-primary">Copy Campaign</DialogTitle>
                    <DialogDescription className="text-xs font-normal">
                        Create a new campaign based on an existing one. Choose what to include below.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1">
                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="source-campaign-name" className="text-xs font-bold text-primary">Source Campaign</Label>
                            <Input id="source-campaign-name" value={campaign?.name || ''} readOnly disabled className="bg-muted/50 font-bold border-primary/10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-campaign-name" className="text-xs font-bold text-primary">New Campaign Name</Label>
                            <Input id="new-campaign-name" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={isCopying} className="font-bold border-primary/20 focus-visible:ring-primary h-10" />
                        </div>
                        
                        <Separator className="my-2" />
                        
                        <h4 className="font-bold text-xs text-primary uppercase tracking-widest">Copy Options</h4>

                        <Alert className="bg-primary/[0.03] border-primary/10">
                            <Info className="h-4 w-4 text-primary" />
                            <AlertTitle className="font-bold text-xs text-primary">Independent Records</AlertTitle>
                            <AlertDescription className="text-xs font-normal text-primary/70 mt-1 leading-relaxed">
                                All selected items will be created as new, separate records. Changes made to this new campaign's data will not affect the original.
                            </AlertDescription>
                        </Alert>
                        
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="copy-summary" checked disabled className="border-primary/40 data-[state=checked]:bg-primary" />
                                <Label htmlFor="copy-summary" className="text-xs font-bold text-primary/70">Campaign Summary & Details (Always copied)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="copy-ration" checked={copyRationLists} onCheckedChange={(checked) => setCopyRationLists(!!checked)} disabled={isCopying} className="border-primary/40 data-[state=checked]:bg-primary" />
                                <Label htmlFor="copy-ration" className="text-xs font-bold text-primary">Ration Lists</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="copy-beneficiaries" checked={copyBeneficiaries} onCheckedChange={(checked) => setCopyBeneficiaries(!!checked)} disabled={isCopying} className="border-primary/40 data-[state=checked]:bg-primary" />
                                <Label htmlFor="copy-beneficiaries" className="text-xs font-bold text-primary">Beneficiary List (as new records)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="copy-donations" checked={copyDonations} onCheckedChange={(checked) => setCopyDonations(!!checked)} disabled={isCopying} className="border-primary/40 data-[state=checked]:bg-primary" />
                                <Label htmlFor="copy-donations" className="text-xs font-bold text-primary">Donations (as new records for this campaign)</Label>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="bg-primary/5 p-4 border-t shrink-0 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCopying} className="font-bold border-primary/20 text-primary">Cancel</Button>
                    <Button onClick={handleConfirm} disabled={isCopying || !newName} className="font-bold shadow-md text-white bg-primary">
                        {isCopying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Copy Campaign
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
