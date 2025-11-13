import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Upload, MousePointer, Send, UserPlus, Trash2, PenTool, Type, Loader2 } from "lucide-react";
import type { Document as DocumentType, Person } from "@shared/schema";
import { PdfSignatureViewer } from "@/components/PdfSignatureViewer";
import { FileUploadZone } from "@/components/attachments/FileUploadZone";

interface CreateSignatureRequestDialogProps {
  clientId: string;
  documents: DocumentType[];
  people: Person[];
  onSuccess?: () => void;
}

interface SignatureField {
  id: string;
  recipientPersonId: string;
  fieldType: "signature" | "typed_name";
  pageNumber: number;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  label: string;
  orderIndex: number;
}

interface Recipient {
  personId: string;
  email: string;
  name: string;
  orderIndex: number;
}

export function CreateSignatureRequestDialog({
  clientId,
  documents,
  people,
  onSuccess
}: CreateSignatureRequestDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("document");
  
  // Step 1: Document selection and upload
  const [documentMode, setDocumentMode] = useState<"upload" | "select">("upload");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localUploadedDocs, setLocalUploadedDocs] = useState<DocumentType[]>([]); // Track locally uploaded docs
  
  // Step 2: Field placement
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [selectedFieldType, setSelectedFieldType] = useState<"signature" | "typed_name">("signature");
  const [selectedRecipientForField, setSelectedRecipientForField] = useState<string>("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Step 3: Recipients and message
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [emailSubject, setEmailSubject] = useState("Document Signature Request");
  const [emailMessage, setEmailMessage] = useState("Please review and sign the attached document.");

  // PDF upload handler
  const handlePdfUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    // Validate PDF
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file",
        variant: "destructive",
      });
      return;
    }

    setUploadingFile(file);
    setIsUploading(true);

    try {
      // Step 1: Get upload URL
      const uploadUrlResponse = await apiRequest('POST', '/api/objects/upload', {});
      const { uploadURL, objectPath } = uploadUrlResponse as any;

      // Step 2: Upload to object storage
      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      // Step 3: Save document metadata
      const document = await apiRequest('POST', `/api/clients/${clientId}/documents`, {
        folderId: null,
        uploadName: 'Signature Request',
        source: 'signature_request',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        objectPath,
      });

      // Step 4: Immediately set document and preview URL for instant usability
      const typedDocument = document as DocumentType;
      setSelectedDocumentId(typedDocument.id);
      setSelectedDocument(typedDocument);
      
      // Add to local uploaded docs so dropdown shows it immediately
      setLocalUploadedDocs(prev => [...prev, typedDocument]);
      
      // Normalize path to avoid duplication
      const normalizedPath = objectPath.startsWith('/objects') 
        ? objectPath 
        : `/objects${objectPath}`;
      setPdfPreviewUrl(normalizedPath);
      
      setDocumentMode("select"); // Switch to select mode to show the selected document
      
      // Invalidate queries to refresh document list
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'documents'] });

      toast({
        title: "PDF uploaded",
        description: "Document uploaded successfully. You can now place signature fields.",
      });
    } catch (error) {
      console.error('Error uploading PDF:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload PDF",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadingFile(null);
    }
  };

  // Filter for PDF documents only - combine prop documents with locally uploaded ones
  const propPdfDocuments = documents.filter(doc => 
    doc.fileType.toLowerCase().includes('pdf')
  );
  const pdfDocuments = [
    ...propPdfDocuments,
    ...localUploadedDocs.filter(doc => !propPdfDocuments.some(pd => pd.id === doc.id))
  ];

  // Filter people with emails
  const peopleWithEmails = people.filter(person => 
    person.email || person.primaryEmail
  );

  // Load PDF preview when document is selected
  useEffect(() => {
    if (selectedDocumentId) {
      const doc = pdfDocuments.find(d => d.id === selectedDocumentId);
      if (doc) {
        setSelectedDocument(doc);
        // Normalize object path - remove leading /objects if present to avoid duplication
        const normalizedPath = doc.objectPath.startsWith('/objects') 
          ? doc.objectPath 
          : `/objects${doc.objectPath}`;
        setPdfPreviewUrl(normalizedPath);
        setCurrentPage(1); // Reset to page 1 when document changes
      }
    }
  }, [selectedDocumentId, pdfDocuments]);

  // Handle adding a field by clicking on the PDF preview
  const handlePdfClick = (pageNumber: number, xPercent: number, yPercent: number) => {
    if (!selectedRecipientForField) {
      toast({
        title: "Select a recipient",
        description: "Please select a recipient before placing signature fields",
        variant: "destructive",
      });
      return;
    }

    // Default field dimensions as percentage
    const widthPercent = selectedFieldType === "signature" ? 20 : 15;
    const heightPercent = selectedFieldType === "signature" ? 5 : 3;

    const newField: SignatureField = {
      id: `field-${Date.now()}`,
      recipientPersonId: selectedRecipientForField,
      fieldType: selectedFieldType,
      pageNumber: pageNumber, // Track the actual page number (1-indexed)
      xPosition: xPercent,
      yPosition: yPercent,
      width: widthPercent,
      height: heightPercent,
      label: selectedFieldType === "signature" ? "Sign here" : "Type your name",
      orderIndex: fields.length,
    };

    setFields([...fields, newField]);
    
    toast({
      title: "Field added",
      description: `${selectedFieldType === "signature" ? "Signature" : "Name"} field placed on page ${pageNumber}`,
    });
  };

  // Handle removing a field
  const removeField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
  };

  // Add recipient
  const addRecipient = (personId: string) => {
    const person = peopleWithEmails.find(p => p.id === personId);
    if (!person) return;

    const email = person.primaryEmail || person.email;
    if (!email) {
      toast({
        title: "No email found",
        description: "This person doesn't have an email address",
        variant: "destructive",
      });
      return;
    }

    if (recipients.some(r => r.personId === personId)) {
      toast({
        title: "Already added",
        description: "This person is already a recipient",
        variant: "destructive",
      });
      return;
    }

    setRecipients([
      ...recipients,
      {
        personId,
        email,
        name: person.fullName,
        orderIndex: recipients.length,
      },
    ]);
  };

  // Remove recipient
  const removeRecipient = (personId: string) => {
    setRecipients(recipients.filter(r => r.personId !== personId));
    // Also remove fields for this recipient
    setFields(fields.filter(f => f.recipientPersonId !== personId));
  };

  // Create signature request mutation
  const createRequestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/signature-requests", {
        clientId,
        documentId: selectedDocumentId,
        emailSubject,
        emailMessage,
        fields,
        recipients: recipients.map(r => ({
          personId: r.personId,
          email: r.email,
          orderIndex: r.orderIndex,
        })),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Signature request created",
        description: "The signature request has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/signature-requests/client', clientId] });
      if (onSuccess) onSuccess();
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create signature request",
        variant: "destructive",
      });
    },
  });

  // Send signature request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("POST", `/api/signature-requests/${requestId}/send`, {});
    },
    onSuccess: () => {
      toast({
        title: "Signature request sent",
        description: "Emails have been sent to all recipients",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/signature-requests/client', clientId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send signature request",
        variant: "destructive",
      });
    },
  });

  // Create and send in one action
  const handleCreateAndSend = async () => {
    try {
      const result = await createRequestMutation.mutateAsync();
      if (result && result.id) {
        await sendRequestMutation.mutateAsync(result.id);
      }
    } catch (error) {
      console.error("Error creating and sending signature request:", error);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setCurrentTab("document");
    setDocumentMode("upload");
    setSelectedDocumentId("");
    setSelectedDocument(null);
    setUploadingFile(null);
    setIsUploading(false);
    setLocalUploadedDocs([]); // Reset local uploads
    setFields([]);
    setRecipients([]);
    setEmailSubject("Document Signature Request");
    setEmailMessage("Please review and sign the attached document.");
    setSelectedFieldType("signature");
    setSelectedRecipientForField("");
  };

  // Can proceed if we have a selected document (either from upload or selection)
  const canProceedToFields = selectedDocumentId && selectedDocument !== null;
  const canProceedToRecipients = canProceedToFields && fields.length > 0;
  const canSend = canProceedToRecipients && recipients.length > 0 && emailSubject && emailMessage;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-signature-request" variant="outline" size="sm">
          <PenTool className="w-4 h-4 mr-2" />
          Create Signature Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Signature Request</DialogTitle>
          <DialogDescription>
            Create a new document signature request for e-signing
          </DialogDescription>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="document" data-testid="tab-select-document">
              <FileText className="w-4 h-4 mr-2" />
              1. Select Document
            </TabsTrigger>
            <TabsTrigger 
              value="fields" 
              disabled={!canProceedToFields}
              data-testid="tab-place-fields"
            >
              <MousePointer className="w-4 h-4 mr-2" />
              2. Place Fields
            </TabsTrigger>
            <TabsTrigger 
              value="send" 
              disabled={!canProceedToRecipients}
              data-testid="tab-send"
            >
              <Send className="w-4 h-4 mr-2" />
              3. Send
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Upload or Select Document */}
          <TabsContent value="document" className="space-y-4">
            {/* Upload/Select Mode Tabs */}
            <Tabs value={documentMode} onValueChange={(v) => setDocumentMode(v as "upload" | "select")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" data-testid="tab-upload-pdf">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload New PDF
                </TabsTrigger>
                <TabsTrigger value="select" data-testid="tab-select-existing">
                  <FileText className="w-4 h-4 mr-2" />
                  Select Existing
                </TabsTrigger>
              </TabsList>

              {/* Upload Tab */}
              <TabsContent value="upload" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Upload PDF Document</CardTitle>
                    <CardDescription>
                      Upload a PDF file for signature request
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isUploading ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">
                          Uploading {uploadingFile?.name}...
                        </p>
                      </div>
                    ) : (
                      <FileUploadZone
                        onFilesSelected={handlePdfUpload}
                        maxFiles={1}
                        maxSize={10 * 1024 * 1024} // 10MB
                        acceptedTypes={['application/pdf', '.pdf']}
                        disabled={isUploading}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Select Existing Tab */}
              <TabsContent value="select" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="document-select">Select PDF Document</Label>
                    <Select
                      value={selectedDocumentId}
                      onValueChange={setSelectedDocumentId}
                    >
                      <SelectTrigger id="document-select" data-testid="select-document">
                        <SelectValue placeholder="Choose a PDF document..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pdfDocuments.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No PDF documents available
                          </SelectItem>
                        ) : (
                          pdfDocuments.map((doc) => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.fileName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {pdfDocuments.length === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        No PDF documents available. Upload one using the "Upload New PDF" tab.
                      </p>
                    )}
                  </div>

                  {selectedDocument && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Selected Document</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <FileText className="w-8 h-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{selectedDocument.fileName}</p>
                            <p className="text-sm text-muted-foreground">
                              {(selectedDocument.fileSize / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                onClick={() => setCurrentTab("fields")}
                disabled={!canProceedToFields || isUploading}
                data-testid="button-next-to-fields"
              >
                Next: Place Fields
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Tab 2: Place Fields */}
          <TabsContent value="fields" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Left: Controls */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Field Type</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Button
                        variant={selectedFieldType === "signature" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedFieldType("signature")}
                        data-testid="button-field-type-signature"
                      >
                        <PenTool className="w-4 h-4 mr-2" />
                        Signature
                      </Button>
                      <Button
                        variant={selectedFieldType === "typed_name" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedFieldType("typed_name")}
                        data-testid="button-field-type-typed-name"
                      >
                        <Type className="w-4 h-4 mr-2" />
                        Typed Name
                      </Button>
                    </div>

                    <div>
                      <Label>Recipient for this field</Label>
                      <Select
                        value={selectedRecipientForField}
                        onValueChange={setSelectedRecipientForField}
                      >
                        <SelectTrigger data-testid="select-field-recipient">
                          <SelectValue placeholder="Select recipient..." />
                        </SelectTrigger>
                        <SelectContent>
                          {peopleWithEmails.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Placed Fields ({fields.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {fields.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Click on the PDF preview to place fields
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {fields.map((field) => {
                          const person = peopleWithEmails.find(p => p.id === field.recipientPersonId);
                          return (
                            <div
                              key={field.id}
                              className="flex items-center justify-between p-2 border rounded"
                            >
                              <div className="flex items-center gap-2">
                                {field.fieldType === "signature" ? (
                                  <PenTool className="w-4 h-4" />
                                ) : (
                                  <Type className="w-4 h-4" />
                                )}
                                <div>
                                  <p className="text-sm font-medium">
                                    {field.fieldType === "signature" ? "Signature" : "Typed Name"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {person?.fullName} · Page {field.pageNumber}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeField(field.id)}
                                data-testid={`button-remove-field-${field.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right: PDF Preview */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">PDF Preview</CardTitle>
                    <CardDescription>Click to place signature fields (navigate pages using buttons below)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pdfPreviewUrl ? (
                      <PdfSignatureViewer
                        pdfUrl={pdfPreviewUrl}
                        onPageClick={handlePdfClick}
                        clickable={true}
                        renderOverlay={(pageNumber, _renderedWidth, _renderedHeight) => (
                          <>
                            {fields
                              .filter(f => f.pageNumber === pageNumber)
                              .map(field => {
                                const person = peopleWithEmails.find(p => p.id === field.recipientPersonId);
                                return (
                                  <div
                                    key={field.id}
                                    className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                                    style={{
                                      left: `${field.xPosition}%`,
                                      top: `${field.yPosition}%`,
                                      width: `${field.width}%`,
                                      height: `${field.height}%`,
                                    }}
                                    data-testid={`field-overlay-${field.id}`}
                                  >
                                    <div className="text-xs font-medium text-primary p-1 truncate">
                                      {field.fieldType === "signature" ? "✍️" : "✏️"} {person?.fullName}
                                    </div>
                                  </div>
                                );
                              })}
                          </>
                        )}
                      />
                    ) : (
                      <div className="aspect-[8.5/11] flex items-center justify-center border rounded bg-muted/20">
                        <p className="text-sm text-muted-foreground">No document selected</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentTab("document")}>
                Back
              </Button>
              <Button
                onClick={() => setCurrentTab("send")}
                disabled={!canProceedToRecipients}
                data-testid="button-next-to-send"
              >
                Next: Add Recipients
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Tab 3: Recipients and Send */}
          <TabsContent value="send" className="space-y-4">
            <div className="space-y-4">
              {/* Recipients */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recipients</CardTitle>
                  <CardDescription>Select people who need to sign this document</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Add Recipient</Label>
                    <Select onValueChange={addRecipient}>
                      <SelectTrigger data-testid="select-add-recipient">
                        <SelectValue placeholder="Select person to add..." />
                      </SelectTrigger>
                      <SelectContent>
                        {peopleWithEmails.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.fullName} ({person.primaryEmail || person.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {recipients.length > 0 && (
                    <div className="space-y-2">
                      {recipients.map((recipient) => (
                        <div
                          key={recipient.personId}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div>
                            <p className="font-medium text-sm">{recipient.name}</p>
                            <p className="text-xs text-muted-foreground">{recipient.email}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRecipient(recipient.personId)}
                            data-testid={`button-remove-recipient-${recipient.personId}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email Message */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Email Message</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="email-subject">Subject</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Document Signature Request"
                      data-testid="input-email-subject"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-message">Message</Label>
                    <Textarea
                      id="email-message"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Please review and sign the attached document."
                      rows={4}
                      data-testid="textarea-email-message"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentTab("fields")}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => createRequestMutation.mutate()}
                  disabled={!canSend || createRequestMutation.isPending}
                  data-testid="button-save-draft"
                >
                  Save Draft
                </Button>
                <Button
                  onClick={handleCreateAndSend}
                  disabled={!canSend || createRequestMutation.isPending || sendRequestMutation.isPending}
                  data-testid="button-create-and-send"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Create & Send
                </Button>
              </div>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
