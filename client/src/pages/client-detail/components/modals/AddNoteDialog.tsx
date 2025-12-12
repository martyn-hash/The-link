import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TiptapEditor } from "@/components/TiptapEditor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Paperclip, X, Loader2, FileText, Image as ImageIcon, Save, Sparkles, Mic, ChevronDown, ChevronUp } from "lucide-react";
import { AudioRecorder } from "@/components/AudioRecorder";

const addNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
});

type AddNoteFormValues = z.infer<typeof addNoteSchema>;

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface AddNoteDialogProps {
  clientId: string;
  projectId?: string;
  isOpen: boolean;
  onClose: () => void;
  mode?: 'client' | 'project';
}

export function AddNoteDialog({ 
  clientId, 
  projectId, 
  isOpen, 
  onClose,
  mode = 'client'
}: AddNoteDialogProps) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isProcessingAi, setIsProcessingAi] = useState(false);

  const draftKey = projectId ? `note-${clientId}-${projectId}` : `note-${clientId}`;
  const { savedContent, additionalFields, hasDraft, saveDraft, clearDraft, lastSavedAt } = useDraftAutoSave({
    key: draftKey,
  });

  const form = useForm<AddNoteFormValues>({
    resolver: zodResolver(addNoteSchema),
    defaultValues: {
      title: '',
      content: '',
    },
  });

  useEffect(() => {
    if (isOpen && hasDraft && savedContent && !draftRestored) {
      form.setValue('content', savedContent);
      if (additionalFields?.title) {
        form.setValue('title', additionalFields.title);
      }
      setDraftRestored(true);
      toast({
        title: "Draft restored",
        description: "Your previous draft has been restored.",
      });
    }
  }, [isOpen, hasDraft, savedContent, additionalFields, form, draftRestored, toast]);

  useEffect(() => {
    if (!isOpen) {
      setDraftRestored(false);
    }
  }, [isOpen]);

  const watchedContent = form.watch('content');
  const watchedTitle = form.watch('title');

  useEffect(() => {
    if (isOpen && (watchedContent || watchedTitle)) {
      saveDraft(watchedContent, { title: watchedTitle });
    }
  }, [watchedContent, watchedTitle, isOpen, saveDraft]);

  const addNoteMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', `/api/clients/${clientId}/notes`, data),
    onSuccess: () => {
      if (mode === 'project' && projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'notes'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'notes'] });
      clearDraft();
      handleClose();
      toast({
        title: "Note added",
        description: "Your note has been saved successfully.",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleClose = () => {
    onClose();
    form.reset();
    setAttachments([]);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    form.reset();
    setAttachments([]);
    setDraftRestored(false);
  };

  const handleAudioResult = (result: { content: string; subject?: string; transcription?: string }) => {
    if (result.content) {
      form.setValue('content', result.content);
    }
  };

  const handleAiPromptSubmit = async () => {
    if (!aiPrompt.trim()) return;
    
    setIsProcessingAi(true);
    try {
      const response = await fetch('/api/ai/text/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process prompt');
      }

      const result = await response.json();
      if (result.content) {
        form.setValue('content', result.content);
        setAiPrompt('');
        setShowAiPrompt(false);
        toast({
          title: "Note created",
          description: "AI has generated your note content.",
        });
      }
    } catch (error: any) {
      showFriendlyError({ error: error.message || 'Failed to process your prompt. Please try again.' });
    } finally {
      setIsProcessingAi(false);
    }
  };

  const onSubmit = (values: AddNoteFormValues) => {
    const noteData = {
      ...values,
      projectId: projectId || null,
      attachments: attachments.length > 0 ? attachments : null,
    };
    addNoteMutation.mutate(noteData);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', 'note-attachment');
        formData.append('clientId', clientId);

        const response = await fetch('/api/objects/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const result = await response.json();
        
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: result.url,
            type: file.type,
            size: file.size,
          },
        ]);
      }

      toast({
        title: "Files uploaded",
        description: "Attachments added to your note.",
      });
    } catch (error) {
      showFriendlyError({ error });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Add Note</DialogTitle>
            {lastSavedAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Save className="w-3 h-3" />
                Draft saved
              </span>
            )}
          </div>
          <DialogDescription className="sr-only">
            Create a new note for this client
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter a title for this note"
                      data-testid="input-note-title"
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

            {/* AI Assist Section */}
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Assist
                </span>
                <div className="flex items-center gap-2">
                  <AudioRecorder 
                    onResult={handleAudioResult}
                    mode="notes"
                    disabled={isProcessingAi}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAiPrompt(!showAiPrompt)}
                    data-testid="button-toggle-ai-prompt"
                  >
                    {showAiPrompt ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                    Write Prompt
                  </Button>
                </div>
              </div>
              
              {showAiPrompt && (
                <div className="space-y-2">
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe what you want the AI to write..."
                    className="min-h-[80px]"
                    data-testid="textarea-ai-prompt"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAiPromptSubmit}
                      disabled={!aiPrompt.trim() || isProcessingAi}
                      data-testid="button-submit-ai-prompt"
                    >
                      {isProcessingAi ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Note
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Attachments</span>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    disabled={isUploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    asChild
                  >
                    <span>
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Paperclip className="h-4 w-4 mr-2" />
                      )}
                      Attach Files
                    </span>
                  </Button>
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="border rounded-lg p-3 space-y-2">
                  {attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileIcon(attachment.type)}
                        <span className="text-sm truncate">{attachment.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(attachment.size)})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                data-testid="button-cancel-note"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addNoteMutation.isPending}
                data-testid="button-save-note"
              >
                {addNoteMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Note
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
