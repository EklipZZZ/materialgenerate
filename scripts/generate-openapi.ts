import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiDocument } from "../src/server/openapi.ts";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = resolve(projectRoot, "src/app/api");
const openApiPath = resolve(projectRoot, "docs/openapi.json");

function routeSegment(segment: string): string {
  if (segment.startsWith("[[...") && segment.endsWith("]]")) {
    return `{${segment.slice(5, -2)}}`;
  }
  if (segment.startsWith("[...") && segment.endsWith("]")) {
    return `{${segment.slice(4, -1)}}`;
  }
  if (segment.startsWith("[") && segment.endsWith("]")) {
    return `{${segment.slice(1, -1)}}`;
  }
  return segment;
}

function findRouteFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...findRouteFiles(path));
    else if (entry.isFile() && entry.name === "route.ts") files.push(path);
  }
  return files;
}

function routePath(filePath: string): string {
  const relativePath = relative(apiRoot, filePath).split(sep).join("/");
  const segments = relativePath.split("/");
  segments.pop();
  return "/api/" + segments.map(routeSegment).join("/");
}

function routeOperations(): Set<string> {
  const operations = new Set<string>();
  for (const filePath of findRouteFiles(apiRoot)) {
    const source = readFileSync(filePath, "utf8");
    const methods = source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g);
    for (const match of methods) {
      operations.add(`${match[1].toLowerCase()} ${routePath(filePath)}`);
    }
    const exportedConstants = source.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g);
    for (const match of exportedConstants) {
      operations.add(`${match[1].toLowerCase()} ${routePath(filePath)}`);
    }
  }
  return operations;
}

function documentedOperations(document: unknown): Set<string> {
  const paths = (document as { paths?: Record<string, Record<string, unknown>> }).paths || {};
  const operations = new Set<string>();
  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      if (pathItem[method]) operations.add(`${method} ${path}`);
    }
  }
  return operations;
}

function sorted(values: Set<string>): string[] {
  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function assertRouteCoverage(document: unknown): void {
  const actual = routeOperations();
  const documented = documentedOperations(document);
  const missing = sorted(new Set(Array.from(actual).filter((operation) => !documented.has(operation))));
  const extra = sorted(new Set(Array.from(documented).filter((operation) => !actual.has(operation))));
  if (!missing.length && !extra.length) return;

  const details = [
    missing.length ? `未记录的路由：\n${missing.map((item) => `  - ${item}`).join("\n")}` : "",
    extra.length ? `文档中不存在的路由：\n${extra.map((item) => `  - ${item}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
  throw new Error(`OpenAPI 路由覆盖检查失败\n${details}`);
}

function expectedContent(): string {
  const document = buildOpenApiDocument();
  assertRouteCoverage(document);
  return JSON.stringify(document, null, 2) + "\n";
}

function main(): void {
  const expected = expectedContent();
  const checkOnly = process.argv.includes("--check");
  if (checkOnly) {
    if (!existsSync(openApiPath)) {
      throw new Error(`缺少 ${openApiPath}，请先运行 pnpm api:generate`);
    }
    const current = readFileSync(openApiPath, "utf8");
    if (current !== expected) {
      throw new Error("docs/openapi.json 已过期，请运行 pnpm api:generate 并提交生成结果");
    }
    return;
  }

  mkdirSync(dirname(openApiPath), { recursive: true });
  writeFileSync(openApiPath, expected, "utf8");
  console.log(`已生成 ${relative(projectRoot, openApiPath)}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
