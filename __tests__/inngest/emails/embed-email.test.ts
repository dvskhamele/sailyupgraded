// Tests the content-hash short-circuit path
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    email: {
      findUnique: jest.fn(),
    },
    $executeRaw: jest.fn(),
  },
}));
jest.mock("@/inngest/client", () => ({
  inngest: {
    send: jest.fn(),
    createFunction: jest.fn((config, handler) => ({ fn: handler })),
  },
}));

import { prismadb } from "@/lib/prisma";
import { embedEmail } from "@/inngest/functions/emails/embed-email";

describe("embed-email: TiDB-disabled path", () => {
  it("skips embedding work", async () => {
    const result = await (embedEmail as any).fn({
      event: { data: { emailId: "e1" } },
    });

    expect(result).toEqual({
      skipped: "semantic embeddings disabled for TiDB (e1)",
    });
    expect(prismadb.$executeRaw).not.toHaveBeenCalled();
  });
});
