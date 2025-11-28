import { Express, Response } from "express";
import multer from "multer";
import Papa from "papaparse";
import XLSX from "xlsx";
import { storage } from "../storage/index";
import { companiesHouseService } from "../companies-house-service";
import { nanoid } from "nanoid";
import {
  formatUKPhoneNumber,
  parseAddress,
  parseDateToISO,
  padCompanyNumber,
  validateEmail,
} from "../utils/import-utils";
import type {
  ImportAuditRecord,
  ImportAuditReport,
  FieldMapping,
  FieldMappingDefinition,
} from "@shared/importTypes";
import { CLIENT_FIELD_DEFINITIONS, suggestFieldMapping } from "@shared/importTypes";

const uploadFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (
      allowedTypes.includes(file.mimetype) ||
      file.originalname.endsWith(".csv") ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"));
    }
  },
});

function applyMappings(row: Record<string, any>, mappings: FieldMapping[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const mapping of mappings) {
    if (mapping.targetField && mapping.targetField !== "_skip") {
      let value = row[mapping.sourceColumn];
      result[mapping.targetField] = value;
    }
  }
  return result;
}

export function registerClientsImportRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any
) {
  // Parse uploaded file and return headers + sample data
  app.post(
    "/api/clients-import/parse",
    isAuthenticated,
    requireAdmin,
    uploadFile.single("file"),
    async (req: any, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        let data: Record<string, any>[] = [];
        let headers: string[] = [];

        if (req.file.originalname.endsWith(".csv")) {
          const csvContent = req.file.buffer.toString("utf-8");
          const parsed = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h: string) => h?.trim() || h,
            transform: (v: string) => (typeof v === "string" ? v.trim() : v),
          });
          data = parsed.data as Record<string, any>[];
          headers = parsed.meta.fields || [];
        } else {
          const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
          const firstSheet = workbook.SheetNames[0];
          data = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]) as Record<string, any>[];
          if (data.length > 0) {
            headers = Object.keys(data[0]);
          }
        }

        // Generate suggested mappings
        const suggestedMappings: FieldMapping[] = headers.map((header) => {
          const suggested = suggestFieldMapping(header, CLIENT_FIELD_DEFINITIONS);
          return {
            sourceColumn: header,
            targetField: suggested || "_skip",
          };
        });

        res.json({
          headers,
          sampleData: data.slice(0, 5),
          allData: data,
          totalRows: data.length,
          suggestedMappings,
          fieldDefinitions: CLIENT_FIELD_DEFINITIONS,
        });
      } catch (error: any) {
        console.error("[ClientsImport] Parse error:", error);
        res.status(500).json({ error: error.message || "Failed to parse file" });
      }
    }
  );

  // Validate mapped data before execution
  app.post(
    "/api/clients-import/validate",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: Response) => {
      try {
        const { data, mappings } = req.body as {
          data: Record<string, any>[];
          mappings: FieldMapping[];
        };

        if (!data || !mappings) {
          return res.status(400).json({ error: "Missing data or mappings" });
        }

        const errors: Array<{ row: number; field: string; message: string }> = [];
        const warnings: Array<{ row: number; field: string; message: string }> = [];
        const previewData: Array<{
          row: number;
          sourceData: Record<string, any>;
          mappedData: Record<string, any>;
          existingClient?: { id: string; name: string };
          action: "create" | "update" | "skip";
          skipReason?: string;
        }> = [];

        let clientsToCreate = 0;
        let clientsToUpdate = 0;
        let clientsToSkip = 0;

        // Get all existing clients by company number for quick lookup
        const existingClients = await storage.getAllClients();
        const clientsByCompanyNumber = new Map<string, any>();
        const clientsByName = new Map<string, any>();
        
        for (const client of existingClients) {
          if (client.companyNumber) {
            clientsByCompanyNumber.set(client.companyNumber.toLowerCase(), client);
          }
          clientsByName.set(client.name.toLowerCase(), client);
        }

        // Get all users for manager matching
        const allUsers = await storage.getAllUsers();
        const usersByEmail = new Map<string, any>();
        for (const user of allUsers) {
          if (user.email) {
            usersByEmail.set(user.email.toLowerCase(), user);
          }
        }

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 2; // Excel row number (1-indexed + header)
          const mapped = applyMappings(row, mappings);

          // Check for required fields
          if (!mapped.name) {
            errors.push({ row: rowNum, field: "name", message: "Client name is required" });
            continue;
          }

          // Validate email if provided
          if (mapped.email) {
            const emailCheck = validateEmail(mapped.email);
            if (!emailCheck.valid) {
              warnings.push({ row: rowNum, field: "email", message: emailCheck.warning || "Invalid email" });
            }
          }

          // Check for duplicates
          const companyNumber = mapped.companyNumber ? padCompanyNumber(mapped.companyNumber) : null;
          let existingClient = null;
          let matchType = "";

          if (companyNumber && companyNumber !== "00000000") {
            existingClient = clientsByCompanyNumber.get(companyNumber.toLowerCase());
            matchType = "company number";
          }
          if (!existingClient && mapped.name) {
            existingClient = clientsByName.get(mapped.name.toLowerCase());
            matchType = "name";
          }

          // Check manager email
          if (mapped.managerEmail) {
            const manager = usersByEmail.get(mapped.managerEmail.toLowerCase());
            if (!manager) {
              warnings.push({ row: rowNum, field: "managerEmail", message: `Manager "${mapped.managerEmail}" not found in system` });
            }
          }

          if (existingClient) {
            clientsToUpdate++;
            previewData.push({
              row: rowNum,
              sourceData: row,
              mappedData: mapped,
              existingClient: { id: existingClient.id, name: existingClient.name },
              action: "update",
            });
          } else {
            clientsToCreate++;
            previewData.push({
              row: rowNum,
              sourceData: row,
              mappedData: mapped,
              action: "create",
            });
          }
        }

        res.json({
          isValid: errors.length === 0,
          totalRows: data.length,
          validRows: data.length - errors.length,
          invalidRows: errors.length,
          errors,
          warnings,
          matchStats: {
            clientsToCreate,
            clientsToUpdate,
            clientsToSkip,
          },
          previewData: previewData.slice(0, 20), // First 20 for preview
        });
      } catch (error: any) {
        console.error("[ClientsImport] Validate error:", error);
        res.status(500).json({ error: error.message || "Failed to validate data" });
      }
    }
  );

  // Execute the import
  app.post(
    "/api/clients-import/execute",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: Response) => {
      try {
        const { data, mappings, enrichWithCompaniesHouse } = req.body as {
          data: Record<string, any>[];
          mappings: FieldMapping[];
          enrichWithCompaniesHouse?: boolean;
        };

        if (!data || !mappings) {
          return res.status(400).json({ error: "Missing data or mappings" });
        }

        const importId = nanoid();
        const startedAt = new Date().toISOString();
        const auditRecords: ImportAuditRecord[] = [];
        
        let created = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;

        // Get all existing clients for duplicate checking
        const existingClients = await storage.getAllClients();
        const clientsByCompanyNumber = new Map<string, any>();
        const clientsByName = new Map<string, any>();
        
        for (const client of existingClients) {
          if (client.companyNumber) {
            clientsByCompanyNumber.set(client.companyNumber.toLowerCase(), client);
          }
          clientsByName.set(client.name.toLowerCase(), client);
        }

        // Get all users for manager matching
        const allUsers = await storage.getAllUsers();
        const usersByEmail = new Map<string, any>();
        for (const user of allUsers) {
          if (user.email) {
            usersByEmail.set(user.email.toLowerCase(), user);
          }
        }

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 2;
          const mapped = applyMappings(row, mappings);
          const recordWarnings: string[] = [];

          try {
            // Skip rows without required data
            if (!mapped.name) {
              auditRecords.push({
                rowNumber: rowNum,
                status: "failed",
                recordType: "client",
                identifier: "Unknown",
                details: "Missing required field: name",
                sourceData: row,
                errorMessage: "Client name is required",
              });
              failed++;
              continue;
            }

            // Format phone number
            const formattedPhone = formatUKPhoneNumber(mapped.companyTelephone);

            // Parse addresses
            const registeredAddr = parseAddress(mapped.registeredAddress);
            const postalAddr = parseAddress(mapped.postalAddress);

            // Pad company number
            const companyNumber = mapped.companyNumber ? padCompanyNumber(mapped.companyNumber) : null;

            // Find manager
            let managerId = null;
            if (mapped.managerEmail) {
              const manager = usersByEmail.get(mapped.managerEmail.toLowerCase());
              if (manager) {
                managerId = manager.id;
              } else {
                recordWarnings.push(`Manager "${mapped.managerEmail}" not found`);
              }
            }

            // Parse dates
            let clientOnboardedDate = null;
            if (mapped.clientOnboardedDate) {
              const parsed = parseDateToISO(mapped.clientOnboardedDate);
              if (parsed) {
                clientOnboardedDate = new Date(parsed);
              }
            }

            // Parse and clean monthly charge (strip non-numeric characters like "+VAT")
            let monthlyChargeQuote = null;
            if (mapped.monthlyChargeQuote) {
              const originalValue = String(mapped.monthlyChargeQuote);
              // Extract just the numeric value (including decimal)
              const numericMatch = originalValue.replace(/[^0-9.]/g, '');
              if (numericMatch && !isNaN(parseFloat(numericMatch))) {
                monthlyChargeQuote = numericMatch;
                if (originalValue !== numericMatch) {
                  recordWarnings.push(`Monthly charge "${originalValue}" cleaned to "${numericMatch}"`);
                }
              } else {
                recordWarnings.push(`Monthly charge "${originalValue}" could not be parsed and was cleared`);
              }
            }

            // Check for existing client
            let existingClient = null;
            if (companyNumber && companyNumber !== "00000000") {
              existingClient = clientsByCompanyNumber.get(companyNumber.toLowerCase());
            }
            if (!existingClient && mapped.name) {
              existingClient = clientsByName.get(mapped.name.toLowerCase());
            }

            // Build client data
            let clientData: any = {
              name: mapped.name,
              clientType: mapped.clientType || "Company",
              tradingAs: mapped.tradingAs || null,
              companyNumber: companyNumber && companyNumber !== "00000000" ? companyNumber : null,
              companyUtr: mapped.companyUtr || null,
              companiesHouseAuthCode: mapped.companiesHouseAuthCode || null,
              email: mapped.email || null,
              companyEmailDomain: mapped.companyEmailDomain || null,
              companyTelephone: formattedPhone || null,
              registeredAddress1: registeredAddr.line1 || null,
              registeredAddress2: registeredAddr.line2 || null,
              registeredAddress3: registeredAddr.line3 || null,
              registeredPostcode: registeredAddr.postcode || null,
              registeredCountry: registeredAddr.country || null,
              postalAddress1: postalAddr.line1 || null,
              postalAddress2: postalAddr.line2 || null,
              postalAddress3: postalAddr.line3 || null,
              postalAddressPostcode: postalAddr.postcode || null,
              postalAddressCountry: postalAddr.country || null,
              managerId,
              monthlyChargeQuote,
              clientOnboardedDate,
              notes: mapped.notes || null,
            };

            // Enrich with Companies House data if enabled and company number exists
            if (enrichWithCompaniesHouse && companyNumber && companyNumber !== "00000000" && mapped.clientType === "Company") {
              try {
                console.log(`[ClientsImport] Fetching CH data for company ${companyNumber}`);
                const chProfile = await companiesHouseService.getCompanyProfile(companyNumber);
                if (chProfile) {
                  const chData = companiesHouseService.transformCompanyToClient(chProfile);
                  // Merge CH data - user-provided values take precedence
                  clientData = {
                    ...chData,  // CH data as base
                    ...clientData,  // Import data overwrites
                    // Ensure CH-specific fields are always from CH API
                    companiesHouseName: chData.companiesHouseName,
                    companiesHouseData: chData.companiesHouseData,
                    nextAccountsDue: chData.nextAccountsDue,
                    nextAccountsPeriodEnd: chData.nextAccountsPeriodEnd,
                    confirmationStatementNextDue: chData.confirmationStatementNextDue,
                    confirmationStatementNextMadeUpTo: chData.confirmationStatementNextMadeUpTo,
                    confirmationStatementLastMadeUpTo: chData.confirmationStatementLastMadeUpTo,
                    accountingReferenceDay: chData.accountingReferenceDay,
                    accountingReferenceMonth: chData.accountingReferenceMonth,
                    lastAccountsMadeUpTo: chData.lastAccountsMadeUpTo,
                    companyStatus: chData.companyStatus,
                    companyType: chData.companyType,
                    dateOfCreation: chData.dateOfCreation,
                  };
                  recordWarnings.push("Enriched with Companies House data");
                }
              } catch (chError: any) {
                recordWarnings.push(`Could not fetch Companies House data: ${chError.message}`);
              }
            }

            if (existingClient) {
              // Update existing client
              const changes: Record<string, { from: any; to: any }> = {};
              const updateData: any = {};

              // Track changes
              for (const [key, value] of Object.entries(clientData)) {
                if (value !== null && value !== undefined && value !== "" && 
                    existingClient[key] !== value) {
                  changes[key] = { from: existingClient[key], to: value };
                  updateData[key] = value;
                }
              }

              if (Object.keys(updateData).length > 0) {
                await storage.updateClient(existingClient.id, updateData);
                updated++;
                auditRecords.push({
                  rowNumber: rowNum,
                  status: "updated",
                  recordType: "client",
                  identifier: mapped.name,
                  details: `Updated ${Object.keys(changes).length} field(s)`,
                  sourceData: row,
                  matchedEntity: { id: existingClient.id, name: existingClient.name },
                  changes,
                  warnings: recordWarnings.length > 0 ? recordWarnings : undefined,
                });

                // Update cache for subsequent rows
                if (companyNumber) {
                  clientsByCompanyNumber.set(companyNumber.toLowerCase(), { ...existingClient, ...updateData });
                }
                clientsByName.set(mapped.name.toLowerCase(), { ...existingClient, ...updateData });
              } else {
                skipped++;
                auditRecords.push({
                  rowNumber: rowNum,
                  status: "skipped",
                  recordType: "client",
                  identifier: mapped.name,
                  details: "No changes needed",
                  sourceData: row,
                  matchedEntity: { id: existingClient.id, name: existingClient.name },
                  warnings: recordWarnings.length > 0 ? recordWarnings : undefined,
                });
              }
            } else {
              // Create new client
              const newClient = await storage.createClient(clientData);
              created++;
              auditRecords.push({
                rowNumber: rowNum,
                status: "created",
                recordType: "client",
                identifier: mapped.name,
                details: "New client created",
                sourceData: row,
                matchedEntity: { id: newClient.id, name: newClient.name },
                warnings: recordWarnings.length > 0 ? recordWarnings : undefined,
              });

              // Update cache for subsequent rows
              if (companyNumber) {
                clientsByCompanyNumber.set(companyNumber.toLowerCase(), newClient);
              }
              clientsByName.set(mapped.name.toLowerCase(), newClient);
            }
          } catch (error: any) {
            failed++;
            auditRecords.push({
              rowNumber: rowNum,
              status: "failed",
              recordType: "client",
              identifier: mapped.name || "Unknown",
              details: "Import failed",
              sourceData: row,
              errorMessage: error.message,
            });
          }
        }

        const auditReport: ImportAuditReport = {
          importId,
          importType: "clients",
          startedAt,
          completedAt: new Date().toISOString(),
          totalRows: data.length,
          summary: { created, updated, skipped, failed },
          records: auditRecords,
          errors: auditRecords.filter(r => r.status === "failed").map(r => r.errorMessage || "Unknown error"),
          warnings: auditRecords.flatMap(r => r.warnings || []),
        };

        res.json({
          success: true,
          importId,
          summary: { created, updated, skipped, failed },
          auditReport,
        });
      } catch (error: any) {
        console.error("[ClientsImport] Execute error:", error);
        res.status(500).json({ error: error.message || "Failed to execute import" });
      }
    }
  );

  // Download template
  app.get(
    "/api/clients-import/template",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: Response) => {
      const headers = CLIENT_FIELD_DEFINITIONS.map(f => f.label);
      const csvContent = headers.join(",") + "\n";
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=clients_import_template.csv");
      res.send(csvContent);
    }
  );
}
