"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/components/auth-provider";
import { ApplicationForm } from "@/components/application-form";
import {
  CopyrightQueryPanel,
  type QueryPanelGeneratePayload,
} from "@/components/copyright-query-panel";
import { API_URL, requireApiUrl } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";

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
    if (!payload.configId) {
      setError("请先保存并选择 API Key 配置");
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
      const body = new FormData();
      body.append("application_id", payload.formId);
      body.append("config_id", payload.configId);
      body.append("skip_analyze", payload.skipAnalyze ? "1" : "0");
      body.append("table_template", payload.tableTemplate);
      if (sourceCodeFile) body.append("source_code_file", sourceCodeFile);
      const response = await authorizedFetch(
        requireApiUrl(API_URL, "NEXT_PUBLIC_API_URL") + "/api/generate",
        { method: "POST", body, signal: controller.signal },
      );
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
    return <main className="flex min-h-screen items-center justify-center bg-[#030014] text-white">正在加载…</main>;
  }

  return (
    <main className="min-h-screen bg-[#030014] px-4 py-6 text-white sm:px-8">
      <nav className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-5">
        <Link href="/" className="font-semibold">软著申报助手</Link>
        <div className="flex items-center gap-2">
          <Link href="/app/history"><Button variant="ghost">生成历史</Button></Link>
          <Link href="/settings/llm-keys"><Button variant="ghost">API Key 配置</Button></Link>
          <Button variant="outline" onClick={() => void signOut().then(() => router.replace("/"))}>退出</Button>
        </div>
      </nav>
      <div className="mx-auto max-w-7xl space-y-8 py-8">
        <div>
          <h1 className="text-3xl font-bold">申报工作台</h1>
          <p className="mt-2 text-white/60">{user.email} · 先提交申请，再选择模型配置生成材料。</p>
        </div>
        <ApplicationForm onCreated={() => setRefreshToken((value) => value + 1)} />
        <CopyrightQueryPanel
          disabled={generating}
          refreshToken={refreshToken}
          onReadyToGenerate={setPayload}
        />
        <Card className="border-white/10 bg-white/[0.04]">
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
    </main>
  );
}
