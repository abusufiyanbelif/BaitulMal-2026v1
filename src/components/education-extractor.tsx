
'use client';

import { useState } from 'react';
import { BookUser, Loader2, Download, Wand2, ToyBrick, Trash2, FileText } from 'lucide-react';
import type { ExtractEducationFindingsOutput } from '@/ai/flows/extract-education-findings';
import type { ExtractDynamicFormOutput } from '@/ai/flows/extract-dynamic-form';
import type { CreateEducationStoryOutput } from '@/ai/flows/create-education-story';

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

interface EducationExtractorProps {
  enableStoryCreator?: boolean;
}

export function EducationExtractor({ enableStoryCreator = false }: EducationExtractorProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [educationResult, setEducationResult] = useState<ExtractEducationFindingsOutput | null>(null);
  const [fieldsResult, setFieldsResult] = useState<ExtractDynamicFormOutput | null>(null);
  const [storyResult, setStoryResult] = useState<CreateEducationStoryOutput | null>(null);
  const [isLoadingEducation, setIsLoadingEducation] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [uploadType, setUploadType] = useState<'image' | 'pdf'>('image');
  const { toast } = useToast();

  const handleFileSelection = (files: File[]) => {
    setUploadedFiles(files);
    setEducationResult(null);
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

  const handleScanEducation = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: 'Error', description: `Please upload at least one ${uploadType}.`, variant: 'destructive' });
      return;
    }
    toast({ title: "Analyzing document...", description: "Please wait." });
    processFile(uploadedFiles[0], '/api/extract-education', setIsLoadingEducation, setEducationResult, 'reportDataUri');
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

      const apiResponse = await fetch('/api/create-education-story', {
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
          description: 'It looks like you uploaded non-educational documents. A general summary has been created, but for best results, please use academic records.',
          variant: 'default',
        });
      }
    } catch (error: any) {
      console.warn("Story creation failed:", error);
      toast({ title: 'Story Creation Failed', description: error.message || 'Could not generate the academic summary.', variant: 'destructive' });
    } finally {
      setIsLoadingStory(false);
    }
  };

  const handleClear = () => {
    setUploadedFiles([]);
    setEducationResult(null);
    setFieldsResult(null);
    setStoryResult(null);
  };
  
  const getFullText = () => {
    if (!educationResult) return '';
    const achievementsText = educationResult.achievements.map(f => `- ${f.achievement}: ${f.details}`).join('\n');
    return `Institution: ${educationResult.institution}\nDegree: ${educationResult.degree}\n\nAchievements:\n${achievementsText}`;
  };
  
  const handleDownloadEducation = () => {
    const text = getFullText();
    if (!text) return;
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'education_findings.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  
  const isLoading = isLoadingEducation || isLoadingFields || isLoadingStory;
  const acceptedFileTypes = uploadType === 'image' ? 'image/*' : 'application/pdf';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookUser className="w-6 h-6" />
              Upload Educational Document(s)
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
                    <RadioGroupItem value="image" id="image-education" className="peer sr-only" />
                    <Label
                    htmlFor="image-education"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                    Image
                    </Label>
                </div>
                <div>
                    <RadioGroupItem value="pdf" id="pdf-education" className="peer sr-only" />
                    <Label
                    htmlFor="pdf-education"
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
              <Button onClick={handleScanEducation} disabled={uploadedFiles.length === 0 || isLoading || enableStoryCreator} className="w-full">
                {isLoadingEducation ? <Loader2 className="animate-spin" /> : `Analyze Document`}
              </Button>
              <Button onClick={handleGetFields} disabled={uploadedFiles.length === 0 || isLoading || enableStoryCreator} className="w-full">
                {isLoadingFields ? <Loader2 className="animate-spin" /> : 'Get Fields'}
              </Button>
            </div>
            {enableStoryCreator && (
              <Button onClick={handleCreateStory} disabled={uploadedFiles.length === 0 || isLoading} className="w-full">
                {isLoadingStory ? <Loader2 className="animate-spin" /> : <><FileText className="mr-2 h-4 w-4"/> Create Academic Summary</>}
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
              Academic Analysis
            </CardTitle>
            {educationResult && (
              <Button variant="outline" size="sm" onClick={handleDownloadEducation}>
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingEducation && (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}
            {educationResult && (
              <div className="space-y-4">
                <ResultDisplay label="Institution" value={educationResult.institution} />
                <ResultDisplay label="Degree/Program" value={educationResult.degree} />
                <div>
                   <h3 className="text-sm font-medium text-muted-foreground mb-1">Key Achievements/Grades</h3>
                   <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Achievement</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {educationResult.achievements.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.achievement}</TableCell>
                            <TableCell>{item.details}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
            {!isLoadingEducation && !educationResult && (
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
                    Academic Summary
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
