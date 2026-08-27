"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ByokPanel } from "@/components/byok-panel";
import { useAuth } from "@/components/auth-provider";
import type { ByokConfig } from "@/lib/byok";
import { BrandLogo, VisualPage } from "@/components/visual-effects";

export default function LlmKeysPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [byok, setByok] = useState<ByokConfig | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  if (loading || !user) return <VisualPage className="flex items-center justify-center text-center text-white">正在加载…</VisualPage>;

  return (
    <VisualPage className="px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
          <BrandLogo label="软著申报助手" />
          <Link href="/app" className="text-sm text-white/60 transition-colors hover:text-white">← 返回控制台</Link>
        </div>
        <div>
          <h1 className="gradient-heading mt-3 text-3xl font-bold">API Key 设置</h1>
        </div>
        <ByokPanel value={byok} onChange={setByok} />
        <p className="text-sm text-white/50">系统不会保存你的 API Key。关闭浏览器标签页或点击“清除 Key”后，当前配置将被移除。</p>
      </div>
    </VisualPage>
  );
}
