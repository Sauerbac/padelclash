#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { restorePadelClash } from "./restore-padelclash-lib.mjs";

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.length !== 1 || !env.DATABASE_URL) {
    throw new Error(
      "Usage: DATABASE_URL='<fresh PostgreSQL 17 target>' node scripts/backups/restore-padelclash.mjs <trusted-padelclash.dump>",
    );
  }
  await restorePadelClash({
    archivePath: argv[0],
    databaseUrl: env.DATABASE_URL,
  });
  process.stdout.write("PadelClash archive restored and analyzed successfully.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`Recovery failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
