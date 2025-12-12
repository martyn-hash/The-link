import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { format } from "date-fns";
import {
  StickyNote,
  Calendar,
  User,
  Folder,
  Trash2,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { ClientNote } from "@shared/schema";
import DOMPurify from "isomorphic-dompurify";

interface ClientNoteWithRelations extends ClientNote {
  createdByUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  project?: {
    id: string;
    description: string | null;
  } | null;
}

interface Attachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface ViewNoteModalProps {
  note: ClientNoteWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
}

export function ViewNoteModal({ note, isOpen, onClose, clientId }: ViewNoteModalProps) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/notes/${note?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'notes'] });
      if (note?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', note.projectId, 'notes'] });
      }
      onClose();
      toast({
        title: "Note deleted",
        description: "The note has been removed.",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  if (!note) return null;

  const formatUserName = (user: ClientNoteWithRelations['createdByUser']) => {
    if (!user) return 'Unknown';
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown';
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    return format(new Date(date), "d MMM yyyy 'at' HH:mm");
  };

  const getAttachments = (): Attachment[] => {
    if (!note.attachments) return [];
    if (Array.isArray(note.attachments)) return note.attachments as Attachment[];
    return [];
  };

  const attachments = getAttachments();

  const isImage = (type: string) => type.startsWith('image/');
  const isPdf = (type: string) => type === 'application/pdf';

  const getFileIcon = (type: string) => {
    if (isImage(type)) return <ImageIcon className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const sanitizedContent = DOMPurify.sanitize(note.content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3',
      'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'span', 'div'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'target', 'rel'],
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <StickyNote className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl" data-testid="text-note-title">
                    {note.title}
                  </DialogTitle>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(note.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {formatUserName(note.createdByUser)}
                    </span>
                    {note.project && (
                      <span className="flex items-center gap-1">
                        <Folder className="h-3 w-3" />
                        <Badge variant="outline" className="text-xs">
                          {note.project.description || 'Project'}
                        </Badge>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <Separator />

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />

              {attachments.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Paperclip className="h-4 w-4" />
                    Attachments ({attachments.length})
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="border rounded-lg overflow-hidden"
                      >
                        {isImage(attachment.type) && (
                          <div
                            className="aspect-video bg-muted cursor-pointer relative group"
                            onClick={() => setPreviewImage(attachment.url)}
                          >
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ExternalLink className="h-6 w-6 text-white" />
                            </div>
                          </div>
                        )}

                        {isPdf(attachment.type) && (
                          <div className="aspect-video bg-muted flex items-center justify-center">
                            <FileText className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}

                        {!isImage(attachment.type) && !isPdf(attachment.type) && (
                          <div className="aspect-video bg-muted flex items-center justify-center">
                            {getFileIcon(attachment.type)}
                          </div>
                        )}

                        <div className="p-3 flex items-center justify-between bg-background">
                          <div className="flex items-center gap-2 min-w-0">
                            {getFileIcon(attachment.type)}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {attachment.name}
                              </p>
                              {attachment.size && (
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(attachment.size)}
                                </p>
                              )}
                            </div>
                          </div>
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={attachment.name}
                          >
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          <DialogFooter>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-note"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
            <Button variant="outline" onClick={onClose} data-testid="button-close-note">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
