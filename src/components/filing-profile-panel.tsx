"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EMPTY_FILING_PROFILE,
  getFilingProfile,
  isFilingProfileComplete,
  saveFilingProfile,
} from "@/lib/filing-profile-api";
import type { FilingProfile } from "@/lib/filing-profile";

export function FilingProfilePanel() {
  const [profile, setProfile] = useState<FilingProfile>(EMPTY_FILING_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getFilingProfile()
      .then((current) => {
        if (active && current) setProfile(current);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "获取官网填报资料失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const set = (key: keyof FilingProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setError(null);
    setMessage(null);
  };

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveFilingProfile(profile);
      setProfile(saved);
      setMessage(isFilingProfileComplete(saved)
        ? "官网填报资料已保存，自动填报前置资料已齐全。"
        : "官网填报资料已暂存，自动填报前请补齐四项。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存官网填报资料失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-form">
      <div className="app-panel__header app-panel__header--plain">
        <div>
          <h2 className="app-panel__title">官网填报资料</h2>
          <p className="app-panel__description">这些资料由你本人维护，自动填报时用于官网后续弹出的申请人信息。系统不会从历史申请中猜测或迁移。</p>
        </div>
        <span className={`app-inline-meta ${isFilingProfileComplete(profile) ? "app-inline-meta--success" : ""}`}>
          {isFilingProfileComplete(profile) ? <CheckCircle2 size={14} /> : null}
          {isFilingProfileComplete(profile) ? "已配置" : "可暂存"}
        </span>
      </div>
      {error && <div className="app-feedback app-feedback--error">{error}</div>}
      {message && <div className="app-feedback app-feedback--success">{message}</div>}
      {loading ? <p className="app-panel__empty-line">正在读取官网填报资料…</p> : (
        <>
          <div className="form-grid">
            <div className="form-field form-field--full">
              <label className="form-label" htmlFor="filing-applicant-address">申请人地址</label>
              <Input id="filing-applicant-address" value={profile.applicant_address} onChange={(event) => set("applicant_address", event.target.value)} disabled={saving} placeholder="填写官网申请人通讯地址" />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="filing-postal-code">邮政编码</label>
              <Input id="filing-postal-code" value={profile.postal_code} onChange={(event) => set("postal_code", event.target.value)} disabled={saving} inputMode="numeric" placeholder="例如 100000" />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="filing-contact-name">联系人</label>
              <Input id="filing-contact-name" value={profile.contact_name} onChange={(event) => set("contact_name", event.target.value)} disabled={saving} placeholder="填写联系人姓名" />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="filing-contact-phone">联系电话</label>
              <Input id="filing-contact-phone" type="tel" value={profile.contact_phone} onChange={(event) => set("contact_phone", event.target.value)} disabled={saving} placeholder="填写官网接收联系的电话" />
            </div>
          </div>
          <p className="form-hint">允许先保存不完整资料；创建自动填报任务时，四项必须全部填写。这里不保存电子邮箱。</p>
          <div className="form-actions">
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <LoaderCircle className="app-spin" size={15} /> : <Save size={15} />}
              {saving ? "保存中…" : "保存官网填报资料"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
