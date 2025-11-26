import { Express, Request, Response } from "express";
import multer from "multer";
import XLSX from "xlsx";
import { storage } from "../storage/index";

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

        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        
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

        const clientData: ClientRow[] = XLSX.utils.sheet_to_json(clientSheet);
        const personData: PersonRow[] = XLSX.utils.sheet_to_json(personSheet);

        const users = await storage.getAllUsers();
        const userEmailMap = new Map(users.map((u: any) => [u.email?.toLowerCase(), u]));

        const transformedClients: TransformedClient[] = [];
        const transformedPeople: TransformedPerson[] = [];

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

        const hasErrors = transformedClients.some(c => c.errors.length > 0) || 
                         transformedPeople.some(p => p.errors.length > 0);
        const hasWarnings = transformedClients.some(c => c.warnings.length > 0) || 
                           transformedPeople.some(p => p.warnings.length > 0);

        res.json({
          success: true,
          summary: {
            clientCount: transformedClients.length,
            personCount: transformedPeople.length,
            hasErrors,
            hasWarnings,
            errorCount: transformedClients.reduce((acc, c) => acc + c.errors.length, 0) +
                       transformedPeople.reduce((acc, p) => acc + p.errors.length, 0),
            warningCount: transformedClients.reduce((acc, c) => acc + c.warnings.length, 0) +
                         transformedPeople.reduce((acc, p) => acc + p.warnings.length, 0),
          },
          clients: transformedClients,
          people: transformedPeople,
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
        const { clients, people } = req.body;
        
        if (!clients || !people) {
          return res.status(400).json({ error: "Missing clients or people data" });
        }

        const results = {
          clientsCreated: 0,
          clientsUpdated: 0,
          peopleCreated: 0,
          peopleUpdated: 0,
          relationshipsCreated: 0,
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

            const clientData = {
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
}
