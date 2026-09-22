import { createHash } from "node:crypto";

const accessCode = process.argv.slice(2).join(" ");

if (!accessCode) {
  console.error("Usage: pnpm access:hash <your-access-code>");
  process.exit(1);
}

const hash = createHash("sha256").update(accessCode, "utf8").digest("hex");
console.log(`sha256:${hash}`);
