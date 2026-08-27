"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { loadByok, providerModels, saveByok, type ByokConfig, type Provider } from "@/lib/byok";

interface Props {
  value: ByokConfig | null;
  onChange: (value: ByokConfig | null) => void;
}

export function ByokPanel({ value, onChange }: Props) {
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadByok();
    if (stored && !value) onChange(stored);
    // The parent owns the state; this runs only when the page first mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(next: Partial<ByokConfig>) {
    const nextValue: ByokConfig = {
      provider: next.provider || value?.provider || "openai",
      model: next.model || value?.model || providerModels.openai[0],
      apiKey: next.apiKey ?? value?.apiKey ?? "",
    };
    saveByok(nextValue);
    onChange(nextValue);
    setMessage(null);
    setError(null);
  }

  function changeProvider(provider: Provider) {
    update({ provider, model: providerModels[provider][0] });
  }

  async function test() {
    if (!value?.apiKey.trim()) {
      setError("请先输入 API Key");
      return;
    }
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await authorizedFetch(apiEndpoint("/api/llm-test"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const body = await response.json().catch(() => ({})) as { msg?: string };
      if (!response.ok) throw new Error(body.msg || "模型连接测试失败");
      setMessage("模型连接正常。API Key 只保存在当前浏览器标签页中。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "模型连接测试失败");
    } finally {
      setTesting(false);
    }
  }

  const provider = value?.provider || "openai";
  const model = value?.model || providerModels[provider][0];

  return (
    <Card className="border-white/10 bg-white/[0.04] text-white">
      <CardHeader><CardTitle>临时 API Key</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-white/60">Key 只在当前浏览器标签页中暂存，调用 AI 时通过 HTTPS 发送，不会保存到系统数据库。</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="byok-provider">提供商</Label><select id="byok-provider" className="h-10 w-full rounded-md border border-white/20 bg-black/30 px-3" value={provider} onChange={(event) => changeProvider(event.target.value as Provider)}><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option></select></div>
          <div className="space-y-2"><Label htmlFor="byok-model">模型</Label><select id="byok-model" className="h-10 w-full rounded-md border border-white/20 bg-black/30 px-3" value={model} onChange={(event) => update({ model: event.target.value })}>{providerModels[provider].map((item) => <option value={item} key={item}>{item}</option>)}</select></div>
          <div className="space-y-2 sm:col-span-1"><Label htmlFor="byok-key">API Key</Label><Input id="byok-key" type="password" autoComplete="off" value={value?.apiKey || ""} onChange={(event) => update({ apiKey: event.target.value })} placeholder="输入你的 API Key" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={() => void test()} disabled={testing}>{testing ? "测试中…" : "测试连接"}</Button><Button type="button" variant="ghost" onClick={() => { saveByok(null); onChange(null); setMessage("已清除当前标签页中的 API Key"); setError(null); }}>清除 Key</Button></div>
        {message && <Alert className="border-emerald-400/30 bg-emerald-500/10"><AlertDescription>{message}</AlertDescription></Alert>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      </CardContent>
    </Card>
  );
}
