import { useState, useEffect } from "react";
import { useParams, useLocation, Redirect } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
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
function DraggableField({ field, person, onRemove, onPageChange, totalPages }: { 
  field: SignatureField;
  person?: Person;
  onRemove: (id: string) => void;
  onPageChange: (fieldId: string, newPage: number) => void;
  totalPages: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.id,
  });

  const style = {
    position: 'absolute' as const,
    left: `${field.xPosition}%`,
    top: `${field.yPosition}%`,
    width: `${field.width}%`,
    height: `${field.height}%`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-2 border-blue-500 bg-blue-100/50 rounded flex items-center justify-between px-2 py-1 text-xs font-medium group hover:bg-blue-200/50"
      data-testid={`draggable-field-${field.id}`}
    >
      <div {...listeners} {...attributes} className="flex items-center gap-2 flex-1 cursor-move min-w-0">
        <GripVertical className="h-5 w-5 text-blue-600 flex-shrink-0" />
        <span className="truncate">
          {person?.fullName}: {field.fieldType === "signature" ? "Sign" : "Name"}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {totalPages > 1 && (
          <span className="text-xs text-blue-700 bg-blue-200 px-1 rounded group-hover:hidden">
            P{field.pageNumber}
          </span>
        )}
        <div className="hidden group-hover:flex items-center gap-1">
          {totalPages > 1 && (
            <select
              value={field.pageNumber}
              onChange={(e) => onPageChange(field.id, parseInt(e.target.value))}
              className="h-6 text-xs border rounded px-1 bg-white"
              onClick={(e) => e.stopPropagation()}
              data-testid={`select-page-field-${field.id}`}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <option key={page} value={page}>P{page}</option>
              ))}
            </select>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onRemove(field.id)}
            data-testid={`button-remove-field-${field.id}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SignatureRequestBuilder() {
  const { clientId } = useParams<{ clientId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<"document" | "fields" | "send">("document");
  
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
  const [pdfDimensionsByPage, setPdfDimensionsByPage] = useState<Map<number, { width: number; height: number }>>(new Map());
  const [totalPages, setTotalPages] = useState<number>(0);
  
  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Require 5px movement before drag starts
      },
    })
  );
  
  // Step 3: Email customization and friendly name
  const [friendlyName, setFriendlyName] = useState("");
  const [emailSubject, setEmailSubject] = useState("Document Signature Request");
  const [emailMessage, setEmailMessage] = useState("Please review and sign the attached document.");
  const [selectedRedirectUrl, setSelectedRedirectUrl] = useState<string>("");
  
  // Reminder settings
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderIntervalDays, setReminderIntervalDays] = useState(3);

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Safe navigation function that checks for unsaved changes
  const navigateWithWarning = (path: string) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(path);
      setShowUnsavedDialog(true);
    } else {
      navigate(path);
    }
  };

  // Confirm navigation (discard changes)
  const confirmNavigation = () => {
    if (pendingNavigation) {
      setHasUnsavedChanges(false);
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
    setShowUnsavedDialog(false);
  };

  // Cancel navigation (stay on page)
  const cancelNavigation = () => {
    setPendingNavigation(null);
    setShowUnsavedDialog(false);
  };

  // Fetch documents
  const { data: documents = [] } = useQuery<DocumentType[]>({
    queryKey: ['/api/clients', clientId, 'documents'],
  });

  // Fetch people (returns ClientPerson[] with nested person data)
  const { data: clientPeople = [] } = useQuery<any[]>({
    queryKey: ['/api/clients', clientId, 'people'],
  });

  // Fetch company settings for redirect URLs
  const { data: companySettings } = useQuery<any>({
    queryKey: ['/api/super-admin/company-settings'],
  });

  const redirectUrlOptions = (companySettings?.postSignatureRedirectUrls as Array<{ name: string; url: string }>) || [];

  // Extract people from clientPeople and filter for those with emails
  const peopleWithEmails = clientPeople
    .map((cp: any) => cp.person)
    .filter((person: Person) => person && (person.email || person.primaryEmail));

  // Auto-derive recipients from placed fields (after peopleWithEmails is declared)
  const recipients: Recipient[] = Array.from(
    new Set(fields.map(f => f.recipientPersonId))
  ).map((personId, index) => {
    const person = peopleWithEmails.find(p => p.id === personId);
    return {
      personId,
      email: person?.email || person?.primaryEmail || '',
      name: person?.fullName || '',
      orderIndex: index
    };
  });

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
      showFriendlyError({ error: "Please select a PDF file" });
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
      showFriendlyError({ error });
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
      showFriendlyError({ error: "Please select a recipient before placing signature fields" });
      return;
    }

    // Check for duplicate field
    const existingField = fields.find(
      f => f.recipientPersonId === selectedRecipientForField && f.fieldType === selectedFieldType
    );

    if (existingField) {
      showFriendlyError({ error: `${peopleWithEmails.find(p => p.id === selectedRecipientForField)?.fullName} already has a ${selectedFieldType === "signature" ? "signature" : "typed name"} field. Move the existing field instead.` });
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
    
    // Visual feedback provided by field appearing on PDF - no toast needed
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
      
      // Get dimensions for the specific page this field is on
      const pageDimensions = pdfDimensionsByPage.get(field.pageNumber);
      if (!pageDimensions || pageDimensions.width === 0 || pageDimensions.height === 0) return field;
      
      // Convert pixel delta to percentage delta using the correct page's dimensions
      const deltaXPercent = (delta.x / pageDimensions.width) * 100;
      const deltaYPercent = (delta.y / pageDimensions.height) * 100;
      
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

  // Handle page change for a field - move field to different page
  const handlePageChange = (fieldId: string, newPage: number) => {
    setFields(prev => prev.map(field => {
      if (field.id !== fieldId) return field;
      return {
        ...field,
        pageNumber: newPage,
      };
    }));
    setHasUnsavedChanges(true);
    
    toast({
      title: "Field moved",
      description: `Field moved to page ${newPage}`,
    });
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
          xPosition: f.xPosition,
          yPosition: f.yPosition,
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
        friendlyName,
        emailSubject,
        emailMessage,
        redirectUrl: selectedRedirectUrl === "__none__" ? null : selectedRedirectUrl || null,
        reminderEnabled,
        reminderIntervalDays,
      });
    },
    onSuccess: () => {
      toast({
        title: "Signature request sent",
        description: "Recipients will receive an email with the document to sign",
      });
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/signature-requests'] });
      navigate(`/clients/${clientId}`);
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  // Navigation guards
  const canProceedToFields = selectedDocumentId && selectedDocument !== null;
  const canSend = canProceedToFields && fields.length > 0 && recipients.length > 0 && friendlyName.trim() && emailSubject && emailMessage;

  // Handle navigation away
  const handleBack = () => {
    navigateWithWarning(`/clients/${clientId}`);
  };

  return (
    <>
      {/* Unsaved changes warning dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent data-testid="dialog-unsaved-changes">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave now, your work will be lost. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelNavigation} data-testid="button-cancel-navigation">
              Stay on Page
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmNavigation} data-testid="button-confirm-navigation">
              Leave and Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main builder UI */}
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
                  variant={currentStep === "send" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => canSend && setCurrentStep("send")}
                  disabled={!canSend}
                  data-testid="step-send"
                >
                  <Send className="h-4 w-4 mr-2" />
                  3. Review & Send
                  {recipients.length > 0 && <Badge variant="secondary" className="ml-auto">{recipients.length} recipients</Badge>}
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
                    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                      <PdfSignatureViewer
                        pdfUrl={pdfPreviewUrl}
                        onPageClick={handlePdfClick}
                        clickable={true}
                        onDocumentLoad={setTotalPages}
                        onPageDimensionsChange={(pageNumber, width, height) => {
                          // Update dimensions for this specific page (outside render cycle)
                          setPdfDimensionsByPage(prev => {
                            const currentDims = prev.get(pageNumber);
                            if (!currentDims || currentDims.width !== width || currentDims.height !== height) {
                              const next = new Map(prev);
                              next.set(pageNumber, { width, height });
                              return next;
                            }
                            return prev;
                          });
                        }}
                        renderOverlay={(pageNumber, renderedWidth, renderedHeight) => {
                          return (
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
                                      onPageChange={handlePageChange}
                                      totalPages={totalPages}
                                    />
                                  );
                                })}
                            </div>
                          );
                        }}
                      />
                    </DndContext>
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep("document")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={() => setCurrentStep("send")} disabled={fields.length === 0} data-testid="button-next-to-send">
                    Next: Review & Send
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Send */}
            {currentStep === "send" && (
              <Card>
                <CardHeader>
                  <CardTitle>Send Signature Request</CardTitle>
                  <CardDescription>Customize the email message and send</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Friendly Name - Required */}
                  <div className="space-y-2">
                    <Label htmlFor="friendly-name" className="text-sm font-medium">
                      Friendly Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="friendly-name"
                      value={friendlyName}
                      onChange={(e) => setFriendlyName(e.target.value)}
                      placeholder="e.g., Annual Accounts 2024, Tax Return, Service Agreement"
                      data-testid="input-friendly-name"
                      className="w-full"
                    />
                    {!friendlyName.trim() && (
                      <p className="text-sm text-destructive">Friendly name is required to send the signature request</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Give this signature request a friendly name for easy identification
                    </p>
                  </div>

                  <Separator />

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

                  <Separator />

                  {/* Post-Signature Redirect URL */}
                  <div className="space-y-2">
                    <Label htmlFor="redirect-url">Post-Signature Redirect (Optional)</Label>
                    <Select value={selectedRedirectUrl || "__none__"} onValueChange={setSelectedRedirectUrl}>
                      <SelectTrigger id="redirect-url" data-testid="select-redirect-url">
                        <SelectValue placeholder="No redirect (show success message)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__" data-testid="select-redirect-none">No redirect (show success message)</SelectItem>
                        {redirectUrlOptions.map((option, index) => (
                          <SelectItem 
                            key={index} 
                            value={option.url}
                            data-testid={`select-redirect-${index}`}
                          >
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Choose where signers will be redirected after completing the signature. Leave as default to show a success message.
                    </p>
                  </div>

                  <Separator />

                  {/* Reminder Settings */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="reminder-enabled">Send Reminders</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically remind unsigned recipients
                        </p>
                      </div>
                      <Switch
                        id="reminder-enabled"
                        checked={reminderEnabled}
                        onCheckedChange={setReminderEnabled}
                        data-testid="switch-reminder-enabled"
                      />
                    </div>

                    {reminderEnabled && (
                      <div className="space-y-2 pl-4 border-l-2 border-muted">
                        <Label htmlFor="reminder-interval">Reminder Interval (days)</Label>
                        <Input
                          id="reminder-interval"
                          type="number"
                          min="1"
                          max="30"
                          value={reminderIntervalDays}
                          onChange={(e) => setReminderIntervalDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 3)))}
                          data-testid="input-reminder-interval"
                          className="w-32"
                        />
                        <p className="text-sm text-muted-foreground">
                          Reminders will be sent every {reminderIntervalDays} day{reminderIntervalDays !== 1 ? 's' : ''} to unsigned recipients (max 5 reminders total)
                        </p>
                      </div>
                    )}
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This will send an email to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} with a secure link to sign the document.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setCurrentStep("fields")}>
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
    </>
  );
}
