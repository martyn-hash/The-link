import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DocumentUploadDialogProps {
  clientId: string;
  source?: string;
}

export function DocumentUploadDialog({ clientId, source = "direct upload" }: DocumentUploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileObjectPathsRef = useRef<Map<string, string>>(new Map());
  const { toast } = useToast();

  const handleUploadComplete = async (result: any) => {
    if (!uploadName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an upload name before uploading files",
        variant: "destructive",
      });
      return;
    }

    if (result.successful && result.successful.length > 0) {
      setIsUploading(true);
      let successCount = 0;
      let errorCount = 0;

      for (const file of result.successful) {
        try {
          const objectPath = fileObjectPathsRef.current.get(file.id) || '';
          
          if (!objectPath) {
            console.error('No object path found for file:', file.name);
            errorCount++;
            continue;
          }
          
          await apiRequest('POST', `/api/clients/${clientId}/documents`, {
            uploadName: uploadName.trim(),
            source,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || 'application/octet-stream',
            objectPath,
          });
          
          successCount++;
        } catch (error) {
          console.error('Error saving document metadata:', error);
          errorCount++;
        }
      }

      setIsUploading(false);
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'documents'] });

      if (successCount > 0) {
        toast({
          title: 'Success',
          description: `${successCount} document${successCount > 1 ? 's' : ''} uploaded successfully${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        });
        setIsOpen(false);
        setUploadName("");
        fileObjectPathsRef.current.clear();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to save document metadata',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-open-upload-dialog">
          <Upload className="w-4 h-4 mr-2" />
          Upload Documents
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Give this upload a descriptive name and select one or more files to upload.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="upload-name">Upload Name *</Label>
            <Input
              id="upload-name"
              placeholder="e.g., ID Documents, Bank Statements, etc."
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              data-testid="input-upload-name"
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground">
              This name will help you identify this set of documents later.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Select Files</Label>
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
              onComplete={handleUploadComplete}
              buttonClassName="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Select Files to Upload
            </ObjectUploader>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
