import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SNAPSHOT_LIMIT = 1000;

async function main() {
  config({ path: path.resolve(process.cwd(), ".env.local") });
  config({ path: path.resolve(process.cwd(), ".env") });

  // Dynamic import ensures ENRICHMENT_API_URL is loaded before the action module.
  const { getUnifiedPeople } = await import("@/actions/crm/people/get-people");
  const result = await getUnifiedPeople({ page: 1, limit: SNAPSHOT_LIMIT });
  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
    throw new Error(result.error || "Apollo did not return records for the snapshot");
  }

  const outputDirectory = path.resolve(process.cwd(), "data");
  const outputPath = path.join(outputDirectory, "apollo-people-snapshot.json");
  const snapshot = {
    source: "apollo",
    generatedAt: new Date().toISOString(),
    limit: SNAPSHOT_LIMIT,
    records: result.data,
  };

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`, "utf8");
  console.info("[APOLLO_SNAPSHOT_EXPORT]", {
    records: result.data.length,
    output: "data/apollo-people-snapshot.json",
  });
}

main().catch((error) => {
  console.error("[APOLLO_SNAPSHOT_EXPORT_ERROR]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
