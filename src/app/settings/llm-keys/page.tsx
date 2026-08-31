"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, LockKeyhole } from "lucide-react";
import { AppShell, PageHeader, Panel } from "@/components/app-shell";
import { ByokPanel } from "@/components/byok-panel";
import type { ByokConfig } from "@/lib/byok";

export default function LlmKeysPage() {
  const [byok, setByok] = useState<ByokConfig | null>(null);

  return (
    <AppShell>
      <PageHeader
        eyebrow="设置 / AI 配置"
        title="设置"
        description="管理已加密保存的 AI 服务配置和数据安全选项。"
      >
        <Link className="app-back-link" href="/app"><ArrowLeft size={14} />返回总览</Link>
      </PageHeader>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置导航">
          <span className="settings-nav__item settings-nav__item--active"><KeyRound size={14} />AI 配置</span>
          <div className="settings-nav__note"><LockKeyhole size={14} /><span>API Key 使用服务端加密保存，页面不会展示完整凭据。</span></div>
        </nav>
        <Panel>
          <ByokPanel value={byok} onChange={setByok} />
        </Panel>
      </div>
    </AppShell>
  );
}
