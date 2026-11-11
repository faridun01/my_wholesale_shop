import { Router, json } from 'express';

export const cspReportRouter = Router();
// Unauthenticated browser telemetry, never a financial mutation. Keep bounded
// and omit document URLs, query strings, inline samples and user identifiers.
cspReportRouter.post('/', json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '16kb' }), (req, res) => {
  const reports = Array.isArray(req.body) ? req.body.slice(0, 10).map(r => r?.body) : [req.body?.['csp-report']];
  for (const report of reports) {
    if (!report || typeof report !== 'object') continue;
    const directive = String(report['effective-directive'] ?? report.effectiveDirective ?? '').replace(/[^a-z-]/g, '').slice(0, 60);
    let blocked = String(report['blocked-uri'] ?? report.blockedURL ?? '');
    try { blocked = new URL(blocked).origin; } catch { blocked = ['inline', 'eval', 'data', 'blob'].includes(blocked) ? blocked : 'other'; }
    if (directive) console.warn('CSP report', { directive, blocked: blocked.slice(0, 200) });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(204).end();
});
