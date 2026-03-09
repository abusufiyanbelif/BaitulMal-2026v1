
'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Loader2, XCircle, UploadCloud, Download, Save, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Donation } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ProcessedRecord {
  row: number;
  data: Partial<Donation>;
  isValid: boolean;
  isUpdate: boolean;
  reason?: string;
}

interface DonationImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (records: Partial<Donation>[]) => Promise<void>;
}

export function DonationImportDialog({
  open,
  onOpenChange,
  onImport,
}: DonationImportDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [processedRecords, setProcessedRecords] = useState<ProcessedRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDownloadTemplate = () => {
    const headers = ['ID', 'DonorName', 'DonorPhone', 'ReceiverName', 'Referral', 'Amount', 'DonationDate', 'Status', 'DonationType', 'Comments', 'Suggestions'];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "donation_full_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length <= 1) {
          setIsProcessing(false);
          toast({ title: "Empty File", description: "The Uploaded CSV Contains No Data Rows.", variant: "destructive" });
          return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const processed: ProcessedRecord[] = lines.slice(1)
        .map((line, idx) => {
            const values = line.split(',').map(v => v.trim());
            const data: Partial<Donation> = {};
            
            headers.forEach((header, hIdx) => {
                const val = values[hIdx];
                if (!val) return;

                switch(header) {
                    case 'id': data.id = val; break;
                    case 'donorname': data.donorName = val; break;
                    case 'donorphone': data.donorPhone = val; break;
                    case 'receivername': data.receiverName = val; break;
                    case 'referral': data.referral = val; break;
                    case 'amount': data.amount = Number(val) || 0; break;
                    case 'donationdate': data.donationDate = val; break;
                    case 'status': data.status = val as any; break;
                    case 'donationtype': data.donationType = val as any; break;
                    case 'comments': data.comments = val; break;
                    case 'suggestions': data.suggestions = val; break;
                }
            });

            const isValid = !!data.donorName && (!!data.amount);
            const isUpdate = !!data.id;

            return {
                row: idx + 2,
                data,
                isValid,
                isUpdate,
                reason: isValid ? undefined : 'Missing Mandatory Donor Name Or Amount.'
            };
        });

      setProcessedRecords(processed);
      setIsProcessing(false);
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirmImport = async () => {
    const validRecords = processedRecords.filter(r => r.isValid).map(r => r.data);
    if (validRecords.length === 0) {
        toast({ title: 'No Valid Data', description: 'Please Review The Records And Fix Errors Before Importing.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);
    await onImport(validRecords);
    setIsSubmitting(false);
    onOpenChange(false);
    setFile(null);
    setProcessedRecords([]);
  };

  const updateCount = processedRecords.filter(r => r.isValid && r.isUpdate).length;
  const newCount = processedRecords.filter(r => r.isValid && !r.isUpdate).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col rounded-[16px] border-primary/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary tracking-tight">Full Donation Data Import</DialogTitle>
          <DialogDescription className="font-normal text-primary/70">
            Upload A CSV To Batch-Register Master Donations Or Update Existing Records.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-hidden flex flex-col py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
            <Button variant="outline" onClick={handleDownloadTemplate} className="font-bold border-primary/20 text-primary h-12 shadow-sm active:scale-95 transition-transform">
                <Download className="mr-2 h-4 w-4" /> Download Template
            </Button>
            <div className="relative">
                <Input id="csv-import-donation-file" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                <label htmlFor="csv-import-donation-file" className="flex items-center justify-center gap-2 border-2 border-dashed border-primary/20 rounded-[12px] h-12 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
                    <UploadCloud className="h-5 w-5 text-primary" />
                    <span className="text-sm font-bold text-primary truncate max-w-[200px]">{file ? file.name : 'Select Donation Data (.csv)'}</span>
                </label>
            </div>
          </div>

          {processedRecords.length > 0 && (
            <div className="flex-1 min-h-0 space-y-4 flex flex-col">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-3">
                        <RefreshCcw className="h-5 w-5 text-blue-600" />
                        <div><p className="text-[10px] font-bold uppercase text-blue-800 tracking-widest">To Update</p><p className="text-lg font-bold text-blue-900 leading-none">{updateCount}</p></div>
                    </div>
                    <div className="p-3 rounded-xl bg-green-50 border border-green-100 flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div><p className="text-[10px] font-bold uppercase text-green-800 tracking-widest">New Entries</p><p className="text-lg font-bold text-green-900 leading-none">{newCount}</p></div>
                    </div>
                    <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <div><p className="text-[10px] font-bold uppercase text-red-800 tracking-widest">Errors</p><p className="text-lg font-bold text-red-900 leading-none">{processedRecords.filter(r => !r.isValid).length}</p></div>
                    </div>
                </div>

                <div className="flex-1 border rounded-xl overflow-hidden bg-white shadow-inner">
                    <ScrollArea className="h-full w-full">
                        <Table>
                            <TableHeader className="bg-primary/5 sticky top-0 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[60px] pl-4">Row</TableHead>
                                    <TableHead className="w-[120px]">Sync Status</TableHead>
                                    <TableHead>Donor Name</TableHead>
                                    <TableHead>Amount (₹)</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right pr-4">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedRecords.map((record) => (
                                    <TableRow key={record.row} className={cn("border-b border-primary/5 transition-colors", !record.isValid ? "bg-red-50/30" : "hover:bg-primary/[0.02]")}>
                                        <TableCell className="pl-4 font-mono text-xs opacity-60">{record.row}</TableCell>
                                        <TableCell>
                                            <Badge variant={!record.isValid ? 'destructive' : record.isUpdate ? 'active' : 'eligible'} className="text-[9px] font-bold">
                                                {!record.isValid ? 'Error' : record.isUpdate ? 'Updating' : 'Inserting'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-bold text-sm text-primary">{record.data.donorName || '---'}</TableCell>
                                        <TableCell className="text-xs font-mono font-bold">₹{record.data.amount?.toLocaleString() || '0'}</TableCell>
                                        <TableCell className="text-xs font-normal opacity-60">{record.data.donationDate || '---'}</TableCell>
                                        <TableCell className="text-right pr-4">
                                            {record.isValid ? (
                                                <span className="text-[10px] text-green-600 font-bold">Verified</span>
                                            ) : (
                                                <span className="text-[10px] text-red-600 font-bold">{record.reason}</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 bg-primary/5 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="font-bold border-primary/20">Cancel</Button>
          <Button onClick={handleConfirmImport} disabled={isSubmitting || processedRecords.length === 0 || isProcessing} className="font-bold shadow-md px-8 h-10 transition-all active:scale-95">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Sync {updateCount + newCount} Donations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
