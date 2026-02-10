
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Info, FileWarning, Loader2, XCircle } from 'lucide-react';
import type { Beneficiary } from '@/lib/types';

export interface ProcessedRecord {
  row: number;
  data: Partial<Beneficiary>;
  status: 'new' | 'duplicate-id' | 'duplicate-name-phone' | 'invalid';
  reason?: string;
}

interface BeneficiaryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processedRecords: ProcessedRecord[];
  onConfirm: (recordsToImport: ProcessedRecord[]) => void;
  isImporting: boolean;
}

export function BeneficiaryImportDialog({
  open,
  onOpenChange,
  processedRecords,
  onConfirm,
  isImporting,
}: BeneficiaryImportDialogProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const { newRecords, duplicateRecords, invalidRecords } = useMemo(() => {
    return processedRecords.reduce(
      (acc, record) => {
        if (record.status === 'new') {
          acc.newRecords.push(record);
        } else if (record.status === 'invalid') {
          acc.invalidRecords.push(record);
        } else {
          acc.duplicateRecords.push(record);
        }
        return acc;
      },
      { 
        newRecords: [] as ProcessedRecord[], 
        duplicateRecords: [] as ProcessedRecord[],
        invalidRecords: [] as ProcessedRecord[],
      }
    );
  }, [processedRecords]);

  useEffect(() => {
    if (open) {
      // Pre-select all new records by default
      const newRecordRows = new Set(newRecords.map(r => r.row));
      setSelectedRows(newRecordRows);
    }
  }, [open, newRecords]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedRows(checked ? new Set(newRecords.map(r => r.row)) : new Set());
  };

  const handleRowSelect = (rowNumber: number, checked: boolean) => {
    const newSelection = new Set(selectedRows);
    if (checked) {
      newSelection.add(rowNumber);
    } else {
      newSelection.delete(rowNumber);
    }
    setSelectedRows(newSelection);
  };
  
  const handleConfirmClick = () => {
    const recordsToImport = processedRecords.filter(r => selectedRows.has(r.row));
    onConfirm(recordsToImport);
  };

  const isAllNewSelected = newRecords.length > 0 && selectedRows.size === newRecords.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Verification</DialogTitle>
          <DialogDescription>
            Review the summary of your import. Only valid new records can be selected for import.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">New Records</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{newRecords.length}</div>
                <p className="text-xs text-muted-foreground">records ready to be imported.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Invalid Records</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invalidRecords.length}</div>
                <p className="text-xs text-muted-foreground">records have missing data and will be skipped.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Duplicates Found</CardTitle>
                <FileWarning className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{duplicateRecords.length}</div>
                <p className="text-xs text-muted-foreground">records already exist and will be skipped.</p>
              </CardContent>
            </Card>
          </div>

        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px]">
                    <div className="flex items-center">
                      <Checkbox
                        id="select-all-import"
                        checked={isAllNewSelected}
                        onCheckedChange={handleSelectAll}
                        disabled={newRecords.length === 0}
                      />
                      <Label htmlFor="select-all-import" className="ml-2">Row #</Label>
                    </div>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRecords.map((record) => (
                  <TableRow key={record.row}>
                    <TableCell>
                      <div className="flex items-center">
                        <Checkbox
                          checked={selectedRows.has(record.row)}
                          onCheckedChange={(checked) => handleRowSelect(record.row, !!checked)}
                          disabled={record.status !== 'new'}
                        />
                        <span className="ml-2">{record.row}</span>
                      </div>
                    </TableCell>
                    <TableCell>{record.data.name}</TableCell>
                    <TableCell>{record.data.phone}</TableCell>
                    <TableCell>
                      <Badge variant={
                        record.status === 'new' ? 'success' : 
                        record.status === 'invalid' ? 'destructive' :
                        'outline'
                      }>
                        {record.status.replace('-id','').replace('-name-phone','')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{record.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleConfirmClick} disabled={isImporting || selectedRows.size === 0}>
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm & Import {selectedRows.size} Records
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
