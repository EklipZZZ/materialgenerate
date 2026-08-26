"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CopyrightFormEditor } from "@/components/copyright-form-editor";
import {
  EMPTY_COPYRIGHT_FORM,
  type CopyrightFormData,
} from "@/lib/copyright-form";
import { createApplication, type ApplicationRecord } from "@/lib/softreg-api";

interface Props {
  onCreated?: (application: ApplicationRecord) => void;
}

export function ApplicationForm({ onCreated }: Props) {
  const [form, setForm] = useState<CopyrightFormData>(EMPTY_COPYRIGHT_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!form.software_full_name.trim()) {
      setError("请先填写软件全称");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await createApplication(form);
      setMessage("申请已保存，可以在下方选择它进行 AI 补全或生成材料。");
      setForm(EMPTY_COPYRIGHT_FORM);
      onCreated?.(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存申请失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-white/10 bg-white/[0.04] text-white">
      <CardHeader>
        <CardTitle>提交申请信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <CopyrightFormEditor form={form} onChange={setForm} disabled={saving} />
        {message && (
          <Alert className="border-emerald-400/30 bg-emerald-500/10">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button onClick={submit} disabled={saving}>
          {saving ? "保存中…" : "保存申请信息"}
        </Button>
      </CardContent>
    </Card>
  );
}
