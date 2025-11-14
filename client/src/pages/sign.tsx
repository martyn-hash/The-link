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
  
  // Signature state
  const [fieldSignatures, setFieldSignatures] = useState<Map<string, { type: string; data: string }>>(new Map());
  const [currentFieldId, setCurrentFieldId] = useState<string | null>(null);
  
  // Canvas refs for signature drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState("");

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
      setCurrentStep("complete");
      toast({
        title: "Signature submitted",
        description: "Your signature has been recorded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit signature",
        variant: "destructive",
      });
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
              <span className="text-xs">{signData.document.fileName}</span>
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
              <p><strong>Document:</strong> {signData.document.fileName}</p>
              <p><strong>Signed by:</strong> {signData.recipient.name}</p>
              <p><strong>Email:</strong> {signData.recipient.email}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Signing step - split layout with PDF
  return (
    <div className="min-h-screen flex">
      {/* Left Sidebar - Signing Controls */}
      <div className="w-full md:w-80 bg-white dark:bg-gray-900 border-r flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold">Document Signature</h1>
          </div>
          <p className="text-sm text-muted-foreground">From: {signData.firmName}</p>
          <p className="text-xs text-muted-foreground mt-1">{signData.document.fileName}</p>
        </div>

        {/* Signing Step */}
        {currentStep === "sign" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Signer Info */}
            <div className="p-4 border-b bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">Signing as:</div>
              <div className="font-medium text-sm">{signData.recipient.name}</div>
              <div className="text-xs text-muted-foreground">{signData.recipient.email}</div>
            </div>

            {/* Combined Progress Bar + Guidance + Submit - Sticky position */}
            <div className="p-4 border-b bg-white dark:bg-gray-900 sticky top-0 z-10 space-y-3">
              {/* Visual Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium">Progress</span>
                  <Badge variant="secondary">
                    {fieldSignatures.size} / {signData.fields.length} fields
                  </Badge>
                </div>
                <Progress 
                  value={(fieldSignatures.size / signData.fields.length) * 100} 
                  className="h-2"
                />
              </div>

              {/* Guidance Message */}
              {getNextUnsignedField() ? (
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                  <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">
                    📝 Complete the field below, then click Next
                  </div>
                  <Button
                    onClick={goToNextField}
                    variant="outline"
                    size="sm"
                    className="w-full bg-white dark:bg-gray-900"
                    data-testid="button-next-field"
                  >
                    Next Field →
                  </Button>
                </div>
              ) : (
                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg text-xs font-medium text-green-900 dark:text-green-100">
                  ✓ All fields complete! Submit your signature below.
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending || fieldSignatures.size < signData.fields.length}
                className="w-full"
                data-testid="button-submit-signature"
              >
                <Send className="w-4 h-4 mr-2" />
                {submitMutation.isPending ? "Submitting..." : "Submit Signature"}
              </Button>
            </div>

            {/* Signature Fields - Scrollable */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              <div className="text-sm font-semibold mb-2">Signature Fields</div>
              {signData.fields.map((field: any, index: number) => {
                const isCurrentField = field.id === currentFieldId;
                const isSigned = fieldSignatures.has(field.id);
                
                return (
                  <div
                    key={field.id}
                    className={`p-3 border rounded-lg text-sm ${
                      isCurrentField ? "border-primary bg-primary/5" : ""
                    } ${isSigned ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {field.fieldType === "signature" ? (
                          <PenTool className="w-3 h-3" />
                        ) : (
                          <Type className="w-3 h-3" />
                        )}
                        <span className="font-medium text-xs">
                          Field {index + 1}
                        </span>
                      </div>
                      {isSigned && (
                        <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900">
                          <Check className="w-3 h-3 mr-1" />
                          Done
                        </Badge>
                      )}
                    </div>

                    {isCurrentField && !isSigned && (
                      <Tabs defaultValue={field.fieldType === "signature" ? "draw" : "type"} className="mt-2">
                        <TabsList className="grid w-full grid-cols-2 h-8">
                          <TabsTrigger value="draw" className="text-xs">Draw</TabsTrigger>
                          <TabsTrigger value="type" className="text-xs">Type</TabsTrigger>
                        </TabsList>

                        <TabsContent value="draw" className="space-y-2 mt-2">
                          <div className="border rounded bg-white dark:bg-gray-900">
                            <canvas
                              ref={canvasRef}
                              width={300}
                              height={100}
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
                              size="sm"
                              onClick={clearCanvas}
                              data-testid="button-clear-signature"
                              className="text-xs"
                            >
                              Clear
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveSignature("drawn")}
                              data-testid="button-save-drawn-signature"
                              className="text-xs"
                            >
                              Save
                            </Button>
                          </div>
                        </TabsContent>

                        <TabsContent value="type" className="space-y-2 mt-2">
                          <Input
                            id="typed-name"
                            value={typedName}
                            onChange={(e) => setTypedName(e.target.value)}
                            placeholder="Enter full name"
                            className="font-serif text-lg"
                            data-testid="input-typed-name"
                          />
                          <Button
                            size="sm"
                            onClick={() => saveSignature("typed")}
                            disabled={!typedName.trim()}
                            data-testid="button-save-typed-name"
                            className="w-full text-xs"
                          >
                            Save Name
                          </Button>
                        </TabsContent>
                      </Tabs>
                    )}

                    {isSigned && (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCurrentFieldId(field.id);
                            const sig = fieldSignatures.get(field.id);
                            if (sig?.type === "typed") {
                              setTypedName(sig.data);
                            }
                            setFieldSignatures(new Map(
                              Array.from(fieldSignatures.entries()).filter(([id]) => id !== field.id)
                            ));
                          }}
                          data-testid={`button-edit-field-${field.id}`}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                    )}

                    {!isCurrentField && !isSigned && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentFieldId(field.id)}
                        data-testid={`button-select-field-${field.id}`}
                        className="w-full text-xs mt-2"
                      >
                        Sign this field
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right Side - PDF Viewer (Full Screen) */}
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 overflow-hidden">
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
                  const isActive = field.id === currentFieldId && currentStep === "sign";
                  return (
                    <div
                      key={field.id}
                      className={`absolute border-2 pointer-events-none transition-all ${
                        isActive
                          ? "border-blue-500 bg-blue-100/40 animate-pulse"
                          : isSigned
                          ? "border-green-500 bg-green-100/30"
                          : "border-yellow-500 bg-yellow-100/30"
                      }`}
                      style={{
                        left: `${field.xPosition}%`,
                        top: `${field.yPosition}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                      }}
                    >
                      <div className={`text-xs font-medium p-1 truncate ${
                        isActive ? "text-blue-700" : isSigned ? "text-green-700" : "text-yellow-700"
                      }`}>
                        {isActive ? "← Sign here" : isSigned ? "✓ Signed" : "⚠ Sign"}
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        />
      </div>
    </div>
  );
}
