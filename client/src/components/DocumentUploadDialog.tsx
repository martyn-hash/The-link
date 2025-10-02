import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DocumentUploadDialogProps {
  clientId: string;
  source?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  objectPath: string;
}

export function DocumentUploadDialog({ clientId, source = "direct upload" }: DocumentUploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadNameError, setUploadNameError] = useState("");
  const fileObjectPathsRef = useRef<Map<string, string>>(new Map());
  const { toast } = useToast();

  const handleFilesUploaded = async (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const newFiles: UploadedFile[] = result.successful.map((file: any) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        objectPath: fileObjectPathsRef.current.get(file.id) || '',
      }));
      
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleSaveDocuments = async () => {
    // Validate upload name
    if (!uploadName.trim()) {
      setUploadNameError("Please enter an upload name before saving");
      return;
    }

    if (uploadedFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please upload at least one file",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    setUploadNameError("");
    let successCount = 0;
    let errorCount = 0;

    try {
      // First, create a folder for this upload batch
      const folder = await apiRequest('POST', `/api/clients/${clientId}/folders`, {
        name: uploadName.trim(),
        source,
      });

      console.log('Folder created successfully:', folder);

      // Then, create all documents and associate them with the folder
      for (const file of uploadedFiles) {
        try {
          if (!file.objectPath) {
            console.error('No object path found for file:', file.name);
            errorCount++;
            continue;
          }
          
          await apiRequest('POST', `/api/clients/${clientId}/documents`, {
            folderId: folder.id,
            uploadName: uploadName.trim(),
            source,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            objectPath: file.objectPath,
          });
          
          successCount++;
        } catch (error) {
          console.error('Error saving document metadata:', error);
          errorCount++;
        }
      }

      setIsSaving(false);
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'documents'] });

      if (successCount > 0) {
        toast({
          title: 'Success',
          description: `${successCount} document${successCount > 1 ? 's' : ''} uploaded successfully${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        });
        setIsOpen(false);
        setUploadName("");
        setUploadedFiles([]);
        setUploadNameError("");
        fileObjectPathsRef.current.clear();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to save document metadata',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create document folder';
      setIsSaving(false);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        // Reset state when closing
        setUploadName("");
        setUploadedFiles([]);
        setUploadNameError("");
        fileObjectPathsRef.current.clear();
      }
    }}>
      <DialogTrigger asChild>
        <Button data-testid="button-open-upload-dialog">
          <Upload className="w-4 h-4 mr-2" />
          Upload Documents
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Upload className="w-5 h-5" />
            Upload Documents
          </DialogTitle>
          <DialogDescription>
            Select files to upload, then give them a descriptive name to help identify this batch later.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* File Upload Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Select Files</Label>
            <ObjectUploader
              maxNumberOfFiles={10}
              maxFileSize={10485760}
              onGetUploadParameters={async (file) => {
                const response = await fetch('/api/objects/upload', {
                  method: 'POST',
                  credentials: 'include',
                });
                if (!response.ok) {
                  throw new Error('Failed to get upload URL');
                }
                const data = await response.json();
                
                fileObjectPathsRef.current.set(file.id, data.objectPath);
                
                return {
                  method: 'PUT' as const,
                  url: data.uploadURL,
                };
              }}
              onComplete={handleFilesUploaded}
              buttonClassName="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Select Files to Upload
            </ObjectUploader>
            <p className="text-xs text-muted-foreground">
              You can upload up to 10 files (max 10MB each)
            </p>
          </div>

          {/* Show uploaded files */}
          {uploadedFiles.length > 0 && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-900">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} uploaded successfully
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Name Section */}
          <div className="space-y-3">
            <Label htmlFor="upload-name" className="text-base font-semibold">
              Upload Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="upload-name"
              placeholder="e.g., ID Documents, Bank Statements, etc."
              value={uploadName}
              onChange={(e) => {
                setUploadName(e.target.value);
                if (uploadNameError) setUploadNameError("");
              }}
              data-testid="input-upload-name"
              disabled={isSaving}
              className={uploadNameError ? "border-red-500" : ""}
            />
            {uploadNameError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{uploadNameError}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-xs text-muted-foreground">
                Give this batch a name to help identify these documents later
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
              data-testid="button-cancel-upload"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveDocuments}
              disabled={isSaving || uploadedFiles.length === 0}
              data-testid="button-save-documents"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save Documents
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
