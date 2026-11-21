import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
const output = resolve("dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ["index.html", "styles.css", "src", "assets"])
  await cp(resolve(file), resolve(output, file), { recursive: true });
console.log("Built static game → dist/");
