
'use client';

import { useState } from 'react';
import { CreditCard, Loader2, Download, Wand2, ToyBrick, Trash2 } from 'lucide-react';
import type { ExtractBillingDataOutput } from '@/ai/flows/extract-billing-data';
import type { ExtractDynamicFormOutput } from '@/ai/flows/extract-dynamic-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from './file-uploader';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DynamicFields } from './dynamic-fields';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

function ResultDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <p className="font-code bg-secondary p-3 rounded-md text-foreground whitespace-pre-wrap">{value || 'N/A'}</p>
    </div>
  );
}

export function BillingExtractor() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [billingResult, setBillingResult] = useState<ExtractBillingDataOutput | null>(null);
  const [fieldsResult, setFieldsResult] = useState<ExtractDynamicFormOutput | null>(null);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'pdf'>('image');
  const { toast } = useToast();

  const processFile = (file: File, apiPath: string, loadingSetter: (loading: boolean) => void, resultSetter: (result: any) => void, apiBodyKey: string) => {
    loadingSetter(true);
    resultSetter(null);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUri = e.target?.result as string;
      if (!dataUri) {
        toast({ title: "Read Error", description: "Could not read the uploaded file.", variant: "destructive" });
        loadingSetter(false);
        return;
      }
      
      try {
        const apiResponse = await fetch(apiPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [apiBodyKey]: dataUri }),
        });

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            throw new Error(errorData.error || 'The server returned an error.');
        }

        const response = await apiResponse.json();
        resultSetter(response);

      } catch (error: any) {
        console.warn(`${apiPath} failed:`, error);
        toast({ title: 'Extraction Failed', description: error.message || 'Could not process the document.', variant: 'destructive' });
      } finally {
        loadingSetter(false);
      }
    };
    reader.onerror = () => {
        toast({ title: "File Error", description: "An error occurred while reading the file.", variant: "destructive" });
        loadingSetter(false);
    };
    reader.readAsDataURL(file);
  }

  const handleScanBilling = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: 'Error', description: `Please upload an ${uploadType} first.`, variant: 'destructive' });
      return;
    }
    toast({ title: "Extracting bill data...", description: "Please wait." });
    processFile(uploadedFiles[0], '/api/extract-billing', setIsLoadingBilling, setBillingResult, 'photoDataUri');
  };
  
  const handleGetFields = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: 'Error', description: `Please upload an ${uploadType} first.`, variant: 'destructive' });
      return;
    }
    toast({ title: "Extracting fields...", description: "Please wait." });
    processFile(uploadedFiles[0], '/api/extract-dynamic-form', setIsLoadingFields, setFieldsResult, 'photoDataUri');
  };

  const handleClear = () => {
    setUploadedFiles([]);
    setBillingResult(null);
    setFieldsResult(null);
  };
  
  const getFullText = () => {
    if (!billingResult) return '';
    const itemsText = billingResult.purchasedItems
      .map(
        (item) =>
          `${item.item} (Qty: ${item.quantity || 'N/A'}, Unit: ${
            item.unitPrice ? `₹${item.unitPrice.toFixed(2)}` : 'N/A'
          }, Total: ₹${item.totalPrice.toFixed(2)})`
      )
      .join('\n');
    return `Vendor Information: ${billingResult.vendorInformation}\nDates: ${billingResult.dates}\nAmounts: ${billingResult.amounts}\n\nPurchased Items:\n${itemsText}`;
  };

  const handleDownloadBilling = () => {
    const text = getFullText();
    if (!text) return;
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'billing_data.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  
  const isLoading = isLoadingBilling || isLoadingFields;
  const acceptedFileTypes = uploadType === 'image' ? 'image/*' : 'application/pdf';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-6 h-6" />
              Upload Bill or Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <RadioGroup
                defaultValue="image"
                onValueChange={(value: 'image' | 'pdf') => {
                    setUploadType(value);
                    handleClear();
                }}
                className="grid grid-cols-2 gap-4 w-full mb-4"
                value={uploadType}
                >
                <div>
                    <RadioGroupItem value="image" id="image-billing" className="peer sr-only" />
                    <Label
                    htmlFor="image-billing"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                    Image
                    </Label>
                </div>
                <div>
                    <RadioGroupItem value="pdf" id="pdf-billing" className="peer sr-only" />
                    <Label
                    htmlFor="pdf-billing"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                    PDF
                    </Label>
                </div>
            </RadioGroup>

            <FileUploader 
                onFilesChange={setUploadedFiles}
                acceptedFileTypes={acceptedFileTypes}
                key={uploadType}
            />

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button onClick={handleScanBilling} disabled={uploadedFiles.length === 0 || isLoading} className="w-full">
                {isLoadingBilling ? <Loader2 className="animate-spin" /> : `Extract Bill Data`}
              </Button>
              <Button onClick={handleGetFields} disabled={uploadedFiles.length === 0 || isLoading} className="w-full">
                {isLoadingFields ? <Loader2 className="animate-spin" /> : 'Get Fields'}
              </Button>
            </div>
             {uploadedFiles.length > 0 && (
                <Button onClick={handleClear} variant="outline" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" /> Clear
                </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-6 h-6" />
              Extracted Bill Data
            </CardTitle>
            {billingResult && (
              <Button variant="outline" size="sm" onClick={handleDownloadBilling}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingBilling && (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}
            {billingResult && (
              <div className="space-y-4">
                <ResultDisplay label="Vendor Information" value={billingResult.vendorInformation} />
                <ResultDisplay label="Dates" value={billingResult.dates} />
                <ResultDisplay label="Amounts" value={billingResult.amounts} />
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Purchased Items</h3>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price (₹)</TableHead>
                          <TableHead className="text-right">Total (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billingResult.purchasedItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.item}</TableCell>
                            <TableCell className="text-right">{item.quantity ?? 'N/A'}</TableCell>
                            <TableCell className="text-right">
                              {item.unitPrice ? `₹${item.unitPrice.toFixed(2)}` : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">₹{item.totalPrice.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
            {!isLoadingBilling && !billingResult && (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>Your results will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <DynamicFields 
        isLoading={isLoadingFields} 
        result={fieldsResult} 
        setResult={setFieldsResult} 
      />
    </div>
  );
}
