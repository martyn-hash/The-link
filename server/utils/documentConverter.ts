/**
 * Office Document to PDF Converter
 * Uses LibreOffice in headless mode to convert .docx and .xlsx files to PDF
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

const execAsync = promisify(exec);

// Temporary directory for conversions
const TMP_DIR = '/tmp/doc-conversions';

// Ensure temp directory exists
async function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true });
  }
}

/**
 * Convert Office document (.docx/.xlsx) to PDF using LibreOffice
 * @param inputBuffer Buffer containing the Office document
 * @param fileName Original filename (used to determine extension)
 * @returns Buffer containing the converted PDF
 * @throws Error if conversion fails
 */
export async function convertOfficeToPDF(
  inputBuffer: Buffer,
  fileName: string
): Promise<Buffer> {
  await ensureTmpDir();

  // Generate unique IDs for temp files
  const fileId = randomUUID();
  const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  
  // Validate file type
  if (!['.docx', '.xlsx', '.doc', '.xls'].includes(extension)) {
    throw new Error(`Unsupported file type: ${extension}. Only .docx and .xlsx are supported.`);
  }

  const inputPath = join(TMP_DIR, `${fileId}${extension}`);
  const outputDir = TMP_DIR;
  const outputPdfPath = join(TMP_DIR, `${fileId}.pdf`);

  try {
    // Write input file to temp directory
    await writeFile(inputPath, inputBuffer);
    console.log(`[DocumentConverter] Converting ${fileName} to PDF (ID: ${fileId})`);

    // Run LibreOffice conversion
    // --headless: Run without GUI
    // --convert-to pdf: Convert to PDF format
    // --outdir: Output directory
    const command = `soffice --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`;
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60 second timeout
    });

    console.log(`[DocumentConverter] LibreOffice output:`, stdout);
    if (stderr) {
      console.warn(`[DocumentConverter] LibreOffice stderr:`, stderr);
    }

    // Check if output PDF exists
    if (!existsSync(outputPdfPath)) {
      throw new Error('PDF conversion failed - output file not created');
    }

    // Read the converted PDF
    const pdfBuffer = await import('fs/promises').then(fs => fs.readFile(outputPdfPath));
    
    console.log(`[DocumentConverter] Successfully converted ${fileName} (${(pdfBuffer.length / 1024).toFixed(1)} KB PDF)`);
    
    return pdfBuffer;

  } catch (error) {
    console.error(`[DocumentConverter] Error converting ${fileName}:`, error);
    throw new Error(`Failed to convert document to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Clean up temp files
    try {
      if (existsSync(inputPath)) await unlink(inputPath);
      if (existsSync(outputPdfPath)) await unlink(outputPdfPath);
    } catch (cleanupError) {
      console.warn(`[DocumentConverter] Error cleaning up temp files:`, cleanupError);
    }
  }
}

/**
 * Generate a cache key for a converted document
 * @param objectPath Original object path
 * @returns Cache key for the converted PDF
 */
export function getCacheKey(objectPath: string): string {
  const hash = createHash('sha256').update(objectPath).digest('hex');
  return `converted-pdfs/${hash}.pdf`;
}

/**
 * Check if file is an Office document that can be converted
 * @param fileName File name
 * @returns True if file can be converted
 */
export function isConvertibleOfficeDoc(fileName: string): boolean {
  const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  return ['.docx', '.xlsx', '.doc', '.xls'].includes(extension);
}
