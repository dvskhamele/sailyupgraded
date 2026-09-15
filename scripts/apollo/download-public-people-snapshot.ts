import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { getUnifiedPeople } from "@/actions/crm/people/get-people";
import type { PeopleRecord } from "@/types/people";

const SOURCE = "https://people.signimus.com/contacts";
const PAGE_SIZE = 1000;
const CHUNK_SIZE = 10_000;
const MAX_OFFSET = 1_000_000;
const RETRIES = 3;

type SnapshotManifest = {
  source: string;
  downloadedAt: string;
  pageSize: number;
  recordsPerChunk: number;
  totalRecords: number;
  uniqueRecords: number;
  duplicatesRemoved: number;
  apiPages: number;
  chunks: number;
  firstOffset: number;
  lastSuccessfulOffset: number;
  firstRecordId: string | null;
  lastRecordId: string | null;
  failedOffsets: number[];
  complete?: boolean;
};

const outputDirectory = path.resolve(process.cwd(), "data", "apollo-people");
const manifestPath = path.join(outputDirectory, "manifest.json");

function digest(record: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

async function writeJsonAtomically(filePath: string, value: unknown) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

async function fetchPage(offset: number): Promise<PeopleRecord[] | null> {
  const url = new URL(SOURCE);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));

  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const result = await getUnifiedPeople({ page: offset / PAGE_SIZE + 1, limit: PAGE_SIZE });
      if (!result.success) throw new Error(result.error || "Apollo request failed");
      if (result.source !== "apollo") throw new Error(`unexpected data source: ${result.source}`);
      return result.data as PeopleRecord[];
    } catch (error) {
      if (attempt === RETRIES) throw new Error(`offset ${offset}: ${error instanceof Error ? error.message : "request failed"}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  return null;
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  let manifest: SnapshotManifest = {
    source: SOURCE,
    downloadedAt: new Date().toISOString(),
    pageSize: PAGE_SIZE,
    recordsPerChunk: CHUNK_SIZE,
    totalRecords: 0,
    uniqueRecords: 0,
    duplicatesRemoved: 0,
    apiPages: 0,
    chunks: 0,
    firstOffset: 0,
    lastSuccessfulOffset: -1,
    firstRecordId: null,
    lastRecordId: null,
    failedOffsets: [],
  };
  const seen = new Set<string>();
  let offset = 0;
  try {
    const previous = JSON.parse(await readFile(manifestPath, "utf8")) as SnapshotManifest;
    if (previous.source !== SOURCE || previous.pageSize !== PAGE_SIZE || previous.recordsPerChunk !== CHUNK_SIZE) {
      throw new Error("Existing manifest does not match this public Apollo export configuration.");
    }
    if (previous.complete) {
      console.info("[APOLLO_PUBLIC_SNAPSHOT_COMPLETE]", previous);
      return;
    }
    for (let index = 1; index <= previous.chunks; index += 1) {
      const chunkPath = path.join(outputDirectory, `part-${String(index).padStart(6, "0")}.json`);
      const records = JSON.parse(await readFile(chunkPath, "utf8")) as PeopleRecord[];
      for (const record of records) seen.add(digest(record.raw as Record<string, unknown>));
    }
    manifest = previous;
    offset = previous.lastSuccessfulOffset + PAGE_SIZE;
    console.info("[APOLLO_PUBLIC_SNAPSHOT_RESUME]", { offset, records: manifest.uniqueRecords, chunks: manifest.chunks });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let chunk: PeopleRecord[] = [];
  const maxPagesThisRun = Number.parseInt(process.env.APOLLO_SNAPSHOT_MAX_PAGES ?? "1001", 10);
  let pagesThisRun = 0;

  for (; offset <= MAX_OFFSET; offset += PAGE_SIZE) {
    const rawPage = await fetchPage(offset);
    if (rawPage === null || rawPage.length === 0) break;

    manifest.apiPages += 1;
    pagesThisRun += 1;
    manifest.lastSuccessfulOffset = offset;
    for (const mapped of rawPage) {
      const hash = digest(mapped.raw as Record<string, unknown>);
      if (seen.has(hash)) {
        manifest.duplicatesRemoved += 1;
        continue;
      }
      seen.add(hash);
      chunk.push(mapped);
      manifest.totalRecords += 1;
      manifest.uniqueRecords += 1;
      manifest.firstRecordId ??= mapped.id;
      manifest.lastRecordId = mapped.id;
    }

    if (chunk.length >= CHUNK_SIZE || offset === MAX_OFFSET || rawPage.length < PAGE_SIZE) {
      const chunkName = `part-${String(manifest.chunks + 1).padStart(6, "0")}.json`;
      await writeJsonAtomically(path.join(outputDirectory, chunkName), chunk);
      manifest.chunks += 1;
      chunk = [];
      await writeJsonAtomically(manifestPath, manifest);
      console.info("[APOLLO_PUBLIC_SNAPSHOT_PROGRESS]", {
        pages: manifest.apiPages,
        lastSuccessfulOffset: manifest.lastSuccessfulOffset,
        records: manifest.uniqueRecords,
        chunks: manifest.chunks,
      });
    }

    if (rawPage.length < PAGE_SIZE) break;
    if (pagesThisRun >= maxPagesThisRun) {
      if (chunk.length > 0) {
        const chunkName = `part-${String(manifest.chunks + 1).padStart(6, "0")}.json`;
        await writeJsonAtomically(path.join(outputDirectory, chunkName), chunk);
        manifest.chunks += 1;
      }
      await writeJsonAtomically(manifestPath, manifest);
      console.info("[APOLLO_PUBLIC_SNAPSHOT_PAUSED]", { offset: manifest.lastSuccessfulOffset, records: manifest.uniqueRecords });
      return;
    }
  }

  if (chunk.length > 0) {
    const chunkName = `part-${String(manifest.chunks + 1).padStart(6, "0")}.json`;
    await writeJsonAtomically(path.join(outputDirectory, chunkName), chunk);
    manifest.chunks += 1;
  }
  manifest.complete = true;
  await writeJsonAtomically(manifestPath, manifest);
  console.info("[APOLLO_PUBLIC_SNAPSHOT_COMPLETE]", manifest);
}

main().catch((error) => {
  console.error("[APOLLO_PUBLIC_SNAPSHOT_ERROR]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
