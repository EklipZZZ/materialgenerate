"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileOutput, Search } from "lucide-react";
import { AppShell, EmptyState, PageHeader, Panel, StatusBadge, formatDateTime } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Input } from "@/components/ui/input";
import { getApplicationProgress } from "@/lib/application-progress";
import { listApplications, type ApplicationRecord } from "@/lib/softreg-api";

export default function GeneratePage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    listApplications()
      .then((items) => {
        if (active) {
          setApplications(items);
          setError(null);
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "加载申请失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return applications;
    return applications.filter((application) =>
      `${application.software_full_name} ${application.software_short_name}`.toLowerCase().includes(normalized),
    );
  }, [applications, query]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="申报空间 / 材料生成"
        title="材料生成"
        description="选择一条已保存的申请生成完整申报材料；源码压缩包请先在申请编辑页关联并完成核对。"
      />

      {error && <div className="app-feedback app-feedback--error">{error}</div>}

      <Panel>
        <div className="app-panel__header">
          <div>
            <h2 className="app-panel__title">选择申请</h2>
            <p className="app-panel__description">建议先在申请编辑页确认信息，再开始生成。</p>
          </div>
          <div className="app-search-wrap">
            <Search size={15} aria-hidden="true" />
            <Input className="app-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索软件名称" aria-label="搜索软件名称" />
          </div>
        </div>
        {loading ? (
          <p className="app-panel__empty-line">正在加载申请…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileOutput size={22} />}
            title={applications.length === 0 ? "还没有可生成的申请" : "没有匹配的申请"}
            description={applications.length === 0 ? "先创建并填写一条申请，再从这里生成材料。" : "试试调整搜索关键词。"}
            action={applications.length === 0 ? <Link className="app-inline-link" href="/app/applications/new">创建第一条申请 <ArrowRight size={14} /></Link> : undefined}
          />
        ) : (
          <div className="app-table-wrap">
            <table className="app-table">
              <thead><tr><th>软件名称</th><th>完成度</th><th>申请状态</th><th>最近更新</th><th /></tr></thead>
              <tbody>
                {filtered.map((application) => {
                  const progress = getApplicationProgress(application);
                  return (
                    <tr key={application.id}>
                      <td><span className="app-table__name">{application.software_full_name || "未填写软件全称"}</span><span className="app-table__subtext">{application.software_short_name || "未填写简称"}</span></td>
                      <td><div className="app-table-progress"><span className="app-progress-track"><span style={{ width: `${progress.percent}%` }} /></span><small>{progress.percent}%</small></div></td>
                      <td><StatusBadge status={application.status === "completed" ? "complete" : progress.percent === 100 ? "ready" : "editing"} /></td>
                      <td>{formatDateTime(application.updated_at || application.created_at)}</td>
                      <td><Link className="app-inline-link" href={`/app/generate/${application.id}`}>开始生成 <ArrowRight size={14} /></Link></td>
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
