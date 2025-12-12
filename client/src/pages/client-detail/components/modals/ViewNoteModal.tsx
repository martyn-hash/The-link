import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { TiptapEditor } from "@/components/TiptapEditor";
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
  Pencil,
  X,
  History,
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

interface ChangelogEntry {
  id: string;
  entityType: string;
  entityId: string;
  changeType: string;
  changedByUserId: string;
  beforeValue: {
    title?: string;
    content?: string;
    attachments?: any;
  } | null;
  afterValue: {
    title?: string;
    content?: string;
    attachments?: any;
  } | null;
  changeDescription: string | null;
  timestamp: string;
  changedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface ViewNoteModalProps {
  note: ClientNoteWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
}

const editNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
});

type EditNoteFormValues = z.infer<typeof editNoteSchema>;

export function ViewNoteModal({ note, isOpen, onClose, clientId }: ViewNoteModalProps) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<EditNoteFormValues>({
    resolver: zodResolver(editNoteSchema),
    defaultValues: {
      title: note?.title || '',
      content: note?.content || '',
    },
  });

  useEffect(() => {
    if (note && isOpen) {
      form.reset({
        title: note.title,
        content: note.content,
      });
    }
  }, [note, isOpen, form]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
    }
  }, [isOpen]);

  const { data: changelog = [] } = useQuery<ChangelogEntry[]>({
    queryKey: ['/api/notes', note?.id, 'changelog'],
    queryFn: async () => {
      if (!note?.id) return [];
      const res = await fetch(`/api/notes/${note.id}/changelog`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch changelog');
      return res.json();
    },
    enabled: !!note?.id && isOpen,
  });

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

  const editMutation = useMutation({
    mutationFn: (data: EditNoteFormValues) => apiRequest('PATCH', `/api/notes/${note?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notes', note?.id, 'changelog'] });
      if (note?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', note.projectId, 'notes'] });
      }
      setIsEditing(false);
      toast({
        title: "Note updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleSubmit = (values: EditNoteFormValues) => {
    editMutation.mutate(values);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (note) {
      form.reset({
        title: note.title,
        content: note.content,
      });
    }
  };

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

  const stripHtml = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

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
                  {isEditing ? (
                    <span className="text-xl font-semibold">Edit Note</span>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <Separator />

          <ScrollArea className="flex-1 pr-4">
            {isEditing ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter a title for this note"
                            data-testid="input-edit-note-title"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <TiptapEditor
                            content={field.value}
                            onChange={field.onChange}
                            placeholder="Write your note here..."
                            className="min-h-[200px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            ) : (
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

                {changelog.length > 0 && (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="changelog" className="border rounded-lg">
                      <AccordionTrigger className="px-4 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4" />
                          Edit History ({changelog.length})
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4">
                          {changelog.map((entry) => (
                            <div key={entry.id} className="border rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">
                                  {formatUserName(entry.changedBy)}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatDate(entry.timestamp)}
                                </span>
                              </div>
                              {entry.beforeValue && entry.afterValue && (
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground mb-1">Before:</p>
                                    <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded text-xs">
                                      <p className="font-medium">{entry.beforeValue.title}</p>
                                      <p className="text-muted-foreground line-clamp-2">
                                        {stripHtml(entry.beforeValue.content || '')}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground mb-1">After:</p>
                                    <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded text-xs">
                                      <p className="font-medium">{entry.afterValue.title}</p>
                                      <p className="text-muted-foreground line-clamp-2">
                                        {stripHtml(entry.afterValue.content || '')}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>
            )}
          </ScrollArea>

          <Separator />

          <DialogFooter>
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={editMutation.isPending}
                  data-testid="button-cancel-edit-note"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={form.handleSubmit(handleSubmit)}
                  disabled={editMutation.isPending}
                  data-testid="button-save-edit-note"
                >
                  {editMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save Changes
                </Button>
              </>
            ) : (
              <>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  data-testid="button-edit-note"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" onClick={onClose} data-testid="button-close-note">
                  Close
                </Button>
              </>
            )}
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
