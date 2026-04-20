"use server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";

export interface DocumentSearchResult {
  id: string;
  name: string;
  summary: string | null;
  systemType: string | null;
  accountName: string | null;
}

export async function searchDocuments(
  query: string
): Promise<DocumentSearchResult[]> {
  const session = await getSession();
  if (!session) return [];
  if (!query || query.trim().length < 2) return [];

  // Keyword search
  const kwResults = await prismadb.documents.findMany({
    where: {
      parent_document_id: null,
      OR: [
        { document_name: { contains: query } },
        { summary: { contains: query } },
      ],
    },
    take: 5,
    select: {
      id: true,
      document_name: true,
      summary: true,
      document_system_type: true,
      accounts: { select: { account: { select: { name: true } } }, take: 1 },
    },
  });

  return (kwResults as any[]).map((r) => ({
    id: r.id,
    name: r.document_name,
    summary: r.summary,
    systemType: r.document_system_type,
    accountName: r.accounts?.[0]?.account?.name ?? null,
  }));
}
