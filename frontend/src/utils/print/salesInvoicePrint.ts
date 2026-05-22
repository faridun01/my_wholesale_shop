import { ceilMoney, formatMoney, roundMoney } from '../format';
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

const formatMoneyWithoutCurrency = (value: unknown) => formatMoney(value, '').trim();
const roundMoneyValue = (value: number) => roundMoney(value);

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

function formatDateTime(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('ru-RU');
  }

  return date.toLocaleDateString('ru-RU');
}

function getItemBaseUnits(item: any) {
  const totalBaseUnits = Number(item?.totalBaseUnits);
  if (Number.isFinite(totalBaseUnits) && totalBaseUnits > 0) return totalBaseUnits;

  const quantity = Number(item?.quantity);
  if (Number.isFinite(quantity) && quantity > 0) return quantity;

  const unitsPerPackage = Number(item?.unitsPerPackageSnapshot ?? item?.unitsPerPackage ?? 0);
  const packageQuantity = Number(item?.packageQuantity ?? 0);
  const extraUnitQuantity = Number(item?.extraUnitQuantity ?? 0);
  if (unitsPerPackage > 0 && packageQuantity > 0) {
    return packageQuantity * unitsPerPackage + Math.max(0, extraUnitQuantity);
  }

  return 0;
}

function getQuantityText(item: any) {
  const packageQuantity = Number(item?.packageQuantity || 0);
  const packageName = String(item?.packageNameSnapshot || item?.packageName || '').trim();
  const baseUnitName = String(item?.baseUnitNameSnapshot || item?.baseUnitName || item?.unit || 'шт').trim() || 'шт';
  const quantity = getItemBaseUnits(item);

  if (packageQuantity > 0 && packageName) {
    return [`${packageQuantity} ${packageName}`];
  }

  return [`${quantity} ${baseUnitName}`];
}

export function printSalesInvoice({
  invoice,
  subtotal,
  discountAmount,
  netAmount: providedNetAmount,
}: SalesInvoicePrintOptions) {
  if (typeof window === 'undefined' || !invoice) {
    return { ok: false, reason: 'invalid' as const };
  }

  const printWindow = window.open('', '_blank', 'width=980,height=900');
  if (!printWindow) {
    return { ok: false, reason: 'blocked' as const };
  }

  const invoiceItems = Array.isArray(invoice.items) ? invoice.items : [];
  const invoiceDateLabel = formatDateTime(invoice.createdAt);
  const customerName = invoice.customer_name || 'Обычный клиент';
  const companyName = invoice.company_name || 'Организация';

  const getUnitPrice = (item: any) => {
    const explicitOriginalPrice = Number(
      item?.originalSellingPrice ?? item?.originalUnitPrice ?? item?.sellingPriceBeforeDiscount ?? item?.listPrice,
    );
    if (Number.isFinite(explicitOriginalPrice) && explicitOriginalPrice > 0) return explicitOriginalPrice;
    return Number(item?.sellingPrice || 0);
  };

  const getDiscountedUnitPrice = (item: any) => {
    const originalPrice = getUnitPrice(item);
    const lineDiscountPercent = Number(item?.lineDiscountPercent ?? item?.discountPercent ?? item?.discount ?? 0);
    if (lineDiscountPercent > 0) {
      return ceilMoney(originalPrice * (1 - lineDiscountPercent / 100));
    }

    return Number(item?.sellingPrice || 0);
  };

  const invoiceDiscountPercent = Math.max(0, Number(invoice?.discount || 0));
  const getLineTotal = (item: any) => {
    const lineTotal = roundMoneyValue(getItemBaseUnits(item) * getDiscountedUnitPrice(item));
    return invoiceDiscountPercent > 0 ? roundMoneyValue(lineTotal * (1 - invoiceDiscountPercent / 100)) : lineTotal;
  };

  const subtotalBeforeDiscount = invoiceItems.length
    ? roundMoneyValue(invoiceItems.reduce((sum: number, item: any) => sum + getItemBaseUnits(item) * getUnitPrice(item), 0))
    : Math.max(0, Number(subtotal || 0));
  const itemsNetAmount = invoiceItems.length
    ? roundMoneyValue(invoiceItems.reduce((sum: number, item: any) => sum + getLineTotal(item), 0))
    : roundMoneyValue(Math.max(0, Number(subtotal || 0) - Number(discountAmount || 0)));
  const returnedAmount = Math.max(0, Number(invoice.returnedAmount || 0));
  const storedInvoiceNetAmount = Math.max(0, Number(providedNetAmount || invoice?.netAmount || 0));
  const finalTotalAmount = storedInvoiceNetAmount > 0
    ? storedInvoiceNetAmount
    : roundMoneyValue(Math.max(0, itemsNetAmount - returnedAmount));
  const totalDiscountAmount = roundMoneyValue(Math.max(0, subtotalBeforeDiscount - (finalTotalAmount + returnedAmount)));
  const paidAmount = Math.max(0, Number(invoice.paidAmount || 0));
  const balanceDue = roundMoneyValue(Math.max(0, finalTotalAmount - paidAmount));
  const totalQuantity = invoiceItems.reduce((sum: number, item: any) => sum + getItemBaseUnits(item), 0);

  const rows = invoiceItems
    .map((item: any, index: number) => {
      const productName = formatProductName(item.product_name || item.productNameSnapshot || item.product?.name || 'Товар');
      const unitName = String(item?.baseUnitNameSnapshot || item?.baseUnitName || item?.unit || 'шт').trim() || 'шт';
      const quantity = getItemBaseUnits(item);
      const price = quantity > 0 ? getLineTotal(item) / quantity : getDiscountedUnitPrice(item);

      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td>${escapeHtml(productName)}</td>
          <td class="center">${escapeHtml(unitName)}</td>
          <td class="right">${escapeHtml(String(Math.round(quantity)))}</td>
          <td class="right">${escapeHtml(formatMoneyWithoutCurrency(price))}</td>
          <td class="right">${escapeHtml(formatMoneyWithoutCurrency(getLineTotal(item)))}</td>
          <td class="small">${getQuantityText(item).map((line) => escapeHtml(line)).join('<br>')}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <title></title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 6mm 7mm;
            background: #fff;
            color: #000;
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 8.5px;
            line-height: 1.15;
          }
          .sheet { width: 100%; }
          .title {
            margin: 0 0 5px;
            text-align: center;
            font-size: 12px;
            font-weight: 400;
          }
          .requisites {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5px;
          }
          .requisites td {
            border: 1px solid #000;
            padding: 2px 4px;
            vertical-align: top;
          }
          .req-label {
            width: 78px;
            color: #333;
            background: #f3f3f3;
            font-weight: 700;
          }
          .items {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .items th,
          .items td {
            border: 1px solid #000;
            padding: 1.5px 2px;
            line-height: 1.08;
            vertical-align: top;
          }
          .items th {
            text-align: center;
            font-size: 7.5px;
            font-weight: 700;
            background: #efefef;
          }
          .items tbody td:nth-child(2) {
            font-size: 8px;
            line-height: 1.05;
          }
          .col-n { width: 22px; }
          .col-name { width: auto; }
          .col-unit { width: 52px; }
          .col-qty { width: 48px; }
          .col-price { width: 60px; }
          .col-sum { width: 66px; }
          .col-note { width: 82px; }
          .center { text-align: center; }
          .right { text-align: right; white-space: nowrap; }
          .small { font-size: 7px; line-height: 1.05; color: #222; }
          .totals {
            width: 240px;
            margin-left: auto;
            margin-top: 4px;
            border-collapse: collapse;
          }
          .totals td {
            border: 1px solid #000;
            padding: 2px 4px;
          }
          .totals .label { font-weight: 700; }
          .totals .grand td {
            font-size: 9.5px;
            font-weight: 700;
            background: #efefef;
          }
          .summary-text {
            margin-top: 5px;
            font-size: 8px;
            line-height: 1.18;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 28px;
            margin-top: 10px;
            font-size: 8px;
          }
          .sign-line {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 8px;
            align-items: end;
            margin-top: 8px;
          }
          .line {
            border-bottom: 1px solid #000;
            height: 11px;
          }
          .footer-note {
            display: none;
            margin-top: 6px;
            font-size: 7px;
            color: #333;
          }
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="title">Товарная накладная № ${escapeHtml(invoice.id)} от ${escapeHtml(invoiceDateLabel)}</div>

          <table class="requisites">
            <tr>
              <td class="req-label">Организация</td>
              <td>${escapeHtml(companyName)}</td>
            </tr>
            <tr>
              <td class="req-label">Покупатель</td>
              <td>${escapeHtml(customerName)}</td>
            </tr>
          </table>

          <table class="items">
            <thead>
              <tr>
                <th class="col-n">№</th>
                <th class="col-name">Номенклатура</th>
                <th class="col-unit">Ед.</th>
                <th class="col-qty">Кол-во</th>
                <th class="col-price">Цена</th>
                <th class="col-sum">Сумма</th>
                <th class="col-note">Примечание</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="7" class="center">Нет товаров</td></tr>'}
            </tbody>
          </table>

          <table class="totals">
            <tr><td class="label">Сумма без скидки</td><td class="right">${escapeHtml(formatMoneyWithoutCurrency(subtotalBeforeDiscount))}</td></tr>
            <tr><td class="label">Скидка</td><td class="right">${escapeHtml(formatMoneyWithoutCurrency(totalDiscountAmount))}</td></tr>
            ${returnedAmount > 0 ? `<tr><td class="label">Возврат</td><td class="right">${escapeHtml(formatMoneyWithoutCurrency(returnedAmount))}</td></tr>` : ''}
            ${paidAmount > 0 ? `<tr><td class="label">Оплачено</td><td class="right">${escapeHtml(formatMoneyWithoutCurrency(paidAmount))}</td></tr>` : ''}
            ${paidAmount > 0 ? `<tr><td class="label">Остаток</td><td class="right">${escapeHtml(formatMoneyWithoutCurrency(balanceDue))}</td></tr>` : ''}
            <tr class="grand"><td>Итого</td><td class="right">${escapeHtml(formatMoneyWithoutCurrency(finalTotalAmount))}</td></tr>
          </table>

          <div class="summary-text">
            Всего отпущено ${escapeHtml(formatMoneyWithoutCurrency(totalQuantity))} единиц, на сумму
            <strong>${escapeHtml(formatMoneyWithoutCurrency(finalTotalAmount))}</strong>.
          </div>

          <div class="signatures">
            <div>
              <strong>Отпустил</strong>
              <div class="sign-line"><span>Подпись</span><span class="line"></span></div>
              <div class="sign-line"><span>Ф.И.О.</span><span class="line"></span></div>
            </div>
            <div>
              <strong>Получил</strong>
              <div class="sign-line"><span>Подпись</span><span class="line"></span></div>
              <div class="sign-line"><span>Ф.И.О.</span><span class="line"></span></div>
            </div>
          </div>

          <div class="footer-note">Документ сформирован автоматически. Проверьте количество и сумму перед подписанием.</div>
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
