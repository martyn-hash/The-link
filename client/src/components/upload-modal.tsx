import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Download, FileText, X } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('csvFile', file);
      
      const response = await fetch('/api/projects/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Successfully uploaded ${data.projects?.length || 0} projects`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setSelectedFile(null);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload CSV file",
        variant: "destructive",
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Invalid File",
          description: "Please select a CSV file",
          variant: "destructive",
        });
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to upload",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate(selectedFile);
  };

  const downloadTemplate = () => {
    const csvContent = `Client Name,Project Description,Bookkeeper Email,Client Manager Email,Priority,Due Date
Acme Corp Ltd,Monthly bookkeeping reconciliation,bookkeeper@example.com,manager@example.com,medium,2024-01-31
TechStart Inc,Quarterly VAT return preparation,bookkeeper@example.com,manager@example.com,high,2024-02-15`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bookflow-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="upload-modal">
        <DialogHeader>
          <DialogTitle>Upload Project Data</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Format Requirements */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium text-foreground mb-2">CSV Format Requirements</h4>
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="mb-2">Your CSV file should contain the following columns:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Client Name (required)</li>
                  <li>Project Description (required)</li>
                  <li>Bookkeeper Email (required)</li>
                  <li>Client Manager Email (required)</li>
                  <li>Priority (optional: low, medium, high, urgent)</li>
                  <li>Due Date (optional: YYYY-MM-DD format)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* File Upload Area */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="file-input"
            />
            
            {!selectedFile ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                data-testid="drop-zone"
              >
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">
                  Drag and drop your CSV file here, or
                </p>
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  data-testid="button-choose-file"
                >
                  Choose File
                </Button>
              </div>
            ) : (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-8 h-8 text-primary" />
                      <div>
                        <p className="font-medium" data-testid="text-selected-file">
                          {selectedFile.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                      data-testid="button-remove-file"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              className="flex-1"
              data-testid="button-download-template"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="flex-1"
              data-testid="button-upload"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploadMutation.isPending ? "Uploading..." : "Upload Projects"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
