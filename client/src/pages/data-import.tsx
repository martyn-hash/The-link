import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileText, CheckCircle, AlertCircle, Info, Download } from "lucide-react";
import Papa from "papaparse";

interface ParsedData {
  clients: any[];
  clientServices: any[];
  roleAssignments: any[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  data?: ParsedData;
}

interface ImportResult {
  success: boolean;
  clientsCreated: number;
  peopleCreated: number;
  relationshipsCreated: number;
  servicesCreated: number;
  rolesAssigned: number;
  errors: string[];
}

export default function DataImport() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  // File upload states
  const [clientsFile, setClientsFile] = useState<File | null>(null);
  const [servicesFile, setServicesFile] = useState<File | null>(null);
  const [rolesFile, setRolesFile] = useState<File | null>(null);

  // Parsed data state
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  // UI states
  const [currentStep, setCurrentStep] = useState<'upload' | 'validate' | 'preview' | 'import' | 'complete'>('upload');
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Redirect to login if not authenticated
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
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Parse CSV files
  const parseFiles = () => {
    if (!clientsFile || !servicesFile || !rolesFile) {
      toast({
        title: "Missing Files",
        description: "Please upload all three CSV files before proceeding.",
        variant: "destructive",
      });
      return;
    }

    const parsePromises = [
      new Promise((resolve, reject) => {
        Papa.parse(clientsFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (error: any) => reject(error),
        });
      }),
      new Promise((resolve, reject) => {
        Papa.parse(servicesFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (error: any) => reject(error),
        });
      }),
      new Promise((resolve, reject) => {
        Papa.parse(rolesFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (error: any) => reject(error),
        });
      }),
    ];

    Promise.all(parsePromises)
      .then(([clients, clientServices, roleAssignments]) => {
        const data: ParsedData = {
          clients: clients as any[],
          clientServices: clientServices as any[],
          roleAssignments: roleAssignments as any[],
        };
        setParsedData(data);
        setCurrentStep('validate');
        validateData(data);
      })
      .catch((error) => {
        toast({
          title: "Parse Error",
          description: `Failed to parse CSV files: ${error.message}`,
          variant: "destructive",
        });
      });
  };

  // Validate parsed data
  const validateData = async (data: ParsedData) => {
    try {
      const response = await apiRequest("POST", "/api/import/validate", data);
      const validationResponse = response as ValidationResult;
      console.log("Validation response:", validationResponse);
      setValidationResult(validationResponse);
      
      if (validationResponse.isValid) {
        console.log("Validation successful, moving to preview");
        setCurrentStep('preview');
      } else {
        console.log("Validation failed with errors:", validationResponse.errors);
        setCurrentStep('preview');
      }
    } catch (error: any) {
      console.error("Validation error:", error);
      toast({
        title: "Validation Error",
        description: error.message || "Failed to validate data",
        variant: "destructive",
      });
      setCurrentStep('upload');
    }
  };

  // Execute import
  const executeImport = async () => {
    if (!parsedData || !validationResult?.isValid) return;

    setCurrentStep('import');
    setImportProgress(0);

    try {
      const response = await apiRequest("POST", "/api/import/execute", parsedData);
      setImportResult(response as ImportResult);
      setImportProgress(100);
      setCurrentStep('complete');
      
      toast({
        title: "Import Complete",
        description: "Data has been successfully imported into the system.",
      });
    } catch (error: any) {
      toast({
        title: "Import Error",
        description: error.message || "Failed to import data",
        variant: "destructive",
      });
      setCurrentStep('preview');
    }
  };

  // Download template CSVs
  const downloadTemplates = () => {
    const clientsTemplate = `client_ref,client_name,client_type,client_email,company_number,person_ref,person_full_name,person_email,person_telephone,person_primary_phone,person_primary_email,officer_role,is_primary_contact
CLI001,Example Ltd,company,info@example.com,12345678,PER001,John Doe,john@example.com,01234567890,+447123456789,john@example.com,director,yes`;

    const servicesTemplate = `client_ref,service_name,frequency,next_start_date,next_due_date,service_owner_email,is_active
CLI001,Monthly Bookkeeping,monthly,01/12/2024,15/12/2024,admin@example.com,yes`;

    const rolesTemplate = `client_ref,service_name,work_role_name,assigned_user_email,is_active
CLI001,Monthly Bookkeeping,Bookkeeper,admin@example.com,yes`;

    // Create download links
    const downloadCSV = (content: string, filename: string) => {
      const blob = new Blob([content], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    };

    downloadCSV(clientsTemplate, '1_clients_and_people_template.csv');
    setTimeout(() => downloadCSV(servicesTemplate, '2_client_services_template.csv'), 100);
    setTimeout(() => downloadCSV(rolesTemplate, '3_role_assignments_template.csv'), 200);

    toast({
      title: "Templates Downloaded",
      description: "Three template CSV files have been downloaded to your computer.",
    });
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
      <TopNavigation />
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Data Import</h1>
          <p className="text-muted-foreground mt-2">
            Import clients, people, services, and role assignments from CSV files
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <Badge variant={currentStep === 'upload' ? 'default' : 'outline'}>1. Upload</Badge>
            <Badge variant={currentStep === 'validate' ? 'default' : 'outline'}>2. Validate</Badge>
            <Badge variant={currentStep === 'preview' ? 'default' : 'outline'}>3. Preview</Badge>
            <Badge variant={currentStep === 'import' ? 'default' : 'outline'}>4. Import</Badge>
            <Badge variant={currentStep === 'complete' ? 'default' : 'outline'}>5. Complete</Badge>
          </div>
        </div>

        {/* Upload Step */}
        {currentStep === 'upload' && (
          <div className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Required CSV Files</AlertTitle>
              <AlertDescription>
                You need to upload 3 CSV files in the following order:
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li><strong>Clients & People:</strong> Contains client and person information with their relationships</li>
                  <li><strong>Client Services:</strong> Links clients to services with scheduling details</li>
                  <li><strong>Role Assignments:</strong> Assigns users to work roles for specific client services</li>
                </ol>
              </AlertDescription>
            </Alert>

            <Button onClick={downloadTemplates} variant="outline" className="mb-4" data-testid="button-download-templates">
              <Download className="w-4 h-4 mr-2" />
              Download Template CSV Files
            </Button>

            <Card>
              <CardHeader>
                <CardTitle>1. Clients & People Master Data</CardTitle>
                <CardDescription>
                  Upload CSV with columns: client_ref, client_name, client_type, client_email, company_number, 
                  person_ref, person_full_name, person_email, person_telephone, person_primary_phone, 
                  person_primary_email, officer_role, is_primary_contact
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setClientsFile(e.target.files?.[0] || null)}
                    data-testid="upload-clients"
                  />
                  {clientsFile && (
                    <Badge variant="outline" data-testid="badge-clients-uploaded">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {clientsFile.name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Client Services</CardTitle>
                <CardDescription>
                  Upload CSV with columns: client_ref, service_name, frequency, next_start_date, 
                  next_due_date, service_owner_email, is_active
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setServicesFile(e.target.files?.[0] || null)}
                    data-testid="upload-services"
                  />
                  {servicesFile && (
                    <Badge variant="outline" data-testid="badge-services-uploaded">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {servicesFile.name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Role Assignments</CardTitle>
                <CardDescription>
                  Upload CSV with columns: client_ref, service_name, work_role_name, 
                  assigned_user_email, is_active
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setRolesFile(e.target.files?.[0] || null)}
                    data-testid="upload-roles"
                  />
                  {rolesFile && (
                    <Badge variant="outline" data-testid="badge-roles-uploaded">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {rolesFile.name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={parseFiles}
              disabled={!clientsFile || !servicesFile || !rolesFile}
              className="w-full"
              data-testid="button-validate"
            >
              <Upload className="w-4 h-4 mr-2" />
              Parse and Validate Files
            </Button>
          </div>
        )}

        {/* Validation Step */}
        {currentStep === 'validate' && (
          <Card>
            <CardHeader>
              <CardTitle>Validating Data...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview Step */}
        {currentStep === 'preview' && validationResult && (
          <div className="space-y-6">
            {validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Errors</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationResult.warnings.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Warnings</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationResult.isValid && parsedData && (
              <>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Data Validated Successfully</AlertTitle>
                  <AlertDescription>
                    Ready to import {parsedData.clients.length} client records, {parsedData.clientServices.length} service mappings, 
                    and {parsedData.roleAssignments.length} role assignments.
                  </AlertDescription>
                </Alert>

                <Tabs defaultValue="clients" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="clients" data-testid="tab-clients">
                      Clients & People ({parsedData.clients.length})
                    </TabsTrigger>
                    <TabsTrigger value="services" data-testid="tab-services">
                      Services ({parsedData.clientServices.length})
                    </TabsTrigger>
                    <TabsTrigger value="roles" data-testid="tab-roles">
                      Role Assignments ({parsedData.roleAssignments.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="clients" className="mt-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="max-h-96 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Client Ref</TableHead>
                                <TableHead>Client Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Person</TableHead>
                                <TableHead>Role</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {parsedData.clients.slice(0, 10).map((row, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{row.client_ref}</TableCell>
                                  <TableCell>{row.client_name}</TableCell>
                                  <TableCell>{row.client_type}</TableCell>
                                  <TableCell>{row.person_full_name}</TableCell>
                                  <TableCell>{row.officer_role}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {parsedData.clients.length > 10 && (
                            <p className="text-sm text-muted-foreground text-center mt-4">
                              Showing 10 of {parsedData.clients.length} rows
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="services" className="mt-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="max-h-96 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Client Ref</TableHead>
                                <TableHead>Service</TableHead>
                                <TableHead>Frequency</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>Due Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {parsedData.clientServices.slice(0, 10).map((row, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{row.client_ref}</TableCell>
                                  <TableCell>{row.service_name}</TableCell>
                                  <TableCell>{row.frequency}</TableCell>
                                  <TableCell>{row.next_start_date}</TableCell>
                                  <TableCell>{row.next_due_date}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {parsedData.clientServices.length > 10 && (
                            <p className="text-sm text-muted-foreground text-center mt-4">
                              Showing 10 of {parsedData.clientServices.length} rows
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="roles" className="mt-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="max-h-96 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Client Ref</TableHead>
                                <TableHead>Service</TableHead>
                                <TableHead>Work Role</TableHead>
                                <TableHead>Assigned User</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {parsedData.roleAssignments.slice(0, 10).map((row, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{row.client_ref}</TableCell>
                                  <TableCell>{row.service_name}</TableCell>
                                  <TableCell>{row.work_role_name}</TableCell>
                                  <TableCell>{row.assigned_user_email}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {parsedData.roleAssignments.length > 10 && (
                            <p className="text-sm text-muted-foreground text-center mt-4">
                              Showing 10 of {parsedData.roleAssignments.length} rows
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-4">
                  <Button
                    onClick={() => {
                      setCurrentStep('upload');
                      setParsedData(null);
                      setValidationResult(null);
                    }}
                    variant="outline"
                    data-testid="button-back-upload"
                  >
                    Back to Upload
                  </Button>
                  <Button
                    onClick={executeImport}
                    className="flex-1"
                    data-testid="button-import"
                  >
                    Execute Import
                  </Button>
                </div>
              </>
            )}

            {!validationResult.isValid && (
              <Button
                onClick={() => {
                  setCurrentStep('upload');
                  setParsedData(null);
                  setValidationResult(null);
                }}
                variant="outline"
                data-testid="button-back-fix"
              >
                Back to Upload - Fix Errors
              </Button>
            )}
          </div>
        )}

        {/* Import Progress Step */}
        {currentStep === 'import' && (
          <Card>
            <CardHeader>
              <CardTitle>Importing Data...</CardTitle>
              <CardDescription>Please wait while the data is being imported</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={importProgress} />
              <p className="text-sm text-muted-foreground text-center">
                {importProgress}% complete
              </p>
            </CardContent>
          </Card>
        )}

        {/* Complete Step */}
        {currentStep === 'complete' && importResult && (
          <div className="space-y-6">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Import Complete</AlertTitle>
              <AlertDescription>
                Successfully imported data into the system.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Import Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Clients Created:</span>
                  <Badge>{importResult.clientsCreated}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>People Created:</span>
                  <Badge>{importResult.peopleCreated}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Relationships Created:</span>
                  <Badge>{importResult.relationshipsCreated}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Services Mapped:</span>
                  <Badge>{importResult.servicesCreated}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Role Assignments:</span>
                  <Badge>{importResult.rolesAssigned}</Badge>
                </div>
              </CardContent>
            </Card>

            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Errors Encountered</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {importResult.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={() => {
                setCurrentStep('upload');
                setParsedData(null);
                setValidationResult(null);
                setImportResult(null);
                setClientsFile(null);
                setServicesFile(null);
                setRolesFile(null);
              }}
              className="w-full"
              data-testid="button-import-more"
            >
              Import More Data
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
