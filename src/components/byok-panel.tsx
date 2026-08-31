"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import {
  clearLegacyByok,
  loadByok,
  providerModels,
  saveByok,
  type ByokConfig,
  type Provider,
  type SavedLlmConfig,
} from "@/lib/byok";

interface Props {
  value: ByokConfig | null;
  onChange: (value: ByokConfig | null) => void;
}

interface ApiEnvelope<T> {
  data?: T;
  msg?: string;
}

function asSavedConfig(value: SavedLlmConfig): ByokConfig {
  return {
    id: value.id,
    name: value.name,
    provider: value.provider,
    model: value.model,
    keyLast4: value.keyLast4,
  };
}

export function ByokPanel({ value, onChange }: Props) {
  const [configs, setConfigs] = useState<SavedLlmConfig[]>([]);
  const [provider, setProvider] = useState<Provider>(value?.provider || "openai");
  const [model, setModel] = useState(value?.model || providerModels.openai[0]);
  const [name, setName] = useState(value?.name || "我的 AI 配置");
  const [apiKey, setApiKey] = useState(value?.apiKey || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const legacyOrSaved = loadByok();
      if (legacyOrSaved) {
        setProvider(legacyOrSaved.provider);
        setModel(legacyOrSaved.model);
        setApiKey(legacyOrSaved.apiKey || "");
        if (legacyOrSaved.name) setName(legacyOrSaved.name);
        if (legacyOrSaved.apiKey) setMessage("检测到旧版浏览器配置，请点击“保存配置”迁移到服务器。");
      }
      void authorizedFetch(apiEndpoint("/api/llm-configs"))
        .then(async (response) => {
          const body = await response.json().catch(() => ({})) as ApiEnvelope<SavedLlmConfig[]>;
          if (!response.ok) throw new Error(body.msg || "读取模型配置失败");
          if (!active) return;
          const list = body.data || [];
          setConfigs(list);
          if (legacyOrSaved?.apiKey) return;
          const selected = (legacyOrSaved?.id && list.find((item) => item.id === legacyOrSaved.id)) || list[0];
          if (selected) {
            setProvider(selected.provider);
            setModel(selected.model);
            setName(selected.name);
            onChange(asSavedConfig(selected));
          }
        })
        .catch((cause) => {
          if (active) setError(cause instanceof Error ? cause.message : "读取模型配置失败");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // Settings owns the selected config; this effect only hydrates it on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateDraft(next: Partial<{ provider: Provider; model: string; name: string }>) {
    const nextProvider = next.provider || provider;
    const nextModel = next.model || model;
    const nextName = next.name ?? name;
    setProvider(nextProvider);
    setModel(nextModel);
    setName(nextName);
    setMessage(null);
    setError(null);
  }

  function selectSavedConfig(id: string) {
    const selected = configs.find((item) => item.id === id);
    if (!selected) return;
    const next = asSavedConfig(selected);
    setProvider(next.provider);
    setModel(next.model);
    setName(next.name || "我的 AI 配置");
    setApiKey("");
    onChange(next);
    setMessage(null);
    setError(null);
  }

  async function saveConfig(): Promise<ByokConfig | null> {
    if (!apiKey.trim()) {
      setError("保存配置时需要重新输入 API Key；已保存配置可直接测试和生成。");
      return null;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await authorizedFetch(apiEndpoint("/api/llm-configs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: value?.id, name, provider, model, apiKey: apiKey.trim() }),
      });
      const body = await response.json().catch(() => ({})) as ApiEnvelope<SavedLlmConfig>;
      if (!response.ok || !body.data) throw new Error(body.msg || "保存模型配置失败");
      const next = asSavedConfig(body.data);
      setConfigs((current) => [body.data!, ...current.filter((item) => item.id !== next.id)]);
      setApiKey("");
      clearLegacyByok();
      saveByok(next);
      onChange(next);
      setProvider(next.provider);
      setModel(next.model);
      setName(next.name || "我的 AI 配置");
      setMessage(`配置已加密保存（${next.provider} · ${next.model} · ****${next.keyLast4}）`);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存模型配置失败");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      let target = value;
      if (!target?.id || apiKey.trim()) target = await saveConfig();
      if (!target?.id) return;
      const response = await authorizedFetch(apiEndpoint(`/api/llm-configs/${target.id}/test`), { method: "POST" });
      const body = await response.json().catch(() => ({})) as ApiEnvelope<null>;
      if (!response.ok) throw new Error(body.msg || "模型连接测试失败");
      setMessage("模型连接成功。API Key 已加密保存在服务器，浏览器只保留配置 ID 和末四位。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "模型连接测试失败");
    } finally {
      setTesting(false);
    }
  }

  async function clear() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (value?.id) {
        const response = await authorizedFetch(apiEndpoint(`/api/llm-configs/${value.id}`), { method: "DELETE" });
        const body = await response.json().catch(() => ({})) as ApiEnvelope<null>;
        if (!response.ok) throw new Error(body.msg || "删除模型配置失败");
      }
      saveByok(null);
      clearLegacyByok();
      setConfigs((current) => current.filter((item) => item.id !== value?.id));
      onChange(null);
      setApiKey("");
      setMessage("已清除当前模型配置");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除模型配置失败");
    } finally {
      setSaving(false);
    }
  }

  const configured = Boolean(value?.id);
  const selectedProvider = value?.provider || provider;
  const selectedModel = value?.model || model;

  return (
    <div className="settings-card">
      <div className="settings-card__header">
        <div className="settings-card__title-row">
          <span className="settings-card__icon"><KeyRound size={16} /></span>
          <div><h2>AI 模型配置</h2><p>用于 AI 补全和申报材料生成。</p></div>
        </div>
        {configured && <span className="settings-card__configured"><CheckCircle2 size={14} />已配置</span>}
      </div>

      <div className="settings-card__notice">
        <ShieldCheck size={15} />
        <span>API Key 使用 AES-256-GCM 加密保存到服务器。前端和查询接口只显示供应商、模型与末四位，不保存完整 Key。</span>
      </div>

      <div className="settings-fields">
        {configs.length > 1 && (
          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="byok-saved-config">已保存配置</label>
            <select id="byok-saved-config" className="app-select" value={value?.id || ""} onChange={(event) => selectSavedConfig(event.target.value)}>
              <option value="">选择配置</option>
              {configs.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.provider} · ****{item.keyLast4}</option>)}
            </select>
          </div>
        )}
        <div className="form-field">
          <label className="form-label" htmlFor="byok-name">配置名称</label>
          <Input id="byok-name" value={name} onChange={(event) => updateDraft({ name: event.target.value })} disabled={loading || saving} />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="byok-provider">服务商</label>
          <select id="byok-provider" className="app-select" value={selectedProvider} onChange={(event) => updateDraft({ provider: event.target.value as Provider, model: providerModels[event.target.value as Provider][0] })} disabled={loading || saving}>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="byok-model">模型</label>
          <select id="byok-model" className="app-select" value={selectedModel} onChange={(event) => updateDraft({ model: event.target.value })} disabled={loading || saving}>
            {providerModels[selectedProvider].map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </div>
        <div className="form-field form-field--full">
          <label className="form-label" htmlFor="byok-key">API Key</label>
          <Input id="byok-key" type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={configured ? `已保存，****${value?.keyLast4 || ""}；修改配置时重新输入` : "粘贴你的 API Key"} disabled={loading || saving} />
        </div>
      </div>

      <div className="settings-actions">
        <Button type="button" onClick={() => void saveConfig()} disabled={loading || saving || !apiKey.trim()}>
          {saving ? <LoaderCircle className="app-spin" size={15} /> : <Save size={15} />}
          {saving ? "保存中…" : "保存配置"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void test()} disabled={loading || saving || testing || (!configured && !apiKey.trim())}>
          {testing ? <LoaderCircle className="app-spin" size={15} /> : <CheckCircle2 size={15} />}
          {testing ? "测试中…" : "测试连接"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void clear()} disabled={loading || saving || testing || (!configured && !apiKey)}>
          <RotateCcw size={15} />清除配置
        </Button>
      </div>

      {message && <div className="app-feedback app-feedback--success">{message}</div>}
      {error && <div className="app-feedback app-feedback--error">{error}</div>}
    </div>
  );
}
