import { useState, useRef, useEffect, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { FileText, Check, AlertCircle, PenTool, Type, Send, Shield } from "lucide-react";
import { PdfSignatureViewer } from "@/components/PdfSignatureViewer";
import { Progress } from "@/components/ui/progress";

// Type for the sign data response from backend
interface SignData {
  request: {
    id: string;
    friendlyName: string;
    emailSubject: string;
    emailMessage: string;
  };
  document: {
    id: string;
    fileName: string;
    fileType: string;
    objectPath: string;
    signedUrl: string;
  };
  client: {
    name: string;
  };
  recipient: {
    name: string;
    email: string;
  };
  firmName: string;
  redirectUrl: string | null;
  fields: Array<{
    id: string;
    fieldType: string;
    pageNumber: number;
    xPosition: number;
    yPosition: number;
    width: number;
    height: number;
    orderIndex: number;
  }>;
}

export default function SignPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  // Get token from URL
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token") || "";

  // UI state
  const [currentStep, setCurrentStep] = useState<"consent" | "sign" | "complete">("consent");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [canAccessDocument, setCanAccessDocument] = useState<boolean | null>(null);
  const [postSubmitState, setPostSubmitState] = useState<"success" | "redirecting" | null>(null);
  
  // Signature state
  const [fieldSignatures, setFieldSignatures] = useState<Map<string, { type: string; data: string }>>(new Map());
  const [currentFieldId, setCurrentFieldId] = useState<string | null>(null);
  
  // Canvas refs for signature drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState("");
  
  // Document-centric signing state
  const [signingStarted, setSigningStarted] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);

  // Fetch signature request data
  const { data: signData, isLoading, error } = useQuery<SignData>({
    queryKey: [`/api/sign/${token}`],
    enabled: !!token,
  });

  // Submit signatures mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const signatures = Array.from(fieldSignatures.entries()).map(([fieldId, sig]) => ({
        fieldId,
        type: sig.type,
        data: sig.data,
      }));

      return await apiRequest("POST", `/api/sign/${token}`, {
        signatures,
        consentAccepted: true,
      });
    },
    onSuccess: (data) => {
      // Always show success screen first
      setPostSubmitState("success");
      
      // After 2 seconds, either redirect or show completion
      setTimeout(() => {
        if (signData?.redirectUrl) {
          setPostSubmitState("redirecting");
          // Redirect after showing redirecting message
          setTimeout(() => {
            window.location.href = signData.redirectUrl!;
          }, 500);
        } else {
          // No redirect - show final completion page
          setCurrentStep("complete");
          setPostSubmitState(null);
        }
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit signature",
        variant: "destructive",
      });
      setPostSubmitState(null);
    },
  });

  // Helper function to get next unsigned field
  const getNextUnsignedField = () => {
    if (!signData) return null;
    const sortedFields = [...signData.fields].sort((a, b) => a.orderIndex - b.orderIndex);
    return sortedFields.find(field => !fieldSignatures.has(field.id)) || null;
  };

  // Helper function to scroll to a field on the PDF
  const scrollToField = (field: any) => {
    // Try to scroll to the specific field overlay first
    const fieldElement = document.getElementById(`field-${field.id}`);
    if (fieldElement) {
      fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Fallback to scrolling to the page
    const pageElement = document.getElementById(`page-${field.pageNumber}`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Navigate to next field
  const goToNextField = () => {
    const nextField = getNextUnsignedField();
    if (nextField) {
      setCurrentFieldId(nextField.id);
      scrollToField(nextField);
    }
  };

  // Track consent view
  useEffect(() => {
    if (signData && currentStep === "consent") {
      // Log consent view for audit trail
      apiRequest("POST", `/api/sign/${token}/consent-viewed`, {}).catch(error => {
        console.error("Failed to log consent view:", error);
        // Don't show error to user - this is just for audit tracking
      });
    }
  }, [signData, currentStep, token]);

  // Auto-select first field on load
  useEffect(() => {
    if (signData && currentStep === "sign" && !currentFieldId) {
      const firstField = getNextUnsignedField();
      if (firstField) {
        setCurrentFieldId(firstField.id);
      }
    }
  }, [signData, currentStep]);

  // Canvas drawing functions
  const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = (type: "drawn" | "typed") => {
    if (!currentFieldId) return;

    if (type === "drawn") {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dataUrl = canvas.toDataURL("image/png");
      setFieldSignatures(new Map(fieldSignatures.set(currentFieldId, {
        type: "drawn",
        data: dataUrl,
      })));
    } else {
      if (!typedName.trim()) {
        toast({
          title: "Name required",
          description: "Please type your name",
          variant: "destructive",
        });
        return;
      }

      setFieldSignatures(new Map(fieldSignatures.set(currentFieldId, {
        type: "typed",
        data: typedName.trim(),
      })));
    }

    toast({
      title: "Signature saved",
      description: "Signature has been added to this field",
    });

    // Clear inputs and move to next unsigned field
    clearCanvas();
    setTypedName("");
    
    // Auto-advance to next field after a short delay for UX
    setTimeout(() => {
      goToNextField();
    }, 300);
  };

  const handleSubmit = () => {
    // Validate all fields are signed
    const allFieldsSigned = signData?.fields.every((field: any) => 
      fieldSignatures.has(field.id)
    );

    if (!allFieldsSigned) {
      toast({
        title: "Missing signatures",
        description: "Please complete all signature fields",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate();
  };

  // Initialize first field when moving to sign step
  useEffect(() => {
    if (currentStep === "sign" && signData?.fields && signData.fields.length > 0 && !currentFieldId) {
      setCurrentFieldId(signData.fields[0]!.id);
    }
  }, [currentStep, signData, currentFieldId]);

  // Success screen - show after submission for 2 seconds
  if (postSubmitState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950 dark:to-emerald-900 p-4">
        <Card className="w-full max-w-md border-green-200 dark:border-green-800 shadow-2xl">
          <CardContent className="pt-8 pb-8">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-600 shadow-lg">
                <Check className="h-12 w-12 text-white" strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold text-green-900 dark:text-green-100 mb-3">
                ✓ Document Signed Successfully!
              </h2>
              <p className="text-green-700 dark:text-green-300 mb-6">
                Your signature has been recorded and securely stored.
              </p>
              {postSubmitState === "redirecting" ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Redirecting you now...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invalid Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This signature link is invalid. Please check the link in your email.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading signature request...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !signData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {(error as any)?.message || "Failed to load signature request"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Consent step - full page
  if (currentStep === "consent") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-6 h-6 text-primary" />
              <CardTitle>Document Signature</CardTitle>
            </div>
            <CardDescription>
              From: {signData.firmName}
              <br />
              <span className="text-xs">{signData.request.friendlyName}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Electronic Signature Consent</h2>
              </div>
              
              {/* Disclosure */}
              <div className="bg-muted p-4 rounded text-sm space-y-3 max-h-80 overflow-y-auto">
                <p className="font-medium">
                  By proceeding, you consent to electronically sign this document under UK eIDAS Regulation.
                </p>
                
                <div>
                  <p className="font-medium">Your Rights:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                    <li>Withdraw consent anytime by contacting {signData.firmName}</li>
                    <li>Request a paper copy at any time</li>
                    <li>No penalty for withdrawal or requesting paper copy</li>
                  </ul>
                </div>

                <div>
                  <p className="font-medium">You agree that:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                    <li>Electronic signatures have the same legal effect as handwritten</li>
                    <li>This consent applies only to this specific document</li>
                    <li>Your signature will be recorded with date, time, and identity</li>
                  </ul>
                </div>
              </div>

              {/* Consent Checkboxes */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="consent-agree"
                    checked={consentAccepted}
                    onCheckedChange={(checked) => setConsentAccepted(checked as boolean)}
                    data-testid="checkbox-consent"
                  />
                  <Label htmlFor="consent-agree" className="text-sm leading-relaxed cursor-pointer">
                    I agree to the Electronic Signature Disclosure and understand my signature will be legally binding.
                  </Label>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="can-access"
                    checked={canAccessDocument === true}
                    onCheckedChange={(checked) => setCanAccessDocument(checked as boolean)}
                    data-testid="checkbox-can-access"
                  />
                  <Label htmlFor="can-access" className="text-sm leading-relaxed cursor-pointer">
                    I can access and view electronic documents
                  </Label>
                </div>
              </div>

              {canAccessDocument === false && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Cannot access documents?</AlertTitle>
                  <AlertDescription className="text-xs">
                    Please contact {signData.firmName} to request a paper copy.
                  </AlertDescription>
                </Alert>
              )}

              <Button
                onClick={() => setCurrentStep("sign")}
                disabled={!consentAccepted || canAccessDocument !== true}
                data-testid="button-proceed-to-sign"
                className="w-full"
              >
                I Agree - Start Signing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Complete step - full page
  if (currentStep === "complete") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="w-6 h-6" />
              <CardTitle>Signature Complete</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>
                Your signature has been recorded. A copy will be sent to your email.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded text-sm space-y-2">
              <p><strong>Document:</strong> {signData.request.friendlyName}</p>
              <p><strong>Signed by:</strong> {signData.recipient.name}</p>
              <p><strong>Email:</strong> {signData.recipient.email}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Signing step - document-centric layout with banner and modal
  // Get all fields sorted by order
  const sortedFields = [...signData.fields].sort((a, b) => a.orderIndex - b.orderIndex);
  
  // Get current field index
  const currentFieldIndex = currentFieldId 
    ? sortedFields.findIndex(f => f.id === currentFieldId) 
    : -1;
  
  const currentField = currentFieldId 
    ? sortedFields.find(f => f.id === currentFieldId) 
    : null;

  // Navigation functions
  const handleStart = () => {
    setSigningStarted(true);
    const firstField = getNextUnsignedField();
    if (firstField) {
      setCurrentFieldId(firstField.id);
      scrollToField(firstField);
      setShowFieldModal(true);
    }
  };

  const handlePrevious = () => {
    if (currentFieldIndex > 0) {
      const prevField = sortedFields[currentFieldIndex - 1];
      if (prevField) {
        setCurrentFieldId(prevField.id);
        scrollToField(prevField);
        setShowFieldModal(true);
      }
    }
  };

  const handleNext = () => {
    if (currentFieldIndex < sortedFields.length - 1) {
      const nextField = sortedFields[currentFieldIndex + 1];
      if (nextField) {
        setCurrentFieldId(nextField.id);
        scrollToField(nextField);
        setShowFieldModal(true);
      }
    }
  };

  const handleFieldClick = (fieldId: string) => {
    setCurrentFieldId(fieldId);
    setSigningStarted(true);
    setShowFieldModal(true);
  };

  const closeModal = () => {
    setShowFieldModal(false);
    clearCanvas();
    setTypedName("");
  };

  const saveAndClose = (type: "drawn" | "typed") => {
    saveSignature(type);
    setTimeout(() => {
      // Check if there's a next unsigned field
      const nextField = getNextUnsignedField();
      if (nextField) {
        // Auto-advance to next field - keep modal open
        setCurrentFieldId(nextField.id);
        scrollToField(nextField);
        // Modal stays open for next field
      } else {
        // All fields signed - close modal
        setShowFieldModal(false);
      }
      clearCanvas();
      setTypedName("");
    }, 300);
  };

  // All fields signed?
  const allFieldsSigned = signData.fields.every((field: any) => fieldSignatures.has(field.id));
  
  // Compute banner state for clear visual feedback
  const bannerState: "start" | "progress" | "complete" = 
    !signingStarted ? "start" :
    allFieldsSigned ? "complete" :
    "progress";

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      {/* Guided Banner - Fixed at top with dynamic state */}
      <div 
        className={`sticky top-0 z-50 border-b shadow-sm transition-colors ${
          bannerState === "complete" 
            ? "bg-green-600 dark:bg-green-700" 
            : "bg-white dark:bg-gray-900"
        }`}
        role="banner"
        aria-live="polite"
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          {bannerState === "start" && (
            // Start state
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Ready to sign {signData.request.friendlyName}?</p>
                  <p className="text-xs text-muted-foreground">Click Start to begin signing</p>
                </div>
              </div>
              <Button 
                onClick={handleStart}
                data-testid="button-start-signing"
                className="w-full md:w-auto"
              >
                <Send className="w-4 h-4 mr-2" />
                Start Signing
              </Button>
            </div>
          )}
          
          {bannerState === "progress" && (
            // Active signing state
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">
                      Field {currentFieldIndex + 1} of {sortedFields.length}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {fieldSignatures.size} / {sortedFields.length} complete
                    </Badge>
                  </div>
                  <Progress 
                    value={(fieldSignatures.size / sortedFields.length) * 100} 
                    className="h-1.5 mt-2 md:w-64"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={currentFieldIndex === 0}
                  data-testid="button-previous-field"
                  className="flex-1 md:flex-none"
                >
                  ← Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={currentFieldIndex === sortedFields.length - 1}
                  data-testid="button-next-field"
                  className="flex-1 md:flex-none"
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
          
          {bannerState === "complete" && (
            // Completion state - prominent green banner
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Check className="w-6 h-6 text-white flex-shrink-0" />
                <div>
                  <p className="font-bold text-base text-white">✓ All fields complete - Ready to submit!</p>
                  <p className="text-xs text-green-100">Review the document and click Submit to finalize your signature</p>
                </div>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                data-testid="button-submit-signature"
                size="lg"
                className="w-full md:w-auto bg-white text-green-700 hover:bg-green-50 font-bold shadow-lg"
              >
                <Send className="w-5 h-5 mr-2" />
                {submitMutation.isPending ? "Submitting..." : "Submit Signature"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer - Full width, takes center stage */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-5xl mx-auto">
          <PdfSignatureViewer
            pdfUrl={signData.document.signedUrl}
            clickable={false}
            className="h-full"
            renderOverlay={(pageNumber, _renderedWidth, _renderedHeight) => (
              <>
                {signData.fields
                  .filter((f: any) => f.pageNumber === pageNumber)
                  .map((field: any) => {
                    const isSigned = fieldSignatures.has(field.id);
                    const isActive = field.id === currentFieldId;
                    return (
                      <div
                        key={field.id}
                        id={`field-${field.id}`}
                        className={`absolute border-2 cursor-pointer transition-all hover:shadow-lg ${
                          isActive
                            ? "border-blue-500 bg-blue-100/40 animate-pulse"
                            : isSigned
                            ? "border-green-600 bg-green-500/30"
                            : "border-yellow-500 bg-yellow-100/30"
                        }`}
                        style={{
                          left: `${field.xPosition}%`,
                          top: `${field.yPosition}%`,
                          width: `${field.width}%`,
                          height: `${field.height}%`,
                        }}
                        onClick={() => handleFieldClick(field.id)}
                        data-testid={`field-overlay-${field.id}`}
                      >
                        {isSigned ? (
                          <div className="flex items-center justify-center h-full">
                            <Check className="w-6 h-6 text-green-700 dark:text-green-300" data-testid="icon-field-signed" />
                          </div>
                        ) : (
                          <div className={`text-xs font-medium p-1 truncate ${
                            isActive ? "text-blue-700" : "text-yellow-700"
                          }`}>
                            {isActive ? "← Click to sign" : "Click to sign"}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </>
            )}
          />
        </div>
      </div>

      {/* Field Interaction Modal/Overlay - Shows when user clicks a field */}
      {showFieldModal && currentField && (
        <>
          {/* Desktop: Modal */}
          <div className="hidden md:block fixed inset-0 bg-black/50 z-50" onClick={closeModal}>
            <div className="flex items-center justify-center min-h-screen p-4">
              <Card 
                className="w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {currentField.fieldType === "signature" ? (
                      <PenTool className="w-5 h-5" />
                    ) : (
                      <Type className="w-5 h-5" />
                    )}
                    {currentField.fieldType === "signature" ? "Sign Here" : "Type Your Name"}
                  </CardTitle>
                  <CardDescription>
                    Field {currentFieldIndex + 1} of {sortedFields.length}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {fieldSignatures.has(currentField.id) ? (
                    <div className="text-center py-8">
                      <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="font-medium">Field already signed</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Use Previous/Next to navigate
                      </p>
                      <Button
                        onClick={closeModal}
                        className="mt-4"
                        data-testid="button-close-modal"
                      >
                        Close
                      </Button>
                    </div>
                  ) : (
                    <Tabs defaultValue={currentField.fieldType === "signature" ? "draw" : "type"}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="draw">Draw</TabsTrigger>
                        <TabsTrigger value="type">Type</TabsTrigger>
                      </TabsList>

                      <TabsContent value="draw" className="space-y-3 mt-4">
                        <div className="border-2 border-dashed rounded-lg bg-white dark:bg-gray-900 p-2">
                          <canvas
                            ref={canvasRef}
                            width={400}
                            height={150}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            className="w-full cursor-crosshair"
                            data-testid="canvas-signature"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={clearCanvas}
                            data-testid="button-clear-signature"
                            className="flex-1"
                          >
                            Clear
                          </Button>
                          <Button
                            onClick={() => saveAndClose("drawn")}
                            data-testid="button-save-drawn-signature"
                            className="flex-1"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Save
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="type" className="space-y-3 mt-4">
                        <Input
                          value={typedName}
                          onChange={(e) => setTypedName(e.target.value)}
                          placeholder="Enter your full name"
                          className="font-serif text-xl h-12"
                          data-testid="input-typed-name"
                          autoFocus
                        />
                        <Button
                          onClick={() => saveAndClose("typed")}
                          disabled={!typedName.trim()}
                          data-testid="button-save-typed-name"
                          className="w-full"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Mobile: Bottom Sheet */}
          <div className="md:hidden fixed inset-0 bg-black/50 z-50 flex items-end" onClick={closeModal}>
            <div 
              className="w-full bg-white dark:bg-gray-900 rounded-t-2xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-900 border-b p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentField.fieldType === "signature" ? (
                      <PenTool className="w-5 h-5" />
                    ) : (
                      <Type className="w-5 h-5" />
                    )}
                    <h3 className="font-semibold">
                      {currentField.fieldType === "signature" ? "Sign Here" : "Type Your Name"}
                    </h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={closeModal}>
                    ✕
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Field {currentFieldIndex + 1} of {sortedFields.length}
                </p>
              </div>

              <div className="p-4">
                {fieldSignatures.has(currentField.id) ? (
                  <div className="text-center py-8">
                    <Check className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="font-medium">Field already signed</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Use Previous/Next to navigate
                    </p>
                    <Button
                      onClick={closeModal}
                      className="mt-4 w-full"
                    >
                      Close
                    </Button>
                  </div>
                ) : (
                  <Tabs defaultValue={currentField.fieldType === "signature" ? "draw" : "type"}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="draw">Draw</TabsTrigger>
                      <TabsTrigger value="type">Type</TabsTrigger>
                    </TabsList>

                    <TabsContent value="draw" className="space-y-3 mt-4">
                      <div className="border-2 border-dashed rounded-lg bg-white dark:bg-gray-900 p-2">
                        <canvas
                          ref={canvasRef}
                          width={300}
                          height={150}
                          onTouchStart={(e) => {
                            const touch = e.touches[0];
                            if (touch && canvasRef.current) {
                              const rect = canvasRef.current.getBoundingClientRect();
                              const mouseEvent = new MouseEvent('mousedown', {
                                clientX: touch.clientX,
                                clientY: touch.clientY
                              });
                              canvasRef.current.dispatchEvent(mouseEvent);
                            }
                          }}
                          onTouchMove={(e) => {
                            e.preventDefault();
                            const touch = e.touches[0];
                            if (touch && canvasRef.current) {
                              const mouseEvent = new MouseEvent('mousemove', {
                                clientX: touch.clientX,
                                clientY: touch.clientY
                              });
                              canvasRef.current.dispatchEvent(mouseEvent);
                            }
                          }}
                          onTouchEnd={() => {
                            if (canvasRef.current) {
                              canvasRef.current.dispatchEvent(new MouseEvent('mouseup'));
                            }
                          }}
                          className="w-full touch-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={clearCanvas}
                          className="flex-1"
                        >
                          Clear
                        </Button>
                        <Button
                          onClick={() => saveAndClose("drawn")}
                          className="flex-1"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="type" className="space-y-3 mt-4">
                      <Input
                        value={typedName}
                        onChange={(e) => setTypedName(e.target.value)}
                        placeholder="Enter your full name"
                        className="font-serif text-xl h-12"
                        autoFocus
                      />
                      <Button
                        onClick={() => saveAndClose("typed")}
                        disabled={!typedName.trim()}
                        className="w-full"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
