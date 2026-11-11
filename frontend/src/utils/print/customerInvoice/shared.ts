export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Printable documents carry no script of their own: under the Content-Security-Policy an
// inline script in a written document is blocked, so the app drives printing instead.
export const buildDocumentHtml = (
  sectionsHtml: string,
  title: string,
  pageMargin = '10mm',
  bodyClass = '',
) => `<!doctype html>
  <html lang="ru">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 16px; font-family: Arial, sans-serif; color: #0f172a; background: #fff; }
        body.print-without-browser-header { padding: 10mm; }
        .sheet { max-width: 900px; margin: 0 auto; }
        .sheet + .sheet { page-break-before: always; margin-top: 24px; }
        .doc-meta { display: flex; justify-content: space-between; gap: 12px; margin: 0 auto 8px; max-width: 900px; color: #64748b; font-size: 9px; }
        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
        .title { font-size: 24px; font-weight: 800; margin: 0; }
        .subtitle { margin-top: 4px; font-size: 12px; font-weight: 700; color: #334155; }
        .parties { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
        .party-block { padding: 0; border: none; background: transparent; }
        .party-meta { text-align: right; }
        .label { margin: 0 0 4px; color: #64748b; font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .value { margin: 0; font-size: 13px; font-weight: 800; }
        .subvalue { margin: 2px 0 0; color: #475569; font-size: 10px; line-height: 1.25; font-weight: 700; }
        .section { margin-top: 12px; }
        .section h3 { margin: 0 0 6px; font-size: 11px; font-weight: 800; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #0f172a; padding: 5px 6px; font-size: 10px; text-align: left; vertical-align: top; font-weight: 700; }
        th { background: #f8fafc; font-weight: 800; }
        .manual-cell { height: 28px; }
        .summary { margin-left: auto; margin-top: 12px; width: 260px; }
        .summary-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid #0f172a; font-size: 10px; font-weight: 700; }
        .summary-row.total { font-size: 16px; font-weight: 900; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; margin-top: 6px; padding: 8px 0; letter-spacing: 0.06em; }
        .section-no-gap { margin-top: 0; }
        .customer-group-sheet { page-break-before: always; }
        .customer-group-card { display: grid; grid-template-columns: minmax(0, 180px) minmax(0, 1fr); gap: 12px; border: 2px solid #0f172a; padding: 12px; }
        .customer-group-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .customer-group-stat { border: 1px solid #0f172a; padding: 8px 10px; }
        .customer-group-stat-label { display: block; margin-bottom: 3px; color: #64748b; font-size: 8px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 28px; font-size: 11px; font-weight: 800; }
        .signature-block { display: grid; gap: 12px; }
        .signature-line { display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: end; gap: 10px; }
        .signature-line span { color: #334155; }
        .signature-line strong { min-height: 18px; border-bottom: 1px solid #0f172a; font-weight: 800; }
        .reconciliation-sheet { max-width: 960px; color: #000; }
        .reconciliation-header { text-align: left; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 8px; }
        .reconciliation-header .title { font-size: 17px; font-weight: 700; }
        .reconciliation-header .subtitle { color: #000; font-size: 10px; font-weight: 700; line-height: 1.2; }
        .reconciliation-sheet .section h3 { font-size: 10px; font-weight: 700; margin-bottom: 4px; }
        .reconciliation-table { table-layout: fixed; }
        .reconciliation-table th,
        .reconciliation-table td { border: 1px solid #555; padding: 3px 4px; color: #000; font-size: 9px; line-height: 1.15; font-weight: 400; }
        .reconciliation-table th { background: #e6e6e6; text-align: center; font-weight: 700; }
        .reconciliation-overview-table td:nth-child(4),
        .reconciliation-overview-table td:nth-child(5),
        .reconciliation-overview-table td:nth-child(6),
        .reconciliation-detail-table td:nth-child(5),
        .reconciliation-detail-table td:nth-child(6),
        .reconciliation-detail-table td:nth-child(7),
        .reconciliation-detail-table td:nth-child(8) { text-align: right; white-space: nowrap; }
        .reconciliation-overview-table td:nth-child(7),
        .reconciliation-overview-table td:nth-child(8) { text-align: left; white-space: normal; }
        .customer-name-cell { font-size: 8.5px; line-height: 1.12; font-weight: 700; overflow-wrap: anywhere; word-break: break-word; hyphens: auto; }
        .customer-title { overflow-wrap: anywhere; word-break: break-word; }
        .reconciliation-parties { grid-template-columns: minmax(0, 2fr) minmax(130px, 1fr) minmax(130px, 1fr); gap: 10px; border: 1px solid #555; padding: 6px; margin-bottom: 8px; }
        .reconciliation-parties .party-block + .party-block { border-left: 1px solid #bbb; padding-left: 8px; }
        .reconciliation-parties .label { color: #333; font-size: 7.5px; letter-spacing: 0; }
        .reconciliation-parties .value { color: #000; font-size: 10px; line-height: 1.15; font-weight: 700; }
        .reconciliation-parties .subvalue { color: #000; font-size: 9px; font-weight: 400; }
        .customer-name-value { font-size: 9px; overflow-wrap: anywhere; word-break: break-word; }
        .reconciliation-sheet .manual-cell { height: 24px; }
        .reconciliation-sheet .signatures { gap: 18px; margin-top: 20px; font-size: 10px; }
        @page { size: A4 portrait; margin: ${escapeHtml(pageMargin)}; }
      </style>
    </head>
    <body class="${escapeHtml(bodyClass)}">
      ${sectionsHtml}
    </body>
  </html>`;

/** Prints a window the app has just written a document into, then closes it. */
export const printAndClose = (printWindow: Window) => {
  const run = () => {
    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
    printWindow.focus();
    printWindow.print();
  };
  if (printWindow.document.readyState === 'complete') run();
  else printWindow.addEventListener('load', run, { once: true });
};

export const createHiddenPrintFrame = () => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';

  document.body.appendChild(iframe);

  const cleanup = () => {
    window.setTimeout(() => {
      iframe.remove();
    }, 300);
  };

  return {
    cleanup,
    iframe,
    iframeDocument: iframe.contentDocument || iframe.contentWindow?.document,
    iframeWindow: iframe.contentWindow,
  };
};
