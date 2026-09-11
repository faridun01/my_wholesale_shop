import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import client from '../../api/client';
import {
  prepareSalesInvoiceData,
  type PreparedSalesInvoiceData,
} from './salesInvoicePrint';

const PDF_FONT_FILE = 'arial.ttf';
const PDF_FONT_NAME = 'ArialUnicode';
const PDF_FONT_URL = '/fonts/arial.ttf';

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
        throw new Error('Не удалось загрузить PDF-шрифт');
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

/**
 * Builds a jsPDF document that is 100% IDENTICAL in layout, structure,
 * calculations, and styling to the standard print invoice (Товарная накладная).
 */
export async function generateSalesInvoicePdf(rawInvoice: any): Promise<jsPDF> {
  let invoice = rawInvoice;
  if (!invoice) throw new Error('Накладная не найдена');

  // If items are missing or empty, fetch the complete invoice
  if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
    try {
      const res = await client.get(`/invoices/${invoice.id}`);
      if (res.data) invoice = res.data;
    } catch {
      // Continue with available data
    }
  }

  const data: PreparedSalesInvoiceData = prepareSalesInvoiceData(invoice);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  await ensurePdfFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 10;
  const marginRight = 10;

  // 1. Title: "Товарная накладная № X от DD.MM.YYYY"
  doc.setFont(PDF_FONT_NAME, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(
    `Товарная накладная № ${data.invoiceId} от ${data.invoiceDateLabel}`,
    pageWidth / 2,
    14,
    { align: 'center' },
  );

  // 2. Requisites Table: Организация & Покупатель
  autoTable(doc, {
    startY: 18,
    margin: { left: marginLeft, right: marginRight },
    theme: 'grid',
    tableLineWidth: 0.2,
    tableLineColor: [0, 0, 0],
    body: [
      [
        {
          content: 'Организация',
          styles: {
            fontStyle: 'bold',
            fillColor: [243, 243, 243],
            textColor: [51, 51, 51],
            cellWidth: 26,
          },
        },
        { content: data.companyName, styles: { textColor: [0, 0, 0] } },
      ],
      [
        {
          content: 'Покупатель',
          styles: {
            fontStyle: 'bold',
            fillColor: [243, 243, 243],
            textColor: [51, 51, 51],
            cellWidth: 26,
          },
        },
        { content: data.customerName, styles: { textColor: [0, 0, 0] } },
      ],
    ],
    styles: {
      font: PDF_FONT_NAME,
      fontSize: 8,
      cellPadding: 1.6,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
  });

  const requisitesFinalY = (doc as any).lastAutoTable?.finalY ?? 32;

  // 3. Items Table: № | Номенклатура | Ед. | Кол-во | Цена | Сумма | Примечание
  const itemsRows = data.items.map((item) => [
    item.index,
    item.productName,
    item.unitName,
    item.quantityFormatted,
    item.priceFormatted,
    item.lineTotalFormatted,
    item.quantityNote,
  ]);

  autoTable(doc, {
    startY: requisitesFinalY + 2,
    margin: { left: marginLeft, right: marginRight },
    theme: 'grid',
    tableLineWidth: 0.2,
    tableLineColor: [0, 0, 0],
    head: [['№', 'Номенклатура', 'Ед.', 'Кол-во', 'Цена', 'Сумма', 'Примечание']],
    headStyles: {
      font: PDF_FONT_NAME,
      fontStyle: 'bold',
      fillColor: [239, 239, 239],
      textColor: [0, 0, 0],
      fontSize: 7.5,
      halign: 'center',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      cellPadding: 1.6,
    },
    body: itemsRows.length > 0 ? itemsRows : [['—', 'Нет товаров', '—', '—', '—', '—', '']],
    bodyStyles: {
      font: PDF_FONT_NAME,
      textColor: [0, 0, 0],
      fontSize: 8,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      cellPadding: 1.6,
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 16, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 26, halign: 'left', fontSize: 7 },
    },
  });

  const itemsFinalY = (doc as any).lastAutoTable?.finalY ?? 60;

  // 4. Totals Table: right-aligned summary block
  const totalsRows: any[] = [
    [
      { content: 'Сумма без скидки', styles: { fontStyle: 'bold', cellWidth: 38 } },
      { content: data.subtotalBeforeDiscountFormatted, styles: { halign: 'right', cellWidth: 30 } },
    ],
    [
      { content: 'Скидка', styles: { fontStyle: 'bold' } },
      { content: data.totalDiscountAmountFormatted, styles: { halign: 'right' } },
    ],
  ];

  if (data.returnedAmount > 0) {
    totalsRows.push([
      { content: 'Возврат', styles: { fontStyle: 'bold' } },
      { content: data.returnedAmountFormatted, styles: { halign: 'right' } },
    ]);
  }

  if (data.paidAmount > 0) {
    totalsRows.push([
      { content: 'Оплачено', styles: { fontStyle: 'bold' } },
      { content: data.paidAmountFormatted, styles: { halign: 'right' } },
    ]);
    totalsRows.push([
      { content: 'Остаток', styles: { fontStyle: 'bold' } },
      { content: data.balanceDueFormatted, styles: { halign: 'right' } },
    ]);
  }

  totalsRows.push([
    {
      content: 'Итого',
      styles: {
        fontStyle: 'bold',
        fillColor: [239, 239, 239],
        fontSize: 9,
      },
    },
    {
      content: data.finalTotalAmountFormatted,
      styles: {
        fontStyle: 'bold',
        fillColor: [239, 239, 239],
        fontSize: 9,
        halign: 'right',
      },
    },
  ]);

  autoTable(doc, {
    startY: itemsFinalY + 2,
    margin: { left: pageWidth - marginRight - 68, right: marginRight },
    theme: 'grid',
    tableLineWidth: 0.2,
    tableLineColor: [0, 0, 0],
    body: totalsRows,
    styles: {
      font: PDF_FONT_NAME,
      fontSize: 8,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
  });

  const totalsFinalY = (doc as any).lastAutoTable?.finalY ?? itemsFinalY + 25;

  // 5. Summary Text: "Всего отпущено X единиц, на сумму Y."
  const summaryY = totalsFinalY + 4;
  doc.setFont(PDF_FONT_NAME, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const summaryPrefix = `Всего отпущено ${data.totalQuantityFormatted} единиц, на сумму `;
  doc.text(summaryPrefix, marginLeft, summaryY);
  const prefixWidth = doc.getTextWidth(summaryPrefix);
  doc.setFont(PDF_FONT_NAME, 'bold');
  doc.text(`${data.finalTotalAmountFormatted}.`, marginLeft + prefixWidth, summaryY);

  // Check if we need a new page for signatures
  let signY = summaryY + 8;
  if (signY + 18 > pageHeight - 10) {
    doc.addPage();
    signY = 15;
  }

  // 6. Signatures Block: Отпустил / Получил
  doc.setFont(PDF_FONT_NAME, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('Отпустил', marginLeft, signY);
  doc.text('Получил', pageWidth / 2 + 10, signY);

  doc.setFont(PDF_FONT_NAME, 'normal');
  doc.text('Подпись  ___________________________', marginLeft, signY + 6);
  doc.text('Ф.И.О.    ___________________________', marginLeft, signY + 12);

  doc.text('Подпись  ___________________________', pageWidth / 2 + 10, signY + 6);
  doc.text('Ф.И.О.    ___________________________', pageWidth / 2 + 10, signY + 12);

  return doc;
}

const cyrillicToLatinMap: Record<string, string> = {
  'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
  'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
  'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
  'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
  'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  '№': 'N'
};

function toSafePdfFilename(name: string): string {
  return name
    .split('')
    .map((char) => cyrillicToLatinMap[char] ?? char)
    .join('')
    .replace(/[^\w.-]/g, '_');
}

/**
 * Downloads the sales invoice PDF to the user's device.
 */
export async function downloadSalesInvoicePdf(rawInvoice: any, filename?: string) {
  const toastId = toast.loading('Формирование накладной...');
  try {
    const doc = await generateSalesInvoicePdf(rawInvoice);
    const invoiceId = rawInvoice?.id || rawInvoice?.invoiceNumber || 'doc';
    const finalFilename = filename ? toSafePdfFilename(filename) : `Nakladnaya_${invoiceId}.pdf`;
    doc.save(finalFilename);
    toast.success('Накладная сохранена в PDF', { id: toastId });
  } catch (error: any) {
    toast.error(error?.message || 'Не удалось сформировать PDF', { id: toastId });
  }
}

/**
 * Shares the sales invoice as a real PDF file via the Web Share API (native WhatsApp, Telegram, etc.)
 * with seamless fallback to direct download if sharing is unavailable or cancelled.
 */
export async function shareInvoicePdf(rawInvoice: any) {
  if (!rawInvoice) return;
  const toastId = toast.loading('Подготовка PDF для отправки...');

  try {
    const doc = await generateSalesInvoicePdf(rawInvoice);
    const invoiceId = rawInvoice?.id || rawInvoice?.invoiceNumber || 'doc';
    const filename = `Nakladnaya_${invoiceId}.pdf`;

    const blob = doc.output('blob');
    const pdfFile = new File([blob], filename, { type: 'application/pdf' });

    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [pdfFile] })
    ) {
      toast.dismiss(toastId);
      try {
        await navigator.share({
          files: [pdfFile],
          title: `Накладная №${invoiceId}`,
          text: `Товарная накладная №${invoiceId}`,
        });
        toast.success('Накладная отправлена');
        return;
      } catch (shareErr: any) {
        if (shareErr?.name === 'AbortError') {
          return;
        }
      }
    }

    doc.save(filename);
    toast.success('Накладная сохранена в PDF', { id: toastId });
  } catch (error: any) {
    toast.error(error?.message || 'Не удалось сформировать PDF файл', { id: toastId });
  }
}

export async function exportSalesInvoiceToPdf(rawInvoice: any, options?: { shareMode?: boolean }) {
  if (options?.shareMode) {
    return shareInvoicePdf(rawInvoice);
  }
  return downloadSalesInvoicePdf(rawInvoice);
}
