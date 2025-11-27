import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  SkipForward,
  FileText,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import type { ImportAuditReport as ImportAuditReportType, ImportAuditRecord } from "@shared/importTypes";
import { generateAuditReportCSV } from "@shared/importTypes";

interface ImportAuditReportProps {
  report: ImportAuditReportType;
  onDownloadCSV?: () => void;
  onClose?: () => void;
  showActions?: boolean;
}

function StatusBadge({ status }: { status: ImportAuditRecord['status'] }) {
  switch (status) {
    case 'created':
      return (
        <Badge className="bg-green-500 text-white">
          <CheckCircle className="w-3 h-3 mr-1" />
          Created
        </Badge>
      );
    case 'updated':
      return (
        <Badge className="bg-blue-500 text-white">
          <CheckCircle className="w-3 h-3 mr-1" />
          Updated
        </Badge>
      );
    case 'skipped':
      return (
        <Badge variant="secondary">
          <SkipForward className="w-3 h-3 mr-1" />
          Skipped
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function RecordTypeLabel({ type }: { type: ImportAuditRecord['recordType'] }) {
  const labels: Record<string, string> = {
    'client_service': 'Client Service',
    'people_service': 'Personal Service',
    'client': 'Client',
    'person': 'Person',
    'role_assignment': 'Role Assignment',
  };
  return <span className="text-xs text-muted-foreground">{labels[type] || type}</span>;
}

export function ImportAuditReport({ 
  report, 
  onDownloadCSV, 
  onClose,
  showActions = true 
}: ImportAuditReportProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'created' | 'updated' | 'skipped' | 'failed'>('all');

  const toggleRowExpansion = (rowNumber: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  const handleDownloadCSV = () => {
    if (onDownloadCSV) {
      onDownloadCSV();
    } else {
      const csvContent = generateAuditReportCSV(report);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `import-audit-${report.importId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const filteredRecords = activeTab === 'all' 
    ? report.records 
    : report.records.filter(r => r.status === activeTab);

  const duration = new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime();
  const durationSeconds = Math.round(duration / 1000);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Import Audit Report</h3>
          <p className="text-sm text-muted-foreground">
            {report.importType} import completed in {durationSeconds}s
          </p>
        </div>
        {showActions && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCSV}
              data-testid="button-download-audit-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </Button>
            {onClose && (
              <Button size="sm" onClick={onClose} data-testid="button-close-audit">
                Done
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold">{report.totalRows}</div>
            <div className="text-xs text-muted-foreground">Total Rows</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-green-600">{report.summary.created}</div>
            <div className="text-xs text-muted-foreground">Created</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{report.summary.updated}</div>
            <div className="text-xs text-muted-foreground">Updated</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200">
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{report.summary.skipped}</div>
            <div className="text-xs text-muted-foreground">Skipped</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-red-600">{report.summary.failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </CardContent>
        </Card>
      </div>

      {report.errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Errors During Import</AlertTitle>
          <AlertDescription>
            <ScrollArea className="max-h-32">
              <ul className="list-disc list-inside space-y-1">
                {report.errors.map((error, idx) => (
                  <li key={idx} className="text-sm">{error}</li>
                ))}
              </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      {report.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warnings</AlertTitle>
          <AlertDescription>
            <ScrollArea className="max-h-32">
              <ul className="list-disc list-inside space-y-1">
                {report.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm">{warning}</li>
                ))}
              </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Detailed Records
          </CardTitle>
          <CardDescription>
            Click on a row to see source data and changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all" data-testid="tab-all">
                All ({report.records.length})
              </TabsTrigger>
              <TabsTrigger value="created" data-testid="tab-created">
                Created ({report.summary.created})
              </TabsTrigger>
              <TabsTrigger value="updated" data-testid="tab-updated">
                Updated ({report.summary.updated})
              </TabsTrigger>
              <TabsTrigger value="skipped" data-testid="tab-skipped">
                Skipped ({report.summary.skipped})
              </TabsTrigger>
              <TabsTrigger value="failed" data-testid="tab-failed">
                Failed ({report.summary.failed})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-32">Type</TableHead>
                    <TableHead>Identifier</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <>
                      <TableRow 
                        key={record.rowNumber}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRowExpansion(record.rowNumber)}
                        data-testid={`audit-row-${record.rowNumber}`}
                      >
                        <TableCell className="font-mono text-sm">{record.rowNumber}</TableCell>
                        <TableCell><StatusBadge status={record.status} /></TableCell>
                        <TableCell><RecordTypeLabel type={record.recordType} /></TableCell>
                        <TableCell className="font-medium truncate max-w-[200px]" title={record.identifier}>
                          {record.identifier}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[300px]" title={record.details}>
                          {record.details}
                        </TableCell>
                        <TableCell>
                          {expandedRows.has(record.rowNumber) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(record.rowNumber) && (
                        <TableRow key={`${record.rowNumber}-expanded`}>
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              {record.matchedEntity && (
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">Matched Entity:</span>
                                  <div className="text-sm">
                                    {record.matchedEntity.name} <span className="text-muted-foreground">({record.matchedEntity.id})</span>
                                  </div>
                                </div>
                              )}
                              {record.errorMessage && (
                                <div>
                                  <span className="text-xs font-medium text-destructive">Error:</span>
                                  <div className="text-sm text-destructive">{record.errorMessage}</div>
                                </div>
                              )}
                              {record.warnings && record.warnings.length > 0 && (
                                <div>
                                  <span className="text-xs font-medium text-orange-600">Warnings:</span>
                                  <ul className="text-sm text-orange-600 list-disc list-inside">
                                    {record.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                  </ul>
                                </div>
                              )}
                              {record.changes && Object.keys(record.changes).length > 0 && (
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">Changes:</span>
                                  <div className="text-sm space-y-1">
                                    {Object.entries(record.changes).map(([field, change]) => (
                                      <div key={field} className="flex items-center gap-2">
                                        <span className="font-mono text-xs">{field}:</span>
                                        <span className="text-red-500 line-through">{String(change.from || '(empty)')}</span>
                                        <span>→</span>
                                        <span className="text-green-500">{String(change.to || '(empty)')}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">Source Data:</span>
                                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                                  {JSON.stringify(record.sourceData, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default ImportAuditReport;
