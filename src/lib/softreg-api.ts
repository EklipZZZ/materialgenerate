import type { CopyrightFormData } from "./copyright-form";
import { formToUpdatePayload, recordToFormData } from "./copyright-form";

const API_BASE =
  process.env.NEXT_PUBLIC_SOFTREG_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok) {
    throw new Error(json.msg || `请求失败 (${res.status})`);
  }
  return json;
}

export function getSoftregApiBase(): string {
  return API_BASE;
}

export async function queryByCode(queryCode: string): Promise<CopyrightFormData> {
  const code = queryCode.trim().toUpperCase();
  const res = await request<Record<string, unknown>>(`/api/software-copyright/query/${code}`);
  if (res.code !== 200 || !res.data) {
    throw new Error(res.msg || "查询码不存在");
  }
  return recordToFormData(res.data);
}

export async function saveEnrichedForm(form: CopyrightFormData): Promise<CopyrightFormData> {
  if (!form.id) {
    throw new Error("缺少表单 ID，无法保存");
  }
  const res = await request<Record<string, unknown>>(
    `/api/software-copyright/form/${form.id}`,
    {
      method: "PUT",
      body: JSON.stringify(formToUpdatePayload(form)),
    }
  );
  if (res.code !== 200 || !res.data) {
    throw new Error(res.msg || "保存失败");
  }
  return recordToFormData(res.data);
}
