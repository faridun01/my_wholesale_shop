// Prisma `select` for a user embedded in an API response (invoice author,
// payment cashier, ...). Never `user: true` — that would serialise the
// password hash and 2FA secret to every client that can see the record.
export const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  role: true,
} as const;
