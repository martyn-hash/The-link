import { Express, Request, Response } from "express";
import multer from "multer";
import { readExcelBuffer, sheetToJson, createWorkbook, jsonToSheet, writeWorkbookToBuffer } from "../utils/excelParser";
import { storage } from "../storage/index";
import { companiesHouseService } from "../companies-house-service";
import { createClientServiceMapping } from "../core/service-mapper";

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.mimetype === "application/vnd.ms-excel" ||
        file.originalname.endsWith(".xlsx") ||
        file.originalname.endsWith(".xls")) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed"));
    }
  },
});

function excelSerialToDate(serial: number): string | null {
  if (!serial || typeof serial !== "number") return null;
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + serial * 86400000);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function excelSerialToISO(serial: number): string | null {
  if (!serial || typeof serial !== "number") return null;
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + serial * 86400000);
  return date.toISOString();
}

function formatUKPhoneNumber(phone: string | number | null | undefined): string {
  if (!phone) return "";
  
  let cleaned = String(phone).replace(/[^\d+]/g, "");
  
  if (cleaned.startsWith("44")) {
    cleaned = "0" + cleaned.substring(2);
  } else if (cleaned.startsWith("+44")) {
    cleaned = "0" + cleaned.substring(3);
  }
  
  if (!cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "0" + cleaned;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith("07")) {
    return `${cleaned.substring(0, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith("01")) {
    return `${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("02")) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 7)} ${cleaned.substring(7)}`;
  }
  
  if (cleaned.length === 10 && !cleaned.startsWith("0")) {
    cleaned = "0" + cleaned;
    if (cleaned.startsWith("07")) {
      return `${cleaned.substring(0, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`;
    }
  }
  
  return cleaned;
}

function parseAddress(addressString: string | null | undefined): {
  line1: string;
  line2: string;
  line3: string;
  postcode: string;
  country: string;
} {
  if (!addressString) {
    return { line1: "", line2: "", line3: "", postcode: "", country: "" };
  }
  
  const lines = addressString.split(/[\n\r]+/).map(l => l.trim()).filter(l => l);
  
  const postcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i;
  let postcode = "";
  let postcodeIndex = -1;
  
  for (let i = lines.length - 1; i >= 0; i--) {
    if (postcodeRegex.test(lines[i])) {
      postcode = lines[i].toUpperCase();
      postcodeIndex = i;
      break;
    }
  }
  
  if (postcodeIndex === -1) {
    const lastLine = lines[lines.length - 1] || "";
    const parts = lastLine.split(/\s+/);
    for (let i = parts.length - 1; i >= 0; i--) {
      const potentialPostcode = parts.slice(i).join(" ");
      if (postcodeRegex.test(potentialPostcode)) {
        postcode = potentialPostcode.toUpperCase();
        lines[lines.length - 1] = parts.slice(0, i).join(" ");
        break;
      }
    }
  } else {
    lines.splice(postcodeIndex, 1);
  }
  
  return {
    line1: lines[0] || "",
    line2: lines[1] || "",
    line3: lines.slice(2).join(", "),
    postcode: postcode,
    country: "United Kingdom",
  };
}

interface ClientRow {
  Client: string;
  "Client Type": string;
  "Creation Date": number | string;
  Manager: string;
  "Company Number": string | number;
  "Company Status": string;
  "Incorporation Date": number | string;
  "Registered Address": string;
  "SIC Code": string;
  "HMRC Year End": number | string;
  "Company Email": string;
  "Monthly Charge Quote": number | string;
  "Company UTR": string | number;
  "Companies House Authentication Code": string;
  "Company Telephone": string | number;
  "Company Postal Address": string;
  "Company Email Domain": string;
  Notes: string;
  "Trading As": string;
}

interface PersonRow {
  Client: string;
  "Client Type": string;
  "First Name": string;
  "Full Name": string;
  "Initial Contact": number | string;
  "Invoice Address": string;
  "Last Name": string;
  "Address Verified": string;
  "Photo ID Verified": string;
  Email: string;
  "Date of Birth": number | string;
  "Money Laundering Complete": string;
  "Postal Address": string;
  "NI Number": string;
  "Mobile Number": string | number;
}

interface ServiceDataRow {
  "Client Company Number"?: string | number;
  "Client Name"?: string;
  "Service Name": string;
  "Field ID"?: string;
  "Value"?: string | number | boolean;
  "Frequency"?: string;
  "Next Start Date"?: string | number;
  "Next Due Date"?: string | number;
  "Service Owner"?: string;
  [key: string]: string | number | boolean | undefined;
}

interface TransformedServiceData {
  original: ServiceDataRow;
  transformed: {
    clientCompanyNumber: string;
    clientName: string;
    clientId: string | null;
    serviceName: string;
    serviceId: string | null;
    fieldId: string;
    fieldName: string | null;
    fieldType: string | null;
    value: any;
    clientServiceId: string | null;
  };
  warnings: string[];
  errors: string[];
}

interface TransformedClient {
  original: ClientRow;
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
  original: PersonRow;
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

export function registerExcelImportRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any,
  requireAdmin: any
) {
  app.post(
    "/api/excel-import/parse",
    isAuthenticated,
    requireAdmin,
    uploadExcel.single("file"),
    async (req: any, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const workbook = await readExcelBuffer(req.file.buffer);
        
        const clientSheetName = workbook.SheetNames.find(n => 
          n.toLowerCase().includes("client") && !n.toLowerCase().includes("person")
        );
        
        const personSheetName = workbook.SheetNames.find(n => 
          n.toLowerCase().includes("person") || n.toLowerCase().includes("people")
        );

        if (!clientSheetName) {
          return res.status(400).json({ 
            error: `Excel file must have a 'Client' sheet. Found sheets: ${workbook.SheetNames.join(", ")}` 
          });
        }
        
        if (!personSheetName) {
          return res.status(400).json({ 
            error: `Excel file must have a 'Person' or 'People' sheet. Found sheets: ${workbook.SheetNames.join(", ")}` 
          });
        }

        const clientSheet = workbook.Sheets[clientSheetName];
        const personSheet = workbook.Sheets[personSheetName];
        
        const serviceDataSheetName = workbook.SheetNames.find(n => 
          n.toLowerCase().includes("service") && n.toLowerCase().includes("data")
        );

        const clientData: ClientRow[] = sheetToJson(clientSheet);
        const personData: PersonRow[] = sheetToJson(personSheet);
        const serviceDataRows: ServiceDataRow[] = serviceDataSheetName 
          ? sheetToJson(workbook.Sheets[serviceDataSheetName])
          : [];

        const users = await storage.getAllUsers();
        const userEmailMap = new Map(users.map((u: any) => [u.email?.toLowerCase(), u]));
        
        const allServices = await storage.getAllServices();
        const serviceNameMap = new Map(allServices.map((s: any) => [s.name.toLowerCase(), s]));
        
        const existingClients = await storage.getAllClients();
        const clientCompanyNumberMap = new Map<string, any>();
        const clientNameMap = new Map<string, any>();
        for (const c of existingClients) {
          if (c.companyNumber) {
            clientCompanyNumberMap.set(c.companyNumber.padStart(8, "0"), c);
          }
          clientNameMap.set(c.name.toLowerCase(), c);
        }

        const transformedClients: TransformedClient[] = [];
        const transformedPeople: TransformedPerson[] = [];
        const transformedServiceData: TransformedServiceData[] = [];

        for (const row of clientData) {
          const warnings: string[] = [];
          const errors: string[] = [];
          
          const regAddress = parseAddress(row["Registered Address"]);
          const postalAddr = parseAddress(row["Company Postal Address"]);
          
          let managerEmail = row.Manager || "";
          let managerId: string | null = null;
          let managerMatched = false;
          
          if (managerEmail && managerEmail.includes("@")) {
            const user = userEmailMap.get(managerEmail.toLowerCase());
            if (user) {
              managerId = user.id;
              managerMatched = true;
            } else {
              errors.push(`Manager email "${managerEmail}" not found in system - please check the email address`);
            }
          } else if (managerEmail) {
            errors.push(`Manager "${managerEmail}" is not an email address - please update the Manager column to use email addresses instead of names`);
          }

          const companyNumber = String(row["Company Number"] || "").padStart(8, "0");
          const rawPhone = row["Company Telephone"];
          const formattedPhone = formatUKPhoneNumber(rawPhone);

          let sicCodes: string[] = [];
          if (row["SIC Code"]) {
            sicCodes = [String(row["SIC Code"])];
          }

          transformedClients.push({
            original: row,
            transformed: {
              name: row.Client || "",
              clientType: row["Client Type"] || "",
              clientOnboardedDate: typeof row["Creation Date"] === "number" 
                ? excelSerialToDate(row["Creation Date"]) : String(row["Creation Date"] || ""),
              managerEmail,
              managerMatched,
              managerId,
              companyNumber: companyNumber !== "00000000" ? companyNumber : "",
              companyStatus: row["Company Status"] || "",
              dateOfCreation: typeof row["Incorporation Date"] === "number"
                ? excelSerialToDate(row["Incorporation Date"]) : String(row["Incorporation Date"] || ""),
              registeredAddress1: regAddress.line1,
              registeredAddress2: regAddress.line2,
              registeredAddress3: regAddress.line3,
              registeredPostcode: regAddress.postcode,
              sicCodes,
              email: row["Company Email"] || "",
              monthlyChargeQuote: String(row["Monthly Charge Quote"] || ""),
              companyUtr: String(row["Company UTR"] || ""),
              companiesHouseAuthCode: row["Companies House Authentication Code"] || "",
              companyTelephone: String(rawPhone || ""),
              companyTelephoneFormatted: formattedPhone,
              postalAddress1: postalAddr.line1,
              postalAddress2: postalAddr.line2,
              postalAddress3: postalAddr.line3,
              postalAddressPostcode: postalAddr.postcode,
              companyEmailDomain: row["Company Email Domain"] || "",
              notes: row.Notes || "",
              tradingAs: row["Trading As"] || "",
            },
            warnings,
            errors,
          });
        }

        for (const row of personData) {
          const warnings: string[] = [];
          const errors: string[] = [];
          
          const address = parseAddress(row["Postal Address"]);
          const rawPhone = row["Mobile Number"];
          const formattedPhone = formatUKPhoneNumber(rawPhone);
          
          let dobFormatted: string | null = null;
          if (typeof row["Date of Birth"] === "number") {
            dobFormatted = excelSerialToDate(row["Date of Birth"]);
          } else if (row["Date of Birth"]) {
            dobFormatted = String(row["Date of Birth"]);
          }

          let initialContactFormatted: string | null = null;
          if (typeof row["Initial Contact"] === "number") {
            initialContactFormatted = excelSerialToDate(row["Initial Contact"]);
          } else if (row["Initial Contact"]) {
            initialContactFormatted = String(row["Initial Contact"]);
          }

          const niNumber = row["NI Number"] || "";
          if (niNumber && !/^[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]?$/i.test(niNumber)) {
            warnings.push(`NI Number "${niNumber}" may be invalid format`);
          }

          transformedPeople.push({
            original: row,
            transformed: {
              clientName: row.Client || "",
              fullName: row["Full Name"] || "",
              firstName: row["First Name"] || "",
              lastName: row["Last Name"] || "",
              email: row.Email || "",
              dateOfBirth: dobFormatted,
              initialContactDate: initialContactFormatted,
              invoiceAddressType: row["Invoice Address"] || "",
              addressVerified: row["Address Verified"]?.toUpperCase() === "Y",
              photoIdVerified: row["Photo ID Verified"]?.toUpperCase() === "Y",
              amlComplete: row["Money Laundering Complete"]?.toUpperCase() === "Y",
              addressLine1: address.line1,
              addressLine2: address.line2,
              locality: address.line3,
              postalCode: address.postcode,
              country: address.country,
              niNumber: niNumber,
              telephone: String(rawPhone || ""),
              telephoneFormatted: formattedPhone,
            },
            warnings,
            errors,
          });
        }

        const clientNames = new Set(transformedClients.map(c => c.transformed.name.toLowerCase()));
        for (const person of transformedPeople) {
          if (!clientNames.has(person.transformed.clientName.toLowerCase())) {
            person.errors.push(`Client "${person.transformed.clientName}" not found in Client sheet`);
          }
        }
        
        const inFileClientByCompanyNumber = new Map<string, any>();
        const inFileClientByName = new Map<string, any>();
        for (const client of transformedClients) {
          const cn = client.transformed.companyNumber;
          if (cn && cn !== "00000000") {
            inFileClientByCompanyNumber.set(cn, client);
          }
          if (client.transformed.name) {
            inFileClientByName.set(client.transformed.name.toLowerCase(), client);
          }
        }
        
        const allWorkRoles = await storage.getAllWorkRoles();
        const workRoleMap = new Map<string, any>();
        for (const role of allWorkRoles) {
          workRoleMap.set(role.name.toLowerCase(), role);
        }
        
        
        for (const row of serviceDataRows) {
          const warnings: string[] = [];
          const errors: string[] = [];
          
          const clientCompanyNumber = String(row["Client Company Number"] || "").padStart(8, "0");
          const clientName = String(row["Client Name"] || "");
          const serviceName = String(row["Service Name"] || "");
          const fieldId = String(row["Field ID"] || "");
          const rawValue = row["Value"];
          
          const frequency = row["Frequency"] ? String(row["Frequency"]) : null;
          const serviceOwnerEmail = row["Service Owner"] ? String(row["Service Owner"]).trim() : null;
          
          let nextStartDate: string | null = null;
          if (row["Next Start Date"]) {
            if (typeof row["Next Start Date"] === "number") {
              nextStartDate = excelSerialToDate(row["Next Start Date"]);
            } else {
              nextStartDate = String(row["Next Start Date"]);
            }
          }
          
          let nextDueDate: string | null = null;
          if (row["Next Due Date"]) {
            if (typeof row["Next Due Date"] === "number") {
              nextDueDate = excelSerialToDate(row["Next Due Date"]);
            } else {
              nextDueDate = String(row["Next Due Date"]);
            }
          }
          
          const roleAssignments: { roleName: string; roleId: string | null; userEmail: string; userId: string | null }[] = [];
          for (const key of Object.keys(row)) {
            if (key.startsWith("Role: ") && row[key]) {
              const roleName = key.substring(6).trim();
              const userEmail = String(row[key]).trim();
              const matchedRole = workRoleMap.get(roleName.toLowerCase());
              const matchedUser = userEmailMap.get(userEmail.toLowerCase());
              
              if (!matchedRole) {
                warnings.push(`Role "${roleName}" not found in system`);
              }
              if (!matchedUser) {
                warnings.push(`User with email "${userEmail}" not found`);
              }
              
              roleAssignments.push({
                roleName,
                roleId: matchedRole?.id || null,
                userEmail,
                userId: matchedUser?.id || null,
              });
            }
          }
          
          let serviceOwnerId: string | null = null;
          if (serviceOwnerEmail) {
            const matchedOwner = userEmailMap.get(serviceOwnerEmail.toLowerCase());
            if (matchedOwner) {
              serviceOwnerId = matchedOwner.id;
            } else {
              warnings.push(`Service owner with email "${serviceOwnerEmail}" not found`);
            }
          }
          
          if (!serviceName) {
            errors.push("Service Name is required");
          }
          const hasServiceConfig = frequency || nextStartDate || nextDueDate || serviceOwnerEmail || roleAssignments.length > 0;
          const hasUdfData = fieldId && rawValue !== undefined && rawValue !== null && rawValue !== "";
          if (!hasServiceConfig && !hasUdfData) {
            errors.push("Row must have either service configuration (Frequency, Dates, Roles) or UDF data (Field ID + Value)");
          }
          if (!clientCompanyNumber && !clientName) {
            errors.push("Either Client Company Number or Client Name is required");
          }
          
          let matchedClient: any = null;
          let isInFileClient = false;
          let inFileClientRef: any = null;
          
          if (clientCompanyNumber && clientCompanyNumber !== "00000000") {
            matchedClient = clientCompanyNumberMap.get(clientCompanyNumber);
            if (!matchedClient) {
              inFileClientRef = inFileClientByCompanyNumber.get(clientCompanyNumber);
              if (inFileClientRef) isInFileClient = true;
            }
          }
          if (!matchedClient && !isInFileClient && clientName) {
            matchedClient = clientNameMap.get(clientName.toLowerCase());
            if (!matchedClient) {
              inFileClientRef = inFileClientByName.get(clientName.toLowerCase());
              if (inFileClientRef) isInFileClient = true;
            }
          }
          
          if (!matchedClient && !isInFileClient && (clientCompanyNumber || clientName)) {
            errors.push(`Client not found: ${clientCompanyNumber !== "00000000" ? `Company Number ${clientCompanyNumber}` : clientName}`);
          }
          
          let matchedService: any = null;
          if (serviceName) {
            matchedService = serviceNameMap.get(serviceName.toLowerCase());
          }
          if (!matchedService && serviceName) {
            errors.push(`Service "${serviceName}" not found in system`);
          }
          
          let fieldName: string | null = null;
          let fieldType: string | null = null;
          let clientServiceId: string | null = null;
          
          if (matchedService) {
            if (fieldId) {
              const udfDefs = (matchedService.udfDefinitions as any[] || []);
              const udfDef = udfDefs.find((d: any) => d.id === fieldId || d.name === fieldId);
              
              if (udfDef) {
                fieldName = udfDef.name;
                fieldType = udfDef.type;
                
                if (udfDef.regex && rawValue !== undefined && rawValue !== null && rawValue !== "") {
                  try {
                    const regex = new RegExp(udfDef.regex);
                    if (!regex.test(String(rawValue))) {
                      errors.push(udfDef.regexError || `Value "${rawValue}" does not match required format for ${udfDef.name}`);
                    }
                  } catch {}
                }
              } else {
                errors.push(`Field "${fieldId}" not found in service "${serviceName}" UDF definitions`);
              }
            }
            
            if (matchedClient) {
              const clientServices = await storage.getClientServicesByClientId(matchedClient.id);
              const matchedClientService = clientServices.find((cs: any) => cs.serviceId === matchedService.id);
              if (matchedClientService) {
                clientServiceId = matchedClientService.id;
              } else {
                warnings.push(`Client "${matchedClient.name}" does not have service "${serviceName}" assigned - will be automatically linked during import`);
              }
            } else if (isInFileClient) {
              warnings.push(`New client "${clientName || inFileClientRef.transformed.name}" - service "${serviceName}" will be automatically linked during import`);
            }
          }
          
          transformedServiceData.push({
            original: row,
            transformed: {
              clientCompanyNumber: clientCompanyNumber !== "00000000" ? clientCompanyNumber : "",
              clientName: clientName || (isInFileClient ? inFileClientRef.transformed.name : ""),
              clientId: matchedClient?.id || null,
              serviceName,
              serviceId: matchedService?.id || null,
              fieldId: fieldId || null,
              fieldName,
              fieldType,
              value: rawValue,
              clientServiceId,
              isInFileClient,
              frequency,
              nextStartDate,
              nextDueDate,
              serviceOwnerId,
              serviceOwnerEmail,
              roleAssignments,
            } as any,
            warnings,
            errors,
          });
        }

        const hasErrors = transformedClients.some(c => c.errors.length > 0) || 
                         transformedPeople.some(p => p.errors.length > 0) ||
                         transformedServiceData.some(s => s.errors.length > 0);
        const hasWarnings = transformedClients.some(c => c.warnings.length > 0) || 
                           transformedPeople.some(p => p.warnings.length > 0) ||
                           transformedServiceData.some(s => s.warnings.length > 0);

        res.json({
          success: true,
          summary: {
            clientCount: transformedClients.length,
            personCount: transformedPeople.length,
            serviceDataCount: transformedServiceData.length,
            hasErrors,
            hasWarnings,
            errorCount: transformedClients.reduce((acc, c) => acc + c.errors.length, 0) +
                       transformedPeople.reduce((acc, p) => acc + p.errors.length, 0) +
                       transformedServiceData.reduce((acc, s) => acc + s.errors.length, 0),
            warningCount: transformedClients.reduce((acc, c) => acc + c.warnings.length, 0) +
                         transformedPeople.reduce((acc, p) => acc + p.warnings.length, 0) +
                         transformedServiceData.reduce((acc, s) => acc + s.warnings.length, 0),
          },
          clients: transformedClients,
          people: transformedPeople,
          serviceData: transformedServiceData,
          availableManagers: users.map((u: any) => ({ id: u.id, email: u.email, name: u.fullName })),
        });
      } catch (error: any) {
        console.error("Excel parse error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.post(
    "/api/excel-import/execute",
    isAuthenticated,
    requireAdmin,
    async (req: any, res: Response) => {
      try {
        const { clients, people, serviceData } = req.body;
        
        if (!clients || !people) {
          return res.status(400).json({ error: "Missing clients or people data" });
        }

        const results = {
          clientsCreated: 0,
          clientsUpdated: 0,
          peopleCreated: 0,
          peopleUpdated: 0,
          relationshipsCreated: 0,
          serviceDataUpdated: 0,
          serviceDataSkipped: 0,
          errors: [] as string[],
        };

        const clientIdMap = new Map<string, string>();

        for (const client of clients) {
          try {
            const t = client.transformed;
            
            let clientOnboardedDate: Date | null = null;
            if (t.clientOnboardedDate) {
              const parts = t.clientOnboardedDate.split("/");
              if (parts.length === 3) {
                clientOnboardedDate = new Date(
                  parseInt(parts[2]), 
                  parseInt(parts[1]) - 1, 
                  parseInt(parts[0])
                );
              }
            }

            let dateOfCreation: Date | null = null;
            if (t.dateOfCreation) {
              const parts = t.dateOfCreation.split("/");
              if (parts.length === 3) {
                dateOfCreation = new Date(
                  parseInt(parts[2]), 
                  parseInt(parts[1]) - 1, 
                  parseInt(parts[0])
                );
              }
            }

            let clientData: any = {
              name: t.name,
              email: t.email || null,
              clientType: t.clientType || null,
              companyNumber: t.companyNumber || null,
              companyStatus: t.companyStatus || null,
              dateOfCreation: dateOfCreation,
              registeredAddress1: t.registeredAddress1 || null,
              registeredAddress2: t.registeredAddress2 || null,
              registeredAddress3: t.registeredAddress3 || null,
              registeredPostcode: t.registeredPostcode || null,
              sicCodes: t.sicCodes.length > 0 ? t.sicCodes : null,
              managerId: t.managerId || null,
              clientOnboardedDate: clientOnboardedDate,
              monthlyChargeQuote: t.monthlyChargeQuote ? parseFloat(t.monthlyChargeQuote) : null,
              companyUtr: t.companyUtr || null,
              companiesHouseAuthCode: t.companiesHouseAuthCode || null,
              companyTelephone: t.companyTelephoneFormatted || null,
              postalAddress1: t.postalAddress1 || null,
              postalAddress2: t.postalAddress2 || null,
              postalAddress3: t.postalAddress3 || null,
              postalAddressPostcode: t.postalAddressPostcode || null,
              companyEmailDomain: t.companyEmailDomain || null,
              tradingAs: t.tradingAs || null,
              notes: t.notes || null,
            };

            // Companies House enrichment for clients with company numbers
            if (t.companyNumber && t.companyNumber.length >= 6 && t.clientType === 'Company') {
              try {
                console.log(`[ExcelImport] Fetching CH data for company ${t.companyNumber}`);
                const chProfile = await companiesHouseService.getCompanyProfile(t.companyNumber);
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
                    lastAccountsType: chData.lastAccountsType,
                    accountsOverdue: chData.accountsOverdue,
                    confirmationStatementOverdue: chData.confirmationStatementOverdue,
                    jurisdiction: chData.jurisdiction,
                    // Keep user-provided values if they exist, otherwise use CH
                    name: t.name || chData.name,
                    companyStatus: t.companyStatus || chData.companyStatus,
                    sicCodes: t.sicCodes.length > 0 ? t.sicCodes : chData.sicCodes,
                  };
                  console.log(`[ExcelImport] CH enrichment successful for ${t.companyNumber}`);
                }
              } catch (chError: any) {
                console.warn(`[ExcelImport] CH enrichment failed for ${t.companyNumber}: ${chError.message}`);
                // Continue without CH enrichment - just use import data
              }
            }

            let existingClient = null;
            if (t.companyNumber && t.companyNumber.length >= 6) {
              existingClient = await storage.getClientByCompanyNumber(t.companyNumber);
            }
            if (!existingClient && t.name) {
              const clientsByName = await storage.getClientByName(t.name);
              if (clientsByName) {
                existingClient = clientsByName;
              }
            }

            let clientId: string;
            if (existingClient) {
              await storage.updateClient(existingClient.id, clientData);
              clientId = existingClient.id;
              results.clientsUpdated++;
            } else {
              const newClient = await storage.createClient(clientData);
              clientId = newClient.id;
              results.clientsCreated++;
            }
            
            clientIdMap.set(t.name.toLowerCase(), clientId);
            if (t.companyNumber) {
              const paddedCompanyNumber = t.companyNumber.padStart(8, "0");
              if (paddedCompanyNumber !== "00000000") {
                clientIdMap.set(paddedCompanyNumber, clientId);
              }
            }
          } catch (error: any) {
            results.errors.push(`Client "${client.transformed.name}": ${error.message}`);
          }
        }

        for (const person of people) {
          try {
            const t = person.transformed;
            const clientId = clientIdMap.get(t.clientName.toLowerCase());
            
            if (!clientId) {
              results.errors.push(`Person "${t.fullName}": Client "${t.clientName}" not found`);
              continue;
            }

            let dateOfBirth: string | null = null;
            if (t.dateOfBirth) {
              const parts = t.dateOfBirth.split("/");
              if (parts.length === 3) {
                dateOfBirth = `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
            }

            let initialContactDate: Date | null = null;
            if (t.initialContactDate) {
              const parts = t.initialContactDate.split("/");
              if (parts.length === 3) {
                initialContactDate = new Date(
                  parseInt(parts[2]), 
                  parseInt(parts[1]) - 1, 
                  parseInt(parts[0])
                );
              }
            }

            const personData = {
              fullName: t.fullName,
              firstName: t.firstName || null,
              lastName: t.lastName || null,
              email: t.email || null,
              primaryEmail: t.email || null,
              dateOfBirth: dateOfBirth,
              addressLine1: t.addressLine1 || null,
              addressLine2: t.addressLine2 || null,
              locality: t.locality || null,
              postalCode: t.postalCode || null,
              country: t.country || null,
              telephone: t.telephoneFormatted || null,
              primaryPhone: t.telephoneFormatted || null,
              niNumber: t.niNumber || null,
              photoIdVerified: t.photoIdVerified,
              addressVerified: t.addressVerified,
              amlComplete: t.amlComplete,
              initialContactDate: initialContactDate,
              invoiceAddressType: t.invoiceAddressType || null,
            };

            let existingPerson = null;
            if (t.email && t.email.includes('@')) {
              existingPerson = await storage.getPersonByEmail(t.email);
            }
            if (!existingPerson && t.fullName && t.niNumber) {
              const personByName = await storage.getPersonByFullName(t.fullName);
              if (personByName && personByName.niNumber === t.niNumber) {
                existingPerson = personByName;
              }
            }
            if (!existingPerson && t.fullName && !t.niNumber) {
              existingPerson = await storage.getPersonByFullName(t.fullName);
            }

            let personId: string;
            if (existingPerson) {
              await storage.updatePerson(existingPerson.id, personData);
              personId = existingPerson.id;
              results.peopleUpdated++;
            } else {
              const newPerson = await storage.createPerson(personData);
              personId = newPerson.id;
              results.peopleCreated++;
            }

            const existingRelation = await storage.getClientPerson(clientId, personId);
            if (!existingRelation) {
              await storage.createClientPerson({
                clientId,
                personId,
                isPrimaryContact: true,
              });
              results.relationshipsCreated++;
            }
          } catch (error: any) {
            results.errors.push(`Person "${person.transformed.fullName}": ${error.message}`);
          }
        }

        if (serviceData && serviceData.length > 0) {
          const clientServiceUpdates = new Map<string, {
            udfValues: Record<string, any>;
            configUpdates: { frequency?: string; nextStartDate?: string; nextDueDate?: string; serviceOwnerId?: string };
            roleAssignments: { roleId: string; userId: string }[];
          }>();
          
          for (const item of serviceData) {
            try {
              const t = item.transformed;
              
              let clientServiceId = t.clientServiceId;
              
              if (!clientServiceId && t.serviceId) {
                let resolvedClientId: string | undefined = t.clientId || undefined;
                
                if (!resolvedClientId) {
                  const paddedCompanyNumber = t.clientCompanyNumber ? t.clientCompanyNumber.padStart(8, "0") : "";
                  resolvedClientId = (paddedCompanyNumber && paddedCompanyNumber !== "00000000" 
                    ? clientIdMap.get(paddedCompanyNumber) 
                    : undefined) || clientIdMap.get(t.clientName?.toLowerCase() || "");
                }
                
                if (resolvedClientId) {
                  const clientServices = await storage.getClientServicesByClientId(resolvedClientId);
                  let matchedClientService: any = clientServices.find((cs: any) => cs.serviceId === t.serviceId);
                  
                  if (!matchedClientService) {
                    try {
                      // Use service mapper which handles CH-connected services correctly
                      matchedClientService = await createClientServiceMapping({
                        clientId: resolvedClientId,
                        serviceId: t.serviceId,
                        isActive: true,
                        udfValues: {},
                      });
                    } catch (createError: any) {
                      results.errors.push(`Failed to create service link for ${t.clientName}/${t.serviceName}: ${createError.message}`);
                    }
                  }
                  
                  if (matchedClientService) {
                    clientServiceId = matchedClientService.id;
                  }
                }
              }
              
              if (!clientServiceId) {
                results.serviceDataSkipped++;
                continue;
              }
              
              const existing = clientServiceUpdates.get(clientServiceId) || {
                udfValues: {},
                configUpdates: {},
                roleAssignments: [],
              };
              
              if (t.fieldId && t.value !== undefined && t.value !== null && t.value !== "") {
                existing.udfValues[t.fieldId] = t.value;
              }
              
              if (t.frequency) existing.configUpdates.frequency = t.frequency;
              if (t.nextStartDate) existing.configUpdates.nextStartDate = t.nextStartDate;
              if (t.nextDueDate) existing.configUpdates.nextDueDate = t.nextDueDate;
              if (t.serviceOwnerId) existing.configUpdates.serviceOwnerId = t.serviceOwnerId;
              
              if (t.roleAssignments && Array.isArray(t.roleAssignments)) {
                for (const ra of t.roleAssignments) {
                  if (ra.roleId && ra.userId) {
                    if (!existing.roleAssignments.some(r => r.roleId === ra.roleId)) {
                      existing.roleAssignments.push({ roleId: ra.roleId, userId: ra.userId });
                    }
                  }
                }
              }
              
              clientServiceUpdates.set(clientServiceId, existing);
            } catch (error: any) {
              results.errors.push(`Service Data for ${item.transformed.clientName}/${item.transformed.serviceName}: ${error.message}`);
            }
          }
          
          const updateEntries = Array.from(clientServiceUpdates.entries());
          for (const [clientServiceId, updates] of updateEntries) {
            try {
              const clientService = await storage.getClientServiceById(clientServiceId);
              if (clientService) {
                // Check if this is a CH-connected service (dates auto-populated from CH data)
                const service = await storage.getServiceById(clientService.serviceId);
                const isCHConnected = service?.isCompaniesHouseConnected || false;
                
                const updateData: any = {};
                
                if (Object.keys(updates.udfValues).length > 0) {
                  const existingValues = (clientService.udfValues as Record<string, any>) || {};
                  updateData.udfValues = { ...existingValues, ...updates.udfValues };
                }
                
                // Only apply frequency/dates from import for non-CH-connected services
                // CH-connected services get their dates from the client's CH data
                if (!isCHConnected) {
                  if (updates.configUpdates.frequency) updateData.frequency = updates.configUpdates.frequency;
                  if (updates.configUpdates.nextStartDate) updateData.nextStartDate = updates.configUpdates.nextStartDate;
                  if (updates.configUpdates.nextDueDate) updateData.nextDueDate = updates.configUpdates.nextDueDate;
                }
                if (updates.configUpdates.serviceOwnerId) updateData.serviceOwnerId = updates.configUpdates.serviceOwnerId;
                
                if (Object.keys(updateData).length > 0) {
                  await storage.updateClientService(clientServiceId, updateData);
                }
                
                for (const roleAssignment of updates.roleAssignments) {
                  try {
                    const existingAssignments = await storage.getClientServiceRoleAssignments(clientServiceId);
                    const existingForRole = existingAssignments.find((a: any) => a.workRoleId === roleAssignment.roleId && a.isActive);
                    
                    if (existingForRole) {
                      if (existingForRole.userId !== roleAssignment.userId) {
                        await storage.updateClientServiceRoleAssignment(existingForRole.id, { userId: roleAssignment.userId });
                      }
                    } else {
                      await storage.createClientServiceRoleAssignment({
                        clientServiceId,
                        workRoleId: roleAssignment.roleId,
                        userId: roleAssignment.userId,
                        isActive: true,
                      });
                    }
                  } catch (roleError: any) {
                    results.errors.push(`Role assignment for ${clientServiceId}: ${roleError.message}`);
                  }
                }
                
                results.serviceDataUpdated++;
              }
            } catch (error: any) {
              results.errors.push(`Service Data update for ${clientServiceId}: ${error.message}`);
            }
          }
        }

        res.json({
          success: results.errors.length === 0,
          ...results,
        });
      } catch (error: any) {
        console.error("Import execution error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // Generate template Excel file for import
  app.get(
    "/api/excel-import/template",
    isAuthenticated,
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        // Fetch all services with UDF definitions
        const services = await storage.getAllServices();
        const workRoles = await storage.getAllWorkRoles();

        // Create workbook
        const workbook = createWorkbook();

        // ===== CLIENT SHEET =====
        const clientHeaders = [
          "Client",
          "Client Type",
          "Creation Date",
          "Manager",
          "Company Number",
          "Company Status",
          "Incorporation Date",
          "Registered Address",
          "SIC Code",
          "HMRC Year End",
          "Company Email",
          "Monthly Charge Quote",
          "Company UTR",
          "Companies House Authentication Code",
          "Company Telephone",
          "Company Postal Address",
          "Company Email Domain",
          "Notes",
          "Trading As"
        ];
        
        // Instructions row with format guidance
        const clientInstructions = [
          "(Company name)",
          "(Company/Individual)",
          "(dd/mm/yyyy)",
          "(user@email.com)",
          "(8 digits, padded)",
          "(Active/Dormant/etc)",
          "(dd/mm/yyyy)",
          "(Multi-line address)",
          "(SIC code)",
          "(dd/mm/yyyy)",
          "(Company email)",
          "(Monthly fee)",
          "(10 digits)",
          "(Auth code)",
          "(UK phone number)",
          "(Multi-line address)",
          "(Domain only)",
          "(Free text notes)",
          "(Trading name)"
        ];
        
        const clientExample = [
          "EXAMPLE - DELETE THIS ROW",
          "Company",
          "01/01/2024",
          "manager@example.com",
          "12345678",
          "Active",
          "01/06/2020",
          "123 Business Street\nLondon\nEC1A 1AA",
          "62020",
          "31/03/2025",
          "info@example.com",
          "500",
          "1234567890",
          "ABC123",
          "07700900123",
          "123 Postal Street\nLondon\nEC1B 2BB",
          "example.com",
          "Important client notes here",
          "Example Trading Name"
        ];
        
        const clientSheetData = [clientHeaders, clientInstructions, clientExample];
        const clientSheet = workbook.addWorksheet("Clients");
        clientSheetData.forEach(row => clientSheet.addRow(row));
        
        // Set column widths
        clientHeaders.forEach((h: string, i: number) => {
          clientSheet.getColumn(i + 1).width = Math.max(h.length + 2, 15);
        });

        // ===== PEOPLE SHEET =====
        const peopleHeaders = [
          "Client",
          "Client Type",
          "First Name",
          "Last Name",
          "Full Name",
          "Email",
          "Date of Birth",
          "Initial Contact",
          "Invoice Address",
          "Postal Address",
          "Address Verified",
          "Photo ID Verified",
          "Money Laundering Complete",
          "NI Number",
          "Mobile Number"
        ];
        
        // Instructions row with format guidance
        const peopleInstructions = [
          "(Client company name)",
          "(Company/Individual)",
          "(First name)",
          "(Last name)",
          "(Full name)",
          "(Email address)",
          "(dd/mm/yyyy)",
          "(dd/mm/yyyy)",
          "(Registered/Other)",
          "(Multi-line address)",
          "(Yes/No)",
          "(Yes/No)",
          "(Yes/No)",
          "(e.g., AB123456C)",
          "(UK mobile number)"
        ];
        
        const peopleExample = [
          "EXAMPLE - DELETE THIS ROW",
          "Company",
          "John",
          "Smith",
          "John Smith",
          "john.smith@example.com",
          "15/06/1985",
          "01/01/2024",
          "Registered",
          "456 Home Street\nManchester\nM1 1AA",
          "Yes",
          "Yes",
          "Yes",
          "AB123456C",
          "07700900456"
        ];
        
        const peopleSheetData = [peopleHeaders, peopleInstructions, peopleExample];
        const peopleSheet = workbook.addWorksheet("People");
        peopleSheetData.forEach(row => peopleSheet.addRow(row));
        
        // Set column widths
        peopleHeaders.forEach((h: string, i: number) => {
          peopleSheet.getColumn(i + 1).width = Math.max(h.length + 2, 15);
        });

        // ===== SERVICE DATA SHEET =====
        // Simple format: base columns, then roles, then UDFs (2 columns each)
        
        const activeServices = services.filter((s: any) => s.isActive !== false);
        
        // Role columns - one per role in the system
        const roleHeaders = workRoles.map((role: any) => role.name);
        
        // Collect all UDFs across all services - 1 column each with combined header
        interface UdfInfo {
          serviceName: string;
          fieldId: string;
          fieldName: string;
        }
        const allUdfs: UdfInfo[] = [];
        
        for (const service of activeServices) {
          const udfs = (service.udfDefinitions || []) as Array<{id: string; name: string; type: string}>;
          for (const udf of udfs) {
            allUdfs.push({
              serviceName: service.name,
              fieldId: udf.id,
              fieldName: udf.name
            });
          }
        }
        
        // Build UDF column headers - 1 column per UDF with Field Name + ID
        const udfHeaders: string[] = allUdfs.map(udf => `${udf.fieldName} (${udf.fieldId})`);
        
        // Build all headers
        const serviceDataHeaders = [
          "Client Company Number",
          "Client Name",
          "Service Name",
          "CH Connected?",
          "Frequency",
          "Next Start Date",
          "Next Due Date",
          "Service Owner",
          ...roleHeaders,
          ...udfHeaders
        ];
        
        // Instructions row
        const instructionRow = [
          "8-digit padded",
          "Use if no company #",
          "Must match exactly",
          "(info only)",
          "Monthly/Quarterly/Annual",
          "dd/mm/yyyy",
          "dd/mm/yyyy",
          "user@email.com",
          ...roleHeaders.map(() => "user@email.com"),
          ...allUdfs.map(() => "Enter value")
        ];
        
        // Create one template row per service
        const serviceDataRows: any[][] = [];
        
        for (const service of activeServices) {
          // Check if this is a CH-connected service (dates auto-populated)
          const isCHConnected = service.isCompaniesHouseConnected || false;
          
          const row: any[] = [
            "",  // Client Company Number
            "",  // Client Name
            service.name,  // Service Name (exact match required)
            isCHConnected ? "Yes - dates auto from CH" : "No",  // CH Connected indicator
            isCHConnected ? "(auto - annually)" : "",  // Frequency - auto for CH services
            isCHConnected ? "(auto from CH data)" : "",  // Next Start Date
            isCHConnected ? "(auto from CH data)" : "",  // Next Due Date
            "",  // Service Owner
            ...roleHeaders.map(() => ""),  // All role columns empty
            ...allUdfs.map(() => "")  // All UDF columns empty (1 per UDF)
          ];
          
          serviceDataRows.push(row);
        }
        
        // Build the sheet
        const serviceSheetData = [
          serviceDataHeaders,
          instructionRow,
          ["--- TEMPLATE ROWS: Copy for each client ---", ...Array(serviceDataHeaders.length - 1).fill("")],
          ...serviceDataRows
        ];
        
        const serviceDataSheet = workbook.addWorksheet("Service Data");
        serviceSheetData.forEach(row => serviceDataSheet.addRow(row));
        
        // Set column widths
        serviceDataHeaders.forEach((h: string, i: number) => {
          serviceDataSheet.getColumn(i + 1).width = Math.min(Math.max(String(h).length + 2, 15), 30);
        });

        // ===== UDF REFERENCE SHEET =====
        // Add a reference sheet with all UDFs organized by service
        const udfRefHeaders = [
          "Service Name",
          "Field ID (use this in import)",
          "Field Name",
          "Field Type",
          "Required"
        ];
        
        const udfRefRows: any[][] = [];
        for (const service of activeServices) {
          const udfs = (service.udfDefinitions || []) as Array<{id: string; name: string; type: string; required?: boolean}>;
          for (const udf of udfs) {
            udfRefRows.push([
              service.name,
              udf.id,
              udf.name,
              udf.type,
              udf.required ? "Yes" : "No"
            ]);
          }
        }
        
        if (udfRefRows.length === 0) {
          udfRefRows.push(["No UDF fields defined in any service", "", "", "", ""]);
        }
        
        const udfRefSheet = workbook.addWorksheet("UDF Reference");
        [udfRefHeaders, ...udfRefRows].forEach(row => udfRefSheet.addRow(row));
        
        // Set column widths
        udfRefHeaders.forEach((h: string, i: number) => {
          udfRefSheet.getColumn(i + 1).width = Math.max(h.length + 2, 25);
        });

        // Generate buffer
        const buffer = await writeWorkbookToBuffer(workbook);

        // Send file
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=import_template.xlsx");
        res.send(buffer);
      } catch (error: any) {
        console.error("Template generation error:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );
}
