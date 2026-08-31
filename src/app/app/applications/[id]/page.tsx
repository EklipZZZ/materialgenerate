"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  FileOutput,
  LoaderCircle,
  MoreHorizontal,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AppShell, PageHeader, Panel, StatusBadge } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CopyrightFormEditor } from "@/components/copyright-form-editor";
import { SourceFeedbackPanel } from "@/components/source-feedback-panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiEndpoint } from "@/lib/api-base";
import { getApplicationProgress, getApplicationStatus } from "@/lib/application-progress";
import { type ByokConfig } from "@/lib/byok";
import { authorizedFetch } from "@/lib/auth";
import { formToEnrichmentDraft, recordToFormData, type CopyrightFormData, validateCopyrightForm } from "@/lib/copyright-form";
import { loadPersistedByok } from "@/lib/llm-config-client";
import {
  deleteApplication,
  getApplication,
  updateApplication,
  type ApplicationRecord,
} from "@/lib/softreg-api";

export default function ApplicationEditPage() {
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [form, setForm] = useState<CopyrightFormData | null>(null);
  const [byok, setByok] = useState<ByokConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    let active = true;
    Promise.all([getApplication(id), loadPersistedByok()])
      .then(([record, storedByok]) => {
        if (!active) return;
        setApplication(record);
        setForm(record);
        setByok(storedByok);
        setError(null);
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
  }, [id, user]);

  async function save() {
    if (!id || !form) return;
    if (!form.software_full_name.trim()) {
      setError("请先填写软件全称");
      return;
    }
    const validationErrors = validateCopyrightForm(form);
    if (validationErrors.length) {
      setError(validationErrors[0]);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateApplication(id, form);
      setApplication(updated);
      setForm(updated);
      setMessage("申请信息已保存");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存申请失败");
    } finally {
      setSaving(false);
    }
  }

  async function enrich() {
    if (!id || !form) return;
    if (!byok?.id) {
      setError("请先在设置中保存 AI 模型配置");
      return;
    }
    setEnriching(true);
    setError(null);
    setMessage(null);
    try {
      const response = await authorizedFetch(apiEndpoint("/api/enrich"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: id,
          llmConfigId: byok.id,
          draft: formToEnrichmentDraft(form),
          regenerateMainFunctions: true,
        }),
      });
      const body = await response.json().catch(() => ({})) as { data?: Record<string, unknown>; msg?: string };
      if (!response.ok || !body.data) throw new Error(body.msg || "AI 补全失败");
      const updated = recordToFormData(body.data) as ApplicationRecord;
      setApplication(updated);
      setForm(updated);
      setMessage(body.msg || "AI 补全完成，请检查内容并保存需要保留的修改");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 补全失败");
    } finally {
      setEnriching(false);
    }
  }

  async function remove() {
    if (!id || !window.confirm("确认删除这条申请？生成记录和关联文件也会一并移除。")) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteApplication(id);
      router.replace("/app/applications");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除申请失败");
      setDeleting(false);
    }
  }

  const progress = form ? getApplicationProgress(form) : null;
  const status = application?.status === "completed" ? "complete" : form ? getApplicationStatus(form) : "draft";
  const busy = saving || enriching || deleting;

  return (
    <AppShell>
      <PageHeader
        eyebrow="我的申请 / 编辑"
        title={form?.software_full_name || (loading ? "加载申请…" : "编辑申请")}
        description={form && (form.updated_at || form.created_at) ? `最近更新于 ${new Date(form.updated_at || form.created_at || "").toLocaleString("zh-CN")}` : "维护登记信息并准备材料生成。"}
      >
        <Link className="app-back-link" href="/app/applications"><ArrowLeft size={14} />返回申请列表</Link>
        {application && <StatusBadge status={status} />}
        {application && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="更多申请操作"><MoreHorizontal size={16} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" disabled={busy} onSelect={() => void remove()}>
                <Trash2 size={14} />{deleting ? "删除中…" : "删除申请"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </PageHeader>

      {error && <div className="app-feedback app-feedback--error">{error}</div>}
      {message && <div className="app-feedback app-feedback--success">{message}</div>}

      {loading ? (
        <Panel><p className="app-panel__empty-line">正在加载申请…</p></Panel>
      ) : !form ? (
        <Panel><p className="app-panel__empty-line">未找到这条申请。</p></Panel>
      ) : (
        <div className="form-layout">
          <Panel>
            <div className="app-panel__header">
              <div>
                <h2 className="app-panel__title">登记信息</h2>
                <p className="app-panel__description">按申报表字段分组编辑，保存后才会用于下一步生成。</p>
              </div>
              <span className="app-inline-meta">完成度 {progress?.percent ?? 0}%</span>
            </div>
            <div className="app-panel__body">
              <CopyrightFormEditor
                form={form}
                onChange={setForm}
                disabled={busy}
              />
              <SourceFeedbackPanel
                applicationId={id}
                llmConfigId={byok?.id}
                disabled={busy}
                onApply={(patch) => {
                  setForm((current) => current ? { ...current, ...patch } : current);
                  setError(null);
                  setMessage("源码反馈已应用到表单草稿，请检查后保存");
                }}
              />
              <div className="form-actions form-actions--sticky">
                <Button type="button" variant="outline" onClick={() => void enrich()} disabled={busy}>
                  {enriching ? <LoaderCircle className="app-spin" size={15} /> : <Sparkles size={15} />}
                  {enriching ? "AI 生成中…" : "AI 补全并生成主要功能"}
                </Button>
                <Button type="button" onClick={() => void save()} disabled={busy}>
                  {saving ? <LoaderCircle className="app-spin" size={15} /> : <Save size={15} />}
                  {saving ? "保存中…" : "保存修改"}
                </Button>
              </div>
            </div>
          </Panel>

          <div className="app-dashboard-stack">
            <Panel className="form-side-card">
              <div className="app-panel__header app-panel__header--plain">
                <div>
                  <h2 className="app-panel__title">下一步</h2>
                  <p className="app-panel__description">完成信息后即可生成材料。</p>
                </div>
              </div>
              <div className="app-panel__body">
                <div className="app-check-list">
                  <div className={progress && progress.percent > 0 ? "app-check-list__item app-check-list__item--done" : "app-check-list__item"}>
                    <span><Check size={13} /></span><div><strong>填写登记信息</strong><small>{progress?.completed ?? 0} / {progress?.total ?? 0} 项已完成</small></div>
                  </div>
                  <div className={status === "ready" || status === "complete" ? "app-check-list__item app-check-list__item--done" : "app-check-list__item"}>
                    <span><Check size={13} /></span><div><strong>确认并保存</strong><small>检查内容后保存最新版本</small></div>
                  </div>
                  <div className="app-check-list__item">
                    <span><FileOutput size={13} /></span><div><strong>生成申报材料</strong><small>源码文档、用户手册和采集表</small></div>
                  </div>
                </div>
                <Button className="app-full-button" asChild variant="secondary">
                  <Link href={`/app/generate/${id}`}><FileOutput size={15} />进入材料生成</Link>
                </Button>
                {!byok?.id && <p className="form-hint app-side-hint">生成前需要先在设置中保存 AI 模型配置。</p>}
                {!byok?.id && <Link className="app-inline-link" href="/settings/llm-keys">前往 AI 配置设置 <ArrowLeft size={13} className="app-arrow-forward" /></Link>}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
