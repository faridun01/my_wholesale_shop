import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReportPdfSection = {
  title: string;
  summaryRows: unknown[][];
  productSummaryHeaders?: string[];
  productSummaryRows?: unknown[][];
  detailHeaders: string[];
  detailRows: unknown[][];
  detailTotalRow: unknown[];
};

type ReportPdfOptions = {
  reportTitle: string;
  reportType: string;
  dateRangeLabel: string;
  generatedAt?: Date;
  sections: ReportPdfSection[];
};

const PDF_FONT_FILE = 'arial.ttf';
const PDF_FONT_NAME = 'ArialUnicode';
const PDF_FONT_URL = '/fonts/arial.ttf';
const PDF_FONT_LOAD_ERROR = 'Не удалось загрузить PDF-шрифт';

let fontBase64Promise: Promise<string> | null = null;

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const loadPdfFontBase64 = async () => {
  if (!fontBase64Promise) {
    fontBase64Promise = fetch(PDF_FONT_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error(PDF_FONT_LOAD_ERROR);
      }

      return arrayBufferToBase64(await response.arrayBuffer());
    });
  }

  return fontBase64Promise;
};

const ensurePdfFont = async (doc: jsPDF) => {
  const fonts = doc.getFontList();
  if (fonts[PDF_FONT_NAME]) {
    return;
  }

  const base64Font = await loadPdfFontBase64();
  doc.addFileToVFS(PDF_FONT_FILE, base64Font);
  doc.addFont(PDF_FONT_FILE, PDF_FONT_NAME, 'normal');
  doc.addFont(PDF_FONT_FILE, PDF_FONT_NAME, 'bold');
};

const formatDateTime = (value: Date) =>
  value.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatDateForFile = (value: Date) => value.toISOString().slice(0, 10);

const buildSafeFilePart = (value: string) =>
  String(value || 'report')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]+/gi, '') || 'report';

const stringifyCell = (value: unknown) => (value === null || value === undefined ? '' : String(value));

const getLastTableY = (doc: jsPDF, fallback: number) => {
  const lastAutoTable = (doc as any).lastAutoTable;
  return typeof lastAutoTable?.finalY === 'number' ? lastAutoTable.finalY : fallback;
};

const addFooter = (doc: jsPDF, title: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(226, 232, 240);
    doc.line(8, pageHeight - 8, pageWidth - 8, pageHeight - 8);
    doc.setTextColor(100, 116, 139);
    doc.setFont(PDF_FONT_NAME, 'normal');
    doc.setFontSize(6.2);
    doc.text(title, 8, pageHeight - 4.5);
    doc.text(`Стр. ${pageNumber} / ${pageCount}`, pageWidth - 8, pageHeight - 4.5, { align: 'right' });
  }
};

const addSection = (doc: jsPDF, section: ReportPdfSection, isFirstSection: boolean) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;
  const sectionStartY = isFirstSection ? 34 : 18;

  if (!isFirstSection) {
    doc.addPage();
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont(PDF_FONT_NAME, 'bold');
  doc.setFontSize(11);
  doc.text(section.title, margin, sectionStartY);

  autoTable(doc, {
    startY: sectionStartY + 5,
    margin: { left: margin, right: pageWidth - margin - 112 },
    body: section.summaryRows.map(([label, value]) => [stringifyCell(label), stringifyCell(value)]),
    theme: 'grid',
    styles: {
      font: PDF_FONT_NAME,
      fontSize: 7.2,
      lineColor: [203, 213, 225],
      lineWidth: 0.12,
      cellPadding: { top: 1.2, right: 1.5, bottom: 1.2, left: 1.5 },
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 74 },
    },
  });

  let detailsStartY = getLastTableY(doc, sectionStartY + 24) + 6;

  if (section.productSummaryRows?.length && section.productSummaryHeaders?.length) {
    autoTable(doc, {
      startY: detailsStartY,
      margin: { left: margin, right: margin, bottom: 12 },
      head: [section.productSummaryHeaders],
      body: section.productSummaryRows!.map((row) => row.map(stringifyCell)),
      theme: 'grid',
      styles: {
        font: PDF_FONT_NAME,
        fontSize: 6.1,
        lineColor: [203, 213, 225],
        lineWidth: 0.1,
        cellPadding: { top: 1.1, right: 1.1, bottom: 1.1, left: 1.1 },
        textColor: [15, 23, 42],
        valign: 'middle',
        overflow: 'linebreak',
      },
      headStyles: {
        font: PDF_FONT_NAME,
        fillColor: [15, 118, 110],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [240, 253, 250],
      },
      columnStyles: {
        0: { cellWidth: 78 },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.row.index === section.productSummaryRows!.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [204, 251, 241];
        }
      },
    });

    detailsStartY = getLastTableY(doc, detailsStartY) + 8;
  }
  autoTable(doc, {
    startY: detailsStartY,
    margin: { left: margin, right: margin, bottom: 12 },
    head: [section.detailHeaders],
    body: [
      ...section.detailRows.map((row) => row.map(stringifyCell)),
      section.detailTotalRow.map(stringifyCell),
    ],
    theme: 'grid',
    styles: {
      font: PDF_FONT_NAME,
      fontSize: 5.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
      cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
      textColor: [15, 23, 42],
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      font: PDF_FONT_NAME,
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 5.9,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.row.index === section.detailRows.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [226, 232, 240];
      }
    },
  });

};

export async function downloadReportPdf({
  reportTitle,
  reportType,
  dateRangeLabel,
  generatedAt = new Date(),
  sections,
}: ReportPdfOptions) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  await ensurePdfFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;
  const generatedAtLabel = formatDateTime(generatedAt);
  const fileDate = formatDateForFile(generatedAt);

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, margin, pageWidth - margin * 2, 18, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(PDF_FONT_NAME, 'bold');
  doc.setFontSize(13);
  doc.text(reportTitle, margin + 4, 15);
  doc.setFont(PDF_FONT_NAME, 'normal');
  doc.setFontSize(7.2);
  doc.text(`Период: ${dateRangeLabel}`, margin + 4, 21);
  doc.text(`Скачано: ${generatedAtLabel}`, pageWidth - margin - 4, 21, { align: 'right' });

  sections.forEach((section, index) => addSection(doc, section, index === 0));
  addFooter(doc, reportTitle);

  doc.save(`otchet_${buildSafeFilePart(reportType)}_${fileDate}.pdf`);
}
