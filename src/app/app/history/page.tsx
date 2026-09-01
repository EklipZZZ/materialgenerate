"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileArchive, FileOutput, MoreHorizontal } from "lucide-react";
import { AppShell, EmptyState, PageHeader, Panel, StatusBadge, formatDateTime } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { listApplications, type ApplicationRecord } from "@/lib/softreg-api";

interface GenerationRecord {
  id: string;
  application_id?: string;
  file_name?: string;
  provider?: string;
  model?: string;
  status?: string;
  created_at?: string;
}

interface Envelope<T> {
  data?: T;
  msg?: string;
  detail?: string;
}

const downloads = [
  { kind: "source_code", label: "源代码文档", icon: FileArchive },
  { kind: "source_code_pdf", label: "源代码 PDF", icon: FileArchive },
  { kind: "user_manual", label: "用户手册", icon: FileOutput },
  { kind: "user_manual_pdf", label: "用户手册 PDF", icon: FileOutput },
  { kind: "collection_form", label: "采集表", icon: FileOutput },
] as const;

export default function HistoryPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      authorizedFetch(apiEndpoint("/api/generation-records")).then(async (response) => {
        const body = await response.json().catch(() => ({})) as Envelope<GenerationRecord[]>;
        if (!response.ok) throw new Error(body.msg || body.detail || "加载生成记录失败");
        return body.data || [];
      }),
      listApplications(),
    ])
      .then(([recordData, applicationData]) => {
        if (!active) return;
        setRecords(recordData);
        setApplications(applicationData);
        setError(null);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "加载生成记录失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const applicationNames = useMemo(() => new Map(applications.map((application) => [application.id, application.software_full_name])), [applications]);

  async function download(recordId: string, kind: string) {
    const key = `${recordId}:${kind}`;
    setDownloading(key);
    setError(null);
    try {
      const response = await authorizedFetch(
        apiEndpoint(`/api/generation-records/${encodeURIComponent(recordId)}/download/${encodeURIComponent(kind)}`),
      );
      const body = await response.json().catch(() => ({})) as Envelope<{ url?: string }>;
      if (!response.ok || !body.data?.url) throw new Error(body.msg || "获取下载链接失败");
      window.open(body.data.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "获取下载链接失败");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="申报空间 / 生成记录"
        title="生成记录"
        description="查看已经生成的申报材料，并按需重新获取短时下载链接。"
      >
        <Button asChild variant="outline"><Link href="/app/generate"><FileOutput size={15} />继续生成</Link></Button>
      </PageHeader>

      {error && <div className="app-feedback app-feedback--error">{error}</div>}

      <Panel className="app-table-panel">
        {loading ? (
          <p className="app-panel__empty-line">正在加载生成记录…</p>
        ) : records.length === 0 ? (
          <EmptyState
            icon={<Download size={22} />}
            title="还没有生成记录"
            description="完成一条申请后，从材料生成页面开始生成，结果会自动出现在这里。"
            action={<Button asChild><Link href="/app/generate"><FileOutput size={16} />开始生成</Link></Button>}
          />
        ) : (
          <div className="app-table-wrap">
            <table className="app-table">
              <thead><tr><th>申请名称</th><th>生成文件</th><th>模型</th><th>状态</th><th>生成时间</th><th><span className="sr-only">下载</span></th></tr></thead>
              <tbody>
                {records.map((record) => {
                  const status = record.status === "failed" || record.status === "error" ? "failed" : "complete";
                  return (
                    <tr key={record.id}>
                      <td>
                        <span className="app-table__name">{applicationNames.get(record.application_id || "") || record.file_name || "未命名申请"}</span>
                        <span className="app-table__subtext">{record.file_name || "申报材料"}</span>
                      </td>
                      <td><span className="app-file-count"><FileOutput size={14} />6 个产物</span></td>
                      <td>{record.provider && record.model ? `${record.provider} / ${record.model}` : "—"}</td>
                      <td><StatusBadge status={status} /></td>
                      <td>{formatDateTime(record.created_at)}</td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="打开下载菜单"><MoreHorizontal size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {downloads.map(({ kind, label, icon: Icon }) => {
                              const key = `${record.id}:${kind}`;
                              return <DropdownMenuItem key={kind} disabled={downloading === key} onSelect={() => void download(record.id, kind)}><Icon size={14} />{downloading === key ? "获取链接中…" : `下载${label}`}</DropdownMenuItem>;
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
