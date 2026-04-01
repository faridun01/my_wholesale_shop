import { formatMoney } from '../format';
import { formatProductName } from '../productName';

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeAddressLine = (value: unknown) =>
  String(value ?? '')
    .split(/\r?\n/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

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
  const customerAddress = normalizeAddressLine(invoice.customer_address || '');
  const sellerRegionLine = [invoice.company_country, invoice.company_region].filter(Boolean).join(', ');
  const sellerCityLine = [invoice.company_city, invoice.company_address].filter(Boolean).join(', ');

  const getDisplayPrice = (item: any) => {
    const sellingPricePerUnit = Number(item.sellingPrice || 0);
    const packageQuantity = Number(item.packageQuantity || 0);
    const unitsPerPackage = Number(item.unitsPerPackageSnapshot || item.unitsPerPackage || 0);

    if (packageQuantity > 0 && unitsPerPackage > 0) {
      return sellingPricePerUnit * unitsPerPackage;
    }

    return sellingPricePerUnit;
  };

  const getUnitPrice = (item: any) => Number(item.sellingPrice || 0);

  const detectInnerUnitLabel = (item: any) => {
    const explicitBaseUnit = String(item.baseUnitNameSnapshot || item.baseUnitName || item.unit || '').trim().toLowerCase();
    if (explicitBaseUnit && explicitBaseUnit !== 'шт') {
      return explicitBaseUnit;
    }

    const source = String(
      item.rawNameSnapshot ||
        item.raw_name_snapshot ||
        item.product_name ||
        item.productNameSnapshot ||
        ''
    ).toLowerCase();

    if (/пач(?:ка|ки|ек)/u.test(source)) return 'пачка';
    if (/флакон(?:а|ов)?/u.test(source)) return 'флакон';
    if (/бут(?:ылка|ылки|ылок)/u.test(source)) return 'бутылка';
    if (/бан(?:ка|ки|ок)/u.test(source)) return 'банка';
    if (/ёмкост(?:ь|и|ей)|емкост(?:ь|и|ей)/u.test(source)) return 'ёмкость';

    return explicitBaseUnit || 'шт';
  };

  const getQuantityLabel = (item: any) => {
    const packageQuantity = Number(item.packageQuantity || 0);
    const extraUnitQuantity = Number(item.extraUnitQuantity || 0);
    const unitsPerPackage = Number(item.unitsPerPackageSnapshot || item.unitsPerPackage || 0);
    const packageName = String(item.packageNameSnapshot || item.packageName || '').trim();
    const baseUnitName = 'шт';
    const quantity = Number(item.quantity || 0);

    if (packageQuantity > 0 && packageName) {
      const primaryLine =
        extraUnitQuantity > 0
          ? `${packageQuantity} ${packageName} + ${extraUnitQuantity} ${baseUnitName}`
          : `${packageQuantity} ${packageName}`;
      const lines = [primaryLine];

      if (unitsPerPackage > 0) {
        lines.push(`${packageQuantity * unitsPerPackage} ${baseUnitName} в ${packageName}`);
      }

      return lines;
    }

    return [`${quantity} ${baseUnitName}`];
  };

  const itemsRows = Array.isArray(invoice.items)
    ? invoice.items
        .map(
          (item: any, index: number) => `
            <tr>
              <td>${index + 1}</td>
              <td class="product-cell"><span class="product-name">${escapeHtml(formatProductName(item.product_name || item.productNameSnapshot || item.product_name_snapshot))}</span></td>
              <td class="quantity-cell">${getQuantityLabel(item)
                .map((line) => `<span class="quantity-line">${escapeHtml(line)}</span>`)
                .join('')}</td>
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
          @page { size: A4 portrait; margin: 7mm; }
          * { box-sizing: border-box; }
          body { margin: 0; padding: 6px; font-family: Arial, sans-serif; color: #0f172a; background: #ffffff; }
          .sheet { max-width: 920px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: stretch; gap: 8px; border-bottom: 1px solid #d9e3ef; padding-bottom: 6px; margin-bottom: 6px; }
          .party-block { min-width: 0; border: 1px solid #d9e3ef; border-radius: 8px; padding: 6px 8px; background: #ffffff; }
          .seller-block { flex: 1; }
          .client-block { width: 235px; }
          .label { margin: 0 0 3px; color: #64748b; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700; }
          .party-name { margin: 0; font-size: 11px; font-weight: 700; line-height: 1.1; color: #0f172a; }
          .party-line { margin: 1px 0 0; color: #334155; font-size: 8.5px; line-height: 1.1; }
          .section { margin-top: 6px; }
          .section h3 { margin: 0 0 3px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: #1e3a8a; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #dbe5f1; padding: 3px 4px; font-size: 8.5px; text-align: left; vertical-align: top; line-height: 1.05; }
          th { background: #ffffff; font-weight: 700; font-size: 8px; color: #111827; }
          .col-number { width: 28px; }
          .col-product { width: 292px; }
          .col-quantity { width: 78px; }
          .col-package-price { width: 74px; }
          .col-unit-price { width: 70px; }
          .col-total { width: 70px; }
          .product-cell { width: 292px; }
          .product-name {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.08;
            max-height: 2.16em;
            overflow: hidden;
            word-break: break-word;
            font-size: 8.4px;
          }
          .quantity-cell { line-height: 1.1; }
          .quantity-line { display: block; }
          .quantity-line + .quantity-line { margin-top: 1px; font-size: 7.4px; color: #475569; }
          .summary { margin-left: auto; margin-top: 6px; width: 220px; }
          .summary-row { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; border-bottom: 1px solid #dbe5f1; font-size: 9px; }
          .summary-row.total { font-size: 10.5px; font-weight: 700; border-top: 1px solid #cbd5e1; margin-top: 2px; padding-top: 4px; }
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
