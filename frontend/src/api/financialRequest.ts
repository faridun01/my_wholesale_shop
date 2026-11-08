import client from './client';
import { getCurrentUser } from '../utils/userAccess';
// Keep the same key after an ambiguous network failure, including a page reload.
// A successful operation consumes its key; a later identical operation is new.
export async function financialPost(path: string, payload: any) {
  const { idempotencyKey: _camel, idempotency_key: _snake, ...body } = payload;
  const fingerprint = JSON.stringify({ path, body, actor: getCurrentUser()?.id });
  const storageKey = `financial-operation:${path}`;
  const stored = sessionStorage.getItem(storageKey);
  let pending: { fingerprint: string; key: string } | null = null;
  try { pending = stored ? JSON.parse(stored) : null; } catch { /* replace corrupt pending metadata */ }
  if (pending?.fingerprint !== fingerprint) pending = { fingerprint, key: crypto.randomUUID() };
  sessionStorage.setItem(storageKey, JSON.stringify(pending));
  const result = await client.post(path, { ...body, idempotencyKey: pending!.key, idempotency_key: pending!.key });
  sessionStorage.removeItem(storageKey);
  return result;
}
