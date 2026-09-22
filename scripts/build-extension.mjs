import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { build } from "esbuild";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const extensionRoot = resolve(projectRoot, "browser-extension");
const dist = resolve(extensionRoot, "dist");

function readLocalPublicEnv(name) {
  const envPath = resolve(projectRoot, ".env.local");
  if (!existsSync(envPath)) return undefined;
  const line = readFileSync(envPath, "utf8").split(/\r?\n/).find((value) => value.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, "") || undefined;
}

function origin(name, value, { allowHttpLocalhost = false } = {}) {
  if (!value) throw new Error(`缺少 ${name}。请设置该环境变量后再构建扩展。`);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} 必须是完整 origin，例如 https://example.com`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${name} 必须只包含 http(s) origin，不得包含路径、查询、凭据或 hash`);
  }
  if (parsed.protocol === "http:" && !(allowHttpLocalhost && ["localhost", "127.0.0.1"].includes(parsed.hostname))) {
    throw new Error(`${name} 生产构建必须使用 HTTPS`);
  }
  return parsed.origin;
}

const appOrigin = origin("SOFTREG_APP_ORIGIN", process.env.SOFTREG_APP_ORIGIN || "https://ipgen.top", { allowHttpLocalhost: true });
const storageOrigin = origin("SOFTREG_STORAGE_ORIGIN", process.env.SOFTREG_STORAGE_ORIGIN || process.env.NEXT_PUBLIC_SUPABASE_URL || readLocalPublicEnv("NEXT_PUBLIC_SUPABASE_URL"));
const appOrigins = [appOrigin];
if (appOrigin === "http://localhost:3000") appOrigins.push("http://127.0.0.1:3000");
if (appOrigin === "http://127.0.0.1:3000") appOrigins.push("http://localhost:3000");
const template = JSON.parse(readFileSync(resolve(extensionRoot, "manifest.template.json"), "utf8"));
const manifest = JSON.parse(JSON.stringify(template).replaceAll("__APP_ORIGIN__", appOrigin).replaceAll("__STORAGE_ORIGIN__", storageOrigin));
manifest.host_permissions = [...appOrigins.map((value) => `${value}/*`), "https://register.ccopyright.com.cn/*", `${storageOrigin}/*`];
manifest.content_scripts[0].matches = appOrigins.map((value) => `${value}/*`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const common = {
  bundle: true,
  target: "chrome120",
  platform: "browser",
  legalComments: "none",
  sourcemap: false,
  define: {
    __SOFTREG_APP_ORIGINS__: JSON.stringify(appOrigins),
    __SOFTREG_STORAGE_ORIGIN__: JSON.stringify(storageOrigin),
  },
};

await build({ ...common, entryPoints: [resolve(extensionRoot, "src/background.ts")], outfile: resolve(dist, "background.js"), format: "esm" });
await build({ ...common, entryPoints: [resolve(extensionRoot, "src/app-bridge.ts")], outfile: resolve(dist, "app-bridge.js"), format: "iife" });
await build({ ...common, entryPoints: [resolve(extensionRoot, "src/official-content.ts")], outfile: resolve(dist, "official-content.js"), format: "iife" });
writeFileSync(resolve(dist, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Chrome 扩展已构建到 ${dist}`);
