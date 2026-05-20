import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { DEFAULT_STORAGE_LIMIT_BYTES, calculatePercentage } from "@/lib/storage-usage";
import { getWorkspaceStorageUsed } from "@/lib/workspace-storage";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const totalStorage = DEFAULT_STORAGE_LIMIT_BYTES;
  const usedStorage = Math.max(await getWorkspaceStorageUsed(), 0);
  const remainingStorage = Math.max(totalStorage - usedStorage, 0);
  const usagePercentage = calculatePercentage(usedStorage, totalStorage);

  return NextResponse.json({
    totalStorage,
    usedStorage,
    remainingStorage,
    usagePercentage,
  });
}
