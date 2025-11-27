import { Express, Response } from "express";
import multer from "multer";
import Papa from "papaparse";
import XLSX from "xlsx";
import { storage } from "../storage/index";
import { nanoid } from "nanoid";
import {
  formatUKPhoneNumber,
  parseAddress,
  parseDateToISO,
  padCompanyNumber,
  validateEmail,
  validateNINumber,
  parseBoolean,
} from "../utils/import-utils";
import type {
  ImportAuditRecord,
  ImportAuditReport,
  FieldMapping,
} from "@shared/importTypes";
import { PEOPLE_FIELD_DEFINITIONS, suggestFieldMapping } from "@shared/importTypes";

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

export function registerPeopleImportRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any
) {
  // Parse uploaded file and return headers + sample data
  app.post(
    "/api/people-import/parse",
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
          const suggested = suggestFieldMapping(header, PEOPLE_FIELD_DEFINITIONS);
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
          fieldDefinitions: PEOPLE_FIELD_DEFINITIONS,
        });
      } catch (error: any) {
        console.error("[PeopleImport] Parse error:", error);
        res.status(500).json({ error: error.message || "Failed to parse file" });
      }
    }
  );

  // Validate mapped data before execution
  app.post(
    "/api/people-import/validate",
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
          existingPerson?: { id: string; name: string };
          matchedClient?: { id: string; name: string };
          action: "create" | "update" | "skip";
          skipReason?: string;
        }> = [];

        let peopleToCreate = 0;
        let peopleToUpdate = 0;
        let peopleToSkip = 0;
        let clientsMatched = 0;
        let clientsNotFound = 0;

        // Get all existing people for duplicate checking
        const existingPeople = await storage.getAllPeople();
        const peopleByEmail = new Map<string, any>();
        const peopleByName = new Map<string, any>();
        
        for (const person of existingPeople) {
          if (person.email) {
            peopleByEmail.set(person.email.toLowerCase(), person);
          }
          if (person.fullName) {
            peopleByName.set(person.fullName.toLowerCase(), person);
          }
        }

        // Get all clients for matching
        const allClients = await storage.getAllClients();
        const clientsByCompanyNumber = new Map<string, any>();
        const clientsByName = new Map<string, any>();
        
        for (const client of allClients) {
          if (client.companyNumber) {
            clientsByCompanyNumber.set(client.companyNumber.toLowerCase(), client);
          }
          clientsByName.set(client.name.toLowerCase(), client);
        }

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 2;
          const mapped = applyMappings(row, mappings);

          // Determine full name
          let fullName = mapped.fullName;
          if (!fullName && mapped.firstName && mapped.lastName) {
            fullName = `${mapped.firstName} ${mapped.lastName}`.trim();
          }

          if (!fullName && !mapped.email) {
            errors.push({ row: rowNum, field: "fullName", message: "Either Full Name or Email is required" });
            continue;
          }

          // Validate email if provided
          if (mapped.email) {
            const emailCheck = validateEmail(mapped.email);
            if (!emailCheck.valid) {
              warnings.push({ row: rowNum, field: "email", message: emailCheck.warning || "Invalid email" });
            }
          }

          // Validate NI number if provided
          if (mapped.niNumber) {
            const niCheck = validateNINumber(mapped.niNumber);
            if (!niCheck.valid) {
              warnings.push({ row: rowNum, field: "niNumber", message: niCheck.warning || "Invalid NI number" });
            }
          }

          // Check for existing person
          let existingPerson = null;
          if (mapped.email) {
            existingPerson = peopleByEmail.get(mapped.email.toLowerCase());
          }
          if (!existingPerson && fullName) {
            existingPerson = peopleByName.get(fullName.toLowerCase());
          }

          // Check for client association
          let matchedClient = null;
          const companyNumber = mapped.clientCompanyNumber ? padCompanyNumber(mapped.clientCompanyNumber) : null;
          
          if (companyNumber && companyNumber !== "00000000") {
            matchedClient = clientsByCompanyNumber.get(companyNumber.toLowerCase());
          }
          if (!matchedClient && mapped.clientName) {
            matchedClient = clientsByName.get(mapped.clientName.toLowerCase());
          }

          if (companyNumber || mapped.clientName) {
            if (matchedClient) {
              clientsMatched++;
            } else {
              clientsNotFound++;
              warnings.push({ row: rowNum, field: "clientName", message: `Client "${mapped.clientName || companyNumber}" not found` });
            }
          }

          if (existingPerson) {
            peopleToUpdate++;
            previewData.push({
              row: rowNum,
              sourceData: row,
              mappedData: mapped,
              existingPerson: { id: existingPerson.id, name: existingPerson.fullName },
              matchedClient: matchedClient ? { id: matchedClient.id, name: matchedClient.name } : undefined,
              action: "update",
            });
          } else {
            peopleToCreate++;
            previewData.push({
              row: rowNum,
              sourceData: row,
              mappedData: mapped,
              matchedClient: matchedClient ? { id: matchedClient.id, name: matchedClient.name } : undefined,
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
            peopleToCreate,
            peopleToUpdate,
            peopleToSkip,
            clientsMatched,
            clientsNotFound,
          },
          previewData: previewData.slice(0, 20),
        });
      } catch (error: any) {
        console.error("[PeopleImport] Validate error:", error);
        res.status(500).json({ error: error.message || "Failed to validate data" });
      }
    }
  );

  // Execute the import
  app.post(
    "/api/people-import/execute",
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

        const importId = nanoid();
        const startedAt = new Date().toISOString();
        const auditRecords: ImportAuditRecord[] = [];
        
        let created = 0;
        let updated = 0;
        let skipped = 0;
        let failed = 0;

        // Get all existing people for duplicate checking
        const existingPeople = await storage.getAllPeople();
        const peopleByEmail = new Map<string, any>();
        const peopleByName = new Map<string, any>();
        
        for (const person of existingPeople) {
          if (person.email) {
            peopleByEmail.set(person.email.toLowerCase(), person);
          }
          if (person.fullName) {
            peopleByName.set(person.fullName.toLowerCase(), person);
          }
        }

        // Get all clients for matching
        const allClients = await storage.getAllClients();
        const clientsByCompanyNumber = new Map<string, any>();
        const clientsByName = new Map<string, any>();
        
        for (const client of allClients) {
          if (client.companyNumber) {
            clientsByCompanyNumber.set(client.companyNumber.toLowerCase(), client);
          }
          clientsByName.set(client.name.toLowerCase(), client);
        }

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNum = i + 2;
          const mapped = applyMappings(row, mappings);
          const recordWarnings: string[] = [];

          try {
            // Determine full name
            let fullName = mapped.fullName;
            if (!fullName && mapped.firstName && mapped.lastName) {
              fullName = `${mapped.firstName} ${mapped.lastName}`.trim();
            }

            if (!fullName && !mapped.email) {
              auditRecords.push({
                rowNumber: rowNum,
                status: "failed",
                recordType: "person",
                identifier: "Unknown",
                details: "Missing required field: Full Name or Email",
                sourceData: row,
                errorMessage: "Either Full Name or Email is required",
              });
              failed++;
              continue;
            }

            // Format mobile number
            const formattedMobile = formatUKPhoneNumber(mapped.mobileNumber);

            // Parse address
            const postalAddr = parseAddress(mapped.postalAddress);

            // Validate NI number
            if (mapped.niNumber) {
              const niCheck = validateNINumber(mapped.niNumber);
              if (!niCheck.valid) {
                recordWarnings.push(niCheck.warning || "NI number format may be invalid");
              }
            }

            // Parse dates
            let dateOfBirth = null;
            if (mapped.dateOfBirth) {
              const parsed = parseDateToISO(mapped.dateOfBirth);
              if (parsed) {
                // Store as DD/MM/YYYY string format (consistent with existing data)
                const date = new Date(parsed);
                dateOfBirth = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
              }
            }

            let initialContactDate = null;
            if (mapped.initialContactDate) {
              const parsed = parseDateToISO(mapped.initialContactDate);
              if (parsed) {
                initialContactDate = new Date(parsed);
              }
            }

            // Check for existing person
            let existingPerson = null;
            if (mapped.email) {
              existingPerson = peopleByEmail.get(mapped.email.toLowerCase());
            }
            if (!existingPerson && fullName) {
              existingPerson = peopleByName.get(fullName.toLowerCase());
            }

            // Check for client association
            let matchedClient = null;
            const companyNumber = mapped.clientCompanyNumber ? padCompanyNumber(mapped.clientCompanyNumber) : null;
            
            if (companyNumber && companyNumber !== "00000000") {
              matchedClient = clientsByCompanyNumber.get(companyNumber.toLowerCase());
            }
            if (!matchedClient && mapped.clientName) {
              matchedClient = clientsByName.get(mapped.clientName.toLowerCase());
            }

            // Build person data
            const personData: any = {
              fullName: fullName || mapped.email,
              firstName: mapped.firstName || null,
              lastName: mapped.lastName || null,
              email: mapped.email || null,
              primaryEmail: mapped.email || null,
              primaryPhone: formattedMobile || null,
              dateOfBirth,
              niNumber: mapped.niNumber || null,
              personalUtrNumber: mapped.utr || null,
              addressLine1: postalAddr.line1 || null,
              addressLine2: postalAddr.line2 || null,
              locality: postalAddr.line3 || null,
              postalCode: postalAddr.postcode || null,
              country: postalAddr.country || null,
              initialContactDate,
              addressVerified: parseBoolean(mapped.addressVerified),
              photoIdVerified: parseBoolean(mapped.photoIdVerified),
              amlComplete: parseBoolean(mapped.moneyLaunderingComplete),
              notes: mapped.notes || null,
            };

            if (existingPerson) {
              // Update existing person
              const changes: Record<string, { from: any; to: any }> = {};
              const updateData: any = {};

              // Track changes
              for (const [key, value] of Object.entries(personData)) {
                if (value !== null && value !== undefined && value !== "" && 
                    existingPerson[key] !== value) {
                  changes[key] = { from: existingPerson[key], to: value };
                  updateData[key] = value;
                }
              }

              if (Object.keys(updateData).length > 0) {
                await storage.updatePerson(existingPerson.id, updateData);
                updated++;

                // Link to client if not already linked
                if (matchedClient) {
                  const existingLinks = await storage.getClientPeopleByPersonId(existingPerson.id);
                  const alreadyLinked = existingLinks.some(link => link.clientId === matchedClient.id);
                  if (!alreadyLinked) {
                    await storage.createClientPerson({
                      clientId: matchedClient.id,
                      personId: existingPerson.id,
                    });
                    recordWarnings.push(`Linked to client "${matchedClient.name}"`);
                  }
                }

                auditRecords.push({
                  rowNumber: rowNum,
                  status: "updated",
                  recordType: "person",
                  identifier: fullName || mapped.email,
                  details: `Updated ${Object.keys(changes).length} field(s)`,
                  sourceData: row,
                  matchedEntity: { id: existingPerson.id, name: existingPerson.fullName },
                  changes,
                  warnings: recordWarnings.length > 0 ? recordWarnings : undefined,
                });

                // Update cache
                if (mapped.email) {
                  peopleByEmail.set(mapped.email.toLowerCase(), { ...existingPerson, ...updateData });
                }
                if (fullName) {
                  peopleByName.set(fullName.toLowerCase(), { ...existingPerson, ...updateData });
                }
              } else {
                // No changes but maybe link to client
                if (matchedClient) {
                  const existingLinks = await storage.getClientPeopleByPersonId(existingPerson.id);
                  const alreadyLinked = existingLinks.some(link => link.clientId === matchedClient.id);
                  if (!alreadyLinked) {
                    await storage.createClientPerson({
                      clientId: matchedClient.id,
                      personId: existingPerson.id,
                    });
                    recordWarnings.push(`Linked to client "${matchedClient.name}"`);
                    updated++;
                    auditRecords.push({
                      rowNumber: rowNum,
                      status: "updated",
                      recordType: "person",
                      identifier: fullName || mapped.email,
                      details: "Linked to new client",
                      sourceData: row,
                      matchedEntity: { id: existingPerson.id, name: existingPerson.fullName },
                      warnings: recordWarnings,
                    });
                  } else {
                    skipped++;
                    auditRecords.push({
                      rowNumber: rowNum,
                      status: "skipped",
                      recordType: "person",
                      identifier: fullName || mapped.email,
                      details: "No changes needed",
                      sourceData: row,
                      matchedEntity: { id: existingPerson.id, name: existingPerson.fullName },
                    });
                  }
                } else {
                  skipped++;
                  auditRecords.push({
                    rowNumber: rowNum,
                    status: "skipped",
                    recordType: "person",
                    identifier: fullName || mapped.email,
                    details: "No changes needed",
                    sourceData: row,
                    matchedEntity: { id: existingPerson.id, name: existingPerson.fullName },
                  });
                }
              }
            } else {
              // Create new person
              const newPerson = await storage.createPerson(personData);
              created++;

              // Link to client if matched
              if (matchedClient) {
                await storage.createClientPerson({
                  clientId: matchedClient.id,
                  personId: newPerson.id,
                });
                recordWarnings.push(`Linked to client "${matchedClient.name}"`);
              }

              auditRecords.push({
                rowNumber: rowNum,
                status: "created",
                recordType: "person",
                identifier: fullName || mapped.email,
                details: "New person created",
                sourceData: row,
                matchedEntity: { id: newPerson.id, name: newPerson.fullName },
                warnings: recordWarnings.length > 0 ? recordWarnings : undefined,
              });

              // Update cache
              if (mapped.email) {
                peopleByEmail.set(mapped.email.toLowerCase(), newPerson);
              }
              if (fullName) {
                peopleByName.set(fullName.toLowerCase(), newPerson);
              }
            }
          } catch (error: any) {
            failed++;
            auditRecords.push({
              rowNumber: rowNum,
              status: "failed",
              recordType: "person",
              identifier: mapped.fullName || mapped.email || "Unknown",
              details: "Import failed",
              sourceData: row,
              errorMessage: error.message,
            });
          }
        }

        const auditReport: ImportAuditReport = {
          importId,
          importType: "people",
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
        console.error("[PeopleImport] Execute error:", error);
        res.status(500).json({ error: error.message || "Failed to execute import" });
      }
    }
  );

  // Download template
  app.get(
    "/api/people-import/template",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: Response) => {
      const headers = PEOPLE_FIELD_DEFINITIONS.map(f => f.label);
      const csvContent = headers.join(",") + "\n";
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=people_import_template.csv");
      res.send(csvContent);
    }
  );
}
