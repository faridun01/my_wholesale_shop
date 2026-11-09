import client from './client';

const PAGE_LIMIT = 1000;

// For screens that work on a complete list (grouping, duplicate search, totals,
// exports). A single request stops at the server's page limit, silently dropping
// whatever comes after it.
export const fetchAllPages = async <T extends { id: number } = any>(path: string, params?: Record<string, unknown>) => {
  // Keyed by id: a row created between two requests shifts the next page by one.
  const rowsById = new Map<number, T>();

  for (let page = 1; ; page += 1) {
    const response = await client.get<T[]>(path, { params: { ...params, page, limit: PAGE_LIMIT } });
    (Array.isArray(response.data) ? response.data : []).forEach((row) => rowsById.set(row.id, row));

    if (String(response.headers['x-has-more']) !== 'true') {
      return Array.from(rowsById.values());
    }
  }
};
