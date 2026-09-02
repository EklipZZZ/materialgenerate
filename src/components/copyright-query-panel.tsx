"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText, LoaderCircle, Save, Sparkles, Trash2 } from "lucide-react";
import { EmptyState, Panel, StatusBadge, formatDateTime } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CopyrightFormEditor } from "@/components/copyright-form-editor";
import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import type { ByokConfig } from "@/lib/byok";
import { formToEnrichmentDraft, recordToFormData, type CopyrightFormData, validateCopyrightForm } from "@/lib/copyright-form";
import { deleteApplication, listApplications, updateApplication, type ApplicationRecord } from "@/lib/softreg-api";

export interface QueryPanelGeneratePayload {
  formId: string;
}

interface Props {
  disabled?: boolean;
  refreshToken?: number;
  byok: ByokConfig | null;
  onReadyToGenerate: (payload: QueryPanelGeneratePayload) => void;
}

export function CopyrightQueryPanel({ disabled, refreshToken, byok, onReadyToGenerate }: Props) {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [selected, setSelected] = useState<ApplicationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const records = await listApplications();
      setApplications(records);
      setSelected((current) => {
        if (!current) return records[0] ?? null;
        return records.find((record) => record.id === current.id) ?? records[0] ?? null;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载申请失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshToken]);

  const selectedForm = useMemo<CopyrightFormData | null>(() => (selected ? { ...selected } : null), [selected]);

  async function save() {
    if (!selectedForm || !selected?.id) return;
    const validationErrors = validateCopyrightForm(selectedForm);
    if (validationErrors.length) {
      setError(validationErrors[0]);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const updated = await updateApplication(selected.id, selectedForm);
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelected(updated);
      setMessage("申请信息已保存");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存申请失败");
    } finally {
      setWorking(false);
    }
  }

  async function enrich() {
    if (!selected?.id || !selectedForm) return;
    if (!byok?.id) {
      setError("请先保存 AI 模型配置");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const response = await authorizedFetch(apiEndpoint("/api/enrich"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selected.id,
          llmConfigId: byok.id,
          draft: formToEnrichmentDraft(selectedForm),
          regenerateMainFunctions: true,
        }),
      });
      const body = await response.json().catch(() => ({})) as { data?: Record<string, unknown>; msg?: string };
      if (!response.ok || !body.data) throw new Error(body.msg || "AI 补全失败");
      const updated = recordToFormData(body.data) as ApplicationRecord;
      setSelected(updated);
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(body.msg || "AI 补全完成，请检查内容");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 补全失败");
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    if (!selected?.id || !window.confirm("确认删除这条申请？")) return;
    setWorking(true);
    setError(null);
    try {
      await deleteApplication(selected.id);
      const next = applications.filter((item) => item.id !== selected.id);
      setApplications(next);
      setSelected(next[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除申请失败");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <Panel><p className="app-panel__empty-line">正在加载申请…</p></Panel>;

  return (
    <Panel>
      <div className="app-panel__header">
        <div><h2 className="app-panel__title">申请信息</h2><p className="app-panel__description">选择申请并继续编辑，生成前请确认内容。</p></div>
      </div>
      {error && <div className="app-feedback app-feedback--error">{error}</div>}
      {message && <div className="app-feedback app-feedback--success">{message}</div>}
      {applications.length === 0 ? (
        <EmptyState icon={<FileText size={22} />} title="还没有申请" description="先创建一条申请，再继续完善登记信息。" />
      ) : (
        <div className="app-panel__body">
          <div className="query-application-list">
            {applications.map((application) => <button type="button" className={`query-application ${selected?.id === application.id ? "query-application--selected" : ""}`} key={application.id} onClick={() => setSelected(application)}><span><strong>{application.software_full_name || "未填写软件全称"}</strong><small>{formatDateTime(application.updated_at || application.created_at)}</small></span><StatusBadge status={application.status} /></button>)}
          </div>
          {selected && selectedForm && <>
            <CopyrightFormEditor form={selectedForm} onChange={(next) => setSelected({ ...selected, ...next })} disabled={disabled || working} />
            <div className="form-actions">
              <Button type="button" variant="outline" onClick={() => void enrich()} disabled={disabled || working}><Sparkles size={15} />AI 补全并生成主要功能</Button>
              <Button type="button" variant="ghost" onClick={() => void remove()} disabled={disabled || working}><Trash2 size={15} />删除</Button>
              <Button type="button" onClick={() => void save()} disabled={disabled || working}>{working ? <LoaderCircle className="app-spin" size={15} /> : <Save size={15} />}保存修改</Button>
              <Button type="button" variant="secondary" onClick={() => onReadyToGenerate({ formId: selected.id })} disabled={disabled || working}><ArrowRight size={15} />进入材料生成</Button>
            </div>
          </>}
        </div>
      )}
    </Panel>
  );
}
