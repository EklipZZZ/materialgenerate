export function apiEndpoint(path: string): string {
  return path.startsWith("/") ? path : "/" + path;
}
