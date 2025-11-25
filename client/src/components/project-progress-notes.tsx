import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { MessageSquare, Plus, Phone, Mail, Send, FileText, Inbox, PhoneCall, Eye } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertCommunicationSchema } from "@shared/schema";
import { TiptapEditor } from '@/components/TiptapEditor';

interface ProjectProgressNotesProps {
  projectId: string;
  clientId: string;
  clientPeople?: any[];
}

export function ProjectProgressNotes({ projectId, clientId, clientPeople = [] }: ProjectProgressNotesProps) {
  const { toast } = useToast();
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [emailContent, setEmailContent] = useState("");

  // Fetch project communications
  const { data: communications = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/communications`],
  });

  // Form schema for adding notes
  const addNoteSchema = z.object({
    clientId: z.string(),
    projectId: z.string().nullable(),
    personId: z.string().nullable(),
    type: z.string(),
    subject: z.string().nullable(),
    content: z.string(),
    actualContactTime: z.string().min(1, "Date/time is required"),
    isRead: z.boolean().nullable(),
    metadata: z.any().nullable(),
    threadId: z.string().nullable(),
  });

  const form = useForm({
    resolver: zodResolver(addNoteSchema),
    defaultValues: {
      clientId,
      projectId,
      personId: null as string | null,
      type: 'note',
      subject: '',
      content: '',
      actualContactTime: new Date().toISOString().slice(0, 16),
      isRead: true as boolean | null,
      metadata: null,
      threadId: null as string | null,
    },
  });

  // Email form
  const emailForm = useForm({
    resolver: zodResolver(z.object({
      personId: z.string().min(1, "Please select a person"),
      subject: z.string().min(1, "Subject is required"),
      content: z.string().min(1, "Email content is required"),
    })),
    defaultValues: {
      personId: '',
      subject: '',
      content: '',
    },
  });

  // SMS form
  const smsForm = useForm({
    resolver: zodResolver(z.object({
      personId: z.string().min(1, "Please select a person"),
      message: z.string().min(1, "Message is required").max(500, "Message must be 500 characters or less"),
    })),
    defaultValues: {
      personId: '',
      message: '',
    },
  });

  // Add communication mutation
  const addCommunicationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/communications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/communications`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/communications`] });
      toast({
        title: "Progress note added",
        description: "The note has been logged successfully.",
      });
      setIsAddingNote(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add note",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string; subject: string; content: string; personId: string }) => {
      return await apiRequest("POST", "/api/send-email", {
        ...data,
        clientId,
        projectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/communications`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/communications`] });
      toast({
        title: "Email sent",
        description: "Your email has been sent and logged.",
      });
      setIsSendingEmail(false);
      emailForm.reset();
      setEmailContent("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send email",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Send SMS mutation
  const sendSmsMutation = useMutation({
    mutationFn: async (data: { to: string; message: string; personId: string }) => {
      return await apiRequest("POST", "/api/send-sms", {
        ...data,
        clientId,
        projectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/communications`] });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/communications`] });
      toast({
        title: "SMS sent",
        description: "Your message has been sent and logged.",
      });
      setIsSendingSMS(false);
      smsForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send SMS",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleAddNote = (values: any) => {
    const formData = {
      ...values,
      personId: values.personId === 'none' ? null : values.personId,
      actualContactTime: new Date(values.actualContactTime).toISOString(),
      clientId,
      projectId,
    };
    addCommunicationMutation.mutate(formData);
  };

  const handleSendEmail = (values: any) => {
    const selectedPerson = clientPeople?.find((cp: any) => cp.person.id === values.personId);
    if (!selectedPerson?.person.primaryEmail) {
      toast({
        title: "No email address",
        description: "The selected person does not have a primary email address.",
        variant: "destructive",
      });
      return;
    }

    sendEmailMutation.mutate({
      to: selectedPerson.person.primaryEmail,
      subject: values.subject,
      content: emailContent,
      personId: values.personId,
    });
  };

  const handleSendSMS = (values: any) => {
    const selectedPerson = clientPeople?.find((cp: any) => cp.person.id === values.personId);
    if (!selectedPerson?.person.primaryPhone) {
      toast({
        title: "No mobile number",
        description: "The selected person does not have a primary mobile number.",
        variant: "destructive",
      });
      return;
    }

    sendSmsMutation.mutate({
      to: selectedPerson.person.primaryPhone,
      message: values.message,
      personId: values.personId,
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'phone_call': return <PhoneCall className="h-4 w-4" />;
      case 'note': return <FileText className="h-4 w-4" />;
      case 'sms_sent': return <Send className="h-4 w-4" />;
      case 'sms_received': return <Inbox className="h-4 w-4" />;
      case 'email_sent': return <Mail className="h-4 w-4" />;
      case 'email_received': return <Inbox className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'phone_call': return 'Phone Call';
      case 'note': return 'Note';
      case 'sms_sent': return 'SMS Sent';
      case 'sms_received': return 'SMS Received';
      case 'email_sent': return 'Email Sent';
      case 'email_received': return 'Email Received';
      default: return 'Communication';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'phone_call': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'note': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'sms_sent': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'sms_received': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'email_sent': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'email_received': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Progress Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Progress Notes
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsSendingSMS(true)}
                size="sm"
                variant="outline"
                data-testid="button-send-sms"
              >
                <Send className="h-4 w-4 mr-2" />
                Send SMS
              </Button>
              <Button
                onClick={() => setIsSendingEmail(true)}
                size="sm"
                variant="outline"
                data-testid="button-send-email"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              <Button
                onClick={() => setIsAddingNote(true)}
                size="sm"
                data-testid="button-add-note"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!communications || communications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No progress notes recorded yet</p>
              <p className="text-sm">Add notes or send communications to track project progress</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Subject/Content</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {communications.map((item: any) => (
                  <TableRow key={item.id} data-testid={`note-row-${item.id}`}>
                    <TableCell data-testid={`cell-type-${item.id}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          {getIcon(item.type)}
                        </div>
                        <Badge variant="secondary" className={getTypeColor(item.type)}>
                          {getTypeLabel(item.type)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-date-${item.id}`}>
                      {format(new Date(item.actualContactTime), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell data-testid={`cell-content-${item.id}`}>
                      <div>
                        {item.subject && (
                          <div className="font-medium">{item.subject}</div>
                        )}
                        {item.content && (
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {item.content.substring(0, 100)}
                            {item.content.length > 100 && '...'}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`cell-user-${item.id}`}>
                      {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingNote(item)}
                        data-testid={`button-view-${item.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Note Dialog */}
      <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Progress Note</DialogTitle>
            <DialogDescription>
              Log a note, phone call, or other communication related to this project.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddNote)} className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="phone_call">Phone Call</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="personId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                      <FormControl>
                        <SelectTrigger data-testid="select-person">
                          <SelectValue placeholder="Select person" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No specific person</SelectItem>
                        {clientPeople?.map((cp: any) => (
                          <SelectItem key={cp.person.id} value={cp.person.id}>
                            {cp.person.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief subject..." {...field} value={field.value || ''} data-testid="input-subject" />
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
                      <Textarea
                        placeholder="Note details..."
                        className="min-h-[100px]"
                        {...field}
                        data-testid="input-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="actualContactTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date/Time</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-datetime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddingNote(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addCommunicationMutation.isPending}
                  data-testid="button-submit-note"
                >
                  {addCommunicationMutation.isPending ? "Saving..." : "Save Note"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={isSendingEmail} onOpenChange={setIsSendingEmail}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Send an email to a contact person related to this project.
            </DialogDescription>
          </DialogHeader>
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(handleSendEmail)} className="space-y-4">
              <FormField
                control={emailForm.control}
                name="personId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-email-person">
                          <SelectValue placeholder="Select person" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientPeople?.map((cp: any) => (
                          <SelectItem key={cp.person.id} value={cp.person.id}>
                            {cp.person.fullName} ({cp.person.primaryEmail || 'No email'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={emailForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Email subject..." {...field} data-testid="input-email-subject" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <label className="text-sm font-medium">Content</label>
                <TiptapEditor
                  content={emailContent}
                  onChange={setEmailContent}
                  placeholder="Enter email content with rich formatting and tables..."
                  className="mt-2 min-h-[200px]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSendingEmail(false)}
                  data-testid="button-cancel-email"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sendEmailMutation.isPending}
                  data-testid="button-send-email"
                >
                  {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Send SMS Dialog */}
      <Dialog open={isSendingSMS} onOpenChange={setIsSendingSMS}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS</DialogTitle>
            <DialogDescription>
              Send a text message to a contact person related to this project.
            </DialogDescription>
          </DialogHeader>
          <Form {...smsForm}>
            <form onSubmit={smsForm.handleSubmit(handleSendSMS)} className="space-y-4">
              <FormField
                control={smsForm.control}
                name="personId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-sms-person">
                          <SelectValue placeholder="Select person" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientPeople?.map((cp: any) => (
                          <SelectItem key={cp.person.id} value={cp.person.id}>
                            {cp.person.fullName} ({cp.person.primaryPhone || 'No phone'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={smsForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Your message..."
                        className="min-h-[100px]"
                        maxLength={500}
                        {...field}
                        data-testid="input-sms-message"
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground text-right">
                      {field.value.length}/500
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSendingSMS(false)}
                  data-testid="button-cancel-sms"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sendSmsMutation.isPending}
                  data-testid="button-send-sms-submit"
                >
                  {sendSmsMutation.isPending ? "Sending..." : "Send SMS"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Note Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={() => setViewingNote(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingNote?.subject || getTypeLabel(viewingNote?.type)}</DialogTitle>
            <DialogDescription>
              {viewingNote && format(new Date(viewingNote.actualContactTime), 'MMMM d, yyyy at HH:mm')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-1">Type</div>
              <Badge className={getTypeColor(viewingNote?.type || '')}>
                {getTypeLabel(viewingNote?.type || '')}
              </Badge>
            </div>
            {viewingNote?.person && (
              <div>
                <div className="text-sm font-medium mb-1">Person</div>
                <div>{viewingNote.person.fullName}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium mb-1">Created By</div>
              <div>{viewingNote?.user ? `${viewingNote.user.firstName} ${viewingNote.user.lastName}` : 'Unknown'}</div>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Content</div>
              <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                {viewingNote?.content}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
