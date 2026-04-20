"use server";

export type SimilarRecord = {
  id: string;
  name: string;
  subtitle: string;
  similarity: number;
  href: string;
};

export type SimilarityResult =
  | { status: "ok"; records: SimilarRecord[] }
  | { status: "no_embedding" }
  | { status: "error"; message: string };

export async function getSimilarAccounts(
  _recordId: string,
  _limit = 5
): Promise<SimilarityResult> {
  return { status: "no_embedding" };
}
