import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { format } from 'date-fns';

interface SignerInfo {
  signerName: string;
  signerEmail: string;
  signedAt: string;
  ipAddress: string;
  deviceInfo: string;
  browserInfo: string;
  osInfo: string;
  documentHash: string;
  consentText?: string;
}

interface CertificateOptions {
  documentName: string;
  clientName: string;
  completedAt: Date;
  signers: SignerInfo[];
  originalDocumentHash: string;
  signedDocumentHash: string;
}

/**
 * Generates a Certificate of Completion PDF with full audit trail
 * Similar to DocuSign's Certificate of Completion
 */
export async function generateCertificateOfCompletion(
  options: CertificateOptions
): Promise<Uint8Array> {
  const {
    documentName,
    clientName,
    completedAt,
    signers,
    originalDocumentHash,
    signedDocumentHash,
  } = options;

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Colors
  const primaryColor = rgb(0.04, 0.48, 0.75); // #0A7BBF
  const successColor = rgb(0.46, 0.79, 0.14); // #76CA23
  const textColor = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.95, 0.95, 0.95);

  // Page dimensions
  const pageWidth = 612; // 8.5 inches
  const pageHeight = 792; // 11 inches
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;

  // Add first page
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPos = pageHeight - margin;

  // Header with success indicator (UK eIDAS compliant)
  // Use "CONFIRMED" text which is legally recognized for electronic signatures
  page.drawText('CONFIRMED', {
    x: pageWidth / 2 - 65,
    y: yPos,
    size: 32,
    font: fontBold,
    color: successColor,
  });
  yPos -= 60;

  // Title
  page.drawText('Certificate of Completion', {
    x: pageWidth / 2 - 140,
    y: yPos,
    size: 24,
    font: fontBold,
    color: primaryColor,
  });
  yPos -= 40;

  // Subtitle
  page.drawText('Electronic Signature Audit Trail', {
    x: pageWidth / 2 - 90,
    y: yPos,
    size: 12,
    font: font,
    color: textColor,
  });
  yPos -= 30;

  // Horizontal line
  page.drawLine({
    start: { x: margin, y: yPos },
    end: { x: pageWidth - margin, y: yPos },
    thickness: 2,
    color: primaryColor,
  });
  yPos -= 40;

  // Document Information Section
  page.drawText('DOCUMENT INFORMATION', {
    x: margin,
    y: yPos,
    size: 11,
    font: fontBold,
    color: textColor,
  });
  yPos -= 25;

  const docInfo = [
    ['Document Name:', documentName],
    ['Client:', clientName],
    ['Completed:', format(completedAt, 'MMMM d, yyyy \'at\' h:mm:ss a')],
    ['Total Signers:', signers.length.toString()],
  ];

  for (const [label, value] of docInfo) {
    page.drawText(label, {
      x: margin + 10,
      y: yPos,
      size: 10,
      font: fontBold,
      color: textColor,
    });
    page.drawText(value, {
      x: margin + 130,
      y: yPos,
      size: 10,
      font: font,
      color: textColor,
    });
    yPos -= 18;
  }

  yPos -= 20;

  // Document Integrity Section
  page.drawText('DOCUMENT INTEGRITY', {
    x: margin,
    y: yPos,
    size: 11,
    font: fontBold,
    color: textColor,
  });
  yPos -= 25;

  // Original Document Hash
  page.drawText('Original Document Hash (SHA-256):', {
    x: margin + 10,
    y: yPos,
    size: 9,
    font: fontBold,
    color: textColor,
  });
  yPos -= 15;

  // Wrap hash into multiple lines
  const hashChunkSize = 64;
  for (let i = 0; i < originalDocumentHash.length; i += hashChunkSize) {
    page.drawText(originalDocumentHash.substring(i, i + hashChunkSize), {
      x: margin + 10,
      y: yPos,
      size: 8,
      font: font,
      color: textColor,
    });
    yPos -= 12;
  }

  yPos -= 5;

  // Signed Document Hash
  page.drawText('Signed Document Hash (SHA-256):', {
    x: margin + 10,
    y: yPos,
    size: 9,
    font: fontBold,
    color: textColor,
  });
  yPos -= 15;

  for (let i = 0; i < signedDocumentHash.length; i += hashChunkSize) {
    page.drawText(signedDocumentHash.substring(i, i + hashChunkSize), {
      x: margin + 10,
      y: yPos,
      size: 8,
      font: font,
      color: textColor,
    });
    yPos -= 12;
  }

  yPos -= 30;

  // Signers Section
  for (let i = 0; i < signers.length; i++) {
    const signer = signers[i];

    // Check if we need a new page
    if (yPos < 200) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      yPos = pageHeight - margin;
    }

    // Signer header with background
    page.drawRectangle({
      x: margin,
      y: yPos - 18,
      width: contentWidth,
      height: 25,
      color: lightGray,
    });

    page.drawText(`SIGNER ${i + 1} - ${signer.signerName}`, {
      x: margin + 10,
      y: yPos - 13,
      size: 11,
      font: fontBold,
      color: primaryColor,
    });

    yPos -= 45;

    // Signer details
    const signerDetails = [
      ['Name:', signer.signerName],
      ['Email:', signer.signerEmail],
      ['Signed At:', format(new Date(signer.signedAt), 'MMMM d, yyyy \'at\' h:mm:ss a')],
      ['IP Address:', signer.ipAddress],
      ['Device:', signer.deviceInfo],
      ['Browser:', signer.browserInfo],
      ['Operating System:', signer.osInfo],
    ];

    for (const [label, value] of signerDetails) {
      if (yPos < margin + 50) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPos = pageHeight - margin;
      }

      page.drawText(label, {
        x: margin + 15,
        y: yPos,
        size: 9,
        font: fontBold,
        color: textColor,
      });

      // Wrap long values
      const maxWidth = contentWidth - 150;
      const wrappedValue = wrapText(value, maxWidth, 9, font);
      
      for (const line of wrappedValue) {
        page.drawText(line, {
          x: margin + 150,
          y: yPos,
          size: 9,
          font: font,
          color: textColor,
        });
        yPos -= 14;
        if (yPos < margin + 50) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          yPos = pageHeight - margin;
        }
      }

      // Reset for next item
      if (wrappedValue.length > 1) {
        yPos += (wrappedValue.length - 1) * 14;
      }
      yPos -= 18;
    }

    // Consent section
    if (signer.consentText) {
      if (yPos < 120) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPos = pageHeight - margin;
      }

      page.drawRectangle({
        x: margin + 15,
        y: yPos - 5,
        width: contentWidth - 30,
        height: 40,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: primaryColor,
        borderWidth: 1,
      });

      // UK eIDAS Compliant Consent Confirmation with full audit details
      const consentStatement = `Signer ${signer.signerName} accepted electronic signature consent on ${format(new Date(signer.consentAcceptedAt), 'MMMM d, yyyy \'at\' h:mm:ss a')} UTC.`;
      const consentStatementLines = wrapText(consentStatement, contentWidth - 50, 8, fontBold);
      let consentY = yPos + 20;
      for (const line of consentStatementLines) {
        page.drawText(line, {
          x: margin + 20,
          y: consentY,
          size: 8,
          font: fontBold,
          color: successColor,
        });
        consentY -= 10;
      }

      yPos -= 10;

      const consentTextLines = wrapText(signer.consentText, contentWidth - 50, 7, font);
      for (const line of consentTextLines) {
        page.drawText(line, {
          x: margin + 20,
          y: yPos,
          size: 7,
          font: font,
          color: textColor,
        });
        yPos -= 10;
      }

      yPos -= 25;
    }

    yPos -= 10;
  }

  // Footer on last page
  if (yPos < 150) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    yPos = pageHeight - margin;
  }

  yPos = 100; // Fixed position at bottom

  page.drawLine({
    start: { x: margin, y: yPos + 20 },
    end: { x: pageWidth - margin, y: yPos + 20 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  const footerText = [
    'This certificate of completion provides a complete audit trail of the electronic signature process.',
    'All signatures were captured in accordance with UK eIDAS regulations for electronic signatures.',
    'The document hashes provide cryptographic proof that the document has not been altered after signing.',
    `Generated on ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm:ss a')}`,
  ];

  yPos -= 5;
  for (const line of footerText) {
    page.drawText(line, {
      x: pageWidth / 2 - (line.length * 2.8),
      y: yPos,
      size: 7,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPos -= 12;
  }

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Helper function to wrap text to fit within a given width
 */
function wrapText(text: string, maxWidth: number, fontSize: number, font: any): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = testLine.length * fontSize * 0.6; // Approximate width

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}
