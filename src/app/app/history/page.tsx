"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import { API_URL, requireApiUrl } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";

interface GenerationRecord {
  id: string;
  application_id?: string;
  file_name?: string;
  provider?: string;
  model?: string;
  status?: string;
  created_at?: string;
}

interface Envelope<T> { data: T; msg?: string; }

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    authorizedFetch(requireApiUrl(API_URL, "NEXT_PUBLIC_API_URL") + "/api/generation-records")
      .then(async (response) => {
        const body = (await response.json()) as Envelope<GenerationRecord[]> & { detail?: string };
        if (!response.ok) throw new Error(body.msg || body.detail || "加载历史失败");
        setRecords(body.data || []);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "加载历史失败"));
  }, [user]);

  async function download(recordId: string, kind: string) {
    setError(null);
    try {
      const response = await authorizedFetch(
        requireApiUrl(API_URL, "NEXT_PUBLIC_API_URL") +
          "/api/generation-records/" + encodeURIComponent(recordId) +
          "/download/" + encodeURIComponent(kind),
      );
      const body = (await response.json()) as Envelope<{ url?: string }>;
      if (!response.ok || !body.data?.url) throw new Error(body.msg || "获取下载链接失败");
      window.open(body.data.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "获取下载链接失败");
    }
  }

  if (loading || !user) return <main className="flex min-h-screen items-center justify-center bg-[#030014] text-white">正在加载…</main>;

  return (
    <main className="min-h-screen bg-[#030014] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/app" className="text-sm text-white/60 hover:text-white">← 返回工作台</Link>
        <h1 className="mt-4 text-3xl font-bold">生成历史</h1>
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        <Card className="mt-6 border-white/10 bg-white/[0.04]">
          <CardHeader><CardTitle>我的生成记录</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {records.length === 0 ? <p className="text-white/60">暂无生成记录</p> : records.map((record) => (
              <div className="rounded-lg border border-white/10 p-4" key={record.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><div className="font-medium">{record.file_name || "未命名申请"}</div><div className="text-sm text-white/50">{record.provider}/{record.model} · {record.status}</div></div>
                  <span className="text-xs text-white/50">{record.created_at ? new Date(record.created_at).toLocaleString() : ""}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  {(["source_code", "user_manual", "collection_form"] as const).map((kind) => (
                    <button
                      type="button"
                      key={kind}
                      className="text-violet-300 hover:text-violet-100"
                      onClick={() => void download(record.id, kind)}
                    >
                      下载{kind === "source_code" ? "源码文档" : kind === "user_manual" ? "用户手册" : "采集表"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
