// Applies pending database migrations during `pnpm build`, but only on Vercel
// production deploys. Local builds and preview deploys skip it, so neither can
// change the live database. A failed migration fails the build, and the
// previous deployment stays live.
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
const forced = process.env.RUN_MIGRATIONS === "1";

if (env !== "production" && !forced) {
  console.log(`Skipping database migrations (VERCEL_ENV=${env ?? "unset"}).`);
  process.exit(0);
}

console.log("Applying database migrations…");
const result = spawnSync("zen", ["migrate", "deploy"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
