
'use client';

import { useState } from 'react';
import { HeartPulse, Loader2, Download, Wand2, ToyBrick, Trash2, FileText } from 'lucide-react';
import type { ExtractMedicalFindingsOutput } from '@/ai/flows/extract-medical-findings';
import type { ExtractDynamicFormOutput } from '@/ai/flows/extract-dynamic-form';
import type { CreateLeadStoryOutput } from '@/ai/flows/create-lead-story';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from './file-uploader';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DynamicFields } from './dynamic-fields';
import { Textarea } from '@/components/ui/textarea';
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

interface MedicalExtractorProps {
  enableStoryCreator?: boolean;
}

export function MedicalExtractor({ enableStoryCreator = false }: MedicalExtractorProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [medicalResult, setMedicalResult] = useState<ExtractMedicalFindingsOutput | null>(null);
  const [fieldsResult, setFieldsResult] = useState<ExtractDynamicFormOutput | null>(null);
  const [storyResult, setStoryResult] = useState<CreateLeadStoryOutput | null>(null);
  const [isLoadingMedical, setIsLoadingMedical] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'pdf'>('image');
  const { toast } = useToast();

  const handleFileSelection = (files: File[]) => {
    setUploadedFiles(files);
    setMedicalResult(null);
    setFieldsResult(null);
    setStoryResult(null);
  };
  
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

  const handleScanMedical = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: 'Error', description: `Please upload at least one ${uploadType}.`, variant: 'destructive' });
      return;
    }
    toast({ title: "Analyzing report...", description: "Please wait." });
    processFile(uploadedFiles[0], '/api/extract-medical', setIsLoadingMedical, setMedicalResult, 'reportDataUri');
  };

  const handleGetFields = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: 'Error', description: `Please upload at least one ${uploadType}.`, variant: 'destructive' });
      return;
    }
    toast({ title: "Extracting fields...", description: "Please wait." });
    processFile(uploadedFiles[0], '/api/extract-dynamic-form', setIsLoadingFields, setFieldsResult, 'photoDataUri');
  };
  
  const handleCreateStory = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: 'Error', description: `Please upload at least one ${uploadType}.`, variant: 'destructive' });
      return;
    }
    setIsLoadingStory(true);
    setStoryResult(null);

    try {
      toast({ title: "Creating story...", description: "This may take a moment."});

      const filePromises = uploadedFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const dataUris = await Promise.all(filePromises);

      const apiResponse = await fetch('/api/create-lead-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportDataUris: dataUris }),
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || 'The server returned an error.');
      }
      
      const response = await apiResponse.json();
      setStoryResult(response);

      if (!response.isCorrectType) {
        toast({
          title: 'Document Mismatch',
          description: 'It looks like you uploaded non-medical documents. A general summary has been created, but for best results, please use medical reports.',
          variant: 'default',
        });
      }
    } catch (error: any) {
      console.warn("Story creation failed:", error);
      toast({ title: 'Story Creation Failed', description: error.message || 'Could not generate the lead story.', variant: 'destructive' });
    } finally {
      setIsLoadingStory(false);
    }
  };

  const handleClear = () => {
    setUploadedFiles([]);
    setMedicalResult(null);
    setFieldsResult(null);
    setStoryResult(null);
  };
  
  const getFullText = () => {
    if (!medicalResult) return '';
    const findingsText = medicalResult.findings.map(f => `- ${f.finding}: ${f.details}`).join('\n');
    return `Diagnosis: ${medicalResult.diagnosis}\n\nFindings:\n${findingsText}`;
  };
  
  const handleDownloadMedical = () => {
    const text = getFullText();
    if (!text) return;
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'medical_findings.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  
  const isLoading = isLoadingMedical || isLoadingFields || isLoadingStory;
  const acceptedFileTypes = uploadType === 'image' ? 'image/*' : 'application/pdf';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="w-6 h-6" />
              Upload Medical Report(s)
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
                    <RadioGroupItem value="image" id="image-medical" className="peer sr-only" />
                    <Label
                    htmlFor="image-medical"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                    Image
                    </Label>
                </div>
                <div>
                    <RadioGroupItem value="pdf" id="pdf-medical" className="peer sr-only" />
                    <Label
                    htmlFor="pdf-medical"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                    PDF
                    </Label>
                </div>
            </RadioGroup>

            <FileUploader 
                onFilesChange={handleFileSelection}
                acceptedFileTypes={acceptedFileTypes}
                key={uploadType}
                multiple={enableStoryCreator} 
            />

            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button onClick={handleScanMedical} disabled={uploadedFiles.length === 0 || isLoading || enableStoryCreator} className="w-full">
                {isLoadingMedical ? <Loader2 className="animate-spin" /> : `Analyze Report`}
              </Button>
              <Button onClick={handleGetFields} disabled={uploadedFiles.length === 0 || isLoading || enableStoryCreator} className="w-full">
                {isLoadingFields ? <Loader2 className="animate-spin" /> : 'Get Fields'}
              </Button>
            </div>
            {enableStoryCreator && (
              <Button onClick={handleCreateStory} disabled={uploadedFiles.length === 0 || isLoading} className="w-full">
                {isLoadingStory ? <Loader2 className="animate-spin" /> : <><FileText className="mr-2 h-4 w-4"/> Create Lead Story</>}
              </Button>
            )}
            {uploadedFiles.length > 0 && (
                <Button onClick={handleClear} variant="outline" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" /> Clear All
                </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-6 h-6" />
              Medical Analysis
            </CardTitle>
            {medicalResult && (
              <Button variant="outline" size="sm" onClick={handleDownloadMedical}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingMedical && (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}
            {medicalResult && (
              <div className="space-y-4">
                <ResultDisplay label="Diagnosis" value={medicalResult.diagnosis} />
                <div>
                   <h3 className="text-sm font-medium text-muted-foreground mb-1">Key Findings</h3>
                   <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Finding</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medicalResult.findings.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.finding}</TableCell>
                            <TableCell>{item.details}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
            {!isLoadingMedical && !medicalResult && (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p>Your structured analysis will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      { (enableStoryCreator && (isLoadingStory || storyResult)) &&
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    Lead Story Abstract
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoadingStory && <Skeleton className="h-48 w-full" />}
                {storyResult && (
                    <Textarea 
                        value={storyResult.story}
                        readOnly
                        rows={8}
                        className="font-code bg-secondary"
                    />
                )}
            </CardContent>
        </Card>
      }

      <DynamicFields 
        isLoading={isLoadingFields} 
        result={fieldsResult} 
        setResult={setFieldsResult} 
      />
    </div>
  );
}
