import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { FileText, Upload, Download, Trash2, Eye, File, Image, Video, Music, FileSpreadsheet, FileType } from 'lucide-react';
import { portalApi } from '@/lib/portalApi';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { formatDistanceToNow } from 'date-fns';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import PortalBottomNav from '@/components/portal-bottom-nav';

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  objectPath: string;
  uploadedAt: string;
  clientId: string;
  clientPortalUserId: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const allowedTypes = [
  'image/png', 
  'image/jpeg', 
  'image/jpg',
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4',
  'audio/mpeg', 
  'audio/mp3'
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType.startsWith('video/')) return Video;
  if (fileType.startsWith('audio/')) return Music;
  if (fileType.includes('pdf')) return FileText;
  if (fileType.includes('spreadsheet') || fileType.includes('csv')) return FileSpreadsheet;
  if (fileType.includes('word')) return FileType;
  return File;
}

export default function PortalDocuments() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = usePortalAuth();
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/portal/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/portal/documents'],
    queryFn: () => portalApi.documents.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => portalApi.documents.delete(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal/documents'] });
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Error',
        description: 'File size must be less than 25MB',
        variant: 'destructive',
      });
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Error',
        description: 'File type not allowed. Allowed types: PNG, JPEG, PDF, CSV, XLSX, DOCX, MP4, MP3',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const uploadUrlData = await portalApi.documents.getUploadUrl(
        selectedFile.name,
        selectedFile.type,
        selectedFile.size
      );

      const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }

      await portalApi.documents.confirmUpload(
        uploadUrlData.objectPath,
        selectedFile.name,
        selectedFile.type,
        selectedFile.size
      );

      queryClient.invalidateQueries({ queryKey: ['/api/portal/documents'] });
      toast({
        title: 'Success',
        description: 'Document uploaded successfully',
      });

      setUploadDialogOpen(false);
      setSelectedFile(null);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreview = async (document: Document) => {
    try {
      setPreviewDocument(document);
      const { downloadUrl } = await portalApi.documents.getDownloadUrl(document.id);
      setPreviewUrl(downloadUrl);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load document preview',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const { downloadUrl } = await portalApi.documents.getDownloadUrl(document.id);
      window.open(downloadUrl, '_blank');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download document',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (documentId: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(documentId);
    }
  };

  const renderPreview = () => {
    if (!previewDocument || !previewUrl) return null;

    const isImage = previewDocument.fileType.startsWith('image/');
    const isPdf = previewDocument.fileType.includes('pdf');
    const isVideo = previewDocument.fileType.startsWith('video/');
    const isAudio = previewDocument.fileType.startsWith('audio/');

    return (
      <Dialog open={!!previewDocument} onOpenChange={() => { setPreviewDocument(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{previewDocument.fileName}</DialogTitle>
            <DialogDescription>
              {formatFileSize(previewDocument.fileSize)} • Uploaded {formatDistanceToNow(new Date(previewDocument.uploadedAt), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {isImage && (
              <img src={previewUrl} alt={previewDocument.fileName} className="w-full h-auto rounded-lg" />
            )}
            {isPdf && (
              <iframe src={previewUrl} className="w-full h-[600px] rounded-lg" title={previewDocument.fileName} />
            )}
            {isVideo && (
              <video controls className="w-full rounded-lg" src={previewUrl}>
                Your browser does not support the video tag.
              </video>
            )}
            {isAudio && (
              <audio controls className="w-full" src={previewUrl}>
                Your browser does not support the audio tag.
              </audio>
            )}
            {!isImage && !isPdf && !isVideo && !isAudio && (
              <div className="text-center py-8">
                <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Preview not available for this file type</p>
                <Button onClick={() => handleDownload(previewDocument)} className="mt-4" data-testid="button-download-preview">
                  <Download className="h-4 w-4 mr-2" />
                  Download to view
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Documents</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">Upload and manage your files</p>
              </div>
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-upload">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Document</DialogTitle>
                    <DialogDescription>
                      Choose a file to upload (max 25MB). Allowed types: PNG, JPEG, PDF, CSV, XLSX, DOCX, MP4, MP3
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-4">
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      accept={allowedTypes.join(',')}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200 dark:hover:file:bg-blue-800"
                      data-testid="input-file"
                    />
                    {selectedFile && (
                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    )}
                    <div className="mt-6 flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setSelectedFile(null); }} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button onClick={handleUpload} disabled={!selectedFile || isUploading} data-testid="button-confirm-upload">
                        {isUploading ? 'Uploading...' : 'Upload'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {documentsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : documents && documents.length > 0 ? (
            documents.map((doc: Document) => {
              const FileIcon = getFileIcon(doc.fileType);
              
              return (
                <Card key={doc.id} data-testid={`document-${doc.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <FileIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate" data-testid={`text-filename-${doc.id}`}>
                            {doc.fileName}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span>{formatFileSize(doc.fileSize)}</span>
                            <span>•</span>
                            <span className="text-xs">
                              {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePreview(doc)}
                          data-testid={`button-preview-${doc.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(doc)}
                          data-testid={`button-download-${doc.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc.id)}
                          data-testid={`button-delete-${doc.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-12" data-testid="empty-state">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No documents yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Upload your first document to get started</p>
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-upload-empty">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {renderPreview()}
      <PortalBottomNav />
    </div>
  );
}
