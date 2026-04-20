"use server";
import type { SimilarityResult } from "./get-similar-accounts";

export async function getSimilarLeads(
  _recordId: string,
  _limit = 5
): Promise<SimilarityResult> {
  return { status: "no_embedding" };
}
