import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type PriceListRow = {
  index: number;
  name: string;
  pricePerUnit: string;
  unitsPerPackage: string;
  pricePerPackage: string;
};

type PriceListOptions = {
  warehouseName: string;
  generatedAt?: Date;
  rows: PriceListRow[];
};

const PDF_TEXT = {
  title: 'ПРАЙС-ЛИСТ ТОВАРОВ',
  number: '№',
  item: 'Наименование товара',
  pricePerUnit: 'Цена за шт',
  unitsPerPackage: 'Кол-во в упак.',
  pricePerPackage: 'Цена за упак.',
  warehouse: 'Склад',
  generatedAt: 'Дата',
  positions: 'Позиций',
  shortTitle: 'Прайс-лист',
  page: 'Стр.',
} as const;

const PDF_FONT_FILE = 'arial.ttf';
const PDF_FONT_NAME = 'ArialUnicode';
const PDF_FONT_URL = '/fonts/arial.ttf';
const PDF_FONT_LOAD_ERROR = 'Не удалось загрузить PDF-шрифт';

let fontBase64Promise: Promise<string> | null = null;

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
  String(value || 'vse-sklady')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]+/gi, '') || 'vse-sklady';

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

export async function downloadPriceListPdf({
  warehouseName,
  generatedAt = new Date(),
  rows,
}: PriceListOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  await ensurePdfFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const fileDate = formatDateForFile(generatedAt);
  const safeWarehouse = buildSafeFilePart(warehouseName);
  const generatedAtLabel = formatDateTime(generatedAt);

  doc.setFillColor(79, 70, 229); // Desktop indigo color for price list
  doc.roundedRect(margin, margin, pageWidth - margin * 2, 16, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont(PDF_FONT_NAME, 'bold');
  doc.setFontSize(14);
  doc.text(PDF_TEXT.title, margin + 4, 14.5);

  doc.setFont(PDF_FONT_NAME, 'normal');
  doc.setFontSize(7.5);
  doc.text(`${PDF_TEXT.warehouse}: ${warehouseName}`, margin + 4, 19.5);
  doc.text(`${PDF_TEXT.generatedAt}: ${generatedAtLabel}`, pageWidth - margin - 4, 19.5, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, 28, pageWidth - margin * 2, 8, 2.5, 2.5, 'F');
  doc.setFont(PDF_FONT_NAME, 'bold');
  doc.setFontSize(7.5);
  doc.text(`${PDF_TEXT.positions}: ${rows.length}`, margin + 4, 33.2);

  autoTable(doc, {
    startY: 40,
    margin: { left: margin, right: margin, bottom: 12 },
    head: [[PDF_TEXT.number, PDF_TEXT.item, PDF_TEXT.pricePerUnit, PDF_TEXT.unitsPerPackage, PDF_TEXT.pricePerPackage]],
    body: rows.map((row) => [
      String(row.index),
      row.name,
      row.pricePerUnit,
      row.unitsPerPackage,
      row.pricePerPackage
    ]),
    theme: 'grid',
    styles: {
      font: PDF_FONT_NAME,
      fontSize: 8,
      lineColor: [209, 213, 219],
      lineWidth: 0.1,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      textColor: [31, 41, 55],
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      font: PDF_FONT_NAME,
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
    },
    didDrawPage: () => {
      const pageNumber = doc.getNumberOfPages();
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);
      doc.setTextColor(107, 114, 128);
      doc.setFont(PDF_FONT_NAME, 'normal');
      doc.setFontSize(7);
      doc.text(`${PDF_TEXT.shortTitle} - ${warehouseName}`, margin, pageHeight - 4);
      doc.text(`${PDF_TEXT.page} ${pageNumber}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
    },
  });

  doc.save(`price_list_${safeWarehouse}_${fileDate}.pdf`);
}
