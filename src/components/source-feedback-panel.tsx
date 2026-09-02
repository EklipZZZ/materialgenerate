"use client";

import { useEffect, useState } from "react";
import { Check, FileArchive, LoaderCircle, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import {
  deleteSavedSourceArchive,
  getSavedSourceArchive,
  uploadSavedSourceArchive,
  type SavedSourceArchive,
} from "@/lib/source-upload";
import type { CopyrightFormData } from "@/lib/copyright-form";
import type { SourceFeedbackResponse, SourceFeedbackSuggestion } from "@/lib/source-feedback";

interface Props {
  applicationId: string;
  llmConfigId?: string;
  applicationUpdatedAt?: string;
  applicationSaved: boolean;
  disabled?: boolean;
  onSaveReview: (
    patch: Partial<CopyrightFormData>,
    decision: "confirmed" | "skipped",
    sourceUpdatedAt: string,
  ) => Promise<void>;
}

interface ApiEnvelope {
  data?: SourceFeedbackResponse;
  msg?: string;
}

function suggestionPatch(suggestion: SourceFeedbackSuggestion): Partial<CopyrightFormData> {
  if (suggestion.field === "source_code_lines") {
    return { source_code_lines: Number.parseInt(suggestion.suggestedValue, 10) || 0 };
  }
  return { [suggestion.field]: suggestion.suggestedValue } as Partial<CopyrightFormData>;
}

function reviewIsCurrent(archive: SavedSourceArchive | null, applicationUpdatedAt?: string): boolean {
  return Boolean(archive
    && archive.reviewStatus !== "pending"
    && archive.reviewedApplicationUpdatedAt === applicationUpdatedAt
    && archive.reviewedSourceUpdatedAt === archive.updatedAt);
}

function reviewLabel(archive: SavedSourceArchive | null, applicationUpdatedAt?: string): string {
  if (!archive) return "未上传源码";
  if (!reviewIsCurrent(archive, applicationUpdatedAt)) return "待核对";
  return archive.reviewStatus === "skipped" ? "已跳过核对" : "已确认";
}

export function SourceFeedbackPanel({
  applicationId,
  llmConfigId,
  applicationUpdatedAt,
  applicationSaved,
  disabled,
  onSaveReview,
}: Props) {
  const [archive, setArchive] = useState<SavedSourceArchive | null>(null);
  const [result, setResult] = useState<SourceFeedbackResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState(false);
  const [loadingArchive, setLoadingArchive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSavedSourceArchive(applicationId)
      .then((current) => {
        if (active) setArchive(current);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "获取源码压缩包失败");
      })
      .finally(() => {
        if (active) setLoadingArchive(false);
      });
    return () => {
      active = false;
    };
  }, [applicationId]);

  async function upload(file: File | null) {
    if (!file) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const next = await uploadSavedSourceArchive(applicationId, file);
      setArchive(next);
      setResult(null);
      setSelected({});
      setMessage("源码压缩包已保存，状态已重置为待核对。请先保存申请信息，再开始源码反馈。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "源码压缩包上传失败");
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    if (!archive || !window.confirm(`确认删除“${archive.fileName}”？删除后材料生成页将不再使用这份源码。`)) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      await deleteSavedSourceArchive(applicationId);
      setArchive(null);
      setResult(null);
      setSelected({});
      setMessage("源码压缩包已删除；之后可直接根据申请信息生成材料。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "源码压缩包删除失败");
    } finally {
      setWorking(false);
    }
  }

  async function analyze() {
    if (!archive) {
      setError("请先选择源码 ZIP、TAR.GZ 或 TGZ 压缩包");
      return;
    }
    if (!applicationSaved) {
      setError("请先点击页面底部“保存修改”，再进行源码核对");
      return;
    }
    if (!llmConfigId) {
      setError("请先在设置中保存 AI 模型配置");
      return;
    }
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const response = await authorizedFetch(apiEndpoint("/api/source-feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, llmConfigId }),
      });
      const body = await response.json().catch(() => ({})) as ApiEnvelope;
      if (!response.ok || !body.data) throw new Error(body.msg || "源码反馈失败");
      setResult(body.data);
      setSelected(Object.fromEntries(body.data.suggestions.map((suggestion) => [suggestion.field, true])));
      setMessage(body.msg || "源码反馈已生成，请确认建议");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "源码反馈失败");
    } finally {
      setWorking(false);
    }
  }

  async function saveReview(decision: "confirmed" | "skipped", patch: Partial<CopyrightFormData> = {}) {
    if (!archive) {
      setError("请先上传源码压缩包");
      return;
    }
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      await onSaveReview(patch, decision, archive.updatedAt);
      const refreshed = await getSavedSourceArchive(applicationId);
      setArchive(refreshed);
      setMessage(decision === "skipped" ? "已跳过源码核对，材料生成时会使用这份已保存源码。" : "源码核对已确认，申请信息和源码版本已锁定。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存源码核对状态失败");
    } finally {
      setWorking(false);
    }
  }

  function applySelected() {
    if (!result) return;
    const patch: Partial<CopyrightFormData> = {};
    for (const suggestion of result.suggestions) {
      if (selected[suggestion.field]) Object.assign(patch, suggestionPatch(suggestion));
    }
    if (!Object.keys(patch).length) {
      setError("请至少选择一条修正建议；如果不想应用建议，可确认无修改或跳过核对");
      return;
    }
    void saveReview("confirmed", patch);
  }

  return (
    <section className="source-feedback-panel">
      <div className="source-feedback-panel__header">
        <div>
          <h3><Sparkles size={16} />源码上传与申请信息核对</h3>
          <p>源码压缩包只在申请页上传和维护。反馈结果只展示差异；勾选建议后会与当前申请一起保存，不会在材料生成期间改写表单。</p>
        </div>
        {archive && <span className={`app-inline-meta ${reviewIsCurrent(archive, applicationUpdatedAt) ? "app-inline-meta--success" : ""}`}>{reviewLabel(archive, applicationUpdatedAt)}</span>}
      </div>
      {error && <div className="app-feedback app-feedback--error">{error}</div>}
      {message && <div className="app-feedback app-feedback--success">{message}</div>}
      {loadingArchive ? <p className="app-panel__empty-line">正在读取源码状态…</p> : (
        <>
          <div className="source-feedback-panel__actions">
            <label className={`upload-zone source-feedback-upload ${archive ? "upload-zone--selected" : ""}`} htmlFor="source-feedback-file">
              <FileArchive size={18} />
              <strong>{archive?.fileName || "选择源码压缩包"}</strong>
              <span>{archive
                ? `${Math.ceil(archive.size / 1024 / 1024)} MB · ${reviewLabel(archive, applicationUpdatedAt)}`
                : "支持 ZIP、TAR.GZ、TGZ，最大 100 MB"}</span>
              <input
                id="source-feedback-file"
                className="sr-only"
                type="file"
                accept=".zip,.tar.gz,.tgz,application/zip,application/gzip"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  event.currentTarget.value = "";
                  void upload(file);
                }}
                disabled={disabled || working}
              />
            </label>
            {archive && <Button type="button" size="sm" variant="ghost" onClick={() => void remove()} disabled={disabled || working}><Trash2 size={14} />删除源码</Button>}
            <Button type="button" variant="outline" onClick={() => void analyze()} disabled={disabled || working || !archive || !applicationSaved || !llmConfigId}>
              {working ? <LoaderCircle className="app-spin" size={15} /> : <Upload size={15} />}
              {working ? "处理中…" : "开始源码反馈"}
            </Button>
          </div>
          {!applicationSaved && <p className="form-hint form-hint--error">当前申请有未保存修改。请先保存，服务端才会用最新已保存版本分析源码。</p>}
          {archive && (
            <div className="source-feedback-review-actions">
              {result?.suggestions.length ? <Button type="button" onClick={applySelected} disabled={disabled || working}>应用选中的建议并保存申请</Button> : result ? <Button type="button" onClick={() => void saveReview("confirmed")} disabled={disabled || working}><Check size={15} />确认无修改并保存核对</Button> : null}
              <Button type="button" variant="ghost" onClick={() => void saveReview("skipped")} disabled={disabled || working}>跳过源码核对并直接生成</Button>
            </div>
          )}
        </>
      )}

      {result && (
        <div className="source-feedback-result">
          <div className="source-feedback-result__summary">
            <span><Check size={14} />{result.sourceSummary}</span>
            <span>统计行数：{result.sourceCodeLines.toLocaleString()} 行</span>
          </div>
          {result.suggestions.length ? (
            <div className="source-feedback-suggestions">
              {result.suggestions.map((suggestion) => (
                <label className="source-feedback-suggestion" key={suggestion.field}>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[suggestion.field])}
                    onChange={(event) => setSelected((current) => ({ ...current, [suggestion.field]: event.target.checked }))}
                    disabled={disabled || working}
                  />
                  <span className="source-feedback-suggestion__content">
                    <strong>{suggestion.label}</strong>
                    <span><em>{suggestion.currentValue || "未填写"}</em><b>→</b><em>{suggestion.suggestedValue}</em></span>
                    <small>{suggestion.reason}</small>
                  </span>
                </label>
              ))}
            </div>
          ) : <p className="form-hint">未发现可直接应用的修正建议，可以确认无修改，或根据源码人工核对申请信息。</p>}
        </div>
      )}
    </section>
  );
}
