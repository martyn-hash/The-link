import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, AlertCircle, Check, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import Papa from "papaparse";
import ExcelJS from "exceljs";

export interface ParsedQuery {
  date: Date | null;
  description: string;
  moneyIn: string;
  moneyOut: string;
  ourQuery: string;
}

interface ColumnMapping {
  date: string;
  description: string;
  moneyIn: string;
  moneyOut: string;
  ourQuery: string;
}

interface QueryBulkImportProps {
  onImport: (queries: ParsedQuery[]) => void;
  trigger?: React.ReactNode;
}

export function QueryBulkImport({ onImport, trigger }: QueryBulkImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "mapping" | "preview">("upload");
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: "",
    description: "",
    moneyIn: "",
    moneyOut: "",
    ourQuery: "",
  });
  const [parsedQueries, setParsedQueries] = useState<ParsedQuery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setError(null);
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "csv") {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) {
            setError("No data found in the file");
            return;
          }
          setRawData(results.data);
          setHeaders(results.meta.fields || []);
          autoMapColumns(results.meta.fields || []);
          setStep("mapping");
        },
        error: (err) => {
          setError(`Failed to parse CSV: ${err.message}`);
        },
      });
    } else if (extension === "xlsx" || extension === "xls") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);
          
          const worksheet = workbook.worksheets[0];
          if (!worksheet) {
            setError("No worksheet found in the spreadsheet");
            return;
          }

          // Get headers from first row
          const headerRow = worksheet.getRow(1);
          const columnHeaders: string[] = [];
          headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const value = cell.value;
            columnHeaders[colNumber - 1] = value != null ? String(value).trim() : `Column${colNumber}`;
          });

          // Get data rows
          const jsonData: Record<string, string>[] = [];
          for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            let hasData = false;
            row.eachCell({ includeEmpty: false }, () => { hasData = true; });
            
            if (!hasData) continue;

            const rowData: Record<string, string> = {};
            for (let colNumber = 1; colNumber <= columnHeaders.length; colNumber++) {
              const header = columnHeaders[colNumber - 1];
              if (!header) continue;
              
              const cell = row.getCell(colNumber);
              let value = "";
              
              if (cell.value !== null && cell.value !== undefined) {
                if (typeof cell.value === 'object' && 'richText' in (cell.value as any)) {
                  value = ((cell.value as any).richText || []).map((rt: any) => rt.text).join('');
                } else if (typeof cell.value === 'object' && 'result' in (cell.value as any)) {
                  value = (cell.value as any).result !== undefined ? String((cell.value as any).result) : '';
                } else {
                  value = String(cell.value);
                }
              }
              
              rowData[header] = value;
            }
            jsonData.push(rowData);
          }

          if (jsonData.length === 0) {
            setError("No data found in the spreadsheet");
            return;
          }

          setRawData(jsonData);
          setHeaders(columnHeaders.filter(h => h));
          autoMapColumns(columnHeaders.filter(h => h));
          setStep("mapping");
        } catch (err: any) {
          setError(`Failed to parse Excel file: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
    }
  };

  const autoMapColumns = (columnHeaders: string[]) => {
    const lowerHeaders = columnHeaders.map((h) => h.toLowerCase());
    const newMapping: ColumnMapping = {
      date: "",
      description: "",
      moneyIn: "",
      moneyOut: "",
      ourQuery: "",
    };

    for (let i = 0; i < columnHeaders.length; i++) {
      const lower = lowerHeaders[i];
      if (lower.includes("date") && !newMapping.date) {
        newMapping.date = columnHeaders[i];
      } else if (
        (lower.includes("description") || lower === "desc" || lower === "details") &&
        !newMapping.description
      ) {
        newMapping.description = columnHeaders[i];
      } else if (
        (lower.includes("money in") ||
          lower === "in" ||
          lower === "credit" ||
          lower.includes("income") ||
          lower === "receipt" ||
          lower === "receipts") &&
        !newMapping.moneyIn
      ) {
        newMapping.moneyIn = columnHeaders[i];
      } else if (
        (lower.includes("money out") ||
          lower === "out" ||
          lower === "debit" ||
          lower.includes("expense") ||
          lower === "payment" ||
          lower === "payments") &&
        !newMapping.moneyOut
      ) {
        newMapping.moneyOut = columnHeaders[i];
      } else if (
        (lower.includes("query") ||
          lower.includes("question") ||
          lower === "note" ||
          lower === "notes" ||
          lower === "comment" ||
          lower === "comments") &&
        !newMapping.ourQuery
      ) {
        newMapping.ourQuery = columnHeaders[i];
      }
    }

    setMapping(newMapping);
  };

  const parseDate = (value: string): Date | null => {
    if (!value || !value.trim()) return null;
    
    const input = value.trim();
    
    const monthNames: Record<string, number> = {
      'january': 1, 'jan': 1,
      'february': 2, 'feb': 2,
      'march': 3, 'mar': 3,
      'april': 4, 'apr': 4,
      'may': 5,
      'june': 6, 'jun': 6,
      'july': 7, 'jul': 7,
      'august': 8, 'aug': 8,
      'september': 9, 'sep': 9, 'sept': 9,
      'october': 10, 'oct': 10,
      'november': 11, 'nov': 11,
      'december': 12, 'dec': 12,
    };
    
    const parseYear = (y: string): number => {
      const num = parseInt(y);
      if (y.length === 2) {
        return num < 50 ? 2000 + num : 1900 + num;
      }
      return num;
    };
    
    const createDate = (day: number, month: number, year: number): Date | null => {
      if (day < 1 || day > 31 || month < 1 || month > 12) return null;
      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) return null;
      if (date.getDate() !== day || date.getMonth() !== month - 1) return null;
      return date;
    };
    
    const patterns: Array<{ regex: RegExp; extract: (m: RegExpMatchArray) => { day: number; month: number; year: number } | null }> = [
      { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/, extract: (m) => ({ day: parseInt(m[1]), month: parseInt(m[2]), year: parseYear(m[3]) }) },
      { regex: /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/, extract: (m) => ({ day: parseInt(m[1]), month: parseInt(m[2]), year: parseYear(m[3]) }) },
      { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/, extract: (m) => ({ day: parseInt(m[1]), month: parseInt(m[2]), year: parseYear(m[3]) }) },
      { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, extract: (m) => ({ day: parseInt(m[3]), month: parseInt(m[2]), year: parseInt(m[1]) }) },
      { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, extract: (m) => ({ day: parseInt(m[3]), month: parseInt(m[2]), year: parseInt(m[1]) }) },
      { regex: /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})$/, extract: (m) => {
        const month = monthNames[m[2].toLowerCase()];
        return month ? { day: parseInt(m[1]), month, year: parseYear(m[3]) } : null;
      }},
      { regex: /^(\d{1,2})-([a-zA-Z]+)-(\d{2,4})$/, extract: (m) => {
        const month = monthNames[m[2].toLowerCase()];
        return month ? { day: parseInt(m[1]), month, year: parseYear(m[3]) } : null;
      }},
      { regex: /^(\d{1,2})\/([a-zA-Z]+)\/(\d{2,4})$/, extract: (m) => {
        const month = monthNames[m[2].toLowerCase()];
        return month ? { day: parseInt(m[1]), month, year: parseYear(m[3]) } : null;
      }},
      { regex: /^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/, extract: (m) => {
        const month = monthNames[m[1].toLowerCase()];
        return month ? { day: parseInt(m[2]), month, year: parseYear(m[3]) } : null;
      }},
      { regex: /^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/, extract: (m) => {
        const month = monthNames[m[1].toLowerCase()];
        return month ? { day: parseInt(m[2]), month, year: parseYear(m[3]) } : null;
      }},
      { regex: /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)\s+(\d{2,4})$/, extract: (m) => {
        const month = monthNames[m[2].toLowerCase()];
        return month ? { day: parseInt(m[1]), month, year: parseYear(m[3]) } : null;
      }},
      { regex: /^(\d{1,2})(?:st|nd|rd|th)?-([a-zA-Z]+)-(\d{2,4})$/i, extract: (m) => {
        const month = monthNames[m[2].toLowerCase()];
        return month ? { day: parseInt(m[1]), month, year: parseYear(m[3]) } : null;
      }},
    ];
    
    for (const { regex, extract } of patterns) {
      const match = input.match(regex);
      if (match) {
        const parts = extract(match);
        if (parts) {
          const date = createDate(parts.day, parts.month, parts.year);
          if (date) return date;
        }
      }
    }
    
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const parseAmount = (value: string): string => {
    if (!value || !value.trim()) return "";
    const cleaned = value.replace(/[£$€,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
    const num = parseFloat(cleaned);
    return isNaN(num) ? "" : Math.abs(num).toFixed(2);
  };

  const handleProceedToPreview = () => {
    const queries: ParsedQuery[] = rawData.map((row) => ({
      date: mapping.date ? parseDate(row[mapping.date]) : null,
      description: mapping.description ? (row[mapping.description] || "").trim() : "",
      moneyIn: mapping.moneyIn ? parseAmount(row[mapping.moneyIn]) : "",
      moneyOut: mapping.moneyOut ? parseAmount(row[mapping.moneyOut]) : "",
      ourQuery: mapping.ourQuery ? (row[mapping.ourQuery] || "").trim() : "",
    }));

    const validQueries = queries.filter(
      (q) => q.date || q.description || q.moneyIn || q.moneyOut || q.ourQuery
    );

    if (validQueries.length === 0) {
      setError("No valid queries found. Please check your column mapping.");
      return;
    }

    setParsedQueries(validQueries);
    setStep("preview");
  };

  const handleImport = () => {
    onImport(parsedQueries);
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    setStep("upload");
    setRawData([]);
    setHeaders([]);
    setMapping({
      date: "",
      description: "",
      moneyIn: "",
      moneyOut: "",
      ourQuery: "",
    });
    setParsedQueries([]);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          data-testid="button-bulk-import-queries"
        >
          <Upload className="h-4 w-4 mr-2" />
          Import from File
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {step === "upload" && "Import Queries from CSV/Excel"}
              {step === "mapping" && "Map Columns"}
              {step === "preview" && "Preview Import"}
            </DialogTitle>
            <DialogDescription>
              {step === "upload" && "Upload a CSV or Excel file containing transaction queries."}
              {step === "mapping" && "Match your file columns to the query fields."}
              {step === "preview" &&
                `${parsedQueries.length} queries ready to import. Review the data below.`}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === "upload" && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-file-upload"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                data-testid="input-file-upload"
              />
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Drop your file here</p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse. Supports CSV, XLSX, and XLS files.
              </p>
              <Button variant="outline" type="button">
                Select File
              </Button>
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Found {rawData.length} rows with {headers.length} columns. Match each query field
                to a column from your file.
              </p>

              <div className="grid gap-4">
                {[
                  { key: "date", label: "Date", required: false },
                  { key: "description", label: "Description", required: false },
                  { key: "moneyIn", label: "Money In", required: false },
                  { key: "moneyOut", label: "Money Out", required: false },
                  { key: "ourQuery", label: "Query Text", required: false },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-4">
                    <Label className="w-28 flex-shrink-0">{label}</Label>
                    <Select
                      value={mapping[key as keyof ColumnMapping] || "__none__"}
                      onValueChange={(v) =>
                        setMapping((m) => ({
                          ...m,
                          [key]: v === "__none__" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger
                        className="flex-1"
                        data-testid={`select-mapping-${key}`}
                      >
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">-- Not mapped --</SelectItem>
                        {headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mapping[key as keyof ColumnMapping] && (
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              <div className="text-sm text-muted-foreground mt-4">
                <p className="font-medium mb-1">Sample data from first row:</p>
                <div className="bg-muted p-3 rounded text-xs overflow-x-auto">
                  {rawData[0] && (
                    <div className="space-y-1">
                      {headers.slice(0, 5).map((h) => (
                        <div key={h}>
                          <span className="font-medium">{h}:</span>{" "}
                          {rawData[0][h] || "(empty)"}
                        </div>
                      ))}
                      {headers.length > 5 && (
                        <div className="text-muted-foreground">
                          ...and {headers.length - 5} more columns
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="h-[400px] overflow-y-auto border rounded-lg p-2">
              <div className="space-y-2">
                {parsedQueries.map((query, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-3 text-sm space-y-1 relative pr-10"
                    data-testid={`preview-query-${index}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setParsedQueries(prev => prev.filter((_, i) => i !== index));
                      }}
                      className="absolute top-2 right-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500"
                      data-testid={`button-delete-preview-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="flex gap-4 text-muted-foreground">
                      {query.date && (
                        <span>{query.date.toLocaleDateString("en-GB")}</span>
                      )}
                      {query.moneyIn && (
                        <span className="text-green-600">In: £{query.moneyIn}</span>
                      )}
                      {query.moneyOut && (
                        <span className="text-red-600">Out: £{query.moneyOut}</span>
                      )}
                    </div>
                    {query.description && (
                      <div className="font-medium">{query.description}</div>
                    )}
                    {query.ourQuery && (
                      <div className="text-muted-foreground italic">
                        Query: {query.ourQuery}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {step === "mapping" && (
              <>
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button
                  onClick={handleProceedToPreview}
                  data-testid="button-proceed-to-preview"
                >
                  Preview Import
                </Button>
              </>
            )}
            {step === "preview" && (
              <>
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Back
                </Button>
                <Button onClick={handleImport} data-testid="button-confirm-import">
                  Import {parsedQueries.length} Queries
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
