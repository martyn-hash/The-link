import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Info, 
  ArrowRight,
  ArrowLeft,
  Download,
  RefreshCw,
  Building2,
  User,
  Briefcase
} from "lucide-react";
import { FieldMappingUI } from "@/components/import/FieldMappingUI";
import { ImportAuditReport } from "@/components/import/ImportAuditReport";
import type { 
  FieldMapping, 
  ServiceImportValidationResult,
  ServiceImportExecutionResult,
  ImportAuditReport as ImportAuditReportType
} from "@shared/importTypes";
import { 
  CLIENT_SERVICE_FIELD_DEFINITIONS, 
  PEOPLE_SERVICE_FIELD_DEFINITIONS 
} from "@shared/importTypes";

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';
type ImportType = 'client_services' | 'people_services' | 'mixed';

interface ParseResult {
  success: boolean;
  totalRows: number;
  headers: string[];
  importType: ImportType;
  sampleData: Record<string, any>[];
  availableServices: { id: string; name: string; isPersonalService: boolean }[];
  availableUsers: { id: string; email: string; name: string }[];
  availableWorkRoles: { id: string; name: string }[];
}

export default function ServiceImport() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [validationResult, setValidationResult] = useState<ServiceImportValidationResult | null>(null);
  const [executionResult, setExecutionResult] = useState<ServiceImportExecutionResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/service-import/parse', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to parse file');
      }

      const result: ParseResult = await response.json();
      setParseResult(result);
      setParsedRows(result.sampleData);
      
      const fullDataResponse = await fetch('/api/service-import/parse', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const fullData = await fullDataResponse.json();
      if (fullData.sampleData) {
        setParsedRows(fullData.sampleData);
      }

      setCurrentStep('mapping');

      toast({
        title: "File Parsed",
        description: `Found ${result.totalRows} rows with ${result.headers.length} columns.`,
      });
    } catch (error: any) {
      toast({
        title: "Parse Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMappingsChange = useCallback((newMappings: FieldMapping[]) => {
    setMappings(newMappings);
  }, []);

  const handleValidate = async () => {
    if (!parseResult || mappings.length === 0) {
      toast({
        title: "Missing Data",
        description: "Please complete field mapping before validating.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/service-import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsedRows,
          mappings,
          importType: parseResult.importType,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Validation failed');
      }

      const result: ServiceImportValidationResult = await response.json();
      setValidationResult(result);
      setCurrentStep('preview');

      if (result.errors.length > 0) {
        toast({
          title: "Validation Issues Found",
          description: `${result.errors.length} errors need to be addressed before import.`,
          variant: "destructive",
        });
      } else if (result.warnings.length > 0) {
        toast({
          title: "Validation Complete with Warnings",
          description: `${result.warnings.length} warnings found. You can proceed with import.`,
        });
      } else {
        toast({
          title: "Validation Successful",
          description: `${result.validRows} rows ready for import.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const executeImport = async () => {
    if (!parseResult || !validationResult) return;

    setCurrentStep('importing');
    setImportProgress(10);

    try {
      setImportProgress(30);
      
      const response = await fetch('/api/service-import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsedRows,
          mappings,
          importType: parseResult.importType,
        }),
        credentials: 'include',
      });

      setImportProgress(80);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result: ServiceImportExecutionResult = await response.json();
      setExecutionResult(result);
      setImportProgress(100);
      setCurrentStep('complete');

      toast({
        title: result.success ? "Import Complete" : "Import Completed with Errors",
        description: `Created ${result.summary.clientServicesCreated + result.summary.peopleServicesCreated} services, updated ${result.summary.clientServicesUpdated + result.summary.peopleServicesUpdated}.`,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Import Error",
        description: error.message,
        variant: "destructive",
      });
      setCurrentStep('preview');
    }
  };

  const resetImport = () => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setParseResult(null);
    setMappings([]);
    setValidationResult(null);
    setExecutionResult(null);
    setImportProgress(0);
    setParsedRows([]);
  };

  const downloadTemplate = () => {
    window.location.href = "/api/service-import/template";
  };

  const getFieldDefinitions = () => {
    if (!parseResult) return CLIENT_SERVICE_FIELD_DEFINITIONS;
    if (parseResult.importType === 'people_services') return PEOPLE_SERVICE_FIELD_DEFINITIONS;
    return CLIENT_SERVICE_FIELD_DEFINITIONS;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation user={user} />
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold" data-testid="page-title">Service Import</h1>
          <p className="text-muted-foreground mt-2">
            Import services for existing clients and people with flexible column mapping
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <Badge variant={currentStep === 'upload' ? 'default' : 'outline'} data-testid="step-upload">
              1. Upload
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={currentStep === 'mapping' ? 'default' : 'outline'} data-testid="step-mapping">
              2. Map Fields
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={currentStep === 'preview' ? 'default' : 'outline'} data-testid="step-preview">
              3. Preview & Validate
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={currentStep === 'importing' || currentStep === 'complete' ? 'default' : 'outline'} data-testid="step-complete">
              4. Import & Report
            </Badge>
          </div>
        </div>

        {currentStep === 'upload' && (
          <div className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Service Import</AlertTitle>
              <AlertDescription>
                <p className="mb-2">Import services for clients or people that already exist in the system.</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Client Services:</strong> Match by Company Number or Client Name</li>
                  <li><strong>Personal Services:</strong> Match by Person Email or Full Name</li>
                  <li>Existing services will be updated, new ones created</li>
                  <li>A detailed audit report will be generated showing all changes</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Download Import Template
                </CardTitle>
                <CardDescription>
                  Get a pre-formatted Excel template with example data and available services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={downloadTemplate}
                  variant="default"
                  className="w-full"
                  data-testid="button-download-template"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Template (.xlsx)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Your File
                </CardTitle>
                <CardDescription>
                  Select a CSV or Excel file (.csv, .xlsx, .xls) containing your service data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    data-testid="input-file"
                  />
                  {selectedFile && (
                    <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-file-selected">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {selectedFile.name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleFileUpload}
              disabled={!selectedFile}
              className="w-full"
              size="lg"
              data-testid="button-parse"
            >
              <Upload className="w-4 h-4 mr-2" />
              Parse File & Continue
            </Button>
          </div>
        )}

        {currentStep === 'mapping' && parseResult && (
          <div className="space-y-6">
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertTitle>File Parsed Successfully</AlertTitle>
              <AlertDescription>
                Found {parseResult.totalRows} rows. 
                Detected import type: <strong>{parseResult.importType === 'client_services' ? 'Client Services' : 
                  parseResult.importType === 'people_services' ? 'Personal Services' : 'Mixed'}</strong>
              </AlertDescription>
            </Alert>

            <FieldMappingUI
              sourceHeaders={parseResult.headers}
              fieldDefinitions={getFieldDefinitions()}
              initialMappings={mappings}
              onMappingsChange={handleMappingsChange}
              onConfirm={handleValidate}
              onBack={() => setCurrentStep('upload')}
              sampleData={parseResult.sampleData}
            />
          </div>
        )}

        {currentStep === 'preview' && validationResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold">{validationResult.totalRows}</div>
                  <div className="text-xs text-muted-foreground">Total Rows</div>
                </CardContent>
              </Card>
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{validationResult.validRows}</div>
                  <div className="text-xs text-muted-foreground">Valid</div>
                </CardContent>
              </Card>
              <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-red-600">{validationResult.invalidRows}</div>
                  <div className="text-xs text-muted-foreground">Invalid</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {validationResult.matchStats.clientsMatched + validationResult.matchStats.peopleMatched}
                  </div>
                  <div className="text-xs text-muted-foreground">Entities Matched</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-purple-600">{validationResult.matchStats.servicesMatched}</div>
                  <div className="text-xs text-muted-foreground">Services Matched</div>
                </CardContent>
              </Card>
            </div>

            {validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Errors ({validationResult.errors.length})</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="max-h-48">
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {validationResult.errors.slice(0, 20).map((error, idx) => (
                        <li key={idx}>Row {error.row}: {error.message}</li>
                      ))}
                      {validationResult.errors.length > 20 && (
                        <li className="text-muted-foreground">
                          ... and {validationResult.errors.length - 20} more errors
                        </li>
                      )}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            {validationResult.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warnings ({validationResult.warnings.length})</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="max-h-32">
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {validationResult.warnings.slice(0, 10).map((warning, idx) => (
                        <li key={idx}>Row {warning.row}: {warning.message}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Preview Data</CardTitle>
                <CardDescription>Review what will be imported</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="preview">
                  <TabsList>
                    <TabsTrigger value="preview" data-testid="tab-preview">
                      Import Preview ({validationResult.previewData.length})
                    </TabsTrigger>
                    <TabsTrigger value="create" data-testid="tab-create">
                      To Create ({validationResult.previewData.filter(p => p.action === 'create').length})
                    </TabsTrigger>
                    <TabsTrigger value="update" data-testid="tab-update">
                      To Update ({validationResult.previewData.filter(p => p.action === 'update').length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Client/Person</TableHead>
                            <TableHead>Service</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.previewData.slice(0, 50).map((item) => (
                            <TableRow key={item.row} data-testid={`preview-row-${item.row}`}>
                              <TableCell className="font-mono">{item.row}</TableCell>
                              <TableCell>
                                <Badge variant={item.action === 'create' ? 'default' : item.action === 'update' ? 'secondary' : 'outline'}>
                                  {item.action}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {item.matchedClient ? (
                                    <>
                                      <Building2 className="w-4 h-4 text-blue-500" />
                                      {item.matchedClient.name}
                                    </>
                                  ) : item.matchedPerson ? (
                                    <>
                                      <User className="w-4 h-4 text-green-500" />
                                      {item.matchedPerson.name}
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Briefcase className="w-4 h-4 text-purple-500" />
                                  {item.matchedService?.name || '-'}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="create">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Client/Person</TableHead>
                            <TableHead>Service</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.previewData.filter(p => p.action === 'create').map((item) => (
                            <TableRow key={item.row}>
                              <TableCell className="font-mono">{item.row}</TableCell>
                              <TableCell>{item.matchedClient?.name || item.matchedPerson?.name || '-'}</TableCell>
                              <TableCell>{item.matchedService?.name || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="update">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Client/Person</TableHead>
                            <TableHead>Service</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.previewData.filter(p => p.action === 'update').map((item) => (
                            <TableRow key={item.row}>
                              <TableCell className="font-mono">{item.row}</TableCell>
                              <TableCell>{item.matchedClient?.name || item.matchedPerson?.name || '-'}</TableCell>
                              <TableCell>{item.matchedService?.name || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('mapping')} data-testid="button-back-mapping">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Mapping
              </Button>
              <Button 
                onClick={executeImport}
                disabled={validationResult.validRows === 0 || validationResult.errors.length > 0}
                data-testid="button-execute-import"
              >
                Execute Import ({validationResult.validRows} rows)
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'importing' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-lg font-medium">Importing Services...</p>
                <Progress value={importProgress} className="w-full max-w-md" />
                <p className="text-sm text-muted-foreground">{importProgress}% complete</p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'complete' && executionResult && (
          <div className="space-y-6">
            <ImportAuditReport 
              report={executionResult.auditReport}
              onClose={resetImport}
              showActions={true}
            />

            <div className="flex justify-center">
              <Button onClick={resetImport} data-testid="button-new-import">
                <RefreshCw className="w-4 h-4 mr-2" />
                Start New Import
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
