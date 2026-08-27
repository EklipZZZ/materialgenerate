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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setError("密码至少需要 8 位");
    if (password !== confirm) return setError("两次输入的密码不一致");
    setLoading(true);
    setError(null);
    const redirectTo = window.location.origin + "/auth/callback/";
    const { data, error: signUpError } = await getSupabaseBrowserClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    if (signUpError) setError(signUpError.message);
    else if (data.session) router.push("/app");
    else setMessage("注册成功，请查收验证邮件后再登录。");
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
            <CardTitle className="text-2xl font-bold text-white">创建账号</CardTitle>
            <p className="mt-2 text-sm text-white/60">开启你的软著文档创作之旅</p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-white/80" htmlFor="email">邮箱</Label>
                <Input className="h-12 rounded-xl" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80" htmlFor="password">密码</Label>
                <Input className="h-12 rounded-xl" id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 8 位" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80" htmlFor="confirm">确认密码</Label>
                <Input className="h-12 rounded-xl" id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入密码" />
              </div>
              {message && <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</p>}
              {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
              <Button className="btn-shimmer h-12 w-full rounded-xl text-base font-semibold" disabled={loading}>{loading ? "提交中…" : "立即注册"}</Button>
            </form>
            <div className="mt-6 text-center text-sm text-white/70">
              已有账号？ <Link className="font-medium text-violet-300 transition-colors hover:text-cyan-200" href="/login">立即登录</Link>
            </div>
          </CardContent>
        </Card>
        <div className="mt-6 text-center text-sm text-white/45"><Link className="transition-colors hover:text-white/80" href="/">← 返回首页</Link></div>
      </div>
    </VisualPage>
  );
}
