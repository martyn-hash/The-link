import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Info, 
  Phone,
  Calendar,
  User,
  Building2,
  ArrowRight,
  RefreshCw
} from "lucide-react";

interface TransformedClient {
  original: any;
  transformed: {
    name: string;
    clientType: string;
    clientOnboardedDate: string | null;
    managerEmail: string;
    managerMatched: boolean;
    managerId: string | null;
    companyNumber: string;
    companyStatus: string;
    dateOfCreation: string | null;
    registeredAddress1: string;
    registeredAddress2: string;
    registeredAddress3: string;
    registeredPostcode: string;
    sicCodes: string[];
    email: string;
    monthlyChargeQuote: string;
    companyUtr: string;
    companiesHouseAuthCode: string;
    companyTelephone: string;
    companyTelephoneFormatted: string;
    postalAddress1: string;
    postalAddress2: string;
    postalAddress3: string;
    postalAddressPostcode: string;
    companyEmailDomain: string;
    notes: string;
    tradingAs: string;
  };
  warnings: string[];
  errors: string[];
}

interface TransformedPerson {
  original: any;
  transformed: {
    clientName: string;
    fullName: string;
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: string | null;
    initialContactDate: string | null;
    invoiceAddressType: string;
    addressVerified: boolean;
    photoIdVerified: boolean;
    amlComplete: boolean;
    addressLine1: string;
    addressLine2: string;
    locality: string;
    postalCode: string;
    country: string;
    niNumber: string;
    telephone: string;
    telephoneFormatted: string;
  };
  warnings: string[];
  errors: string[];
}

interface TransformedServiceData {
  original: any;
  transformed: {
    clientCompanyNumber: string;
    clientName: string;
    clientId: string | null;
    serviceName: string;
    serviceId: string | null;
    fieldId: string | null;
    fieldName: string | null;
    fieldType: string | null;
    value: any;
    clientServiceId: string | null;
    isInFileClient?: boolean;
    frequency?: string | null;
    nextStartDate?: string | null;
    nextDueDate?: string | null;
    serviceOwnerId?: string | null;
    serviceOwnerEmail?: string | null;
    roleAssignments?: Array<{
      roleName: string;
      roleId: string | null;
      userEmail: string;
      userId: string | null;
    }>;
  };
  warnings: string[];
  errors: string[];
}

interface ParseResult {
  success: boolean;
  summary: {
    clientCount: number;
    personCount: number;
    serviceDataCount: number;
    hasErrors: boolean;
    hasWarnings: boolean;
    errorCount: number;
    warningCount: number;
  };
  clients: TransformedClient[];
  people: TransformedPerson[];
  serviceData: TransformedServiceData[];
  availableManagers: { id: string; email: string; name: string }[];
}

interface ImportResult {
  success: boolean;
  clientsCreated: number;
  clientsUpdated: number;
  peopleCreated: number;
  peopleUpdated: number;
  relationshipsCreated: number;
  serviceDataUpdated: number;
  serviceDataSkipped: number;
  errors: string[];
}

export default function ExcelImport() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [currentStep, setCurrentStep] = useState<'upload' | 'parsing' | 'preview' | 'importing' | 'complete'>('upload');
  const [importProgress, setImportProgress] = useState(0);

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
    if (!excelFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to upload.",
        variant: "destructive",
      });
      return;
    }

    setCurrentStep('parsing');

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const response = await fetch('/api/excel-import/parse', {
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
      setCurrentStep('preview');

      if (result.summary.hasErrors) {
        toast({
          title: "Parsing Complete with Errors",
          description: `Found ${result.summary.errorCount} errors that need attention.`,
          variant: "destructive",
        });
      } else if (result.summary.hasWarnings) {
        toast({
          title: "Parsing Complete with Warnings",
          description: `Found ${result.summary.warningCount} warnings to review.`,
        });
      } else {
        const serviceDataMsg = result.summary.serviceDataCount > 0 
          ? ` with ${result.summary.serviceDataCount} service data fields` 
          : '';
        toast({
          title: "Parsing Successful",
          description: `Ready to import ${result.summary.clientCount} clients and ${result.summary.personCount} people${serviceDataMsg}.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Parse Error",
        description: error.message,
        variant: "destructive",
      });
      setCurrentStep('upload');
    }
  };

  const executeImport = async () => {
    if (!parseResult) return;

    setCurrentStep('importing');
    setImportProgress(10);

    try {
      const response = await fetch('/api/excel-import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clients: parseResult.clients,
          people: parseResult.people,
          serviceData: parseResult.serviceData || [],
        }),
        credentials: 'include',
      });

      setImportProgress(80);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import data');
      }

      const result: ImportResult = await response.json();
      setImportResult(result);
      setImportProgress(100);
      setCurrentStep('complete');

      const serviceDataMsg = result.serviceDataUpdated > 0 
        ? ` and ${result.serviceDataUpdated} service data updates` 
        : '';
      toast({
        title: "Import Complete",
        description: `Created ${result.clientsCreated} clients, updated ${result.clientsUpdated}, and processed ${result.peopleCreated + result.peopleUpdated} people${serviceDataMsg}.`,
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
    setExcelFile(null);
    setParseResult(null);
    setImportResult(null);
    setCurrentStep('upload');
    setImportProgress(0);
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
          <h1 className="text-3xl font-bold" data-testid="page-title">Excel Data Import</h1>
          <p className="text-muted-foreground mt-2">
            Import clients and people from your Excel migration file with automatic data transformation
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <Badge variant={currentStep === 'upload' ? 'default' : 'outline'} data-testid="step-upload">
              1. Upload Excel
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={currentStep === 'parsing' ? 'default' : 'outline'} data-testid="step-parsing">
              2. Parse & Transform
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={currentStep === 'preview' ? 'default' : 'outline'} data-testid="step-preview">
              3. Review Mappings
            </Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Badge variant={currentStep === 'importing' || currentStep === 'complete' ? 'default' : 'outline'} data-testid="step-import">
              4. Import
            </Badge>
          </div>
        </div>

        {currentStep === 'upload' && (
          <div className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Excel File Requirements</AlertTitle>
              <AlertDescription>
                <p className="mb-2">Your Excel file can have the following sheets:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Client sheet:</strong> Company information, manager, contact details, UTR, etc.</li>
                  <li><strong>Person sheet:</strong> Individual people linked to clients with their personal details</li>
                  <li><strong>Service Data sheet (optional):</strong> Service-specific data including UDF values, configuration, and role assignments</li>
                </ul>
                <p className="mt-2 text-sm">The system will automatically:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><Calendar className="inline w-3 h-3 mr-1" />Convert Excel date serials to readable dates</li>
                  <li><Phone className="inline w-3 h-3 mr-1" />Format phone numbers to UK standard</li>
                  <li><User className="inline w-3 h-3 mr-1" />Match manager emails to system users</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="service-data">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Service Data Sheet Reference
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="font-medium mb-2">Required Columns:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li><strong>Client Company Number</strong> or <strong>Client Name</strong> - to identify the client</li>
                        <li><strong>Service Name</strong> - exact name of the service (e.g., "Annual Accounts")</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium mb-2">UDF (Custom Field) Columns:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li><strong>Field ID</strong> - the unique ID of the custom field (find this on the Services page)</li>
                        <li><strong>Value</strong> - the value to set for this field</li>
                      </ul>
                      <p className="text-xs text-muted-foreground mt-2">
                        Tip: Navigate to <strong>Services</strong> page, click on a service, and view its UDF definitions to find the Field IDs.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium mb-2">Service Configuration Columns (Optional):</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                        <li><strong>Frequency</strong> - service frequency (e.g., "Monthly", "Quarterly", "Annual")</li>
                        <li><strong>Next Start Date</strong> - when the next service period starts</li>
                        <li><strong>Next Due Date</strong> - when the next service is due</li>
                        <li><strong>Service Owner</strong> - email address of the user who owns this service</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium mb-2">Role Assignment Columns (Optional):</p>
                      <p className="text-muted-foreground mb-2">
                        Add columns with the header format <strong>Role: [Role Name]</strong> and set the value to the user's email address.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Example: Column header "Role: Manager" with value "john@company.com" assigns the Manager role to that user.
                      </p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Upload Excel File
                </CardTitle>
                <CardDescription>
                  Select your Excel file (.xlsx) containing the Client and Person sheets
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                    data-testid="input-excel-file"
                  />
                  {excelFile && (
                    <Badge variant="outline" className="flex items-center gap-1" data-testid="badge-file-selected">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {excelFile.name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleFileUpload}
              disabled={!excelFile}
              className="w-full"
              size="lg"
              data-testid="button-parse-file"
            >
              <Upload className="w-4 h-4 mr-2" />
              Parse and Preview Data
            </Button>
          </div>
        )}

        {currentStep === 'parsing' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-lg font-medium">Parsing Excel file...</p>
                <p className="text-sm text-muted-foreground">
                  Converting dates, formatting phone numbers, and matching managers
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'preview' && parseResult && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{parseResult.summary.clientCount}</p>
                      <p className="text-sm text-muted-foreground">Clients</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <User className="w-8 h-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{parseResult.summary.personCount}</p>
                      <p className="text-sm text-muted-foreground">People</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-8 h-8 text-yellow-500" />
                    <div>
                      <p className="text-2xl font-bold">{parseResult.summary.warningCount}</p>
                      <p className="text-sm text-muted-foreground">Warnings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                    <div>
                      <p className="text-2xl font-bold">{parseResult.summary.errorCount}</p>
                      <p className="text-sm text-muted-foreground">Errors</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {parseResult.summary.hasWarnings && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warnings Found</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="max-h-32">
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {parseResult.clients
                        .filter(c => c.warnings.length > 0)
                        .slice(0, 10)
                        .map((c, idx) => (
                          c.warnings.map((w, wIdx) => (
                            <li key={`c-${idx}-${wIdx}`}>{c.transformed.name}: {w}</li>
                          ))
                        ))}
                      {parseResult.people
                        .filter(p => p.warnings.length > 0)
                        .slice(0, 10)
                        .map((p, idx) => (
                          p.warnings.map((w, wIdx) => (
                            <li key={`p-${idx}-${wIdx}`}>{p.transformed.fullName}: {w}</li>
                          ))
                        ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="clients" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="clients" data-testid="tab-clients">
                  <Building2 className="w-4 h-4 mr-2" />
                  Clients ({parseResult.summary.clientCount})
                </TabsTrigger>
                <TabsTrigger value="people" data-testid="tab-people">
                  <User className="w-4 h-4 mr-2" />
                  People ({parseResult.summary.personCount})
                </TabsTrigger>
                <TabsTrigger value="serviceData" data-testid="tab-service-data">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Service Data ({parseResult.summary.serviceDataCount || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="clients" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Client Data Preview</CardTitle>
                    <CardDescription>
                      Review the transformed client data before import
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Client Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Company #</TableHead>
                            <TableHead>Manager</TableHead>
                            <TableHead>Phone (Formatted)</TableHead>
                            <TableHead>Onboarded</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parseResult.clients.map((client, idx) => (
                            <TableRow key={idx} className={client.errors.length > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                              <TableCell className="font-medium">
                                {client.transformed.name}
                                {client.transformed.tradingAs && (
                                  <span className="text-xs text-muted-foreground block">
                                    t/a {client.transformed.tradingAs}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{client.transformed.clientType}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {client.transformed.companyNumber || '-'}
                              </TableCell>
                              <TableCell>
                                {client.transformed.managerMatched ? (
                                  <Badge variant="default" className="bg-green-500">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    {client.transformed.managerEmail}
                                  </Badge>
                                ) : client.transformed.managerEmail ? (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="destructive">
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        Not Matched
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      "{client.transformed.managerEmail}" not found. Update to email address in Excel.
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {client.transformed.companyTelephoneFormatted ? (
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-green-500" />
                                    <span className="font-mono text-sm">
                                      {client.transformed.companyTelephoneFormatted}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {client.transformed.clientOnboardedDate ? (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-blue-500" />
                                    <span className="text-sm">{client.transformed.clientOnboardedDate}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {client.errors.length > 0 ? (
                                  <Badge variant="destructive">Error</Badge>
                                ) : client.warnings.length > 0 ? (
                                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">Warning</Badge>
                                ) : (
                                  <Badge variant="outline" className="border-green-500 text-green-600">Ready</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="people" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>People Data Preview</CardTitle>
                    <CardDescription>
                      Review the transformed people data before import
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone (Formatted)</TableHead>
                            <TableHead>DOB</TableHead>
                            <TableHead>NI Number</TableHead>
                            <TableHead>Verifications</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parseResult.people.map((person, idx) => (
                            <TableRow key={idx} className={person.errors.length > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                              <TableCell className="font-medium">
                                {person.transformed.fullName}
                              </TableCell>
                              <TableCell className="text-sm">
                                {person.transformed.clientName}
                              </TableCell>
                              <TableCell className="text-sm">
                                {person.transformed.email || '-'}
                              </TableCell>
                              <TableCell>
                                {person.transformed.telephoneFormatted ? (
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-green-500" />
                                    <span className="font-mono text-sm">
                                      {person.transformed.telephoneFormatted}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {person.transformed.dateOfBirth ? (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-blue-500" />
                                    <span className="text-sm">{person.transformed.dateOfBirth}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {person.transformed.niNumber || '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge 
                                        variant={person.transformed.photoIdVerified ? "default" : "outline"}
                                        className={person.transformed.photoIdVerified ? "bg-green-500" : ""}
                                      >
                                        ID
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>Photo ID {person.transformed.photoIdVerified ? 'Verified' : 'Not Verified'}</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge 
                                        variant={person.transformed.addressVerified ? "default" : "outline"}
                                        className={person.transformed.addressVerified ? "bg-green-500" : ""}
                                      >
                                        Addr
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>Address {person.transformed.addressVerified ? 'Verified' : 'Not Verified'}</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge 
                                        variant={person.transformed.amlComplete ? "default" : "outline"}
                                        className={person.transformed.amlComplete ? "bg-green-500" : ""}
                                      >
                                        AML
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>AML {person.transformed.amlComplete ? 'Complete' : 'Not Complete'}</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="serviceData" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Service Data Preview</CardTitle>
                    <CardDescription>
                      Review the service-specific custom field values before import (optional sheet)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(!parseResult.serviceData || parseResult.serviceData.length === 0) ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No "Service Data" sheet found in the Excel file.</p>
                        <p className="text-sm mt-2">This is optional - you can add service-specific data later via the client detail page.</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Client</TableHead>
                              <TableHead>Service</TableHead>
                              <TableHead>Data Type</TableHead>
                              <TableHead>Details</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parseResult.serviceData.map((item, idx) => {
                              const hasConfig = item.transformed.frequency || item.transformed.nextStartDate || item.transformed.nextDueDate || item.transformed.serviceOwnerEmail;
                              const hasRoles = (item.transformed.roleAssignments?.length ?? 0) > 0;
                              const hasUdf = item.transformed.fieldId;
                              
                              return (
                                <TableRow key={idx} className={item.errors.length > 0 ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                                  <TableCell className="font-medium">
                                    {item.transformed.clientName}
                                    {item.transformed.clientId && (
                                      <CheckCircle className="w-3 h-3 text-green-500 inline ml-1" />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {item.transformed.serviceName}
                                    {item.transformed.serviceId && (
                                      <CheckCircle className="w-3 h-3 text-green-500 inline ml-1" />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="flex flex-wrap gap-1">
                                      {hasUdf && <Badge variant="secondary" className="text-xs">UDF</Badge>}
                                      {hasConfig && <Badge variant="secondary" className="text-xs">Config</Badge>}
                                      {hasRoles && <Badge variant="secondary" className="text-xs">Roles</Badge>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm max-w-[300px]">
                                    <div className="space-y-1">
                                      {hasUdf && (
                                        <div className="truncate">
                                          <span className="text-muted-foreground">{item.transformed.fieldName || item.transformed.fieldId}:</span>{' '}
                                          <span className="font-mono">{String(item.transformed.value ?? '')}</span>
                                        </div>
                                      )}
                                      {item.transformed.frequency && (
                                        <div className="text-xs text-muted-foreground">Frequency: {item.transformed.frequency}</div>
                                      )}
                                      {item.transformed.nextStartDate && (
                                        <div className="text-xs text-muted-foreground">Start: {item.transformed.nextStartDate}</div>
                                      )}
                                      {item.transformed.nextDueDate && (
                                        <div className="text-xs text-muted-foreground">Due: {item.transformed.nextDueDate}</div>
                                      )}
                                      {item.transformed.serviceOwnerEmail && (
                                        <div className="text-xs text-muted-foreground">Owner: {item.transformed.serviceOwnerEmail}</div>
                                      )}
                                      {hasRoles && item.transformed.roleAssignments && (
                                        <div className="text-xs text-muted-foreground">
                                          Roles: {item.transformed.roleAssignments.map((r: any) => `${r.roleName}→${r.userEmail}`).join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {item.errors.length > 0 ? (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Badge variant="destructive">Error</Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {item.errors.join(', ')}
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : item.warnings.length > 0 ? (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Badge variant="outline" className="border-yellow-500 text-yellow-600">Warning</Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {item.warnings.join(', ')}
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : item.transformed.clientServiceId ? (
                                      <Badge variant="outline" className="border-green-500 text-green-600">Ready</Badge>
                                    ) : item.transformed.isInFileClient ? (
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Badge variant="outline" className="border-blue-500 text-blue-600">New Client</Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Client will be created during import - service must be assigned first for data to apply
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <Badge variant="outline" className="border-yellow-500 text-yellow-600">No Service Link</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex gap-4">
              <Button variant="outline" onClick={resetImport} className="flex-1" data-testid="button-start-over">
                <RefreshCw className="w-4 h-4 mr-2" />
                Start Over
              </Button>
              <Button 
                onClick={executeImport} 
                disabled={parseResult.summary.hasErrors}
                className="flex-1"
                size="lg"
                data-testid="button-execute-import"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import {parseResult.summary.clientCount} Clients & {parseResult.summary.personCount} People
                {(parseResult.serviceData?.length || 0) > 0 && ` + ${parseResult.serviceData.length} Service Fields`}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'importing' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-lg font-medium">Importing data...</p>
                <Progress value={importProgress} className="w-full max-w-md" />
                <p className="text-sm text-muted-foreground">
                  Creating clients and people records
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'complete' && importResult && (
          <div className="space-y-6">
            <Alert className={importResult.success ? "border-green-500" : "border-red-500"}>
              {importResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertTitle>{importResult.success ? "Import Successful!" : "Import Completed with Errors"}</AlertTitle>
              <AlertDescription>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{importResult.clientsCreated}</p>
                    <p className="text-xs text-muted-foreground">Clients Created</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{importResult.clientsUpdated}</p>
                    <p className="text-xs text-muted-foreground">Clients Updated</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{importResult.peopleCreated}</p>
                    <p className="text-xs text-muted-foreground">People Created</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{importResult.peopleUpdated}</p>
                    <p className="text-xs text-muted-foreground">People Updated</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{importResult.relationshipsCreated}</p>
                    <p className="text-xs text-muted-foreground">Relationships</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">{importResult.serviceDataUpdated || 0}</p>
                    <p className="text-xs text-muted-foreground">Service Data Updated</p>
                    {importResult.serviceDataSkipped > 0 && (
                      <p className="text-xs text-yellow-600 mt-1">({importResult.serviceDataSkipped} skipped)</p>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Errors During Import</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="max-h-48 mt-2">
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {importResult.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4">
              <Button variant="outline" onClick={resetImport} className="flex-1" data-testid="button-import-more">
                <Upload className="w-4 h-4 mr-2" />
                Import More Data
              </Button>
              <Button onClick={() => navigate('/clients')} className="flex-1" data-testid="button-view-clients">
                <Building2 className="w-4 h-4 mr-2" />
                View Clients
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
