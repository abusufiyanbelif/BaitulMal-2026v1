
'use client';

import { useState, type ChangeEvent, useEffect } from 'react';
import { UploadCloud, X, File as FileIcon } from 'lucide-react';
import Image from 'next/image';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface FileUploaderProps {
  onFilesChange: (files: File[]) => void;
  acceptedFileTypes?: string;
  multiple?: boolean;
}

export function FileUploader({
  onFilesChange,
  acceptedFileTypes = 'image/*,application/pdf',
  multiple = false,
}: FileUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [activePreview, setActivePreview] = useState<string | null>(null);

  useEffect(() => {
    // This effect handles cleanup of object URLs
    return () => {
      previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      const fileArray = Array.from(selectedFiles);
      const newPreviews = fileArray.map(file => URL.createObjectURL(file));

      if (multiple) {
          const allFiles = [...files, ...fileArray];
          const allPreviews = [...previews, ...newPreviews];
          setFiles(allFiles);
          setPreviews(allPreviews);
          onFilesChange(allFiles);
          if (!activePreview) {
            setActivePreview(newPreviews[0]);
          }
      } else {
          // Revoke old previews before setting new ones
          previews.forEach(url => URL.revokeObjectURL(url));
          setFiles(fileArray);
          setPreviews(newPreviews);
          onFilesChange(fileArray);
          setActivePreview(newPreviews[0]);
      }
    }
  };
  
  const handleRemoveFile = (index: number) => {
    // Revoke the specific object URL to prevent memory leaks
    URL.revokeObjectURL(previews[index]);

    const newFiles = files.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);

    setFiles(newFiles);
    setPreviews(newPreviews);
    onFilesChange(newFiles);

    if (activePreview === previews[index]) {
        setActivePreview(newPreviews.length > 0 ? newPreviews[0] : null);
    }
  };

  const handleReset = () => {
    previews.forEach(url => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviews([]);
    onFilesChange([]);
    setActivePreview(null);
  };

  const isPdf = (previewUrl: string, file: File) => {
    return file.type === 'application/pdf' || (previewUrl.startsWith('blob:') && file.name.endsWith('.pdf'));
  };

  const descriptionText = acceptedFileTypes.includes('image') && acceptedFileTypes.includes('pdf')
    ? 'Any image file or PDF'
    : acceptedFileTypes.includes('image')
    ? 'Image files (PNG, JPG, etc.)'
    : acceptedFileTypes.includes('pdf')
    ? 'PDF documents'
    : 'Supported files';

  if (files.length > 0) {
    return (
      <div className="flex flex-col items-center gap-4 w-full">
        <div 
          className="relative w-full max-w-sm h-64 border-2 border-dashed rounded-lg overflow-hidden bg-secondary/20 flex items-center justify-center"
        >
          {activePreview && previews.indexOf(activePreview) !== -1 ? (
            isPdf(activePreview, files[previews.indexOf(activePreview)]) ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <FileIcon className="w-16 h-16" />
                <p className="mt-2 text-sm font-medium break-all">{files[previews.indexOf(activePreview)]?.name}</p>
              </div>
            ) : (
              <Image 
                src={activePreview} 
                alt="File preview" 
                fill 
                sizes="(max-width: 384px) 100vw, 384px"
                className="object-contain"
                data-ai-hint="document preview"
              />
            )
          ) : (
             <p className="text-muted-foreground">No file selected for preview</p>
          )}
        </div>

        {multiple && previews.length > 1 && (
          <div className="w-full flex flex-wrap gap-2 justify-center">
            {previews.map((preview, index) => (
              <Card 
                key={preview} 
                className={cn(
                  "p-1 w-20 h-20 relative cursor-pointer", 
                  activePreview === preview && "ring-2 ring-primary"
                )}
                onClick={() => setActivePreview(preview)}
              >
                <CardContent className="p-0 relative w-full h-full flex items-center justify-center bg-secondary/20 rounded-md overflow-hidden">
                  {isPdf(preview, files[index]) ? (
                    <FileIcon className="w-8 h-8 text-muted-foreground" />
                  ) : (
                    <Image src={preview} alt={files[index]?.name || ''} fill sizes="100vw" className="object-cover" />
                  )}
                  <Button 
                    variant="destructive" 
                    size="icon" 
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(index);
                    }}
                  >
                    <X className="h-3 w-3"/>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-sm text-muted-foreground">{multiple ? `${files.length} files selected` : (files[0]?.name || 'No file selected')}</p>
        <div className="flex gap-2">
            <label htmlFor="file-reupload" className={cn(buttonVariants({ variant: 'outline' }), "cursor-pointer")}>
                {multiple ? 'Add more files' : 'Change file'}
                <Input
                    id="file-reupload"
                    type="file"
                    className="hidden"
                    onChange={handleFilesChange}
                    accept={acceptedFileTypes}
                    multiple={multiple}
                />
            </label>
            <Button onClick={handleReset} variant="outline">
              Clear all files
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <label
        htmlFor="file-upload"
        className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary transition-colors"
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
          <p className="mb-2 text-sm text-center text-muted-foreground">
            <span className="font-semibold text-primary">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">{descriptionText}</p>
        </div>
        <Input
          id="file-upload"
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFilesChange}
          accept={acceptedFileTypes}
          multiple={multiple}
        />
      </label>
    </div>
  );
}

  