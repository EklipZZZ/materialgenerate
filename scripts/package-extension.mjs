import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, relative } from "node:path";
import { zipSync } from "fflate";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(projectRoot, "browser-extension/dist");
const release = resolve(projectRoot, "browser-extension/release");
const output = resolve(release, "softreg-filing-extension-v0.1.0.zip");

function collect(directory, files = {}) {
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) collect(path, files);
    else files[relative(dist, path).replaceAll("\\", "/")] = readFileSync(path);
  }
  return files;
}

mkdirSync(release, { recursive: true });
writeFileSync(output, zipSync(collect(dist), { level: 6 }));
console.log(`Chrome 扩展安装包已生成到 ${output}`);
