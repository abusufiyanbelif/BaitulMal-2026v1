
'use client';

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
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { Beneficiary } from '@/lib/types';

interface ImportRecord {
  row: number;
  data: Partial<Beneficiary>;
  error?: string;
}

interface BeneficiaryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newRecords: ImportRecord[];
  duplicateRecords: ImportRecord[];
  onConfirm: () => void;
  isImporting: boolean;
}

export function BeneficiaryImportDialog({
  open,
  onOpenChange,
  newRecords,
  duplicateRecords,
  onConfirm,
  isImporting,
}: BeneficiaryImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Verification</DialogTitle>
          <DialogDescription>
            Review the summary of your import. Duplicates will be skipped automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">New Beneficiaries</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{newRecords.length}</div>
                <p className="text-xs text-muted-foreground">records will be imported.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Duplicates Found</CardTitle>
                <XCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{duplicateRecords.length}</div>
                <p className="text-xs text-muted-foreground">records will be skipped.</p>
              </CardContent>
            </Card>
          </div>

          {duplicateRecords.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                View {duplicateRecords.length} Duplicates
              </summary>
              <ScrollArea className="h-64 mt-2 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicateRecords.map((record) => (
                      <TableRow key={record.row}>
                        <TableCell>{record.row}</TableCell>
                        <TableCell>{record.data.name}</TableCell>
                        <TableCell>{record.data.phone}</TableCell>
                        <TableCell>{record.data.address}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </details>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isImporting || newRecords.length === 0}>
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm & Import {newRecords.length} Records
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    