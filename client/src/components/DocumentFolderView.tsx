import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Folder, ChevronRight, Home, Download, Trash2, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";

interface DocumentFolderViewProps {
  clientId: string;
}

export default function DocumentFolderView({ clientId }: DocumentFolderViewProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string>("");
  const { toast } = useToast();

  // Fetch folders
  const { data: folders, isLoading: foldersLoading } = useQuery<any[]>({
    queryKey: ["/api/clients", clientId, "folders"],
    enabled: currentFolderId === null,
  });

  // Fetch all documents to find ungrouped ones
  const { data: allDocuments, isLoading: allDocumentsLoading } = useQuery<any[]>({
    queryKey: ["/api/clients", clientId, "documents"],
    enabled: currentFolderId === null,
  });

  // Fetch documents for current folder
  const { data: documents, isLoading: documentsLoading } = useQuery<any[]>({
    queryKey: ["/api/folders", currentFolderId, "documents"],
    enabled: currentFolderId !== null,
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      await apiRequest("DELETE", `/api/folders/${folderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "folders"] });
      toast({
        title: "Folder deleted",
        description: "The folder and all its documents have been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete folder",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders", currentFolderId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "folders"] });
      toast({
        title: "Document deleted",
        description: "The document has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const canPreview = (fileType: string): boolean => {
    const previewableTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp',
      'application/pdf'
    ];
    return previewableTypes.some(type => fileType.toLowerCase().includes(type.toLowerCase()));
  };

  // Breadcrumb navigation
  const renderBreadcrumb = () => (
    <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setCurrentFolderId(null);
          setCurrentFolderName("");
        }}
        data-testid="breadcrumb-home"
      >
        <Home className="w-4 h-4 mr-1" />
        All Folders
      </Button>
      {currentFolderName && (
        <>
          <ChevronRight className="w-4 h-4" />
          <span className="font-medium text-foreground" data-testid="breadcrumb-current">
            {currentFolderName}
          </span>
        </>
      )}
    </div>
  );

  // Filter ungrouped documents (legacy or documents without folders)
  const ungroupedDocuments = allDocuments?.filter(doc => !doc.folderId) || [];

  // Folder list view
  if (currentFolderId === null) {
    if (foldersLoading || allDocumentsLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      );
    }

    if ((!folders || folders.length === 0) && ungroupedDocuments.length === 0) {
      return (
        <div className="text-center py-8">
          <Folder className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No documents yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Upload documents to get started.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {renderBreadcrumb()}
        
        {/* Folders Table */}
        {folders && folders.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Document Folders</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folder Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folders.map((folder: any) => (
                  <TableRow key={folder.id} data-testid={`folder-row-${folder.id}`}>
                    <TableCell>
                      <button
                        onClick={() => {
                          setCurrentFolderId(folder.id);
                          setCurrentFolderName(folder.name);
                        }}
                        className="flex items-center gap-2 hover:underline"
                        data-testid={`button-open-folder-${folder.id}`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <Folder className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium" data-testid={`text-folder-name-${folder.id}`}>
                          {folder.name}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground" data-testid={`text-folder-date-${folder.id}`}>
                        {formatDistanceToNow(new Date(folder.createdAt), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" data-testid={`text-folder-creator-${folder.id}`}>
                        {folder.user ? `${folder.user.firstName} ${folder.user.lastName}` : 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" data-testid={`text-folder-count-${folder.id}`}>
                        {folder.documentCount || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs bg-muted px-2 py-1 rounded" data-testid={`badge-folder-source-${folder.id}`}>
                        {folder.source}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this folder and all its documents?')) {
                            deleteFolderMutation.mutate(folder.id);
                          }
                        }}
                        disabled={deleteFolderMutation.isPending}
                        data-testid={`button-delete-folder-${folder.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Ungrouped Documents */}
        {ungroupedDocuments.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Ungrouped Documents</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Upload Name</TableHead>
                  <TableHead>Date Uploaded</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>File Size</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ungroupedDocuments.map((doc: any) => (
                  <TableRow key={doc.id} data-testid={`document-row-${doc.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium" data-testid={`text-document-name-${doc.id}`}>
                          {doc.fileName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" data-testid={`text-upload-name-${doc.id}`}>
                        {doc.uploadName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground" data-testid={`text-document-date-${doc.id}`}>
                        {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" data-testid={`text-uploader-${doc.id}`}>
                        {doc.user ? `${doc.user.firstName} ${doc.user.lastName}` : 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground" data-testid={`text-filesize-${doc.id}`}>
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canPreview(doc.fileType) && (
                          <DocumentPreviewDialog 
                            document={doc} 
                            trigger={
                              <Button variant="ghost" size="sm" data-testid={`button-preview-${doc.id}`}>
                                <Eye className="w-4 h-4" />
                              </Button>
                            }
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc.id, doc.fileName)}
                          data-testid={`button-download-${doc.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Delete this document?')) {
                              deleteDocumentMutation.mutate(doc.id);
                            }
                          }}
                          disabled={deleteDocumentMutation.isPending}
                          data-testid={`button-delete-${doc.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  }

  // Document list view (inside a folder)
  if (documentsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {renderBreadcrumb()}
      
      {!documents || documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No documents in this folder.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Date Uploaded</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead>File Size</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc: any) => (
              <TableRow key={doc.id} data-testid={`document-row-${doc.id}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium" data-testid={`text-document-name-${doc.id}`}>
                      {doc.fileName}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground" data-testid={`text-document-date-${doc.id}`}>
                    {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm" data-testid={`text-uploader-${doc.id}`}>
                    {doc.user ? `${doc.user.firstName} ${doc.user.lastName}` : 'Unknown'}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground" data-testid={`text-filesize-${doc.id}`}>
                    {formatFileSize(doc.fileSize)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {canPreview(doc.fileType) && (
                      <DocumentPreviewDialog 
                        document={doc} 
                        trigger={
                          <Button variant="ghost" size="sm" data-testid={`button-preview-${doc.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        }
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(doc.id, doc.fileName)}
                      data-testid={`button-download-${doc.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this document?')) {
                          deleteDocumentMutation.mutate(doc.id);
                        }
                      }}
                      disabled={deleteDocumentMutation.isPending}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
