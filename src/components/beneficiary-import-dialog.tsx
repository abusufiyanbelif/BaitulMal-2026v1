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
import { CheckCircle, Loader2, XCircle, UploadCloud, Download, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Beneficiary } from '@/lib/types';

interface ProcessedRecord {
  row: number;
  data: Partial<Beneficiary>;
  isValid: boolean;
  reason?: string;
}

interface BeneficiaryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (records: Partial<Beneficiary>[]) => Promise<void>;
}

export function BeneficiaryImportDialog({
  open,
  onOpenChange,
  onImport,
}: BeneficiaryImportDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [processedRecords, setProcessedRecords] = useState<ProcessedRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDownloadTemplate = () => {
    const headers = ['Name', 'Phone', 'Address', 'Age', 'Occupation', 'FamilyMembers', 'IDType', 'IDNumber', 'ReferralBy'];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "beneficiary_template.csv");
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
      const lines = text.split('\n');
      if (lines.length <= 1) {
          setIsProcessing(false);
          return;
      }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const processed: ProcessedRecord[] = lines.slice(1)
        .map((line, idx) => {
            if (!line.trim()) return null;
            const values = line.split(',').map(v => v.trim());
            const data: Partial<Beneficiary> = {};
            
            headers.forEach((header, hIdx) => {
                if (header === 'name') data.name = values[hIdx];
                if (header === 'phone') data.phone = values[hIdx];
                if (header === 'address') data.address = values[hIdx];
                if (header === 'age') data.age = Number(values[hIdx]) || undefined;
                if (header === 'occupation') data.occupation = values[hIdx];
                if (header === 'familymembers') data.members = Number(values[hIdx]) || undefined;
                if (header === 'idtype') data.idProofType = values[hIdx];
                if (header === 'idnumber') data.idNumber = values[hIdx];
                if (header === 'referralby') data.referralBy = values[hIdx];
            });

            const isValid = !!data.name && !!data.phone;
            return {
                row: idx + 2,
                data,
                isValid,
                reason: isValid ? undefined : 'Missing Mandatory Name Or Phone.'
            };
        })
        .filter((r): r is ProcessedRecord => r !== null);

      setProcessedRecords(processed);
      setIsProcessing(false);
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirmImport = async () => {
    const validRecords = processedRecords.filter(r => r.isValid).map(r => r.data);
    if (validRecords.length === 0) {
        toast({ title: 'No Valid Data', description: 'Please upload a file with valid records.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);
    await onImport(validRecords);
    setIsSubmitting(false);
    onOpenChange(false);
    setFile(null);
    setProcessedRecords([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col rounded-[16px] border-primary/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary tracking-tight">Import Records</DialogTitle>
          <DialogDescription className="font-normal text-primary/70">
            Upload A CSV File To Bulk-Register Beneficiaries.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-hidden flex flex-col py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
            <Button variant="outline" onClick={handleDownloadTemplate} className="font-bold border-primary/20 text-primary h-12 shadow-sm active:scale-95 transition-transform">
                <Download className="mr-2 h-4 w-4" /> Download Template
            </Button>
            <div className="relative">
                <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                <label htmlFor="csv-upload" className="flex items-center justify-center gap-2 border-2 border-dashed border-primary/20 rounded-[12px] h-12 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
                    <UploadCloud className="h-5 w-5 text-primary" />
                    <span className="text-sm font-bold text-primary">{file ? file.name : 'Select Data File (.csv)'}</span>
                </label>
            </div>
          </div>

          {processedRecords.length > 0 && (
            <div className="flex-1 min-h-0 space-y-4 flex flex-col">
                <div className="grid grid-cols-2 gap-4 shrink-0">
                    <div className="p-3 rounded-lg bg-green-50 border border-green-100 flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <div><p className="text-[10px] font-bold uppercase text-green-800 tracking-widest">Valid Records</p><p className="text-lg font-bold text-green-900 leading-none">{processedRecords.filter(r => r.isValid).length}</p></div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-3">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <div><p className="text-[10px] font-bold uppercase text-red-800 tracking-widest">Invalid Rows</p><p className="text-lg font-bold text-red-900 leading-none">{processedRecords.filter(r => !r.isValid).length}</p></div>
                    </div>
                </div>

                <div className="flex-1 border rounded-xl overflow-hidden bg-white shadow-inner">
                    <ScrollArea className="h-full w-full">
                        <Table>
                            <TableHeader className="bg-primary/5 sticky top-0 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[60px] pl-4">Row</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Address</TableHead>
                                    <TableHead className="text-right pr-4">Vetting</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedRecords.map((record) => (
                                    <TableRow key={record.row} className="border-b border-primary/5 hover:bg-primary/[0.02]">
                                        <TableCell className="pl-4 font-mono text-xs opacity-60">{record.row}</TableCell>
                                        <TableCell className="font-bold text-sm text-primary">{record.data.name || '---'}</TableCell>
                                        <TableCell className="text-xs font-mono">{record.data.phone || '---'}</TableCell>
                                        <TableCell className="text-xs max-w-[200px] truncate">{record.data.address || '---'}</TableCell>
                                        <TableCell className="text-right pr-4">
                                            <Badge variant={record.isValid ? 'eligible' : 'destructive'} className="text-[9px] font-bold">
                                                {record.isValid ? 'Ready' : 'Invalid'}
                                            </Badge>
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
          <Button onClick={handleConfirmImport} disabled={isSubmitting || processedRecords.length === 0 || isProcessing} className="font-bold shadow-md px-8 h-10">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Confirm & Import {processedRecords.filter(r => r.isValid).length} Records
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}