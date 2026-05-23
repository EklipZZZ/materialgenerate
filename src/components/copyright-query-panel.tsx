"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Save,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { CopyrightFormEditor } from "@/components/copyright-form-editor";
import {
  EMPTY_COPYRIGHT_FORM,
  type CopyrightFormData,
  formToMarkdown,
} from "@/lib/copyright-form";
import { queryByCode, saveEnrichedForm } from "@/lib/softreg-api";

export interface QueryPanelGeneratePayload {
  tableTemplate: string;
  fileName: string;
  formId: string;
  skipAnalyze: boolean;
}

interface Props {
  disabled?: boolean;
  onReadyToGenerate: (payload: QueryPanelGeneratePayload) => void;
}

export function CopyrightQueryPanel({ disabled, onReadyToGenerate }: Props) {
  const [queryCode, setQueryCode] = useState("");
  const [form, setForm] = useState<CopyrightFormData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleQuery = async () => {
    const code = queryCode.trim();
    if (!code) {
      setError("请输入查询码");
      return;
    }
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const data = await queryByCode(code);
      setForm(data);
    } catch (e) {
      setForm(null);
      setError(e instanceof Error ? e.message : "查询失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form?.id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await saveEnrichedForm(form);
      setForm(updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleAiEnrich = async () => {
    if (!form) return;
    setEnriching(true);
    setError(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 补全失败");
      setForm(data.form);
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 补全失败");
    } finally {
      setEnriching(false);
    }
  };

  const handlePrepareGenerate = () => {
    if (!form?.id) {
      setError("请先查询并保存采集表");
      return;
    }
    const tableTemplate = formToMarkdown(form);
    onReadyToGenerate({
      tableTemplate,
      fileName: form.software_full_name || "软著项目",
      formId: form.id,
      skipAnalyze: form.status === "enriched" || saved,
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl card-glow space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
          <Search className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">查询码导入</h2>
          <p className="text-sm text-white/50">从小程序提交后获取的 RJ 查询码</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          className="bg-white/5 border-white/10 font-mono uppercase"
          placeholder="例如 RJ20260521123"
          value={queryCode}
          onChange={(e) => setQueryCode(e.target.value.toUpperCase())}
          disabled={disabled || loading}
        />
        <Button
          onClick={handleQuery}
          disabled={disabled || loading}
          className="shrink-0 bg-emerald-600 hover:bg-emerald-500"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="ml-2">查询</span>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-xl bg-red-500/10 border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {form && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 font-mono">
              {form.query_code}
            </Badge>
            <Badge variant="secondary" className="bg-white/10">
              {form.status === "enriched" ? "已补全" : "待补全"}
            </Badge>
            {saved && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> 已保存到后端
              </span>
            )}
          </div>

          <CopyrightFormEditor
            form={form}
            onChange={(f) => {
              setForm(f);
              setSaved(false);
            }}
            disabled={disabled || enriching}
          />

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleAiEnrich}
              disabled={disabled || enriching || saving}
              className="border-violet-500/40 text-violet-300"
            >
              {enriching ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              AI 补全
            </Button>
            <Button
              onClick={handleSave}
              disabled={disabled || saving || enriching}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              保存补全
            </Button>
            <Button
              variant="secondary"
              onClick={handlePrepareGenerate}
              disabled={disabled || enriching}
              className="bg-white/10 hover:bg-white/20"
            >
              使用此数据生成 →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export { EMPTY_COPYRIGHT_FORM };
