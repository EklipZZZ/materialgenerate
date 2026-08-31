"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Bot, Clock3, Cpu, FileCheck2, FileText, Plus, ShieldCheck } from "lucide-react";
import { AppShell, EmptyState, PageHeader, Panel, StatusBadge, formatDateTime } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { listApplications, type ApplicationRecord } from "@/lib/softreg-api";
import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { getApplicationProgress, getApplicationStatus } from "@/lib/application-progress";

interface GenerationRecord {
  id: string;
  file_name?: string;
  provider?: string;
  model?: string;
  status?: string;
  created_at?: string;
}

interface GenerationEnvelope {
  data?: GenerationRecord[];
  msg?: string;
}

export default function AppPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      listApplications(),
      authorizedFetch(apiEndpoint("/api/generation-records"))
        .then(async (response) => {
          const body = await response.json().catch(() => ({})) as GenerationEnvelope;
          if (!response.ok) throw new Error(body.msg || "加载生成记录失败");
          return body.data || [];
        }),
    ])
      .then(([applicationData, recordData]) => {
        if (!active) return;
        setApplications(applicationData);
        setRecords(recordData);
        setError(null);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "加载工作台失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const selected = applications[0];
  const progress = selected ? getApplicationProgress(selected) : null;
  const editingCount = applications.filter((item) => getApplicationStatus(item) === "editing").length;
  const readyCount = applications.filter((item) => getApplicationStatus(item) === "ready").length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="申报空间 / 概览"
        title="总览"
        description="集中处理申请信息，准备并下载软件著作权申报材料。"
      >
        <Button asChild>
          <Link href="/app/applications/new"><Plus size={16} />新建申请</Link>
        </Button>
      </PageHeader>

      {error && <div className="app-feedback app-feedback--error">{error}</div>}

      <section className="app-stat-grid" aria-label="工作台概览">
        <div className="app-stat-card">
          <span className="app-stat-card__label">进行中的申请</span>
          <strong className="app-stat-card__value">{loading ? "—" : editingCount}</strong>
          <span className="app-stat-card__hint"><Clock3 size={13} />需要继续编辑</span>
        </div>
        <div className="app-stat-card">
          <span className="app-stat-card__label">待生成材料</span>
          <strong className="app-stat-card__value">{loading ? "—" : readyCount}</strong>
          <span className="app-stat-card__hint app-stat-card__hint--brand"><FileCheck2 size={13} />信息已完整</span>
        </div>
        <div className="app-stat-card">
          <span className="app-stat-card__label">已生成记录</span>
          <strong className="app-stat-card__value">{loading ? "—" : records.length}</strong>
          <span className="app-stat-card__hint"><ArrowUpRight size={13} />可随时下载</span>
        </div>
      </section>

      <div className="app-dashboard-grid">
        <Panel className="app-overview-panel">
          <div className="app-panel__header">
            <div>
              <h2 className="app-panel__title">继续处理</h2>
              <p className="app-panel__description">从最近修改的申请继续申报。</p>
            </div>
            {selected && <StatusBadge status={getApplicationStatus(selected)} />}
          </div>
          {selected && progress ? (
            <div className="app-overview-panel__body">
              <div className="app-overview-panel__application">
                <div>
                  <h2>{selected.software_full_name || "未命名申请"}</h2>
                  <p>最后更新于 {formatDateTime(selected.updated_at)}</p>
                </div>
                <span className="app-inline-meta">{selected.version || "V1.0"}</span>
              </div>
              <div className="app-progress-summary">
                <div className="app-progress-summary__value"><strong>{progress.percent}%</strong><span>资料完整度</span></div>
                <div className="app-progress-track" aria-label={`资料完整度 ${progress.percent}%`}><span style={{ width: `${progress.percent}%` }} /></div>
                <span className="app-progress-summary__detail">已完成 {progress.completed} / {progress.total} 项</span>
              </div>
              <div className="app-step-list">
                <div className={`app-step ${progress.percent > 0 ? "app-step--done" : "app-step--current"}`}>
                  <span className="app-step__number">1</span><span className="app-step__copy"><strong>申请信息</strong><small>{progress.percent > 0 ? "已填写" : "待填写"}</small></span>
                </div>
                <div className={`app-step ${progress.percent >= 70 ? "app-step--done" : "app-step--current"}`}>
                  <span className="app-step__number">2</span><span className="app-step__copy"><strong>内容检查</strong><small>{progress.percent >= 70 ? "可以生成" : "继续完善"}</small></span>
                </div>
                <div className={`app-step ${progress.percent === 100 ? "app-step--current" : ""}`}>
                  <span className="app-step__number">3</span><span className="app-step__copy"><strong>材料生成</strong><small>{progress.percent === 100 ? "下一步" : "等待完成"}</small></span>
                </div>
              </div>
              <div className="app-overview-panel__footer">
                <span><ShieldCheck size={14} />信息仅对你可见</span>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/app/applications/${selected.id}`}>继续编辑 <ArrowRight size={14} /></Link>
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              title={loading ? "正在加载申请" : "还没有申请记录"}
              description={loading ? "请稍候。" : "创建第一份申请，开始准备软件著作权登记材料。"}
              action={!loading && <Button asChild><Link href="/app/applications/new"><Plus size={16} />创建申请</Link></Button>}
            />
          )}
        </Panel>

        <div className="app-dashboard-stack">
          <Panel className="app-side-panel">
            <div className="app-side-panel__topline">
              <span className="app-side-panel__icon"><Bot size={17} /></span>
              <span className="app-status app-status--ready"><span className="app-status__dot" />按需调用</span>
            </div>
            <h2>AI 服务</h2>
            <p>用于补全申请信息和生成申报材料，Key 会在服务端加密保存。</p>
            <div className="app-side-panel__model"><Cpu size={14} />当前配置保存为加密服务配置</div>
            <Link href="/settings/llm-keys" className="app-side-panel__link">管理 AI 设置 <ArrowRight size={14} /></Link>
          </Panel>
          <Panel className="app-tip-panel">
            <span className="app-tip-panel__icon"><FileText size={16} /></span>
            <div><strong>建议先完善申请信息</strong><p>完整的信息会让后续生成的源码文档和用户手册更准确。</p></div>
          </Panel>
        </div>
      </div>

      <Panel className="app-table-panel">
        <div className="app-panel__header">
          <div><h2 className="app-panel__title">最近申请</h2><p className="app-panel__description">查看申请状态，继续编辑或进入材料生成。</p></div>
          <Link href="/app/applications" className="app-inline-link">查看全部 <ArrowRight size={14} /></Link>
        </div>
        {applications.length === 0 && !loading ? (
          <EmptyState title="暂无申请" description="创建一份申请后，所有资料会显示在这里。" action={<Button asChild><Link href="/app/applications/new"><Plus size={16} />新建申请</Link></Button>} />
        ) : (
          <div className="app-table-wrap">
            <table className="app-table">
              <thead><tr><th>申请名称</th><th>状态</th><th>资料完整度</th><th>更新时间</th><th /></tr></thead>
              <tbody>
                {applications.slice(0, 5).map((application) => {
                  const itemProgress = getApplicationProgress(application);
                  return <tr key={application.id}>
                    <td><span className="app-table__name">{application.software_full_name || "未命名申请"}</span><span className="app-table__subtext">{application.software_short_name || "未填写简称"}</span></td>
                    <td><StatusBadge status={getApplicationStatus(application)} /></td>
                    <td><div className="app-table-progress"><span className="app-progress-track"><span style={{ width: `${itemProgress.percent}%` }} /></span><small>{itemProgress.percent}%</small></div></td>
                    <td>{formatDateTime(application.updated_at)}</td>
                    <td><div className="app-table__actions"><Link href={`/app/applications/${application.id}`}>编辑</Link><Link href={`/app/generate/${application.id}`}>生成</Link></div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="app-table-panel app-section-gap">
        <div className="app-panel__header"><div><h2 className="app-panel__title">最近生成</h2><p className="app-panel__description">最近生成的材料可从生成记录中再次下载。</p></div><Link href="/app/history" className="app-inline-link">打开生成记录 <ArrowRight size={14} /></Link></div>
        {records.length === 0 ? <p className="app-panel__empty-line">暂无生成记录。</p> : <div className="app-table-wrap"><table className="app-table"><thead><tr><th>申请名称</th><th>模型</th><th>状态</th><th>生成时间</th><th /></tr></thead><tbody>{records.slice(0, 5).map((record) => <tr key={record.id}><td><span className="app-table__name">{record.file_name || "未命名申请"}</span></td><td>{record.provider && record.model ? `${record.provider} / ${record.model}` : "—"}</td><td><StatusBadge status={record.status || "complete"} /></td><td>{formatDateTime(record.created_at)}</td><td><Link className="app-inline-link" href="/app/history">查看 <ArrowRight size={14} /></Link></td></tr>)}</tbody></table></div>}
      </Panel>
    </AppShell>
  );
}
