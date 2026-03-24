import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const cssDir = join(process.cwd(), ".next", "static", "chunks");
const cssFiles = readdirSync(cssDir).filter((file) => file.endsWith(".css"));

if (cssFiles.length === 0) {
  throw new Error("No built CSS files found in .next/static/chunks.");
}

for (const file of cssFiles) {
  const contents = readFileSync(join(cssDir, file), "utf8");

  if (contents.includes("@tailwind")) {
    throw new Error(`Uncompiled Tailwind directive found in ${file}.`);
  }
}

console.log(`Verified ${cssFiles.length} compiled CSS file(s) with no raw Tailwind directives.`);
