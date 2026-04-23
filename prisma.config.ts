import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "npx tsx prisma/seeds/seed.ts",
  },
});
