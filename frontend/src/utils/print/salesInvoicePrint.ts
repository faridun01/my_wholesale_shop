import { formatMoney } from '../format';
import { formatProductName } from '../productName';

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface SalesInvoicePrintOptions {
  invoice: any;
  statusLabel: string;
  subtotal: number;
  discountAmount: number;
  netAmount: number;
  balanceAmount: number;
  changeAmount: number;
  appliedPaidAmount: number;
}

export function printSalesInvoice({
  invoice,
  subtotal,
  discountAmount,
  netAmount,
}: SalesInvoicePrintOptions) {
  if (typeof window === 'undefined' || !invoice) {
    return { ok: false, reason: 'invalid' as const };
  }

  const printWindow = window.open('', '_blank', 'width=980,height=900');
  if (!printWindow) {
    return { ok: false, reason: 'blocked' as const };
  }

  const customerName = invoice.customer_name || 'Обычный клиент';
  const customerPhone = invoice.customer_phone || '';
  const customerAddress = invoice.customer_address || '';
  const invoiceDate = new Date(invoice.createdAt).toLocaleDateString('ru-RU');

  const itemsRows = Array.isArray(invoice.items)
    ? invoice.items
        .map(
          (item: any, index: number) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(formatProductName(item.product_name))}</td>
              <td>${escapeHtml(item.quantityLabel || `${item.quantity} ${item.unit || ''}`)}</td>
              <td>${escapeHtml(formatMoney(item.sellingPrice))}</td>
              <td>${escapeHtml(formatMoney(item.totalPrice))}</td>
            </tr>
          `,
        )
        .join('')
    : '';

  const html = `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <title>Накладная #${invoice.id}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 30px; font-family: Arial, sans-serif; color: #0f172a; background: #ffffff; }
          .sheet { max-width: 920px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: stretch; gap: 28px; border-bottom: 2px solid #dbe3ef; padding-bottom: 22px; margin-bottom: 18px; }
          .company-block { flex: 1; min-width: 0; }
          .company-line { margin: 0 0 4px; font-size: 14px; font-weight: 700; line-height: 1.45; color: #111827; }
          .client-block { width: 320px; border: 1px solid #dbe3ef; border-radius: 18px; padding: 16px 18px; background: #f8fafc; }
          .label { margin: 0 0 8px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
          .client-name { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.3; color: #0f172a; }
          .client-line { margin: 8px 0 0; color: #334155; font-size: 14px; line-height: 1.5; }
          .meta-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 22px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; }
          .meta-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
          .meta-value { margin-top: 4px; font-size: 14px; font-weight: 700; color: #0f172a; }
          .section { margin-top: 20px; }
          .section h3 { margin: 0 0 12px; font-size: 15px; text-transform: uppercase; letter-spacing: 0.08em; color: #334155; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e2e8f0; padding: 12px; font-size: 14px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; font-weight: 700; }
          .summary { margin-left: auto; margin-top: 24px; width: 320px; }
          .summary-row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
          .summary-row.total { font-size: 20px; font-weight: 700; border-top: 2px solid #cbd5e1; margin-top: 8px; padding-top: 12px; }
          @media print { body { padding: 0; } .sheet { max-width: none; } }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div class="company-block">
              ${invoice.company_name ? `<p class="company-line">${escapeHtml(invoice.company_name)}</p>` : ''}
              ${invoice.company_country ? `<p class="company-line">${escapeHtml(invoice.company_country)}</p>` : ''}
              ${(invoice.company_region || invoice.company_city) ? `<p class="company-line">${escapeHtml([invoice.company_region, invoice.company_city].filter(Boolean).join(' '))}</p>` : ''}
              ${invoice.company_address ? `<p class="company-line">${escapeHtml(invoice.company_address)}</p>` : ''}
              ${invoice.company_phone ? `<p class="company-line">${escapeHtml(invoice.company_phone)}</p>` : ''}
            </div>
            <div class="client-block">
              <p class="label">Клиент</p>
              <p class="client-name">${escapeHtml(customerName)}</p>
              ${customerPhone ? `<p class="client-line">Телефон: ${escapeHtml(customerPhone)}</p>` : ''}
              ${customerAddress ? `<p class="client-line">Адрес: ${escapeHtml(customerAddress)}</p>` : ''}
            </div>
          </div>

          <div class="meta-row">
            <div>
              <div class="meta-label">Документ</div>
              <div class="meta-value">Накладная #${escapeHtml(invoice.id)}</div>
            </div>
            <div style="text-align: right;">
              <div class="meta-label">Дата</div>
              <div class="meta-value">${escapeHtml(invoiceDate)}</div>
            </div>
          </div>

          <div class="section">
            <h3>Товары</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 52px;">№</th>
                  <th>Товар</th>
                  <th style="width: 150px;">Количество</th>
                  <th style="width: 140px;">Цена</th>
                  <th style="width: 140px;">Сумма</th>
                </tr>
              </thead>
              <tbody>${itemsRows}</tbody>
            </table>
          </div>

          <div class="summary">
            <div class="summary-row"><span>Подытог</span><strong>${escapeHtml(formatMoney(subtotal))}</strong></div>
            <div class="summary-row"><span>Скидка (${escapeHtml(invoice.discount || 0)}%)</span><strong>-${escapeHtml(formatMoney(discountAmount))}</strong></div>
            ${Number(invoice.returnedAmount || 0) > 0 ? `<div class="summary-row"><span>Возвращено</span><strong>-${escapeHtml(formatMoney(invoice.returnedAmount || 0))}</strong></div>` : ''}
            <div class="summary-row total"><span>Итого</span><span>${escapeHtml(formatMoney(netAmount))}</span></div>
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };

  return { ok: true as const };
}
