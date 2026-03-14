export function formatProductName(value: unknown) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '';
  }

  return normalized.replace(
    /(^|[\s(])(?:SKIF|«SKIF»|"SKIF")(?=[$\s),.])/gi,
    (_match, prefix: string) => `${prefix}«SKIF»`
  );
}
