"use client";

import { useState } from "react";
import { Check, FileArchive, LoaderCircle, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { uploadSourceFile } from "@/lib/source-upload";
import type { CopyrightFormData } from "@/lib/copyright-form";
import type { SourceFeedbackResponse, SourceFeedbackSuggestion } from "@/lib/source-feedback";

interface Props {
  applicationId: string;
  llmConfigId?: string;
  disabled?: boolean;
  onApply: (patch: Partial<CopyrightFormData>) => void;
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

export function SourceFeedbackPanel({ applicationId, llmConfigId, disabled, onApply }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SourceFeedbackResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function analyze() {
    if (!file) {
      setError("请先选择源码 ZIP、TAR.GZ 或 TGZ 压缩包");
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
      const uploaded = await uploadSourceFile(file);
      const response = await authorizedFetch(apiEndpoint("/api/source-feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          llmConfigId,
          sourceObjectKey: uploaded.path,
          sourceFileName: uploaded.fileName,
        }),
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

  function applySelected() {
    if (!result) return;
    const patch: Partial<CopyrightFormData> = {};
    for (const suggestion of result.suggestions) {
      if (!selected[suggestion.field]) continue;
      Object.assign(patch, suggestionPatch(suggestion));
    }
    if (!Object.keys(patch).length) {
      setError("请至少选择一条修正建议");
      return;
    }
    onApply(patch);
    setMessage("已应用到表单草稿，请检查后点击“保存修改”");
  }

  return (
    <section className="source-feedback-panel">
      <div className="source-feedback-panel__header">
        <div>
          <h3><Sparkles size={16} />根据源码核对申请信息</h3>
          <p>请先保存当前申请，再上传源码压缩包。系统会统计源码行数并给出技术字段修正建议；建议不会自动覆盖表单，需你勾选确认。</p>
        </div>
      </div>
      {error && <div className="app-feedback app-feedback--error">{error}</div>}
      {message && <div className="app-feedback app-feedback--success">{message}</div>}
      <div className="source-feedback-panel__actions">
        <label className={`upload-zone source-feedback-upload ${file ? "upload-zone--selected" : ""}`} htmlFor="source-feedback-file">
          <FileArchive size={18} />
          <strong>{file ? file.name : "选择源码压缩包"}</strong>
          <span>{file ? `${Math.ceil(file.size / 1024 / 1024)} MB · 可重新选择` : "支持 ZIP、TAR.GZ、TGZ，最大 100 MB"}</span>
          <input
            id="source-feedback-file"
            className="sr-only"
            type="file"
            accept=".zip,.tar.gz,.tgz,application/zip,application/gzip"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            disabled={disabled || working}
          />
        </label>
        <Button type="button" variant="outline" onClick={() => void analyze()} disabled={disabled || working || !file || !llmConfigId}>
          {working ? <LoaderCircle className="app-spin" size={15} /> : <Upload size={15} />}
          {working ? "分析中…" : "上传并分析源码"}
        </Button>
      </div>

      {result && (
        <div className="source-feedback-result">
          <div className="source-feedback-result__summary">
            <span><Check size={14} />{result.sourceSummary}</span>
            <span>统计行数：{result.sourceCodeLines.toLocaleString()} 行</span>
          </div>
          {result.suggestions.length ? (
            <>
              <div className="source-feedback-suggestions">
                {result.suggestions.map((suggestion) => (
                  <label className="source-feedback-suggestion" key={suggestion.field}>
                    <input
                      type="checkbox"
                      checked={Boolean(selected[suggestion.field])}
                      onChange={(event) => setSelected((current) => ({ ...current, [suggestion.field]: event.target.checked }))}
                    />
                    <span className="source-feedback-suggestion__content">
                      <strong>{suggestion.label}</strong>
                      <span><em>{suggestion.currentValue || "未填写"}</em><b>→</b><em>{suggestion.suggestedValue}</em></span>
                      <small>{suggestion.reason}</small>
                    </span>
                  </label>
                ))}
              </div>
              <Button type="button" onClick={applySelected}>应用选中的建议</Button>
            </>
          ) : <p className="form-hint">未发现可直接应用的修正建议，请根据源码人工核对申请信息。</p>}
        </div>
      )}
    </section>
  );
}
