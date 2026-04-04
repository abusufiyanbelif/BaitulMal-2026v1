
'use client';

import { useState } from 'react';
import { User, Loader2, Download, Wand2, ToyBrick, Trash2 } from 'lucide-react';
import type { ExtractKeyInfoFromAadhaarOutput } from '@/ai/flows/extract-key-info-identity';
import type { ExtractDynamicFormOutput } from '@/ai/flows/extract-dynamic-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from './file-uploader';
import { Skeleton } from '@/components/ui/skeleton';
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

export function IdentityExtractor() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [infoResult, setInfoResult] = useState<ExtractKeyInfoFromAadhaarOutput | null>(null);
  const [fieldsResult, setFieldsResult] = useState<ExtractDynamicFormOutput | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
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

  const handleScanInfo = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: 'Error', description: `Please upload an ${uploadType} first.`, variant: 'destructive' });
      return;
    }
    toast({ title: "Extracting info...", description: "Please wait." });
    processFile(uploadedFiles[0], '/api/scan-id', setIsLoadingInfo, setInfoResult, 'photoDataUri');
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
    setInfoResult(null);
    setFieldsResult(null);
  };

  const getFullText = () => {
    if (!infoResult) return '';
    return `Name: ${infoResult.name}\nDate of Birth: ${infoResult.dob}\nGender: ${infoResult.gender}\nAadhaar Number: ${infoResult.aadhaarNumber}\nAddress: ${infoResult.address}`;
  };

  const handleDownloadInfo = () => {
    const text = getFullText();
    if (!text) return;
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'aadhaar_info.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  
  const isLoading = isLoadingInfo || isLoadingFields;
  const acceptedFileTypes = uploadType === 'image' ? 'image/*' : 'application/pdf';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-6 h-6" />
              Upload Aadhaar Card
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
                <RadioGroupItem value="image" id="image-id" className="peer sr-only" />
                <Label
                  htmlFor="image-id"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  Image
                </Label>
              </div>
              <div>
                <RadioGroupItem value="pdf" id="pdf-id" className="peer sr-only" />
                <Label
                  htmlFor="pdf-id"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  Pdf
                </Label>
              </div>
            </RadioGroup>
            
            <FileUploader 
                onFilesChange={setUploadedFiles}
                acceptedFileTypes={acceptedFileTypes}
                key={uploadType}
            />
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button onClick={handleScanInfo} disabled={uploadedFiles.length === 0 || isLoading} className="w-full">
                {isLoadingInfo ? <Loader2 className="animate-spin" /> : `Extract Info`}
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
              Extracted Information
            </CardTitle>
            {infoResult && (
              <Button variant="outline" size="sm" onClick={handleDownloadInfo}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingInfo && (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}
            {infoResult && (
              <div className="space-y-4">
                <ResultDisplay label="Full Name" value={infoResult.name} />
                <ResultDisplay label="Date of Birth" value={infoResult.dob} />
                <ResultDisplay label="Gender" value={infoResult.gender} />
                <ResultDisplay label="Aadhaar Number" value={infoResult.aadhaarNumber} />
                <ResultDisplay label="Address" value={infoResult.address} />
              </div>
            )}
            {!isLoadingInfo && !infoResult && (
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
