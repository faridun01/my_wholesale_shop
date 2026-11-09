-- One-time reconciliation of records audited against the server dump of 2026-11-09.
-- Every statement is guarded by the exact state it corrects, so it does nothing on a
-- database without those records. Payments and returns are never rewritten; previous
-- invoice values are kept in invoice_revisions.

-- 1. Batch 158 was received at a package price. The product's price history shows the
-- owner corrected the per-piece cost to 9.62 three minutes later; the batch kept 96.20.
CREATE TEMP TABLE _batch_cost_fix AS
SELECT b.id AS batch_id, b.product_id, b.warehouse_id,
       (SELECT t.user_id FROM inventory_transactions t WHERE t.product_id = b.product_id AND t.type = 'incoming' AND t.cost_at_time = 96.20 ORDER BY t.id LIMIT 1) AS user_id
FROM product_batches b
JOIN products p ON p.id = b.product_id
WHERE b.id = 158 AND b.product_id = 41 AND b.quantity = 9720 AND b.cost_price = 96.20
  AND p.cost_price = 9.62
  AND EXISTS (SELECT 1 FROM price_history h WHERE h.product_id = b.product_id AND h.cost_price = 9.62);

UPDATE product_batches b SET cost_price = 9.62, purchase_cost_price = 9.62
FROM _batch_cost_fix f WHERE b.id = f.batch_id;

UPDATE invoice_items ii SET cost_price = 9.62
FROM _batch_cost_fix f
WHERE ii.product_id = f.product_id AND ii.cost_price = 96.20
  AND EXISTS (SELECT 1 FROM sale_allocations sa WHERE sa.invoice_item_id = ii.id AND sa.batch_id = f.batch_id);

UPDATE inventory_transactions t SET cost_at_time = 9.62
FROM _batch_cost_fix f
WHERE t.product_id = f.product_id AND t.type = 'outgoing' AND t.cost_at_time = 96.20;

INSERT INTO inventory_transactions (product_id, warehouse_id, user_id, qty_change, type, reason, reference_id, cost_at_time)
SELECT f.product_id, f.warehouse_id, f.user_id, 0, 'adjustment', 'Исправление себестоимости партии #158: 96.20 -> 9.62', f.batch_id, 9.62
FROM _batch_cost_fix f;

DROP TABLE _batch_cost_fix;

-- 2. Binary floats billed certain prices one cent too high per unit (9.30 became 9.31).
CREATE TEMP TABLE _line_fix AS
SELECT ii.id AS item_id, ii.invoice_id, ii.total_price AS old_total,
       ceil(ii.selling_price * (100 - ii.discount) / 100 * 100) / 100 * ii.quantity::numeric AS new_total
FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
WHERE NOT i.cancelled AND ii.eligible_net_amount IS NULL AND i.calculation_version IS NULL
  AND ii.total_price - ceil(ii.selling_price * (100 - ii.discount) / 100 * 100) / 100 * ii.quantity::numeric
      = 0.01 * ii.quantity::numeric;

CREATE TEMP TABLE _invoice_fix AS
SELECT i.id AS invoice_id, i.user_id, i.total_amount AS old_total, i.net_amount AS old_net, i.discount,
       i.total_amount - SUM(f.old_total - f.new_total) AS new_total
FROM _line_fix f JOIN invoices i ON i.id = f.invoice_id
GROUP BY i.id;

INSERT INTO invoice_revisions (invoice_id, user_id, snapshot)
SELECT i.id, f.user_id, jsonb_build_object(
  'correction', 'Исправление завышения цены на 0,01 за единицу',
  'id', i.id, 'totalAmount', i.total_amount, 'discount', i.discount, 'netAmount', i.net_amount,
  'paidAmount', i.paid_amount, 'returnedAmount', i.returned_amount, 'status', i.status,
  'items', (SELECT jsonb_agg(jsonb_build_object('id', ii.id, 'productId', ii.product_id, 'quantity', ii.quantity, 'sellingPrice', ii.selling_price, 'discount', ii.discount, 'totalPrice', ii.total_price) ORDER BY ii.id) FROM invoice_items ii WHERE ii.invoice_id = i.id))
FROM _invoice_fix f JOIN invoices i ON i.id = f.invoice_id;

UPDATE invoice_items ii SET total_price = f.new_total
FROM _line_fix f WHERE ii.id = f.item_id;

UPDATE invoices i SET
  total_amount = f.new_total,
  net_amount = f.old_net - ((f.old_total - round(f.old_total * f.discount / 100, 2)) - (f.new_total - round(f.new_total * f.discount / 100, 2)))
FROM _invoice_fix f WHERE i.id = f.invoice_id;

UPDATE invoices i SET status = CASE
    WHEN paid.received >= i.net_amount THEN 'paid'
    WHEN paid.received > 0 THEN 'partial'
    ELSE 'unpaid' END
FROM _invoice_fix f
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(p.amount) FILTER (WHERE NOT (p.amount < 0 AND p.reversal_of_id IS NULL AND (p.return_id IS NOT NULL OR lower(p.method) = 'refund'))), 0) AS received
  FROM payments p WHERE p.invoice_id = f.invoice_id
) AS paid
WHERE i.id = f.invoice_id;

DROP TABLE _invoice_fix;
DROP TABLE _line_fix;

-- 3. Stock ledger: sales from the first weeks have no outgoing rows, although their
-- lines and batch allocations exist. Stock itself is right; only the journal is short.
INSERT INTO inventory_transactions (product_id, warehouse_id, user_id, qty_change, type, reason, reference_id, cost_at_time, selling_at_time, created_at)
SELECT ii.product_id, i.warehouse_id, i.user_id, -ii.quantity, 'outgoing',
       'Invoice #' || i.id || ' (восстановлено при сверке)', i.id, ii.cost_price, ii.selling_price, i.created_at
FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
WHERE i.created_at < TIMESTAMP '2026-04-19 00:00:00'
  AND NOT EXISTS (SELECT 1 FROM inventory_transactions t WHERE t.reference_id = i.id AND t.type = 'outgoing')
  AND (NOT i.cancelled OR EXISTS (SELECT 1 FROM inventory_transactions t WHERE t.reference_id = i.id AND t.reason = 'Invoice #' || i.id || ' Cancelled'));

-- Invoice 63: 20 pieces came back and its lines were later rewritten without them, so
-- the original sale of those pieces is missing from the journal as well.
INSERT INTO inventory_transactions (product_id, warehouse_id, user_id, qty_change, type, reason, reference_id, created_at)
SELECT t.product_id, t.warehouse_id, t.user_id, -t.qty_change, 'outgoing',
       'Invoice #63 (восстановлено при сверке, позже возвращено)', 63, i.created_at
FROM inventory_transactions t
JOIN invoices i ON i.id = 63 AND i.returned_amount = 359.68
WHERE t.reference_id = 63 AND t.type = 'return' AND t.reason LIKE '%(Накладная #63)'
  AND NOT EXISTS (SELECT 1 FROM inventory_transactions d WHERE d.reference_id = 63 AND d.reason LIKE 'Invoice #63 (восстановлено при сверке, позже%');

-- Invoice 383 was fully returned and then cancelled, crediting the same pieces twice.
INSERT INTO inventory_transactions (product_id, warehouse_id, user_id, qty_change, type, reason, reference_id, created_at)
SELECT t.product_id, t.warehouse_id, t.user_id, -t.qty_change, 'adjustment',
       'Сторно двойного зачисления по накладной #383', 383, t.created_at
FROM inventory_transactions t
JOIN invoices i ON i.id = 383 AND i.cancelled AND i.returned_amount = 1164
WHERE t.reference_id = 383 AND t.type = 'adjustment' AND t.reason = 'Invoice #383 Cancelled'
  AND NOT EXISTS (SELECT 1 FROM inventory_transactions d WHERE d.reference_id = 383 AND d.reason = 'Сторно двойного зачисления по накладной #383');
