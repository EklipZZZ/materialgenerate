"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BrandLogo, VisualPage } from "@/components/visual-effects";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) setError(signInError.message);
    else router.push("/app");
    setLoading(false);
  }

  return (
    <VisualPage className="flex items-center justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <BrandLogo />
        </div>
        <Card className="visual-card w-full rounded-3xl border-white/20 bg-[#0a0a1a]/90 p-2 shadow-2xl">
          <CardHeader className="px-6 pb-4 pt-6 text-center">
            <CardTitle className="text-2xl font-bold text-white">登录软著申报助手</CardTitle>
            <p className="mt-2 text-sm text-white/60">欢迎回来，继续制作你的申报材料</p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-white/80" htmlFor="email">邮箱</Label>
                <Input className="h-12 rounded-xl" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80" htmlFor="password">密码</Label>
                <Input className="h-12 rounded-xl" id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" />
              </div>
              {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
              <Button className="btn-shimmer h-12 w-full rounded-xl text-base font-semibold" disabled={loading}>{loading ? "登录中…" : "登录"}</Button>
            </form>
            <div className="mt-6 flex justify-between text-sm text-white/60">
              <Link className="transition-colors hover:text-white" href="/forgot-password">忘记密码</Link>
              <Link className="font-medium text-violet-300 transition-colors hover:text-cyan-200" href="/register">注册账号</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </VisualPage>
  );
}
