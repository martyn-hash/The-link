import { useState, useRef, useEffect } from "react";
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
  const { data: signData, isLoading, error } = useQuery({
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

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

    // Move to next field or finish
    const currentIndex = signData?.fields.findIndex((f: any) => f.id === currentFieldId) || 0;
    if (currentIndex < signData?.fields.length - 1) {
      setCurrentFieldId(signData.fields[currentIndex + 1].id);
      clearCanvas();
      setTypedName("");
    }
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
      setCurrentFieldId(signData.fields[0].id);
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

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold">Document Signature Request</h1>
          </div>
          <p className="text-muted-foreground">
            From: {signData.client.name}
          </p>
        </div>

        {/* Consent Step */}
        {currentStep === "consent" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Electronic Signature Disclosure and Consent
              </CardTitle>
              <CardDescription>
                Please review and accept before signing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* UK eIDAS Compliance Disclosure */}
              <div className="bg-muted p-4 rounded-lg max-h-96 overflow-y-auto text-sm space-y-3">
                <h3 className="font-semibold">Important Information About Electronic Signatures</h3>
                
                <p>
                  By clicking "I Agree" below, you consent to electronically sign this document. 
                  Your electronic signature will be legally valid and binding under UK law (UK eIDAS Regulation).
                </p>

                <h4 className="font-semibold mt-4">What You're Agreeing To:</h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>You agree to sign this document electronically rather than using a handwritten signature</li>
                  <li>Your electronic signature will have the same legal effect as a handwritten signature</li>
                  <li>This consent applies only to this specific document</li>
                </ul>

                <h4 className="font-semibold mt-4">Your Rights:</h4>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Right to withdraw:</strong> You may withdraw your consent to use electronic signatures at any time by contacting {signData.client.name}</li>
                  <li><strong>Right to paper copy:</strong> You have the right to request a paper copy of this document at any time</li>
                  <li><strong>No penalty:</strong> There is no fee or penalty for withdrawing consent or requesting a paper copy</li>
                </ul>

                <h4 className="font-semibold mt-4">System Requirements:</h4>
                <p>To view and sign electronic documents, you need:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>A device with internet access (computer, tablet, or mobile phone)</li>
                  <li>A modern web browser (Chrome, Firefox, Safari, or Edge)</li>
                  <li>The ability to view PDF documents</li>
                  <li>An email address to receive the signed document</li>
                </ul>

                <h4 className="font-semibold mt-4">How It Works:</h4>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>Accept this consent disclosure</li>
                  <li>Review the document</li>
                  <li>Provide your signature(s) where indicated</li>
                  <li>Your signature will be recorded with date, time, and your identity</li>
                  <li>A signed copy will be sent to your email address</li>
                </ol>

                <h4 className="font-semibold mt-4">Contact Information:</h4>
                <p>
                  If you have questions about electronic signatures or need assistance, 
                  please contact {signData.client.name}.
                </p>

                <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded mt-4 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm font-medium">
                    <strong>Note:</strong> If you cannot access or view electronic documents, 
                    please request a paper copy before proceeding.
                  </p>
                </div>
              </div>

              {/* Consent Checkboxes */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="consent-agree"
                    checked={consentAccepted}
                    onCheckedChange={(checked) => setConsentAccepted(checked as boolean)}
                    data-testid="checkbox-consent"
                  />
                  <Label htmlFor="consent-agree" className="text-sm leading-relaxed cursor-pointer">
                    I have read and agree to the Electronic Signature Disclosure and Consent above. 
                    I understand that my electronic signature will be legally binding.
                  </Label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="can-access"
                    checked={canAccessDocument === true}
                    onCheckedChange={(checked) => setCanAccessDocument(checked as boolean)}
                    data-testid="checkbox-can-access"
                  />
                  <Label htmlFor="can-access" className="text-sm leading-relaxed cursor-pointer">
                    I can view and access this electronic document clearly on my device.
                    (If not, please request a paper copy)
                  </Label>
                </div>
              </div>

              {canAccessDocument === false && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Cannot access document?</AlertTitle>
                  <AlertDescription>
                    Please contact {signData.client.name} to request a paper copy of this document.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setCurrentStep("sign")}
                  disabled={!consentAccepted || canAccessDocument !== true}
                  data-testid="button-proceed-to-sign"
                >
                  I Agree - Proceed to Sign
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signing Step */}
        {currentStep === "sign" && (
          <div className="space-y-6">
            {/* Document Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  {signData.document.fileName}
                </CardTitle>
                <CardDescription>
                  {signData.request.emailMessage}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Signed as:</p>
                    <p className="font-medium">{signData.recipient.name}</p>
                    <p className="text-sm text-muted-foreground">{signData.recipient.email}</p>
                  </div>
                  <div className="ml-auto">
                    <Badge variant="secondary">
                      {fieldSignatures.size} / {signData.fields.length} fields completed
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PDF Preview with Field Indicators */}
            <Card>
              <CardHeader>
                <CardTitle>Document Preview</CardTitle>
                <CardDescription>Review the document and see where you need to sign</CardDescription>
              </CardHeader>
              <CardContent>
                <PdfSignatureViewer
                  pdfUrl={`/objects${signData.document.objectPath}`}
                  clickable={false}
                  renderOverlay={(pageNumber, _renderedWidth, _renderedHeight) => (
                    <>
                      {signData.fields
                        .filter((f: any) => f.pageNumber === pageNumber)
                        .map((field: any) => {
                          const isSigned = fieldSignatures.has(field.id);
                          return (
                            <div
                              key={field.id}
                              className={`absolute border-2 pointer-events-none ${
                                isSigned
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
                                isSigned ? "text-green-700" : "text-yellow-700"
                              }`}>
                                {isSigned ? "✓ Signed" : "⚠ Sign here"}
                              </div>
                            </div>
                          );
                        })}
                    </>
                  )}
                />
              </CardContent>
            </Card>

            {/* Signature Fields */}
            <Card>
              <CardHeader>
                <CardTitle>Signature Fields</CardTitle>
                <CardDescription>Complete all required signature fields</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {signData.fields.map((field: any, index: number) => {
                  const isCurrentField = field.id === currentFieldId;
                  const isSigned = fieldSignatures.has(field.id);
                  
                  return (
                    <div
                      key={field.id}
                      className={`p-4 border rounded-lg ${
                        isCurrentField ? "border-primary bg-primary/5" : ""
                      } ${isSigned ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {field.fieldType === "signature" ? (
                            <PenTool className="w-4 h-4" />
                          ) : (
                            <Type className="w-4 h-4" />
                          )}
                          <span className="font-medium">
                            {index + 1}. {field.fieldType === "signature" ? "Signature" : "Type Name"}
                          </span>
                        </div>
                        {isSigned && (
                          <Badge variant="outline" className="bg-green-100 dark:bg-green-900">
                            <Check className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>

                      {isCurrentField && !isSigned && (
                        <Tabs defaultValue={field.fieldType === "signature" ? "draw" : "type"}>
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="draw">Draw Signature</TabsTrigger>
                            <TabsTrigger value="type">Type Name</TabsTrigger>
                          </TabsList>

                          <TabsContent value="draw" className="space-y-3">
                            <div className="border rounded bg-white dark:bg-gray-900">
                              <canvas
                                ref={canvasRef}
                                width={500}
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
                                size="sm"
                                onClick={clearCanvas}
                                data-testid="button-clear-signature"
                              >
                                Clear
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => saveSignature("drawn")}
                                data-testid="button-save-drawn-signature"
                              >
                                Save Signature
                              </Button>
                            </div>
                          </TabsContent>

                          <TabsContent value="type" className="space-y-3">
                            <div>
                              <Label htmlFor="typed-name">Type your full name</Label>
                              <Input
                                id="typed-name"
                                value={typedName}
                                onChange={(e) => setTypedName(e.target.value)}
                                placeholder="Enter your full name"
                                className="font-serif text-2xl"
                                data-testid="input-typed-name"
                              />
                            </div>
                            <Button
                              size="sm"
                              onClick={() => saveSignature("typed")}
                              disabled={!typedName.trim()}
                              data-testid="button-save-typed-name"
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
                        >
                          Complete this field
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isPending || fieldSignatures.size < signData.fields.length}
                size="lg"
                data-testid="button-submit-signature"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit Signature
              </Button>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {currentStep === "complete" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check className="w-6 h-6" />
                Signature Complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>
                  Your signature has been recorded and saved. A copy of the signed document 
                  will be sent to your email address shortly.
                </AlertDescription>
              </Alert>

              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <p><strong>Document:</strong> {signData.document.fileName}</p>
                <p><strong>Signed by:</strong> {signData.recipient.name}</p>
                <p><strong>Email:</strong> {signData.recipient.email}</p>
                <p><strong>Date:</strong> {new Date().toLocaleString()}</p>
              </div>

              <p className="text-sm text-muted-foreground">
                You can now close this window. Thank you for completing this signature request.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
