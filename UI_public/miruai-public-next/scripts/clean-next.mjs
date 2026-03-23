import { rmSync } from "node:fs";
import { resolve } from "node:path";

const nextProdDir = resolve(process.cwd(), ".next");
const nextDevDir = resolve(process.cwd(), ".next-dev");
const tsBuildInfo = resolve(process.cwd(), "tsconfig.tsbuildinfo");
const target = process.argv[2] || "all";

if (target === "all" || target === "build") {
  rmSync(nextProdDir, { recursive: true, force: true });
}

if (target === "all" || target === "dev") {
  rmSync(nextDevDir, { recursive: true, force: true });
}

rmSync(tsBuildInfo, { force: true });
