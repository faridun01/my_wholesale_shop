import { createHash } from 'node:crypto';
export function operationKey(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 160) throw Object.assign(new Error('A stable idempotency key is required'), { status: 400 });
  return value.trim();
}
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).filter(k => !['idempotencyKey', 'idempotency_key'].includes(k) && value[k] !== undefined).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const requestHash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function assertReplay(existing: { requestHash?: string | null }, hash: string) {
  if (existing.requestHash !== hash) throw Object.assign(new Error('Idempotency key was already used for a different operation'), { status: 409 });
}
