"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import {
  createLlmConfig,
  deleteLlmConfig,
  listLlmConfigs,
  testLlmConfig,
  updateLlmConfig,
  type LlmConfig,
  type Provider,
} from "@/lib/llm-api";

const models = {
  openai: ["gpt-5-mini", "gpt-5.1"],
  deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"],
} as const;

export default function LlmKeysPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [configs, setConfigs] = useState<LlmConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState<string>(models.openai[0]);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    listLlmConfigs().then(setConfigs).catch((cause) => setError(cause instanceof Error ? cause.message : "加载配置失败"));
  }, [user]);

  function changeProvider(next: Provider) {
    setProvider(next);
    setModel(models[next][0]);
  }

  function resetEditor() {
    setEditingId(null);
    setName("");
    setProvider("openai");
    setModel(models.openai[0]);
    setApiKey("");
  }

  function edit(config: LlmConfig) {
    setEditingId(config.id);
    setName(config.name);
    setProvider(config.provider);
    setModel(config.model);
    setApiKey("");
    setMessage("编辑时留空 API Key 即保留原 Key；填写则会替换原 Key。");
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = editingId
        ? await updateLlmConfig(editingId, { name, provider, model, ...(apiKey ? { apiKey } : {}) })
        : await createLlmConfig({ name, provider, model, apiKey });
      setConfigs((current) => editingId
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...current]);
      resetEditor();
      setMessage("配置已保存；服务端只返回 Key 末四位，不会返回明文 Key。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存配置失败");
    } finally {
      setSaving(false);
    }
  }

  async function test(config: LlmConfig) {
    setTestingId(config.id);
    setError(null);
    setMessage(null);
    try {
      await testLlmConfig(config.id);
      setMessage(config.name + " 连接正常。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "模型连接测试失败");
    } finally {
      setTestingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("确定删除这个模型配置吗？")) return;
    try {
      await deleteLlmConfig(id);
      setConfigs((current) => current.filter((item) => item.id !== id));
      if (editingId === id) resetEditor();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除配置失败");
    }
  }

  if (loading || !user) return <main className="flex min-h-screen items-center justify-center bg-[#030014] text-white">正在加载。</main>;

  return (
    <main className="min-h-screen bg-[#030014] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/app" className="text-sm text-white/60 hover:text-white">← 返回控制台</Link>
            <h1 className="mt-3 text-3xl font-bold">API Key 配置</h1>
          </div>
        </div>
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader><CardTitle>{editingId ? "编辑模型配置" : "新增模型配置"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="name">配置名称</Label><Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="我的 OpenAI" /></div>
              <div className="space-y-2"><Label htmlFor="provider">提供商</Label><select id="provider" className="h-10 w-full rounded-md border border-white/20 bg-black/30 px-3" value={provider} onChange={(e) => changeProvider(e.target.value as Provider)}><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option></select></div>
              <div className="space-y-2"><Label htmlFor="model">模型</Label><select id="model" className="h-10 w-full rounded-md border border-white/20 bg-black/30 px-3" value={model} onChange={(e) => setModel(e.target.value)}>{models[provider].map((item) => <option value={item} key={item}>{item}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="api-key">API Key {editingId ? "（可选）" : ""}</Label><Input id="api-key" required={!editingId} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" /></div>
              <div className="flex items-center gap-3 sm:col-span-2"><Button disabled={saving}>{saving ? "保存中…" : editingId ? "保存修改" : "保存配置"}</Button>{editingId && <Button type="button" variant="outline" onClick={resetEditor}>取消编辑</Button>}<span className="text-xs text-white/50">Key 通过 HTTPS 传输一次，由服务端 AES-256-GCM 加密保存。</span></div>
            </form>
            {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.04]">
          <CardHeader><CardTitle>已保存配置</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {configs.length === 0 ? <p className="text-white/60">暂无配置</p> : configs.map((config) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 p-3" key={config.id}>
                <div><div className="font-medium">{config.name}</div><div className="text-sm text-white/50">{config.provider} / {config.model} · ****{config.key_last4}</div></div>
                <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void test(config)} disabled={testingId === config.id}>{testingId === config.id ? "测试中…" : "测试"}</Button><Button variant="outline" size="sm" onClick={() => edit(config)}>编辑</Button><Button variant="destructive" size="sm" onClick={() => void remove(config.id)}>删除</Button></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
