import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { useQuery } from "@tanstack/react-query";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  Briefcase,
  Settings,
  Users,
  FileText
} from "lucide-react";
import { FieldMappingUI } from "@/components/import/FieldMappingUI";
import { ImportAuditReport } from "@/components/import/ImportAuditReport";
import type { 
  FieldMapping, 
  ServiceImportValidationResult,
  ServiceImportExecutionResult,
  ImportAuditReport as ImportAuditReportType,
  FieldMappingDefinition
} from "@shared/importTypes";
import { 
  CLIENT_SERVICE_FIELD_DEFINITIONS, 
  PEOPLE_SERVICE_FIELD_DEFINITIONS 
} from "@shared/importTypes";

type ImportStep = 'select_service' | 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';
type ImportType = 'client_services' | 'people_services' | 'mixed';

interface UdfDefinition {
  id: string;
  name: string;
  type: 'number' | 'date' | 'boolean' | 'short_text' | 'long_text' | 'dropdown';
  required?: boolean;
  options?: string[];
}

interface ServiceWithDetails {
  id: string;
  name: string;
  isPersonalService: boolean;
  udfDefinitions: UdfDefinition[];
  roles: { id: string; name: string }[];
}

interface ServicesResponse {
  services: ServiceWithDetails[];
  users: { id: string; email: string; name: string }[];
}

interface ParseResult {
  success: boolean;
  totalRows: number;
  headers: string[];
  importType: ImportType;
  sampleData: Record<string, any>[];
  allData: Record<string, any>[];
  availableServices: { id: string; name: string; isPersonalService: boolean }[];
  availableUsers: { id: string; email: string; name: string }[];
  availableWorkRoles: { id: string; name: string }[];
}

export default function ServiceImport() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<ImportStep>('select_service');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [validationResult, setValidationResult] = useState<ServiceImportValidationResult | null>(null);
  const [executionResult, setExecutionResult] = useState<ServiceImportExecutionResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);

  const { data: servicesData, isLoading: servicesLoading } = useQuery<ServicesResponse>({
    queryKey: ['/api/service-import/services'],
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      showFriendlyError({ error: "You are logged out. Logging in again..." });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (selectedServiceId && servicesData?.services) {
      const service = servicesData.services.find(s => s.id === selectedServiceId);
      setSelectedService(service || null);
    } else {
      setSelectedService(null);
    }
  }, [selectedServiceId, servicesData?.services]);

  const handleServiceSelect = () => {
    if (!selectedService) {
      showFriendlyError({ error: "Please select a service to import data for." });
      return;
    }
    setCurrentStep('upload');
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      showFriendlyError({ error: "Please select a file to upload." });
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
      setParsedRows(result.allData || result.sampleData);

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
    if (!parseResult || mappings.length === 0 || !selectedService) {
      showFriendlyError({ error: "Please complete field mapping before validating." });
      return;
    }

    try {
      const importType = selectedService.isPersonalService ? 'people_services' : 'client_services';
      
      const response = await fetch('/api/service-import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsedRows,
          mappings,
          importType,
          selectedServiceId: selectedService.id,
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
    if (!parseResult || !validationResult || !selectedService) return;

    setCurrentStep('importing');
    setImportProgress(10);

    try {
      setImportProgress(30);
      
      const importType = selectedService.isPersonalService ? 'people_services' : 'client_services';
      
      const response = await fetch('/api/service-import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsedRows,
          mappings,
          importType,
          selectedServiceId: selectedService.id,
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

      if (result.success) {
        toast({
          title: "Import Complete",
          description: `Created ${result.summary.clientServicesCreated + result.summary.peopleServicesCreated} services, updated ${result.summary.clientServicesUpdated + result.summary.peopleServicesUpdated}.`,
        });
      } else {
        showFriendlyError({ error: `Import completed with errors. Created ${result.summary.clientServicesCreated + result.summary.peopleServicesCreated} services, updated ${result.summary.clientServicesUpdated + result.summary.peopleServicesUpdated}.` });
      }
    } catch (error: any) {
      showFriendlyError({ error });
      setCurrentStep('preview');
    }
  };

  const resetImport = () => {
    setCurrentStep('select_service');
    setSelectedServiceId('');
    setSelectedService(null);
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

  const getFieldDefinitions = useCallback((): FieldMappingDefinition[] => {
    if (!selectedService) {
      return CLIENT_SERVICE_FIELD_DEFINITIONS;
    }

    const baseFields = selectedService.isPersonalService 
      ? PEOPLE_SERVICE_FIELD_DEFINITIONS.filter(f => f.systemField !== 'serviceName')
      : CLIENT_SERVICE_FIELD_DEFINITIONS.filter(f => f.systemField !== 'serviceName');

    const dynamicFields: FieldMappingDefinition[] = [];

    for (const role of selectedService.roles) {
      dynamicFields.push({
        systemField: `role_${role.name}`,
        label: `Role: ${role.name}`,
        description: `Email address of user to assign as ${role.name}`,
        required: false,
        type: 'email',
        group: 'Role Assignments',
      });
    }

    for (const udf of selectedService.udfDefinitions) {
      let fieldType: FieldMappingDefinition['type'] = 'text';
      if (udf.type === 'date') fieldType = 'date';
      else if (udf.type === 'boolean') fieldType = 'boolean';
      else if (udf.type === 'number') fieldType = 'text';
      else if (udf.type === 'dropdown') fieldType = 'select';

      dynamicFields.push({
        systemField: `udf_${udf.id}`,
        label: udf.name,
        description: `Custom field: ${udf.name}`,
        required: udf.required || false,
        type: fieldType,
        options: udf.options,
        group: 'Custom Fields',
      });
    }

    return [...baseFields, ...dynamicFields];
  }, [selectedService]);

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
            Import service data for existing clients with role assignments and custom fields
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <Badge variant={currentStep === 'select_service' ? 'default' : 'outline'} data-testid="step-select">
              1. Select Service
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={currentStep === 'upload' ? 'default' : 'outline'} data-testid="step-upload">
              2. Upload
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={currentStep === 'mapping' ? 'default' : 'outline'} data-testid="step-mapping">
              3. Map Fields
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={currentStep === 'preview' ? 'default' : 'outline'} data-testid="step-preview">
              4. Preview
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={currentStep === 'importing' || currentStep === 'complete' ? 'default' : 'outline'} data-testid="step-complete">
              5. Import
            </Badge>
          </div>
        </div>

        {currentStep === 'select_service' && (
          <div className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Select Target Service</AlertTitle>
              <AlertDescription>
                <p>Choose the service you want to import data for. The system will then show you the relevant fields including:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>Standard fields (frequency, dates, owner)</li>
                  <li>Work role assignments specific to this service</li>
                  <li>Custom fields (UDFs) defined for this service</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Choose Service
                </CardTitle>
                <CardDescription>
                  Select the service type you are importing data for
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {servicesLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="service-select">Service</Label>
                      <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                        <SelectTrigger id="service-select" data-testid="select-service">
                          <SelectValue placeholder="Select a service..." />
                        </SelectTrigger>
                        <SelectContent>
                          {servicesData?.services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              <div className="flex items-center gap-2">
                                {service.isPersonalService ? (
                                  <User className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Building2 className="w-4 h-4 text-blue-500" />
                                )}
                                {service.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedService && (
                      <Card className="bg-muted/50">
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-5 h-5 text-primary" />
                              <span className="font-semibold text-lg">{selectedService.name}</span>
                              <Badge variant={selectedService.isPersonalService ? 'secondary' : 'default'}>
                                {selectedService.isPersonalService ? 'Personal Service' : 'Client Service'}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <Users className="w-4 h-4" />
                                  Work Roles ({selectedService.roles.length})
                                </div>
                                {selectedService.roles.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {selectedService.roles.map((role) => (
                                      <Badge key={role.id} variant="outline" className="text-xs">
                                        {role.name}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No roles configured</p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <FileText className="w-4 h-4" />
                                  Custom Fields ({selectedService.udfDefinitions.length})
                                </div>
                                {selectedService.udfDefinitions.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {selectedService.udfDefinitions.map((udf) => (
                                      <Badge key={udf.id} variant="outline" className="text-xs">
                                        {udf.name}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No custom fields</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleServiceSelect}
              disabled={!selectedService}
              className="w-full"
              size="lg"
              data-testid="button-continue-to-upload"
            >
              Continue to Upload
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {currentStep === 'upload' && selectedService && (
          <div className="space-y-6">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Importing for: {selectedService.name}</AlertTitle>
              <AlertDescription>
                <p className="mb-2">
                  {selectedService.isPersonalService 
                    ? 'This is a personal service - match people by email or name.'
                    : 'This is a client service - match clients by company number or name.'}
                </p>
                <div className="flex gap-4 text-sm">
                  <span><strong>{selectedService.roles.length}</strong> role fields available</span>
                  <span><strong>{selectedService.udfDefinitions.length}</strong> custom fields available</span>
                </div>
              </AlertDescription>
            </Alert>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Download Import Template
                </CardTitle>
                <CardDescription>
                  Get a pre-formatted Excel template with example data
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

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep('select_service')} data-testid="button-back-select">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Change Service
              </Button>
              <Button
                onClick={handleFileUpload}
                disabled={!selectedFile}
                size="lg"
                data-testid="button-parse"
              >
                <Upload className="w-4 h-4 mr-2" />
                Parse File & Continue
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'mapping' && parseResult && selectedService && (
          <div className="space-y-6">
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertTitle>File Parsed Successfully</AlertTitle>
              <AlertDescription>
                Found {parseResult.totalRows} rows for <strong>{selectedService.name}</strong>.
                Map your columns to the available fields including roles and custom fields.
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

        {currentStep === 'preview' && validationResult && selectedService && (
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
                <CardDescription>Review what will be imported for {selectedService.name}</CardDescription>
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
                                  {item.matchedService?.name || selectedService.name}
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
                              <TableCell>{item.matchedService?.name || selectedService.name}</TableCell>
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
                              <TableCell>{item.matchedService?.name || selectedService.name}</TableCell>
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
