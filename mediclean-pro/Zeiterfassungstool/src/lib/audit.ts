import { prisma } from './db';

interface AuditEntry {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: entry.tenantId,
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      oldValue: entry.oldValue ?? undefined,
      newValue: entry.newValue ?? undefined,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    },
  });
}

export function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): { oldValue: Record<string, unknown>; newValue: Record<string, unknown> } {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      oldValue[key] = oldObj[key];
      newValue[key] = newObj[key];
    }
  }

  return { oldValue, newValue };
}
