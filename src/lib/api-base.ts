export const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

export function requireApiUrl(value: string, name: string): string {
  if (!value) throw new Error(name + " is not configured");
  return value;
}
