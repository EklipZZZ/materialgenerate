"use client";

import Link from "next/link";
import { ArrowLeft, ContactRound, KeyRound } from "lucide-react";
import { AppShell, PageHeader, Panel } from "@/components/app-shell";
import { FilingProfilePanel } from "@/components/filing-profile-panel";

export default function FilingProfilePage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="设置 / 官网填报资料"
        title="设置"
        description="维护自动填报时使用的默认申请人联系资料。"
      >
        <Link className="app-back-link" href="/app"><ArrowLeft size={14} />返回总览</Link>
      </PageHeader>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置导航">
          <Link className="settings-nav__item" href="/settings/llm-keys"><KeyRound size={14} />AI 配置</Link>
          <Link className="settings-nav__item settings-nav__item--active" href="/settings/filing-profile"><ContactRound size={14} />官网填报资料</Link>
        </nav>
        <Panel>
          <FilingProfilePanel />
        </Panel>
      </div>
    </AppShell>
  );
}
