"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CopyrightFormEditor } from "@/components/copyright-form-editor";
import {
  formToMarkdown,
  recordToFormData,
  type CopyrightFormData,
} from "@/lib/copyright-form";
import {
  deleteApplication,
  listApplications,
  updateApplication,
  type ApplicationRecord,
} from "@/lib/softreg-api";
import { API_URL, requireApiUrl } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { listLlmConfigs, type LlmConfig } from "@/lib/llm-api";

export interface QueryPanelGeneratePayload {
  tableTemplate: string;
  fileName: string;
  formId: string;
  skipAnalyze: boolean;
  configId: string;
}

interface Props {
  disabled?: boolean;
  refreshToken?: number;
  onReadyToGenerate: (payload: QueryPanelGeneratePayload) => void;
}

export function CopyrightQueryPanel({ disabled, refreshToken, onReadyToGenerate }: Props) {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [selected, setSelected] = useState<ApplicationRecord | null>(null);
  const [configs, setConfigs] = useState<LlmConfig[]>([]);
  const [configId, setConfigId] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [records, llmConfigs] = await Promise.all([listApplications(), listLlmConfigs()]);
      setApplications(records);
      setConfigs(llmConfigs);
      setConfigId((current) => current || llmConfigs[0]?.id || "");
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

  const selectedForm = useMemo<CopyrightFormData | null>(
    () => (selected ? { ...selected } : null),
    [selected],
  );

  async function save() {
    if (!selectedForm || !selected?.id) return;
    setWorking(true);
    setError(null);
    try {
      const updated = await updateApplication(selected.id, selectedForm);
      setApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelected(updated);
      setMessage("申请信息已保存");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setWorking(false);
    }
  }

  async function enrich() {
    if (!selected?.id) return;
    if (!configId) {
      setError("请先在 API Key 配置页保存一条模型配置");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const response = await authorizedFetch(
        requireApiUrl(API_URL, "NEXT_PUBLIC_API_URL") + "/api/enrich",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId: selected.id, configId }),
        },
      );
      const body = (await response.json()) as { data?: Record<string, unknown>; msg?: string };
      if (!response.ok || !body.data) throw new Error(body.msg || "AI 补全失败");
      const updated = recordToFormData(body.data) as ApplicationRecord;
      setSelected(updated);
      setApplications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage("AI 补全完成，请检查并保存需要调整的字段");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI 补全失败");
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    if (!selected?.id || !window.confirm("确定删除这条申请吗？")) return;
    setWorking(true);
    try {
      await deleteApplication(selected.id);
      const next = applications.filter((item) => item.id !== selected.id);
      setApplications(next);
      setSelected(next[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return <Card className="border-white/10 bg-white/[0.04] text-white"><CardContent className="p-6">正在加载你的申请…</CardContent></Card>;
  }

  return (
    <Card className="border-white/10 bg-white/[0.04] text-white">
      <CardHeader>
        <CardTitle>我的申请</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {message && <Alert className="border-emerald-400/30 bg-emerald-500/10"><AlertDescription>{message}</AlertDescription></Alert>}
        {applications.length === 0 ? (
          <p className="text-white/60">还没有申请记录，请先提交申请信息。</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {applications.map((application) => (
                <button
                  type="button"
                  key={application.id}
                  onClick={() => setSelected(application)}
                  className={"rounded-lg border p-3 text-left transition " + (
                    selected?.id === application.id
                      ? "border-violet-400 bg-violet-500/15"
                      : "border-white/10 bg-black/10 hover:border-white/30"
                  )}
                >
                  <div className="font-medium">{application.software_full_name || "未命名申请"}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
                    <Badge variant="outline">{application.status || "draft"}</Badge>
                    {application.created_at ? new Date(application.created_at).toLocaleString() : ""}
                  </div>
                </button>
              ))}
            </div>
            {selected && selectedForm && (
              <>
                <CopyrightFormEditor
                  form={selectedForm}
                  onChange={(next) => setSelected({ ...selected, ...next })}
                  disabled={disabled || working}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={save} disabled={disabled || working}>保存修改</Button>
                  <Button variant="outline" onClick={enrich} disabled={disabled || working}>AI 智能补全</Button>
                  <Button variant="destructive" onClick={remove} disabled={disabled || working}>删除申请</Button>
                  <select
                    className="h-10 rounded-md border border-white/20 bg-black/30 px-3 text-sm"
                    value={configId}
                    onChange={(event) => setConfigId(event.target.value)}
                    disabled={working}
                    aria-label="模型配置"
                  >
                    <option value="">选择模型配置</option>
                    {configs.map((config) => (
                      <option value={config.id} key={config.id}>
                        {config.name} · {config.provider}/{config.model}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => onReadyToGenerate({
                      tableTemplate: formToMarkdown(selectedForm),
                      fileName: selectedForm.software_short_name || selectedForm.software_full_name || "software-copyright",
                      formId: selected.id,
                      skipAnalyze: true,
                      configId,
                    })}
                    disabled={disabled || working}
                  >
                    进入材料生成
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
