import { Express, Request, Response } from "express";
import multer from "multer";
import Papa from "papaparse";
import XLSX from "xlsx";
import { storage } from "../storage/index";
import { nanoid } from "nanoid";
import type {
  ImportAuditRecord,
  ImportAuditReport,
  ServiceImportValidationResult,
  ServiceImportExecutionResult,
  FieldMapping,
  CLIENT_SERVICE_FIELD_DEFINITIONS,
  PEOPLE_SERVICE_FIELD_DEFINITIONS,
} from "@shared/importTypes";

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

function parseDate(value: string | number | null | undefined): Date | null {
  if (!value) return null;

  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }

  const dateStr = String(value).trim();

  const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }

  const yyyymmdd = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (yyyymmdd) {
    return new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]));
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

function normalizeBoolean(value: any): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const str = String(value).toLowerCase().trim();
  return ["yes", "true", "1", "y", "active"].includes(str);
}

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

export function registerServiceImportRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any
) {
  app.post(
    "/api/service-import/parse",
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

        const hasClientFields =
          headers.some((h) => h.toLowerCase().includes("company") || h.toLowerCase().includes("client"));
        const hasPersonFields =
          headers.some((h) => h.toLowerCase().includes("person") || (h.toLowerCase().includes("name") && !h.toLowerCase().includes("service")));

        let importType: "client_services" | "people_services" | "mixed" = "client_services";
        if (hasPersonFields && !hasClientFields) {
          importType = "people_services";
        } else if (hasPersonFields && hasClientFields) {
          importType = "mixed";
        }

        const allServices = await storage.getAllServices();
        const users = await storage.getAllUsers();
        const workRoles = await storage.getAllWorkRoles();

        res.json({
          success: true,
          totalRows: data.length,
          headers,
          importType,
          sampleData: data.slice(0, 5),
          availableServices: allServices.map((s: any) => ({
            id: s.id,
            name: s.name,
            isPersonalService: s.isPersonalService,
            udfDefinitions: s.udfDefinitions || [],
          })),
          availableUsers: users.map((u: any) => ({
            id: u.id,
            email: u.email,
            name: u.fullName,
          })),
          availableWorkRoles: workRoles.map((r: any) => ({
            id: r.id,
            name: r.name,
          })),
        });
      } catch (error: any) {
        console.error("Service import parse error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/service-import/validate",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: Response) => {
      try {
        const { rows, mappings, importType } = req.body as {
          rows: Record<string, any>[];
          mappings: FieldMapping[];
          importType: "client_services" | "people_services" | "mixed";
        };

        if (!rows || !mappings) {
          return res.status(400).json({ error: "Missing rows or mappings" });
        }

        const allServices = await storage.getAllServices();
        const serviceNameMap = new Map(allServices.map((s: any) => [s.name.toLowerCase(), s]));

        const allClients = await storage.getAllClients();
        const clientNameMap = new Map<string, any>();
        const clientCompanyNumberMap = new Map<string, any>();
        for (const c of allClients) {
          clientNameMap.set(c.name.toLowerCase(), c);
          if (c.companyNumber) {
            clientCompanyNumberMap.set(c.companyNumber.padStart(8, "0"), c);
          }
        }

        const allPeople = await storage.getAllPeople();
        const personEmailMap = new Map<string, any>();
        const personNameMap = new Map<string, any>();
        for (const p of allPeople) {
          if (p.email) personEmailMap.set(p.email.toLowerCase(), p);
          if (p.primaryEmail) personEmailMap.set(p.primaryEmail.toLowerCase(), p);
          if (p.fullName) personNameMap.set(p.fullName.toLowerCase(), p);
        }

        const users = await storage.getAllUsers();
        const userEmailMap = new Map(users.map((u: any) => [u.email?.toLowerCase(), u]));

        const errors: Array<{ row: number; field: string; message: string }> = [];
        const warnings: Array<{ row: number; field: string; message: string }> = [];
        const previewData: ServiceImportValidationResult["previewData"] = [];

        let clientsMatched = 0,
          clientsNotFound = 0;
        let peopleMatched = 0,
          peopleNotFound = 0;
        let servicesMatched = 0,
          servicesNotFound = 0;

        for (let i = 0; i < rows.length; i++) {
          const rowNum = i + 2;
          const rawRow = rows[i];
          const mappedRow = applyMappings(rawRow, mappings);

          const serviceName = mappedRow.serviceName;
          if (!serviceName) {
            errors.push({ row: rowNum, field: "serviceName", message: "Service name is required" });
            continue;
          }

          const matchedService = serviceNameMap.get(String(serviceName).toLowerCase());
          if (matchedService) {
            servicesMatched++;
          } else {
            servicesNotFound++;
            errors.push({ row: rowNum, field: "serviceName", message: `Service "${serviceName}" not found in system` });
            continue;
          }

          let matchedClient: any = null;
          let matchedPerson: any = null;
          let action: "create" | "update" | "skip" = "create";
          let skipReason: string | undefined;

          if (importType === "people_services" || matchedService.isPersonalService) {
            const personEmail = mappedRow.personEmail;
            const personName = mappedRow.personFullName;

            if (personEmail) {
              matchedPerson = personEmailMap.get(String(personEmail).toLowerCase());
            }
            if (!matchedPerson && personName) {
              matchedPerson = personNameMap.get(String(personName).toLowerCase());
            }

            if (matchedPerson) {
              peopleMatched++;
              const personServices = await storage.getPeopleServicesByPersonId(matchedPerson.id);
              const existingService = personServices.find((ps: any) => ps.serviceId === matchedService.id);
              if (existingService) {
                action = "update";
              }
            } else {
              peopleNotFound++;
              errors.push({
                row: rowNum,
                field: "personEmail",
                message: `Person not found: ${personEmail || personName || "(no identifier)"}`,
              });
              continue;
            }
          } else {
            const companyNumber = mappedRow.companyNumber;
            const clientName = mappedRow.clientName;

            if (companyNumber) {
              const paddedNum = String(companyNumber).padStart(8, "0");
              matchedClient = clientCompanyNumberMap.get(paddedNum);
            }
            if (!matchedClient && clientName) {
              matchedClient = clientNameMap.get(String(clientName).toLowerCase());
            }

            if (matchedClient) {
              clientsMatched++;
              const clientServices = await storage.getClientServicesByClientId(matchedClient.id);
              const existingService = clientServices.find((cs: any) => cs.serviceId === matchedService.id);
              if (existingService) {
                action = "update";
              }
            } else {
              clientsNotFound++;
              errors.push({
                row: rowNum,
                field: "companyNumber",
                message: `Client not found: ${companyNumber || clientName || "(no identifier)"}`,
              });
              continue;
            }
          }

          if (mappedRow.serviceOwnerEmail) {
            const owner = userEmailMap.get(String(mappedRow.serviceOwnerEmail).toLowerCase());
            if (!owner) {
              warnings.push({
                row: rowNum,
                field: "serviceOwnerEmail",
                message: `Service owner "${mappedRow.serviceOwnerEmail}" not found`,
              });
            }
          }

          previewData.push({
            row: rowNum,
            sourceData: rawRow,
            matchedClient: matchedClient ? { id: matchedClient.id, name: matchedClient.name } : undefined,
            matchedPerson: matchedPerson ? { id: matchedPerson.id, name: matchedPerson.fullName } : undefined,
            matchedService: matchedService ? { id: matchedService.id, name: matchedService.name } : undefined,
            action,
            skipReason,
          });
        }

        const validRows = previewData.length;
        const invalidRows = rows.length - validRows;

        const result: ServiceImportValidationResult = {
          isValid: errors.length === 0,
          totalRows: rows.length,
          validRows,
          invalidRows,
          errors,
          warnings,
          matchStats: {
            clientsMatched,
            clientsNotFound,
            peopleMatched,
            peopleNotFound,
            servicesMatched,
            servicesNotFound,
          },
          previewData,
        };

        res.json(result);
      } catch (error: any) {
        console.error("Service import validation error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/service-import/execute",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: Response) => {
      try {
        const { rows, mappings, importType } = req.body as {
          rows: Record<string, any>[];
          mappings: FieldMapping[];
          importType: "client_services" | "people_services" | "mixed";
        };

        if (!rows || !mappings) {
          return res.status(400).json({ error: "Missing rows or mappings" });
        }

        const importId = nanoid(12);
        const startedAt = new Date().toISOString();

        const allServices = await storage.getAllServices();
        const serviceNameMap = new Map(allServices.map((s: any) => [s.name.toLowerCase(), s]));

        const allClients = await storage.getAllClients();
        const clientNameMap = new Map<string, any>();
        const clientCompanyNumberMap = new Map<string, any>();
        for (const c of allClients) {
          clientNameMap.set(c.name.toLowerCase(), c);
          if (c.companyNumber) {
            clientCompanyNumberMap.set(c.companyNumber.padStart(8, "0"), c);
          }
        }

        const allPeople = await storage.getAllPeople();
        const personEmailMap = new Map<string, any>();
        const personNameMap = new Map<string, any>();
        for (const p of allPeople) {
          if (p.email) personEmailMap.set(p.email.toLowerCase(), p);
          if (p.primaryEmail) personEmailMap.set(p.primaryEmail.toLowerCase(), p);
          if (p.fullName) personNameMap.set(p.fullName.toLowerCase(), p);
        }

        const users = await storage.getAllUsers();
        const userEmailMap = new Map(users.map((u: any) => [u.email?.toLowerCase(), u]));

        const workRoles = await storage.getAllWorkRoles();
        const roleNameMap = new Map(workRoles.map((r: any) => [r.name.toLowerCase(), r]));

        const summary = {
          clientServicesCreated: 0,
          clientServicesUpdated: 0,
          clientServicesSkipped: 0,
          peopleServicesCreated: 0,
          peopleServicesUpdated: 0,
          peopleServicesSkipped: 0,
          roleAssignmentsCreated: 0,
          roleAssignmentsUpdated: 0,
          udfValuesUpdated: 0,
          errors: 0,
        };

        const auditRecords: ImportAuditRecord[] = [];
        const globalErrors: string[] = [];
        const globalWarnings: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const rowNum = i + 2;
          const rawRow = rows[i];
          const mappedRow = applyMappings(rawRow, mappings);

          try {
            const serviceName = mappedRow.serviceName;
            if (!serviceName) {
              auditRecords.push({
                rowNumber: rowNum,
                status: "failed",
                recordType: "client_service",
                identifier: "(unknown)",
                details: "Missing service name",
                sourceData: rawRow,
                errorMessage: "Service name is required",
              });
              summary.errors++;
              continue;
            }

            const matchedService = serviceNameMap.get(String(serviceName).toLowerCase());
            if (!matchedService) {
              auditRecords.push({
                rowNumber: rowNum,
                status: "failed",
                recordType: "client_service",
                identifier: serviceName,
                details: `Service not found`,
                sourceData: rawRow,
                errorMessage: `Service "${serviceName}" not found in system`,
              });
              summary.errors++;
              continue;
            }

            const isPersonalService = importType === "people_services" || matchedService.isPersonalService;

            if (isPersonalService) {
              const personEmail = mappedRow.personEmail;
              const personName = mappedRow.personFullName;

              let matchedPerson: any = null;
              if (personEmail) {
                matchedPerson = personEmailMap.get(String(personEmail).toLowerCase());
              }
              if (!matchedPerson && personName) {
                matchedPerson = personNameMap.get(String(personName).toLowerCase());
              }

              if (!matchedPerson) {
                auditRecords.push({
                  rowNumber: rowNum,
                  status: "failed",
                  recordType: "people_service",
                  identifier: `${personEmail || personName} / ${serviceName}`,
                  details: "Person not found",
                  sourceData: rawRow,
                  errorMessage: `Person not found: ${personEmail || personName}`,
                });
                summary.errors++;
                continue;
              }

              const personServices = await storage.getPeopleServicesByPersonId(matchedPerson.id);
              let existingService = personServices.find((ps: any) => ps.serviceId === matchedService.id);
              
              const serviceData: any = {
                personId: matchedPerson.id,
                serviceId: matchedService.id,
                isActive: mappedRow.isActive !== undefined ? normalizeBoolean(mappedRow.isActive) : true,
              };

              if (mappedRow.frequency) serviceData.frequency = mappedRow.frequency;
              if (mappedRow.nextStartDate) serviceData.nextStartDate = parseDate(mappedRow.nextStartDate);
              if (mappedRow.nextDueDate) serviceData.nextDueDate = parseDate(mappedRow.nextDueDate);
              if (mappedRow.serviceOwnerEmail) {
                const owner = userEmailMap.get(String(mappedRow.serviceOwnerEmail).toLowerCase());
                if (owner) serviceData.serviceOwnerId = owner.id;
              }

              const changes: Record<string, { from: any; to: any }> = {};

              if (existingService) {
                if (serviceData.frequency && serviceData.frequency !== existingService.frequency) {
                  changes.frequency = { from: existingService.frequency, to: serviceData.frequency };
                }
                await storage.updatePeopleService(existingService.id, serviceData);
                summary.peopleServicesUpdated++;

                auditRecords.push({
                  rowNumber: rowNum,
                  status: "updated",
                  recordType: "people_service",
                  identifier: `${matchedPerson.fullName} / ${matchedService.name}`,
                  details: `Updated personal service`,
                  sourceData: rawRow,
                  matchedEntity: { id: existingService.id, name: matchedService.name },
                  changes,
                });
              } else {
                const newService = await storage.createPeopleService(serviceData);
                summary.peopleServicesCreated++;

                auditRecords.push({
                  rowNumber: rowNum,
                  status: "created",
                  recordType: "people_service",
                  identifier: `${matchedPerson.fullName} / ${matchedService.name}`,
                  details: `Created personal service`,
                  sourceData: rawRow,
                  matchedEntity: { id: newService.id, name: matchedService.name },
                });
              }
            } else {
              const companyNumber = mappedRow.companyNumber;
              const clientName = mappedRow.clientName;

              let matchedClient: any = null;
              if (companyNumber) {
                const paddedNum = String(companyNumber).padStart(8, "0");
                matchedClient = clientCompanyNumberMap.get(paddedNum);
              }
              if (!matchedClient && clientName) {
                matchedClient = clientNameMap.get(String(clientName).toLowerCase());
              }

              if (!matchedClient) {
                auditRecords.push({
                  rowNumber: rowNum,
                  status: "failed",
                  recordType: "client_service",
                  identifier: `${companyNumber || clientName} / ${serviceName}`,
                  details: "Client not found",
                  sourceData: rawRow,
                  errorMessage: `Client not found: ${companyNumber || clientName}`,
                });
                summary.errors++;
                continue;
              }

              const clientServices = await storage.getClientServicesByClientId(matchedClient.id);
              let existingService = clientServices.find((cs: any) => cs.serviceId === matchedService.id);

              const serviceData: any = {
                clientId: matchedClient.id,
                serviceId: matchedService.id,
                isActive: mappedRow.isActive !== undefined ? normalizeBoolean(mappedRow.isActive) : true,
              };

              if (mappedRow.frequency) serviceData.frequency = mappedRow.frequency;
              if (mappedRow.nextStartDate) serviceData.nextStartDate = parseDate(mappedRow.nextStartDate);
              if (mappedRow.nextDueDate) serviceData.nextDueDate = parseDate(mappedRow.nextDueDate);
              if (mappedRow.serviceOwnerEmail) {
                const owner = userEmailMap.get(String(mappedRow.serviceOwnerEmail).toLowerCase());
                if (owner) serviceData.serviceOwnerId = owner.id;
              }

              const changes: Record<string, { from: any; to: any }> = {};

              if (existingService) {
                if (serviceData.frequency && serviceData.frequency !== existingService.frequency) {
                  changes.frequency = { from: existingService.frequency, to: serviceData.frequency };
                }
                await storage.updateClientService(existingService.id, serviceData);
                summary.clientServicesUpdated++;

                auditRecords.push({
                  rowNumber: rowNum,
                  status: "updated",
                  recordType: "client_service",
                  identifier: `${matchedClient.name} / ${matchedService.name}`,
                  details: `Updated client service`,
                  sourceData: rawRow,
                  matchedEntity: { id: existingService.id, name: matchedService.name },
                  changes,
                });
              } else {
                const newService = await storage.createClientService(serviceData);
                existingService = newService as any;
                summary.clientServicesCreated++;

                auditRecords.push({
                  rowNumber: rowNum,
                  status: "created",
                  recordType: "client_service",
                  identifier: `${matchedClient.name} / ${matchedService.name}`,
                  details: `Created client service`,
                  sourceData: rawRow,
                  matchedEntity: { id: newService.id, name: matchedService.name },
                });
              }

              const clientServiceId = existingService?.id;
              
              for (const key of Object.keys(mappedRow)) {
                if (key.startsWith("role_") && mappedRow[key]) {
                  const roleName = key.substring(5);
                  const userEmail = String(mappedRow[key]).trim();
                  const matchedRole = roleNameMap.get(roleName.toLowerCase());
                  const matchedUser = userEmailMap.get(userEmail.toLowerCase());

                  if (matchedRole && matchedUser && clientServiceId) {
                    try {
                      const existingAssignments = await storage.getClientServiceRoleAssignments(clientServiceId);
                      const existingForRole = existingAssignments.find(
                        (a: any) => a.workRoleId === matchedRole.id && a.isActive
                      );

                      if (existingForRole) {
                        if (existingForRole.userId !== matchedUser.id) {
                          await storage.updateClientServiceRoleAssignment(existingForRole.id, { userId: matchedUser.id });
                          summary.roleAssignmentsUpdated++;
                        }
                      } else {
                        await storage.createClientServiceRoleAssignment({
                          clientServiceId: clientServiceId,
                          workRoleId: matchedRole.id,
                          userId: matchedUser.id,
                          isActive: true,
                        });
                        summary.roleAssignmentsCreated++;
                      }
                    } catch (roleError: any) {
                      globalWarnings.push(`Row ${rowNum}: Role assignment error - ${roleError.message}`);
                    }
                  }
                }
              }
            }
          } catch (rowError: any) {
            auditRecords.push({
              rowNumber: rowNum,
              status: "failed",
              recordType: importType === "people_services" ? "people_service" : "client_service",
              identifier: `Row ${rowNum}`,
              details: "Processing error",
              sourceData: rawRow,
              errorMessage: rowError.message,
            });
            summary.errors++;
          }
        }

        const completedAt = new Date().toISOString();

        const auditReport: ImportAuditReport = {
          importId,
          importType: importType,
          startedAt,
          completedAt,
          totalRows: rows.length,
          summary: {
            created: summary.clientServicesCreated + summary.peopleServicesCreated,
            updated: summary.clientServicesUpdated + summary.peopleServicesUpdated,
            skipped: summary.clientServicesSkipped + summary.peopleServicesSkipped,
            failed: summary.errors,
          },
          records: auditRecords,
          errors: globalErrors,
          warnings: globalWarnings,
        };

        const result: ServiceImportExecutionResult = {
          success: summary.errors === 0,
          importId,
          summary,
          auditReport,
        };

        res.json(result);
      } catch (error: any) {
        console.error("Service import execution error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.get(
    "/api/service-import/template",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const allServices = await storage.getAllServices();
        const workRoles = await storage.getAllWorkRoles();

        const workbook = XLSX.utils.book_new();

        const clientServiceHeaders = [
          "Company Number",
          "Client Name",
          "Service Name",
          "Frequency",
          "Next Start Date",
          "Next Due Date",
          "Service Owner Email",
          "Is Active",
        ];

        for (const role of workRoles) {
          clientServiceHeaders.push(`Role: ${role.name}`);
        }

        const clientServiceInstructions = [
          "(8 digits)",
          "(Client company name)",
          "(Service name - exact match required)",
          "(monthly/quarterly/annual/one-off)",
          "(dd/mm/yyyy)",
          "(dd/mm/yyyy)",
          "(user@email.com)",
          "(Yes/No)",
        ];

        for (const role of workRoles) {
          clientServiceInstructions.push(`(${role.name} user email)`);
        }

        const clientServiceExample = [
          "12345678",
          "Example Ltd",
          allServices.find((s: any) => !s.isPersonalService)?.name || "Monthly Bookkeeping",
          "monthly",
          "01/01/2025",
          "15/01/2025",
          "owner@example.com",
          "Yes",
        ];

        for (const role of workRoles) {
          clientServiceExample.push("user@example.com");
        }

        const clientServiceSheet = XLSX.utils.aoa_to_sheet([
          clientServiceHeaders,
          clientServiceInstructions,
          clientServiceExample,
        ]);
        clientServiceSheet["!cols"] = clientServiceHeaders.map((h: string) => ({ wch: Math.max(h.length + 2, 15) }));
        XLSX.utils.book_append_sheet(workbook, clientServiceSheet, "Client Services");

        const personalServiceHeaders = [
          "Person Email",
          "Person Full Name",
          "Service Name",
          "Frequency",
          "Next Start Date",
          "Next Due Date",
          "Service Owner Email",
          "Is Active",
        ];

        const personalServiceInstructions = [
          "(Person's email address)",
          "(Full name if no email)",
          "(Service name - exact match required)",
          "(monthly/quarterly/annual/one-off)",
          "(dd/mm/yyyy)",
          "(dd/mm/yyyy)",
          "(user@email.com)",
          "(Yes/No)",
        ];

        const personalServiceExample = [
          "john@example.com",
          "John Smith",
          allServices.find((s: any) => s.isPersonalService)?.name || "Personal Tax Return",
          "annual",
          "06/04/2025",
          "31/01/2026",
          "owner@example.com",
          "Yes",
        ];

        const personalServiceSheet = XLSX.utils.aoa_to_sheet([
          personalServiceHeaders,
          personalServiceInstructions,
          personalServiceExample,
        ]);
        personalServiceSheet["!cols"] = personalServiceHeaders.map((h: string) => ({ wch: Math.max(h.length + 2, 15) }));
        XLSX.utils.book_append_sheet(workbook, personalServiceSheet, "Personal Services");

        const serviceListData = [["Service Name", "Type", "Is Personal Service"]];
        for (const service of allServices) {
          serviceListData.push([
            service.name,
            service.isPersonalService ? "Personal" : "Client",
            service.isPersonalService ? "Yes" : "No",
          ]);
        }
        const serviceListSheet = XLSX.utils.aoa_to_sheet(serviceListData);
        serviceListSheet["!cols"] = [{ wch: 40 }, { wch: 15 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(workbook, serviceListSheet, "Available Services");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="service-import-template.xlsx"');
        res.send(buffer);
      } catch (error: any) {
        console.error("Template generation error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );
}
