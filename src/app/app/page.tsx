"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/components/auth-provider";
import { ApplicationForm } from "@/components/application-form";
import { ByokPanel } from "@/components/byok-panel";
import {
  CopyrightQueryPanel,
  type QueryPanelGeneratePayload,
} from "@/components/copyright-query-panel";
import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { uploadSourceFile } from "@/lib/source-upload";
import type { ByokConfig } from "@/lib/byok";
import { BrandLogo, VisualPage } from "@/components/visual-effects";

interface GenerationResult {
  sourceCodeDocx?: string;
  userManualDocx?: string;
  collectionFormMarkdown?: string;
  fileName?: string;
}

interface StreamEvent {
  step: string;
  message: string;
  data?: GenerationResult & { chunk?: string };
}

const steps = ["init", "analyze", "source_code", "manual", "convert", "upload"];

export default function AppPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [refreshToken, setRefreshToken] = useState(0);
  const [payload, setPayload] = useState<QueryPanelGeneratePayload | null>(null);
  const [byok, setByok] = useState<ByokConfig | null>(null);
  const [sourceCodeFile, setSourceCodeFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  async function generate() {
    if (!payload) {
      setError("请先在我的申请中选择一条申请");
      return;
    }
    if (!byok?.apiKey.trim()) {
      setError("请先输入 API Key");
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    setCurrentStep("");
    setMessage("正在启动生成服务…");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let sourceObjectKey: string | undefined;
      if (sourceCodeFile) {
        setMessage("正在上传源码压缩包…");
        sourceObjectKey = (await uploadSourceFile(sourceCodeFile)).path;
      }
      const response = await authorizedFetch(apiEndpoint("/api/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: payload.formId,
          provider: byok.provider,
          model: byok.model,
          apiKey: byok.apiKey,
          tableTemplate: payload.tableTemplate,
          skipAnalyze: payload.skipAnalyze,
          sourceObjectKey,
          sourceFileName: sourceCodeFile?.name,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(bodyText || "生成请求失败");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("生成服务没有返回进度流");
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: GenerationResult | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent;
            setCurrentStep(event.step);
            setMessage(event.message);
            if (event.step === "error") throw new Error(event.message);
            if (event.step === "complete" && event.data) finalResult = event.data;
          } catch (cause) {
            if (cause instanceof Error && cause.message !== "Unexpected end of JSON input") throw cause;
          }
        }
      }
      setResult(finalResult);
      if (!finalResult) setError("生成服务未返回文件结果");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") setError("已取消生成");
      else setError(cause instanceof Error ? cause.message : "生成失败");
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  if (loading || !user) {
    return <VisualPage className="flex items-center justify-center text-center text-white">正在加载…</VisualPage>;
  }

  return (
    <VisualPage className="px-4 py-6 text-white sm:px-8">
      <nav className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-5">
        <BrandLogo label="软著申报助手" />
        <div className="flex items-center gap-2">
          <Link href="/app/history"><Button variant="ghost" className="text-white/75">生成历史</Button></Link>
          <Link href="/settings/llm-keys"><Button variant="ghost" className="text-white/75">API Key 配置</Button></Link>
          <Button variant="outline" className="rounded-xl" onClick={() => void signOut().then(() => router.replace("/"))}>退出</Button>
        </div>
      </nav>
      <div className="mx-auto max-w-7xl space-y-8 py-8">
        <div>
          <h1 className="gradient-heading text-3xl font-bold">申报工作台</h1>
          <p className="mt-2 text-white/60">{user.email} · 先提交申请，再输入临时 API Key 生成材料。</p>
        </div>
        <ApplicationForm onCreated={() => setRefreshToken((value) => value + 1)} />
        <ByokPanel value={byok} onChange={setByok} />
        <CopyrightQueryPanel
          disabled={generating}
          refreshToken={refreshToken}
          byok={byok}
          onReadyToGenerate={setPayload}
        />
        <Card className="glass-panel card-glow">
          <CardHeader><CardTitle>AI 文档生成</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="rounded-md border border-dashed border-white/30 px-4 py-3 text-sm text-white/70">
                <span>{sourceCodeFile ? sourceCodeFile.name : "上传源码压缩包（可选）"}</span>
                <input
                  className="hidden"
                  type="file"
                  accept=".zip,.tar.gz,.tgz"
                  onChange={(event) => setSourceCodeFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <Button onClick={generate} disabled={generating || !payload}>
                {generating ? "生成中…" : "生成申报材料"}
              </Button>
              {generating && <Button variant="outline" onClick={() => abortRef.current?.abort()}>取消</Button>}
            </div>
            {payload && <p className="text-sm text-emerald-300">已选择：{payload.fileName}</p>}
            {currentStep && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 text-xs text-white/60">
                  {steps.map((step) => <span key={step} className={step === currentStep ? "text-violet-300" : ""}>{step}</span>)}
                </div>
                <p className="text-sm text-white/70">{message}</p>
              </div>
            )}
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            {result && (
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["sourceCodeDocx", "源码文档"],
                  ["userManualDocx", "用户手册"],
                  ["collectionFormMarkdown", "采集表 Markdown"],
                ].map(([key, label]) => result[key as keyof GenerationResult] && (
                  <a
                    key={key}
                    className="rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200 hover:bg-emerald-500/20"
                    href={result[key as keyof GenerationResult]}
                    target="_blank"
                    rel="noreferrer"
                  >
                    下载{label}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </VisualPage>
  );
}
