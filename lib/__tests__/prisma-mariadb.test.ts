import { createMariaDbConfigFromUrl } from "../prisma-mariadb";

describe("createMariaDbConfigFromUrl", () => {
  it("uses production-grade pool timeouts by default", () => {
    const config = createMariaDbConfigFromUrl(
      "mysql://user:pass@example.com:3307/appdb"
    );

    expect(config.host).toBe("example.com");
    expect(config.port).toBe(3307);
    expect(config.user).toBe("user");
    expect(config.password).toBe("pass");
    expect(config.database).toBe("appdb");
    expect(config.connectTimeout).toBe(10_000);
    expect(config.acquireTimeout).toBe(30_000);
    expect(config.initializationTimeout).toBe(29_900);
    expect(config.connectionLimit).toBe(10);
  });

  it("accepts common camelCase and pool timeout URL aliases", () => {
    const config = createMariaDbConfigFromUrl(
      "mysql://user:pass@example.com/appdb?connectTimeout=12000&pool_timeout=45000&initializationTimeout=44000&idleTimeout=60&connectionLimit=4"
    );

    expect(config.connectTimeout).toBe(12_000);
    expect(config.acquireTimeout).toBe(45_000);
    expect(config.initializationTimeout).toBe(44_000);
    expect(config.idleTimeout).toBe(60);
    expect(config.connectionLimit).toBe(4);
  });
});
