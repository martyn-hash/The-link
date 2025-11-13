import { useState, useEffect } from "react";
import { useParams, useLocation, Redirect } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Upload, ArrowLeft, ArrowRight, Send, UserPlus, Trash2, PenTool, Type, Loader2, X, AlertCircle, GripVertical } from "lucide-react";
import { PdfSignatureViewer } from "@/components/PdfSignatureViewer";
import { FileUploadZone } from "@/components/attachments/FileUploadZone";
import type { Document as DocumentType, Person } from "@shared/schema";
import { 
  DndContext, 
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  useDraggable
} from '@dnd-kit/core';

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

// Draggable Field Component
function DraggableField({ field, person, onRemove }: { 
  field: SignatureField;
  person?: Person;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: field.id,
  });

  const style = {
    position: 'absolute' as const,
    left: `${field.xPosition}%`,
    top: `${field.yPosition}%`,
    width: `${field.width}%`,
    height: `${field.height}%`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-2 border-blue-500 bg-blue-100/50 rounded flex items-center justify-center text-xs font-medium group hover:bg-blue-200/50 cursor-move"
      data-testid={`draggable-field-${field.id}`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3 w-3 mr-1 text-blue-600" />
      <span className="flex-1 text-center">
        {person?.fullName}: {field.fieldType === "signature" ? "Sign" : "Name"}
      </span>
    </div>
  );
}

export default function SignatureRequestBuilder() {
  const { clientId } = useParams<{ clientId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<"document" | "fields" | "recipients" | "send">("document");
  
  // Step 1: Document selection and upload
  const [documentMode, setDocumentMode] = useState<"upload" | "select">("upload");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [selectedDocument, setSelectedDocument] = useState<DocumentType | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localUploadedDocs, setLocalUploadedDocs] = useState<DocumentType[]>([]);
  
  // Step 2: Field placement
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [selectedFieldType, setSelectedFieldType] = useState<"signature" | "typed_name">("signature");
  const [selectedRecipientForField, setSelectedRecipientForField] = useState<string>("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Drag-and-drop state
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  
  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before drag starts
      },
    })
  );
  
  // Step 3: Recipients and message
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [emailSubject, setEmailSubject] = useState("Document Signature Request");
  const [emailMessage, setEmailMessage] = useState("Please review and sign the attached document.");

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch documents
  const { data: documents = [] } = useQuery<DocumentType[]>({
    queryKey: ['/api/clients', clientId, 'documents'],
  });

  // Fetch people (returns ClientPerson[] with nested person data)
  const { data: clientPeople = [] } = useQuery<any[]>({
    queryKey: ['/api/clients', clientId, 'people'],
  });

  // Extract people from clientPeople and filter for those with emails
  const peopleWithEmails = clientPeople
    .map((cp: any) => cp.person)
    .filter((person: Person) => person && (person.email || person.primaryEmail));

  // Filter for PDF documents
  const propPdfDocuments = documents.filter(doc => 
    doc.fileType.toLowerCase().includes('pdf')
  );
  const pdfDocuments = [
    ...propPdfDocuments,
    ...localUploadedDocs.filter(doc => !propPdfDocuments.some(pd => pd.id === doc.id))
  ];

  // Handle PDF upload
  const handlePdfUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

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
      const uploadUrlResponse = await apiRequest('POST', '/api/objects/upload', {});
      const { uploadURL, objectPath } = uploadUrlResponse as any;

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      const document = await apiRequest('POST', `/api/clients/${clientId}/documents`, {
        folderId: null,
        uploadName: 'Signature Request',
        source: 'signature_request',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        objectPath,
      });

      const typedDocument = document as DocumentType;
      setSelectedDocumentId(typedDocument.id);
      setSelectedDocument(typedDocument);
      setLocalUploadedDocs(prev => [...prev, typedDocument]);
      
      const normalizedPath = objectPath.startsWith('/objects') 
        ? objectPath 
        : `/objects${objectPath}`;
      setPdfPreviewUrl(normalizedPath);
      
      setDocumentMode("select");
      setHasUnsavedChanges(true);
      
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

  // Load PDF preview when document is selected
  useEffect(() => {
    if (selectedDocumentId) {
      const doc = pdfDocuments.find(d => d.id === selectedDocumentId);
      if (doc) {
        setSelectedDocument(doc);
        const normalizedPath = doc.objectPath.startsWith('/objects') 
          ? doc.objectPath 
          : `/objects${doc.objectPath}`;
        setPdfPreviewUrl(normalizedPath);
        setCurrentPage(1);
        setHasUnsavedChanges(true);
      }
    }
  }, [selectedDocumentId, pdfDocuments]);

  // Handle placing field on PDF
  const handlePdfClick = (pageNumber: number, xPercent: number, yPercent: number) => {
    if (!selectedRecipientForField) {
      toast({
        title: "Select a recipient",
        description: "Please select a recipient before placing signature fields",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate field
    const existingField = fields.find(
      f => f.recipientPersonId === selectedRecipientForField && f.fieldType === selectedFieldType
    );

    if (existingField) {
      toast({
        title: "Duplicate field",
        description: `${peopleWithEmails.find(p => p.id === selectedRecipientForField)?.fullName} already has a ${selectedFieldType === "signature" ? "signature" : "typed name"} field. Move the existing field instead.`,
        variant: "destructive",
      });
      return;
    }

    const widthPercent = selectedFieldType === "signature" ? 20 : 15;
    const heightPercent = selectedFieldType === "signature" ? 5 : 3;

    const newField: SignatureField = {
      id: `field-${Date.now()}`,
      recipientPersonId: selectedRecipientForField,
      fieldType: selectedFieldType,
      pageNumber: pageNumber,
      xPosition: xPercent,
      yPosition: yPercent,
      width: widthPercent,
      height: heightPercent,
      label: selectedFieldType === "signature" ? "Sign here" : "Type your name",
      orderIndex: fields.length,
    };

    setFields([...fields, newField]);
    setHasUnsavedChanges(true);
    
    toast({
      title: "Field added",
      description: `${selectedFieldType === "signature" ? "Signature" : "Name"} field placed on page ${pageNumber}`,
    });
  };

  // Remove field
  const removeField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
    setHasUnsavedChanges(true);
  };

  // Handle drag end - update field position
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    
    if (!delta || (delta.x === 0 && delta.y === 0)) return;
    
    const fieldId = active.id as string;
    setActiveFieldId(null);
    
    setFields(prev => prev.map(field => {
      if (field.id !== fieldId) return field;
      
      // Convert pixel delta to percentage delta using stored PDF dimensions
      if (pdfDimensions.width === 0 || pdfDimensions.height === 0) return field;
      
      const deltaXPercent = (delta.x / pdfDimensions.width) * 100;
      const deltaYPercent = (delta.y / pdfDimensions.height) * 100;
      
      // Calculate new position and clamp to 0-100%
      const newX = Math.min(Math.max(field.xPosition + deltaXPercent, 0), 100 - field.width);
      const newY = Math.min(Math.max(field.yPosition + deltaYPercent, 0), 100 - field.height);
      
      // Round to 2 decimal places
      const roundedX = Math.round(newX * 100) / 100;
      const roundedY = Math.round(newY * 100) / 100;
      
      return {
        ...field,
        xPosition: roundedX,
        yPosition: roundedY,
      };
    }));
    
    setHasUnsavedChanges(true);
  };

  // Add recipient
  const addRecipient = (personId: string) => {
    const person = peopleWithEmails.find(p => p.id === personId);
    if (!person) return;

    if (recipients.find(r => r.personId === personId)) {
      toast({
        title: "Recipient already added",
        variant: "destructive",
      });
      return;
    }

    const newRecipient: Recipient = {
      personId: person.id,
      email: person.email || person.primaryEmail || "",
      name: person.fullName,
      orderIndex: recipients.length,
    };

    setRecipients([...recipients, newRecipient]);
    setHasUnsavedChanges(true);
  };

  // Remove recipient
  const removeRecipient = (personId: string) => {
    setRecipients(recipients.filter(r => r.personId !== personId));
    setFields(fields.filter(f => f.recipientPersonId !== personId));
    setHasUnsavedChanges(true);
  };

  // Send signature request
  const sendMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/signature-requests', {
        clientId,
        documentId: selectedDocumentId,
        fields: fields.map((f, idx) => ({
          recipientPersonId: f.recipientPersonId,
          fieldType: f.fieldType,
          pageNumber: f.pageNumber,
          xPercent: f.xPosition,
          yPercent: f.yPosition,
          width: f.width,
          height: f.height,
          label: f.label,
          orderIndex: idx,
        })),
        recipients: recipients.map((r, idx) => ({
          personId: r.personId,
          email: r.email,
          orderIndex: idx,
        })),
        emailSubject,
        emailMessage,
      });
    },
    onSuccess: () => {
      toast({
        title: "Signature request sent",
        description: "Recipients will receive an email with the document to sign",
      });
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/signature-requests'] });
      navigate(`/clients/${clientId}/docs`);
    },
    onError: (error) => {
      toast({
        title: "Failed to send request",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Navigation guards
  const canProceedToFields = selectedDocumentId && selectedDocument !== null;
  const canProceedToRecipients = canProceedToFields && fields.length > 0;
  const canSend = canProceedToRecipients && recipients.length > 0 && emailSubject && emailMessage;

  // Handle navigation away
  const handleBack = () => {
    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Are you sure you want to leave?")) {
        navigate(`/clients/${clientId}/docs`);
      }
    } else {
      navigate(`/clients/${clientId}/docs`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleBack} data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Documents
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-2xl font-bold">Create Signature Request</h1>
                <p className="text-sm text-muted-foreground">Upload a PDF and configure signature fields</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Wizard steps */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={currentStep === "document" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setCurrentStep("document")}
                  data-testid="step-document"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  1. Select Document
                  {selectedDocument && <Badge variant="secondary" className="ml-auto">✓</Badge>}
                </Button>
                <Button
                  variant={currentStep === "fields" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => canProceedToFields && setCurrentStep("fields")}
                  disabled={!canProceedToFields}
                  data-testid="step-fields"
                >
                  <PenTool className="h-4 w-4 mr-2" />
                  2. Place Fields
                  {fields.length > 0 && <Badge variant="secondary" className="ml-auto">{fields.length}</Badge>}
                </Button>
                <Button
                  variant={currentStep === "recipients" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => canProceedToRecipients && setCurrentStep("recipients")}
                  disabled={!canProceedToRecipients}
                  data-testid="step-recipients"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  3. Add Recipients
                  {recipients.length > 0 && <Badge variant="secondary" className="ml-auto">{recipients.length}</Badge>}
                </Button>
                <Button
                  variant={currentStep === "send" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => canSend && setCurrentStep("send")}
                  disabled={!canSend}
                  data-testid="step-send"
                >
                  <Send className="h-4 w-4 mr-2" />
                  4. Send
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main content area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Step 1: Document Selection */}
            {currentStep === "document" && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Document</CardTitle>
                  <CardDescription>Upload a new PDF or select an existing one</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={documentMode} onValueChange={(v) => setDocumentMode(v as "upload" | "select")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="upload">Upload New PDF</TabsTrigger>
                      <TabsTrigger value="select">Select Existing</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upload" className="space-y-4">
                      <FileUploadZone
                        onFilesSelected={handlePdfUpload}
                        maxFiles={1}
                        maxSize={10 * 1024 * 1024}
                        acceptedTypes={['application/pdf']}
                        disabled={isUploading}
                      />
                      {isUploading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading {uploadingFile?.name}...
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="select" className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select PDF Document</Label>
                        <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                          <SelectTrigger data-testid="select-document">
                            <SelectValue placeholder="Choose a PDF document" />
                          </SelectTrigger>
                          <SelectContent>
                            {pdfDocuments.map((doc) => (
                              <SelectItem key={doc.id} value={doc.id}>
                                {doc.fileName} ({(doc.fileSize / 1024).toFixed(0)} KB)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedDocument && (
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                              <div className="flex-1">
                                <p className="font-medium">{selectedDocument.fileName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {(selectedDocument.fileSize / 1024).toFixed(0)} KB
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>

                  {selectedDocument && (
                    <div className="mt-6 flex justify-end">
                      <Button onClick={() => setCurrentStep("fields")} data-testid="button-next-to-fields">
                        Next: Place Fields
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Field Placement - Full height with scrollable PDF */}
            {currentStep === "fields" && pdfPreviewUrl && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Place Signature Fields</CardTitle>
                    <CardDescription>Click on the PDF to place signature or typed name fields</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Field Type</Label>
                        <div className="flex gap-2">
                          <Button
                            variant={selectedFieldType === "signature" ? "default" : "outline"}
                            onClick={() => setSelectedFieldType("signature")}
                            className="flex-1"
                            data-testid="button-field-type-signature"
                          >
                            <PenTool className="h-4 w-4 mr-2" />
                            Signature
                          </Button>
                          <Button
                            variant={selectedFieldType === "typed_name" ? "default" : "outline"}
                            onClick={() => setSelectedFieldType("typed_name")}
                            className="flex-1"
                            data-testid="button-field-type-typed-name"
                          >
                            <Type className="h-4 w-4 mr-2" />
                            Typed Name
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Recipient for this field</Label>
                        <Select value={selectedRecipientForField} onValueChange={setSelectedRecipientForField}>
                          <SelectTrigger data-testid="select-recipient-for-field">
                            <SelectValue placeholder="Select recipient" />
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
                    </div>

                    {/* Placed fields list */}
                    {fields.length > 0 && (
                      <div className="space-y-2">
                        <Label>Placed Fields ({fields.length})</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {fields.map((field) => {
                            const person = peopleWithEmails.find(p => p.id === field.recipientPersonId);
                            return (
                              <div key={field.id} className="flex items-center justify-between p-2 border rounded">
                                <div className="flex items-center gap-2">
                                  {field.fieldType === "signature" ? <PenTool className="h-4 w-4" /> : <Type className="h-4 w-4" />}
                                  <span className="font-medium">{field.fieldType === "signature" ? "Signature" : "Typed Name"}</span>
                                  <span className="text-sm text-muted-foreground">
                                    {person?.fullName} · Page {field.pageNumber}
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeField(field.id)}
                                  data-testid={`button-remove-field-${field.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* PDF Preview - Scrollable full height */}
                <Card className="h-[600px]">
                  <CardContent className="p-4 h-full overflow-auto">
                    <PdfSignatureViewer
                      pdfUrl={pdfPreviewUrl}
                      onPageClick={handlePdfClick}
                      clickable={true}
                      renderOverlay={(pageNumber, renderedWidth, renderedHeight) => {
                        // Safely update PDF dimensions only when they change
                        if (renderedWidth !== pdfDimensions.width || renderedHeight !== pdfDimensions.height) {
                          setPdfDimensions({ width: renderedWidth, height: renderedHeight });
                        }
                        
                        return (
                          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                            <div className="absolute inset-0">
                              {fields
                                .filter(f => f.pageNumber === pageNumber)
                                .map(field => {
                                  const person = peopleWithEmails.find(p => p.id === field.recipientPersonId);
                                  return (
                                    <DraggableField
                                      key={field.id}
                                      field={field}
                                      person={person}
                                      onRemove={removeField}
                                    />
                                  );
                                })}
                            </div>
                          </DndContext>
                        );
                      }}
                    />
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep("document")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={() => setCurrentStep("recipients")} disabled={fields.length === 0} data-testid="button-next-to-recipients">
                    Next: Add Recipients
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Recipients */}
            {currentStep === "recipients" && (
              <Card>
                <CardHeader>
                  <CardTitle>Add Recipients</CardTitle>
                  <CardDescription>Select people who need to sign the document</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Add Recipient</Label>
                    <Select onValueChange={addRecipient}>
                      <SelectTrigger data-testid="select-add-recipient">
                        <SelectValue placeholder="Select a person to add" />
                      </SelectTrigger>
                      <SelectContent>
                        {peopleWithEmails
                          .filter(p => !recipients.find(r => r.personId === p.id))
                          .map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.fullName} ({person.email || person.primaryEmail})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {recipients.length > 0 && (
                    <div className="space-y-2">
                      <Label>Recipients ({recipients.length})</Label>
                      {recipients.map((recipient) => (
                        <div key={recipient.personId} className="flex items-center justify-between p-3 border rounded">
                          <div>
                            <p className="font-medium">{recipient.name}</p>
                            <p className="text-sm text-muted-foreground">{recipient.email}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRecipient(recipient.personId)}
                            data-testid={`button-remove-recipient-${recipient.personId}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between mt-6">
                    <Button variant="outline" onClick={() => setCurrentStep("fields")}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button onClick={() => setCurrentStep("send")} disabled={recipients.length === 0} data-testid="button-next-to-send">
                      Next: Send
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Send */}
            {currentStep === "send" && (
              <Card>
                <CardHeader>
                  <CardTitle>Send Signature Request</CardTitle>
                  <CardDescription>Customize the email message and send</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Subject</Label>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Document Signature Request"
                      data-testid="input-email-subject"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email Message</Label>
                    <Textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Please review and sign the attached document."
                      rows={4}
                      data-testid="textarea-email-message"
                    />
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This will send an email to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} with a secure link to sign the document.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep("recipients")}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={() => sendMutation.mutate()}
                      disabled={sendMutation.isPending || !canSend}
                      data-testid="button-send-request"
                    >
                      {sendMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Signature Request
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
