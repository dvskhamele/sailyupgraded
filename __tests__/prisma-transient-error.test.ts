import { isTransientPrismaConnectionError } from "@/lib/prisma";

describe("isTransientPrismaConnectionError", () => {
  it("treats Prisma transaction start timeouts as transient", () => {
    expect(
      isTransientPrismaConnectionError({
        code: "P2028",
        message: "Transaction API error: Unable to start a transaction in the given time.",
      }),
    ).toBe(true);
  });

  it("treats driver pool timeouts as transient", () => {
    expect(
      isTransientPrismaConnectionError({
        message: "pool timeout: failed to retrieve a connection from pool after 8093ms",
      }),
    ).toBe(true);
  });
});
