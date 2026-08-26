"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export async function getAccessToken(): Promise<string> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("登录状态已失效，请重新登录");
  }
  return data.session.access_token;
}

export async function authorizedFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + token);
  return fetch(url, { ...init, headers });
}
