"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ByokPanel } from "@/components/byok-panel";
import { useAuth } from "@/components/auth-provider";
import type { ByokConfig } from "@/lib/byok";

export default function LlmKeysPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [byok, setByok] = useState<ByokConfig | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  if (loading || !user) return <main className="flex min-h-screen items-center justify-center bg-[#030014] text-white">正在加载…</main>;

  return (
    <main className="min-h-screen bg-[#030014] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/app" className="text-sm text-white/60 hover:text-white">← 返回控制台</Link>
          <h1 className="mt-3 text-3xl font-bold">API Key 设置</h1>
        </div>
        <ByokPanel value={byok} onChange={setByok} />
        <p className="text-sm text-white/50">系统不会保存你的 API Key。关闭浏览器标签页或点击“清除 Key”后，当前配置将被移除。</p>
      </div>
    </main>
  );
}
