"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { BrandLogo, VisualPage } from "@/components/visual-effects";

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
    authorizedFetch(apiEndpoint("/api/generation-records"))
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
        apiEndpoint("/api/generation-records/" + encodeURIComponent(recordId) +
          "/download/" + encodeURIComponent(kind)),
      );
      const body = (await response.json()) as Envelope<{ url?: string }>;
      if (!response.ok || !body.data?.url) throw new Error(body.msg || "获取下载链接失败");
      window.open(body.data.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "获取下载链接失败");
    }
  }

  if (loading || !user) return <VisualPage className="flex items-center justify-center text-center text-white">正在加载…</VisualPage>;

  return (
    <VisualPage className="px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
          <BrandLogo label="软著申报助手" />
          <Link href="/app" className="text-sm text-white/60 transition-colors hover:text-white">← 返回工作台</Link>
        </div>
        <h1 className="gradient-heading mt-4 text-3xl font-bold">生成历史</h1>
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        <Card className="glass-panel card-glow mt-6">
          <CardHeader><CardTitle>我的生成记录</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {records.length === 0 ? <p className="text-white/60">暂无生成记录</p> : records.map((record) => (
              <div className="card-glow rounded-xl border border-white/10 bg-white/[0.03] p-4" key={record.id}>
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
    </VisualPage>
  );
}
