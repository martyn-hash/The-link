import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
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
      // Parse actual backend response format
      const created = data.details?.newProjectsCreated || 0;
      const archived = data.details?.existingProjectsArchived || 0;
      const existing = data.details?.alreadyExistsCount || 0;
      const totalProcessed = created + archived + existing;
      
      let description;
      if (totalProcessed === 0) {
        description = "No projects were processed from the uploaded file";
      } else {
        const parts = [];
        if (created > 0) parts.push(`${created} new project${created > 1 ? 's' : ''} created`);
        if (archived > 0) parts.push(`${archived} project${archived > 1 ? 's' : ''} archived`);
        if (existing > 0) parts.push(`${existing} project${existing > 1 ? 's' : ''} already existed`);
        description = `Successfully uploaded: ${parts.join(', ')}`;
      }
      
      toast({
        title: "Upload Complete",
        description,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setSelectedFile(null);
      onClose();
    },
    onError: (error: any) => {
      let title = "Upload Failed";
      let description = error.message || "Failed to upload CSV file";
      
      // Handle specific validation errors
      if (error.message?.includes('Invalid project month format')) {
        title = "Invalid Date Format";
        description = "Project Month must be in DD/MM/YYYY format (e.g., 15/01/2025). Please check your CSV file and try again.";
      } else if (error.message?.includes('duplicate client names')) {
        title = "Duplicate Clients";
        description = "Your CSV contains duplicate client names. Please ensure each client appears only once and try again.";
      } else if (error.message?.includes('Invalid project description')) {
        title = "Invalid Project Description";
        description = "Some project descriptions in your CSV are not configured in the system. Please add them in Settings > Project Descriptions first.";
      } else if (error.message?.includes('Missing required columns')) {
        title = "Missing Columns";
        description = "Your CSV file is missing required columns. Please download the template and ensure all required fields are included.";
      }
      
      toast({
        title,
        description,
        variant: "friendly" as const,
        duration: 10000,
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
          title: "Wrong File Type",
          description: "Please select a CSV file - that's the spreadsheet format we need.",
          variant: "friendly" as const,
          duration: 5000,
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
        description: "Please choose a CSV file first, then click upload.",
        variant: "friendly" as const,
        duration: 5000,
      });
      return;
    }
    
    uploadMutation.mutate(selectedFile);
  };

  const downloadTemplate = () => {
    const csvContent = `Client Name,Project Description,Bookkeeper Email,Client Manager Email,Priority,Due Date,Project Month
Acme Corp Ltd,Monthly Bookkeeping,bookkeeper@example.com,manager@example.com,medium,2024-01-31,15/01/2025
TechStart Inc,Quarterly VAT Return,bookkeeper@example.com,manager@example.com,high,2024-02-15,28/02/2025
Global Solutions,Annual Accounts,bookkeeper@example.com,manager@example.com,urgent,2024-03-31,31/03/2025`;
    
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
                  <li>Project Description (required - must match a configured Project Type from Settings)</li>
                  <li>Bookkeeper Email (required)</li>
                  <li>Client Manager Email (required)</li>
                  <li>Priority (optional: low, medium, high, urgent)</li>
                  <li>Due Date (optional: YYYY-MM-DD format)</li>
                  <li>Project Month (required: DD/MM/YYYY format, e.g., 15/01/2025)</li>
                </ul>
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                  <p className="text-blue-800 dark:text-blue-200 text-xs">
                    <strong>Note:</strong> Project Month uses UK date format (DD/MM/YYYY). 
                    Each client can only appear once per upload. Project Description must exactly match a configured Project Type name.
                  </p>
                </div>
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
