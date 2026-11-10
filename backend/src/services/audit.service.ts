import prisma from '../db/prisma.js';

export interface AuditLogOptions {
  userId?: number;
  action: string;
  entity: string;
  entityId?: number;
  details?: string | Record<string, any>;
  ipAddress?: string;
}

export class AuditService {
  /**
   * Logs a user/system administrative action.
   */
  static async log(options: AuditLogOptions) {
    try {
      const detailsStr =
        typeof options.details === 'object'
          ? JSON.stringify(options.details)
          : options.details;

      // Safe creation using prisma client
      if ((prisma as any).auditLog) {
        await (prisma as any).auditLog.create({
          data: {
            userId: options.userId ?? null,
            action: options.action,
            entity: options.entity,
            entityId: options.entityId ?? null,
            details: detailsStr ?? null,
            ipAddress: options.ipAddress ?? null,
          },
        });
      } else {
        console.log('[AUDIT LOG]:', {
          ...options,
          details: detailsStr,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Writes the entry inside the caller's transaction: it is kept or rolled back with
   * the action it describes, so a financial action never exists without its record.
   */
  static async record(tx: any, options: AuditLogOptions) {
    await tx.auditLog.create({
      data: {
        userId: options.userId ?? null,
        action: options.action,
        entity: options.entity,
        entityId: options.entityId ?? null,
        details: typeof options.details === 'object' ? JSON.stringify(options.details) : options.details ?? null,
        ipAddress: options.ipAddress ?? null,
      },
    });
  }

  /**
   * Fetches audit logs with optional filtering.
   */
  static async getLogs(limit = 100, offset = 0) {
    if ((prisma as any).auditLog) {
      return await (prisma as any).auditLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });
    }
    return [];
  }
}
