import { readFileSync, writeFileSync } from 'node:fs';
const source = new URL('../backend/src/utils/financial.ts', import.meta.url);
const target = new URL('../frontend/src/utils/financial.ts', import.meta.url);
writeFileSync(target, readFileSync(source));
