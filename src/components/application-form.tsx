"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      setMessage("申请已保存。你可以继续补充信息，或进入材料生成流程。");
      setForm(EMPTY_COPYRIGHT_FORM);
      onCreated?.(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存申请失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="application-form">
      <CopyrightFormEditor form={form} onChange={setForm} disabled={saving} />

      {message && <div className="app-feedback app-feedback--success">{message}</div>}
      {error && <div className="app-feedback app-feedback--error">{error}</div>}

      <div className="form-actions">
        <Button type="button" onClick={() => void submit()} disabled={saving}>
          {saving ? "保存中…" : "保存申请信息"}
        </Button>
      </div>
    </div>
  );
}
