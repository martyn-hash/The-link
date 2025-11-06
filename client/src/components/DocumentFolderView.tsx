import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";

interface DocumentFolderViewProps {
  clientId: string;
  renderActions?: (currentFolderId: string | null) => React.ReactNode;
}

export default function DocumentFolderView({ clientId, renderActions }: DocumentFolderViewProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string>("");
  const { toast } = useToast();
  const isMobile = useIsMobile();

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

  const handleDownload = async (doc: any) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/file`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
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
      'application/pdf',
      'audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4'
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
        <div className="space-y-4">
          <div className="text-center py-8">
            <Folder className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No documents yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Upload documents to get started.</p>
          </div>
          {renderActions && (
            <div className="flex justify-center gap-2">
              {renderActions(null)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          {renderBreadcrumb()}
          {renderActions && <div className="flex gap-2">{renderActions(null)}</div>}
        </div>
        
        {/* Folders Table */}
        {folders && folders.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Document Folders</h3>
            {isMobile ? (
              /* Mobile Card View */
              <div className="space-y-3">
                {folders.map((folder: any) => (
                  <Card key={folder.id} data-testid={`folder-card-${folder.id}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Folder Name with Icon */}
                        <button
                          onClick={() => {
                            setCurrentFolderId(folder.id);
                            setCurrentFolderName(folder.name);
                          }}
                          className="flex items-center gap-2 hover:underline w-full text-left"
                          data-testid={`button-open-folder-${folder.id}`}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Folder className="w-5 h-5 text-primary" />
                          </div>
                          <span className="text-base font-medium flex-1" data-testid={`text-folder-name-${folder.id}`}>
                            {folder.name}
                          </span>
                        </button>

                        {/* Folder Info Grid */}
                        <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
                          <div>
                            <span className="text-muted-foreground text-xs">Created</span>
                            <p className="font-medium" data-testid={`text-folder-date-${folder.id}`}>
                              {formatDistanceToNow(new Date(folder.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Created By</span>
                            <p className="font-medium" data-testid={`text-folder-creator-${folder.id}`}>
                              {folder.user ? `${folder.user.firstName} ${folder.user.lastName}` : 'Unknown'}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Documents</span>
                            <p className="font-medium" data-testid={`text-folder-count-${folder.id}`}>
                              {folder.documentCount || 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Source</span>
                            <p className="font-medium">
                              <span className="text-xs bg-muted px-2 py-1 rounded" data-testid={`badge-folder-source-${folder.id}`}>
                                {folder.source}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Delete Button */}
                        <Button
                          variant="destructive"
                          className="w-full h-11 mt-2"
                          onClick={() => {
                            if (confirm('Delete this folder and all its documents?')) {
                              deleteFolderMutation.mutate(folder.id);
                            }
                          }}
                          disabled={deleteFolderMutation.isPending}
                          data-testid={`button-delete-folder-${folder.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Folder
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* Desktop Table View */
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
            )}
          </div>
        )}

        {/* Ungrouped Documents */}
        {ungroupedDocuments.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Ungrouped Documents</h3>
            {isMobile ? (
              /* Mobile Card View */
              <div className="space-y-3">
                {ungroupedDocuments.map((doc: any) => (
                  <Card key={doc.id} data-testid={`document-card-${doc.id}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* File Icon & Name */}
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-medium truncate" data-testid={`text-document-name-${doc.id}`}>
                              {doc.fileName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate" data-testid={`text-upload-name-${doc.id}`}>
                              {doc.uploadName}
                            </p>
                          </div>
                        </div>

                        {/* Document Info Grid */}
                        <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
                          <div>
                            <span className="text-muted-foreground text-xs">Uploaded</span>
                            <p className="font-medium" data-testid={`text-document-date-${doc.id}`}>
                              {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Uploaded By</span>
                            <p className="font-medium" data-testid={`text-uploader-${doc.id}`}>
                              {doc.user ? `${doc.user.firstName} ${doc.user.lastName}` : 'Unknown'}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground text-xs">File Size</span>
                            <p className="font-medium" data-testid={`text-filesize-${doc.id}`}>
                              {formatFileSize(doc.fileSize)}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons - Touch-friendly full-width buttons */}
                        <div className="flex flex-col gap-2 pt-2">
                          {canPreview(doc.fileType) && (
                            <DocumentPreviewDialog 
                              document={doc} 
                              trigger={
                                <Button variant="outline" className="w-full h-11" data-testid={`button-preview-${doc.id}`}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Preview
                                </Button>
                              }
                            />
                          )}
                          <Button
                            variant="outline"
                            className="w-full h-11"
                            onClick={() => handleDownload(doc)}
                            data-testid={`button-download-${doc.id}`}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                          <Button
                            variant="destructive"
                            className="w-full h-11"
                            onClick={() => {
                              if (confirm('Delete this document?')) {
                                deleteDocumentMutation.mutate(doc.id);
                              }
                            }}
                            disabled={deleteDocumentMutation.isPending}
                            data-testid={`button-delete-${doc.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* Desktop Table View */
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
                            onClick={() => handleDownload(doc)}
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
      <div className="flex items-center justify-between">
        {renderBreadcrumb()}
        {renderActions && <div className="flex gap-2">{renderActions(currentFolderId)}</div>}
      </div>
      
      {!documents || documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No documents in this folder.</p>
        </div>
      ) : isMobile ? (
        /* Mobile Card View */
        <div className="space-y-3">
          {documents.map((doc: any) => (
            <Card key={doc.id} data-testid={`document-card-${doc.id}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* File Icon & Name */}
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-base font-medium flex-1 truncate" data-testid={`text-document-name-${doc.id}`}>
                      {doc.fileName}
                    </p>
                  </div>

                  {/* Document Info Grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-border">
                    <div>
                      <span className="text-muted-foreground text-xs">Uploaded</span>
                      <p className="font-medium" data-testid={`text-document-date-${doc.id}`}>
                        {formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Uploaded By</span>
                      <p className="font-medium" data-testid={`text-uploader-${doc.id}`}>
                        {doc.user ? `${doc.user.firstName} ${doc.user.lastName}` : 'Unknown'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs">File Size</span>
                      <p className="font-medium" data-testid={`text-filesize-${doc.id}`}>
                        {formatFileSize(doc.fileSize)}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons - Touch-friendly full-width buttons */}
                  <div className="flex flex-col gap-2 pt-2">
                    {canPreview(doc.fileType) && (
                      <DocumentPreviewDialog 
                        document={doc} 
                        trigger={
                          <Button variant="outline" className="w-full h-11" data-testid={`button-preview-${doc.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </Button>
                        }
                      />
                    )}
                    <Button
                      variant="outline"
                      className="w-full h-11"
                      onClick={() => handleDownload(doc)}
                      data-testid={`button-download-${doc.id}`}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full h-11"
                      onClick={() => {
                        if (confirm('Delete this document?')) {
                          deleteDocumentMutation.mutate(doc.id);
                        }
                      }}
                      disabled={deleteDocumentMutation.isPending}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop Table View */
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
                      onClick={() => handleDownload(doc)}
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
