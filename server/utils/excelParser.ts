/**
 * Excel Parser Utility
 * Provides xlsx-compatible API using exceljs under the hood
 * This replaces the vulnerable xlsx package (CVE)
 */

import ExcelJS from "exceljs";

export interface ParsedWorkbook {
  SheetNames: string[];
  Sheets: Record<string, ParsedSheet>;
}

export interface ParsedSheet {
  _worksheet: ExcelJS.Worksheet;
}

/**
 * Read an Excel file from a buffer
 */
export async function readExcelBuffer(buffer: Buffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const SheetNames = workbook.worksheets.map((ws) => ws.name);
  const Sheets: Record<string, ParsedSheet> = {};

  for (const ws of workbook.worksheets) {
    Sheets[ws.name] = { _worksheet: ws };
  }

  return { SheetNames, Sheets };
}

/**
 * Convert a worksheet to JSON array of objects
 */
export function sheetToJson<T = Record<string, any>>(
  sheet: ParsedSheet,
  options?: { raw?: boolean; defval?: any }
): T[] {
  const worksheet = sheet._worksheet;
  const result: T[] = [];
  const defval = options?.defval ?? "";

  if (worksheet.rowCount === 0) {
    return result;
  }

  // Get headers from first row
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = cell.value;
    headers[colNumber - 1] = value != null ? String(value).trim() : `Column${colNumber}`;
  });

  // Determine the actual number of columns by checking the last non-empty header
  let maxCol = 0;
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    if (cell.value != null && String(cell.value).trim() !== "") {
      maxCol = Math.max(maxCol, colNumber);
    }
  });

  // If no headers found, return empty
  if (maxCol === 0) {
    return result;
  }

  // Process data rows (starting from row 2)
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    
    // Skip completely empty rows
    let hasData = false;
    row.eachCell({ includeEmpty: false }, () => {
      hasData = true;
    });
    
    if (!hasData) {
      continue;
    }

    const rowData: Record<string, any> = {};

    for (let colNumber = 1; colNumber <= maxCol; colNumber++) {
      const header = headers[colNumber - 1];
      if (!header) continue;

      const cell = row.getCell(colNumber);
      let value: any = defval;

      if (cell.value !== null && cell.value !== undefined) {
        // Handle different cell types
        if (cell.type === ExcelJS.ValueType.Date) {
          value = cell.value as Date;
        } else if (cell.type === ExcelJS.ValueType.Number) {
          value = cell.value as number;
        } else if (cell.type === ExcelJS.ValueType.Boolean) {
          value = cell.value as boolean;
        } else if (cell.type === ExcelJS.ValueType.Formula) {
          // For formula cells, get the result
          const formulaCell = cell.value as ExcelJS.CellFormulaValue;
          value = formulaCell.result !== undefined ? formulaCell.result : defval;
        } else if (cell.type === ExcelJS.ValueType.RichText) {
          // For rich text, concatenate all text parts
          const richText = cell.value as ExcelJS.CellRichTextValue;
          value = richText.richText.map((rt) => rt.text).join("");
        } else {
          value = String(cell.value);
        }
      }

      rowData[header] = value;
    }

    result.push(rowData as T);
  }

  return result;
}

/**
 * Create a new workbook
 */
export function createWorkbook(): ExcelJS.Workbook {
  return new ExcelJS.Workbook();
}

/**
 * Create a worksheet from JSON data
 */
export function jsonToSheet(
  workbook: ExcelJS.Workbook,
  data: Record<string, any>[],
  sheetName: string
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length === 0) {
    return worksheet;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Add header row
  worksheet.addRow(headers);

  // Add data rows
  for (const row of data) {
    const values = headers.map((h) => row[h] ?? "");
    worksheet.addRow(values);
  }

  return worksheet;
}

/**
 * Write workbook to buffer
 */
export async function writeWorkbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Create a worksheet from array-of-arrays (aoa) data
 * First row is treated as headers
 */
export function aoaToSheet(
  workbook: ExcelJS.Workbook,
  data: any[][],
  sheetName: string
): ExcelJS.Worksheet {
  const worksheet = workbook.addWorksheet(sheetName);

  for (const row of data) {
    worksheet.addRow(row);
  }

  return worksheet;
}

/**
 * Append an aoa sheet to an existing workbook
 */
export function appendAoaSheet(
  workbook: ExcelJS.Workbook,
  data: any[][],
  sheetName: string
): ExcelJS.Worksheet {
  return aoaToSheet(workbook, data, sheetName);
}

// Export ExcelJS for advanced usage
export { ExcelJS };
