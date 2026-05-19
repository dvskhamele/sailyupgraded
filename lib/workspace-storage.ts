import { prismadb } from "@/lib/prisma";
import { WORKSPACE_STORAGE_LIMIT_BYTES } from "@/lib/storage-validation";

export const DEFAULT_WORKSPACE_STORAGE_ID = "default";

export async function ensureWorkspaceStorage() {
  await prismadb.$executeRaw`
    INSERT INTO WorkspaceStorage (id, storageUsed, updatedAt)
    VALUES (${DEFAULT_WORKSPACE_STORAGE_ID}, 0, CURRENT_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE id = id
  `;
}

export async function getWorkspaceStorageUsed() {
  await ensureWorkspaceStorage();
  const storage = await prismadb.$queryRaw<Array<{ storageUsed: bigint | number }>>`
    SELECT storageUsed
    FROM WorkspaceStorage
    WHERE id = ${DEFAULT_WORKSPACE_STORAGE_ID}
    LIMIT 1
  `;

  return Number(storage[0]?.storageUsed ?? 0);
}

export async function reserveWorkspaceStorage(bytes: number) {
  await ensureWorkspaceStorage();

  const availableBeforeUpload = BigInt(WORKSPACE_STORAGE_LIMIT_BYTES - bytes);
  const updatedRows = await prismadb.$executeRaw`
    UPDATE WorkspaceStorage
    SET storageUsed = storageUsed + ${bytes}
    WHERE id = ${DEFAULT_WORKSPACE_STORAGE_ID}
      AND storageUsed <= ${availableBeforeUpload}
  `;

  return updatedRows === 1;
}

export async function releaseWorkspaceStorage(bytes: number) {
  await ensureWorkspaceStorage();

  await prismadb.$executeRaw`
    UPDATE WorkspaceStorage
    SET storageUsed = GREATEST(storageUsed - ${bytes}, 0)
    WHERE id = ${DEFAULT_WORKSPACE_STORAGE_ID}
  `;
}
