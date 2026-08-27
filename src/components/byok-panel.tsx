"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    // The settings page owns the current value; this only hydrates it once.
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
      setError("请输入 API Key");
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
      setMessage("模型连接成功。API Key 只保存在当前浏览器 Tab 的 sessionStorage 中。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "模型连接测试失败");
    } finally {
      setTesting(false);
    }
  }

  function clear() {
    saveByok(null);
    onChange(null);
    setMessage("已清除当前 Tab 中保存的 API Key");
    setError(null);
  }

  const provider = value?.provider || "openai";
  const model = value?.model || providerModels[provider][0];

  return (
    <div className="settings-card">
      <div className="settings-card__header">
        <div className="settings-card__title-row">
          <span className="settings-card__icon"><KeyRound size={16} /></span>
          <div><h2>临时 API Key</h2><p>用于 AI 补全和申报材料生成。</p></div>
        </div>
        {value?.apiKey && <span className="settings-card__configured"><CheckCircle2 size={14} />已配置</span>}
      </div>

      <div className="settings-card__notice">
        <ShieldCheck size={15} />
        <span>Key 只保存在当前浏览器 Tab 的 sessionStorage 中。调用 AI 时通过 HTTPS 发送，不会写入系统数据库。</span>
      </div>

      <div className="settings-fields">
        <div className="form-field">
          <label className="form-label" htmlFor="byok-provider">服务商</label>
          <select id="byok-provider" className="app-select" value={provider} onChange={(event) => changeProvider(event.target.value as Provider)}>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="byok-model">模型</label>
          <select id="byok-model" className="app-select" value={model} onChange={(event) => update({ model: event.target.value })}>
            {providerModels[provider].map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="byok-key">API Key</label>
          <Input id="byok-key" type="password" autoComplete="off" value={value?.apiKey || ""} onChange={(event) => update({ apiKey: event.target.value })} placeholder="粘贴你的 API Key" />
        </div>
      </div>

      <div className="settings-actions">
        <Button type="button" variant="outline" onClick={() => void test()} disabled={testing || !value?.apiKey.trim()}>
          {testing ? <LoaderCircle className="app-spin" size={15} /> : <CheckCircle2 size={15} />}
          {testing ? "测试中…" : "测试连接"}
        </Button>
        <Button type="button" variant="ghost" onClick={clear} disabled={!value?.apiKey}>
          <RotateCcw size={15} />清除 Key
        </Button>
      </div>

      {message && <div className="app-feedback app-feedback--success">{message}</div>}
      {error && <div className="app-feedback app-feedback--error">{error}</div>}
    </div>
  );
}
