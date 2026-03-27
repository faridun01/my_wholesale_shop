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
  const sellerRegionLine = [invoice.company_country, invoice.company_region].filter(Boolean).join(', ');
  const sellerCityLine = [invoice.company_city, invoice.company_address].filter(Boolean).join(', ');

  const getDisplayPrice = (item: any) => {
    const sellingPricePerUnit = Number(item.sellingPrice || 0);
    const packageQuantity = Number(item.packageQuantity || 0);
    const extraUnitQuantity = Number(item.extraUnitQuantity || 0);
    const unitsPerPackage = Number(item.unitsPerPackageSnapshot || item.unitsPerPackage || 0);

    if (packageQuantity > 0 && extraUnitQuantity === 0 && unitsPerPackage > 0) {
      return sellingPricePerUnit * unitsPerPackage;
    }

    return sellingPricePerUnit;
  };

  const getUnitPrice = (item: any) => Number(item.sellingPrice || 0);

  const itemsRows = Array.isArray(invoice.items)
    ? invoice.items
        .map(
          (item: any, index: number) => `
            <tr>
              <td>${index + 1}</td>
              <td class="product-cell"><span class="product-name">${escapeHtml(formatProductName(item.product_name || item.productNameSnapshot || item.product_name_snapshot))}</span></td>
              <td>${escapeHtml(item.quantityLabel || `${item.quantity} ${item.unit || ''}`)}</td>
              <td>${escapeHtml(formatMoney(getDisplayPrice(item)))}</td>
              <td>${escapeHtml(formatMoney(getUnitPrice(item)))}</td>
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
        <title>Накладная</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          body { margin: 0; padding: 12px; font-family: Arial, sans-serif; color: #0f172a; background: #ffffff; }
          .sheet { max-width: 920px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: stretch; gap: 14px; border-bottom: 1px solid #dbe3ef; padding-bottom: 10px; margin-bottom: 10px; }
          .party-block { min-width: 0; border: 1px solid #dbe3ef; border-radius: 12px; padding: 10px 12px; background: #f8fafc; }
          .seller-block { flex: 1; }
          .client-block { width: 280px; }
          .label { margin: 0 0 6px; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
          .party-name { margin: 0; font-size: 16px; font-weight: 700; line-height: 1.2; color: #0f172a; }
          .party-line { margin: 4px 0 0; color: #334155; font-size: 12px; line-height: 1.35; }
          .section { margin-top: 10px; }
          .section h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #334155; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 12px; text-align: left; vertical-align: top; line-height: 1.25; }
          th { background: #f8fafc; font-weight: 700; font-size: 11px; }
          .col-number { width: 42px; }
          .col-product { width: 265px; }
          .col-quantity { width: 112px; }
          .col-package-price { width: 108px; }
          .col-unit-price { width: 102px; }
          .col-total { width: 96px; }
          .product-cell { width: 265px; }
          .product-name {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.22;
            max-height: 2.44em;
            overflow: hidden;
            word-break: break-word;
          }
          .summary { margin-left: auto; margin-top: 10px; width: 260px; }
          .summary-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          .summary-row.total { font-size: 16px; font-weight: 700; border-top: 1px solid #cbd5e1; margin-top: 4px; padding-top: 8px; }
          @media print {
            body { padding: 0; }
            .sheet { max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <div class="party-block seller-block">
              <p class="label">ПРОДАВЕЦ</p>
              ${invoice.company_name ? `<p class="party-name">${escapeHtml(invoice.company_name)}</p>` : ''}
              ${sellerRegionLine ? `<p class="party-line">${escapeHtml(sellerRegionLine)}</p>` : ''}
              ${sellerCityLine ? `<p class="party-line">${escapeHtml(sellerCityLine)}</p>` : ''}
              ${invoice.company_phone ? `<p class="party-line">${escapeHtml(invoice.company_phone)}</p>` : ''}
            </div>
            <div class="party-block client-block">
              <p class="label">Клиент</p>
              <p class="party-name">${escapeHtml(customerName)}</p>
              ${customerPhone ? `<p class="party-line">Телефон: ${escapeHtml(customerPhone)}</p>` : ''}
              ${customerAddress ? `<p class="party-line">Адрес: ${escapeHtml(customerAddress)}</p>` : ''}
            </div>
          </div>

          <div class="section">
            <h3>Товары</h3>
            <table>
              <thead>
                <tr>
                  <th class="col-number">№</th>
                  <th class="col-product">Товар</th>
                  <th class="col-quantity">Количество</th>
                  <th class="col-package-price">Цена за упаковку</th>
                  <th class="col-unit-price">Цена за штуку</th>
                  <th class="col-total">Сумма</th>
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
