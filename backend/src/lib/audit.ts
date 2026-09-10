import { db } from "../db/client";
import { auditLogTable } from "../db/schema/index";

export async function logAudit(
  actorUserId: number | null,
  action: string,
  target?: { type: string; id: number },
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLogTable).values({
    actorUserId,
    action,
    targetType: target?.type,
    targetId: target?.id,
    metadata,
  });
}
