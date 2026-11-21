import { cp, mkdir, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
const output = resolve("dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ["index.html", "styles.css", "src", "assets"])
  await cp(resolve(file), resolve(output, file), { recursive: true });
const { version } = JSON.parse(await readFile(resolve("package.json"), "utf8"));
const query = `?v=${encodeURIComponent(version)}`;
for (const name of await readdir(resolve(output, "src"))) {
  if (!name.endsWith(".js")) continue;
  const path = resolve(output, "src", name),
    source = await readFile(path, "utf8");
  await writeFile(
    path,
    source.replace(
      /(from\s+["'])(\.{1,2}\/[^"']+\.js)(["'])/g,
      `$1$2${query}$3`,
    ),
  );
}
const htmlPath = resolve(output, "index.html");
const html = await readFile(htmlPath, "utf8");
await writeFile(
  htmlPath,
  html
    .replace('href="styles.css"', `href="styles.css${query}"`)
    .replace('src="src/main.js"', `src="src/main.js${query}"`),
);
await writeFile(
  resolve(output, "version.json"),
  JSON.stringify({ version }) + "\n",
);
console.log("Built static game → dist/");
