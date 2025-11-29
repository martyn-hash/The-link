import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
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
  Download,
  User,
  Building2,
} from "lucide-react";
import { FieldMappingUI } from "@/components/import/FieldMappingUI";
import { ImportAuditReport } from "@/components/import/ImportAuditReport";
import type { 
  FieldMapping, 
  ImportAuditReport as ImportAuditReportType
} from "@shared/importTypes";
import { PEOPLE_FIELD_DEFINITIONS } from "@shared/importTypes";

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ParseResult {
  headers: string[];
  sampleData: Record<string, any>[];
  allData: Record<string, any>[];
  totalRows: number;
  suggestedMappings: FieldMapping[];
}

interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{ row: number; field: string; message: string }>;
  warnings: Array<{ row: number; field: string; message: string }>;
  matchStats: {
    peopleToCreate: number;
    peopleToUpdate: number;
    peopleToSkip: number;
    clientsMatched: number;
    clientsNotFound: number;
  };
  previewData: Array<{
    row: number;
    sourceData: Record<string, any>;
    mappedData: Record<string, any>;
    existingPerson?: { id: string; name: string };
    matchedClient?: { id: string; name: string };
    action: 'create' | 'update' | 'skip';
  }>;
}

interface ExecutionResult {
  success: boolean;
  importId: string;
  summary: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  auditReport: ImportAuditReportType;
}

export default function PeopleImport() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading]);

  const handleFileUpload = async () => {
    if (!selectedFile) {
      showFriendlyError({ error: "Please select a file to upload." });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/people-import/parse', {
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
      setParsedRows(result.allData || result.sampleData);
      setMappings(result.suggestedMappings || []);
      setCurrentStep('mapping');

      toast({
        title: "File Parsed",
        description: `Found ${result.totalRows} rows with ${result.headers.length} columns.`,
      });
    } catch (error: any) {
      showFriendlyError({ error });
    }
  };

  const handleMappingsChange = useCallback((newMappings: FieldMapping[]) => {
    setMappings(newMappings);
  }, []);

  const handleValidate = async () => {
    if (!parseResult || mappings.length === 0) {
      showFriendlyError({ error: "Please complete field mapping before validating." });
      return;
    }

    try {
      const response = await fetch('/api/people-import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: parsedRows,
          mappings,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Validation failed');
      }

      const result: ValidationResult = await response.json();
      setValidationResult(result);
      setCurrentStep('preview');

      if (result.errors.length > 0) {
        showFriendlyError({ error: `${result.errors.length} errors need to be addressed before import.` });
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
      showFriendlyError({ error });
    }
  };

  const executeImport = async () => {
    if (!parseResult || !validationResult) return;

    setCurrentStep('importing');
    setImportProgress(10);

    try {
      setImportProgress(30);
      
      const response = await fetch('/api/people-import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: parsedRows,
          mappings,
        }),
        credentials: 'include',
      });

      setImportProgress(80);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result: ExecutionResult = await response.json();
      setExecutionResult(result);
      setImportProgress(100);
      setCurrentStep('complete');

      if (result.success) {
        toast({
          title: "Import Complete",
          description: `Created ${result.summary.created} people, updated ${result.summary.updated}.`,
        });
      } else {
        showFriendlyError({ error: `Import completed with errors. Created ${result.summary.created} people, updated ${result.summary.updated}.` });
      }
    } catch (error: any) {
      showFriendlyError({ error });
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
    window.location.href = "/api/people-import/template";
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
          <h1 className="text-3xl font-bold" data-testid="page-title">People Import</h1>
          <p className="text-muted-foreground mt-2">
            Import people with flexible column mapping and client association
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
              <AlertTitle>People Import</AlertTitle>
              <AlertDescription>
                <p className="mb-2">Import contacts and individuals with automatic client linking.</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Duplicate Detection:</strong> Matched by Email or Full Name</li>
                  <li><strong>Client Association:</strong> Link to clients by Company Number or Name</li>
                  <li><strong>Phone Formatting:</strong> UK mobile numbers automatically formatted</li>
                  <li><strong>NI Validation:</strong> National Insurance numbers validated</li>
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
                  Get a pre-formatted CSV template with all available fields
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
                  Download Template (.csv)
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
                  Select a CSV or Excel file (.csv, .xlsx, .xls) containing your people data
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
                Found {parseResult.totalRows} rows with {parseResult.headers.length} columns.
              </AlertDescription>
            </Alert>

            <FieldMappingUI
              sourceHeaders={parseResult.headers}
              fieldDefinitions={PEOPLE_FIELD_DEFINITIONS}
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
                  <div className="text-3xl font-bold text-green-600">{validationResult.matchStats.peopleToCreate}</div>
                  <div className="text-xs text-muted-foreground">To Create</div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">{validationResult.matchStats.peopleToUpdate}</div>
                  <div className="text-xs text-muted-foreground">To Update</div>
                </CardContent>
              </Card>
              <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-purple-600">{validationResult.matchStats.clientsMatched}</div>
                  <div className="text-xs text-muted-foreground">Clients Matched</div>
                </CardContent>
              </Card>
              <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-red-600">{validationResult.invalidRows}</div>
                  <div className="text-xs text-muted-foreground">Invalid</div>
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
                <Tabs defaultValue="all">
                  <TabsList>
                    <TabsTrigger value="all" data-testid="tab-all">
                      All ({validationResult.previewData.length})
                    </TabsTrigger>
                    <TabsTrigger value="create" data-testid="tab-create">
                      To Create ({validationResult.matchStats.peopleToCreate})
                    </TabsTrigger>
                    <TabsTrigger value="update" data-testid="tab-update">
                      To Update ({validationResult.matchStats.peopleToUpdate})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="all">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Person</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Linked Client</TableHead>
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
                                  <User className="w-4 h-4 text-green-500" />
                                  {item.mappedData?.fullName || item.existingPerson?.name || '-'}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.mappedData?.email || '-'}
                              </TableCell>
                              <TableCell>
                                {item.matchedClient ? (
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-blue-500" />
                                    {item.matchedClient.name}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
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
                            <TableHead>Person</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Linked Client</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.previewData.filter(p => p.action === 'create').map((item) => (
                            <TableRow key={item.row}>
                              <TableCell className="font-mono">{item.row}</TableCell>
                              <TableCell>{item.mappedData?.fullName || '-'}</TableCell>
                              <TableCell>{item.mappedData?.email || '-'}</TableCell>
                              <TableCell>{item.matchedClient?.name || '-'}</TableCell>
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
                            <TableHead>Existing Person</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Linked Client</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {validationResult.previewData.filter(p => p.action === 'update').map((item) => (
                            <TableRow key={item.row}>
                              <TableCell className="font-mono">{item.row}</TableCell>
                              <TableCell>{item.existingPerson?.name || '-'}</TableCell>
                              <TableCell>{item.mappedData?.email || '-'}</TableCell>
                              <TableCell>{item.matchedClient?.name || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCurrentStep('mapping')} data-testid="button-back-mapping">
                Back to Mapping
              </Button>
              <Button
                onClick={executeImport}
                disabled={validationResult.errors.length > 0}
                className="flex-1"
                size="lg"
                data-testid="button-execute-import"
              >
                <Upload className="w-4 h-4 mr-2" />
                Execute Import ({validationResult.validRows} rows)
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'importing' && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <h3 className="text-lg font-semibold">Importing People...</h3>
                <Progress value={importProgress} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  Processing import and linking to clients...
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'complete' && executionResult && (
          <div className="space-y-6">
            <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-200">Import Complete</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                Successfully processed {executionResult.summary.created + executionResult.summary.updated} people.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{executionResult.summary.created}</div>
                  <div className="text-xs text-muted-foreground">Created</div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">{executionResult.summary.updated}</div>
                  <div className="text-xs text-muted-foreground">Updated</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold">{executionResult.summary.skipped}</div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </CardContent>
              </Card>
              <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-red-600">{executionResult.summary.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </CardContent>
              </Card>
            </div>

            <ImportAuditReport report={executionResult.auditReport} />

            <Button onClick={resetImport} className="w-full" size="lg" data-testid="button-new-import">
              <Upload className="w-4 h-4 mr-2" />
              Start New Import
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
