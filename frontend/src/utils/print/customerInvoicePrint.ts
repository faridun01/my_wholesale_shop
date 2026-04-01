import { formatMoney } from '../format';

const PAYMENT_EPSILON = 0.01;

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeAddressLine = (...parts: unknown[]) =>
  parts
    .flatMap((value) => String(value ?? '').split(/\r?\n/g))
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeDisplayBaseUnit = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'шт';
  if (['пачка', 'пачки', 'пачек', 'шт', 'штук', 'штука', 'штуки', 'pcs', 'piece', 'pieces'].includes(normalized)) {
    return 'шт';
  }
  return normalized;
};

const getCustomerInvoiceQuantityLines = (item: any) => {
  const packageQuantity = Math.max(0, Number(item?.packageQuantity || 0));
  const extraUnitQuantity = Math.max(0, Number(item?.extraUnitQuantity || 0));
  const unitsPerPackage = Math.max(0, Number(item?.unitsPerPackageSnapshot ?? item?.unitsPerPackage ?? 0));
  const packageName = String(item?.packageNameSnapshot || item?.packageName || '').trim();
  const baseUnitName = normalizeDisplayBaseUnit(item?.baseUnitNameSnapshot || item?.baseUnitName || item?.unit || 'шт');
  const quantity = Math.max(0, Number(item?.quantity || 0));

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

interface CustomerInvoicePrintOptions {
  invoice: any;
  customer: {
    name?: string;
    phone?: string;
    country?: string;
    region?: string;
    city?: string;
    address?: string;
  } | null;
  statusLabel: string;
  subtotal: number;
  discountAmount: number;
  netAmount: number;
  appliedPaidAmount: number;
  changeAmount: number;
}

export function printCustomerInvoice({
  invoice,
  customer,
  statusLabel,
  subtotal,
  discountAmount,
  netAmount,
  appliedPaidAmount,
  changeAmount,
}: CustomerInvoicePrintOptions) {
  if (typeof window === 'undefined' || !invoice || !customer) {
    return { ok: false, reason: 'invalid' as const };
  }

  const customerAddress = normalizeAddressLine(customer.country, customer.region, customer.city, customer.address);

  const printWindow = window.open('', '_blank', 'width=980,height=900');
  if (!printWindow) {
    return { ok: false, reason: 'blocked' as const };
  }

  const itemsRows = Array.isArray(invoice.items)
    ? invoice.items
        .map(
          (item: any, index: number) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(item.product?.name || '---')}</td>
              <td>${getCustomerInvoiceQuantityLines(item).map((line) => `<div>${escapeHtml(line)}</div>`).join('')}</td>
              <td>${escapeHtml(formatMoney(item.sellingPrice))}</td>
              <td>${escapeHtml(formatMoney(Number(item.quantity || 0) * Number(item.sellingPrice || 0)))}</td>
            </tr>
          `,
        )
        .join('')
    : '';

  const paymentsBlock =
    Array.isArray(invoice.paymentEvents) && invoice.paymentEvents.length > 0
      ? `
      <div class="section">
        <h3>Оплаты</h3>
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Сумма</th>
              <th>Сотрудник</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.paymentEvents
              .map(
                (payment: any) => `
                  <tr>
                    <td>${escapeHtml(new Date(payment.createdAt).toLocaleString('ru-RU'))}</td>
                    <td>${escapeHtml(formatMoney(payment.amount))}</td>
                    <td>${escapeHtml(payment.staff_name)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
      : '';

  const returnsBlock =
    Array.isArray(invoice.returnEvents) && invoice.returnEvents.length > 0
      ? `
      <div class="section">
        <h3>Возвраты</h3>
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Сумма</th>
              <th>Причина</th>
              <th>Сотрудник</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.returnEvents
              .map(
                (itemReturn: any) => `
                  <tr>
                    <td>${escapeHtml(new Date(itemReturn.createdAt).toLocaleString('ru-RU'))}</td>
                    <td>-${escapeHtml(formatMoney(itemReturn.totalValue))}</td>
                    <td>${escapeHtml(itemReturn.reason || '---')}</td>
                    <td>${escapeHtml(itemReturn.staff_name)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
      : '';

  const html = `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <title>Накладная #${invoice.id}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #0f172a; background: #fff; }
          .sheet { max-width: 900px; margin: 0 auto; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 18px; }
          .title { font-size: 26px; font-weight: 700; margin: 0 0 6px; }
          .muted { color: #475569; font-size: 12px; line-height: 1.45; }
          .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
          .card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px; background: #f8fafc; }
          .label { margin: 0 0 6px; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
          .value { margin: 0; font-size: 16px; font-weight: 700; }
          .subvalue { margin: 6px 0 0; color: #475569; font-size: 12px; line-height: 1.35; }
          .section { margin-top: 18px; }
          .section h3 { margin: 0 0 10px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #e2e8f0; padding: 9px; font-size: 12px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; font-weight: 700; }
          .summary { margin-left: auto; margin-top: 18px; width: 300px; }
          .summary-row { display: flex; justify-content: space-between; gap: 16px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          .summary-row.total { font-size: 17px; font-weight: 700; border-top: 2px solid #cbd5e1; margin-top: 6px; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="header">
            <h1 class="title">Накладная #${invoice.id}</h1>
            <div class="muted">
              <div>Дата: ${escapeHtml(new Date(invoice.createdAt).toLocaleString('ru-RU'))}</div>
              <div>Статус: ${escapeHtml(statusLabel)}</div>
            </div>
          </div>
          <div class="grid">
            <div class="card">
              <p class="label">Клиент</p>
              <p class="value">${escapeHtml(customer.name || '---')}</p>
              ${customer.phone ? `<p class="subvalue">Телефон: ${escapeHtml(customer.phone)}</p>` : ''}
              ${customerAddress ? `<p class="subvalue">Адрес: ${escapeHtml(customerAddress)}</p>` : ''}
            </div>
            <div class="card">
              <p class="label">Склад</p>
              <p class="value">${escapeHtml(invoice.warehouse?.name || '---')}</p>
            </div>
            <div class="card">
              <p class="label">Оплата</p>
              <p class="value">${escapeHtml(formatMoney(appliedPaidAmount))}</p>
              <p class="subvalue">${
                changeAmount > PAYMENT_EPSILON
                  ? `Сдача клиенту: ${escapeHtml(formatMoney(changeAmount))}`
                  : `Остаток: ${escapeHtml(formatMoney(invoice.invoiceBalance))}`
              }</p>
            </div>
          </div>
          <div class="section">
            <h3>Товары</h3>
            <table>
              <thead>
                <tr>
                  <th style="width: 52px;">№</th>
                  <th>Товар</th>
                  <th style="width: 120px;">Количество</th>
                  <th style="width: 140px;">Цена</th>
                  <th style="width: 140px;">Сумма</th>
                </tr>
              </thead>
              <tbody>${itemsRows}</tbody>
            </table>
          </div>
          <div class="summary">
            <div class="summary-row"><span>Подытог</span><strong>${escapeHtml(formatMoney(subtotal))}</strong></div>
            <div class="summary-row"><span>Скидка (${escapeHtml(invoice.discount)}%)</span><strong>-${escapeHtml(formatMoney(discountAmount))}</strong></div>
            ${Number(invoice.returnedAmount || 0) > 0 ? `<div class="summary-row"><span>Возвращено</span><strong>-${escapeHtml(formatMoney(invoice.returnedAmount))}</strong></div>` : ''}
            <div class="summary-row total"><span>Итого</span><strong>${escapeHtml(formatMoney(netAmount))}</strong></div>
            <div class="summary-row"><span>Оплачено</span><strong>${escapeHtml(formatMoney(appliedPaidAmount))}</strong></div>
            <div class="summary-row"><span>Остаток</span><strong>${escapeHtml(formatMoney(invoice.invoiceBalance))}</strong></div>
          </div>
          ${paymentsBlock}
          ${returnsBlock}
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  return { ok: true as const };
}
