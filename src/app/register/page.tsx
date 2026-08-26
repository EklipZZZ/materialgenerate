"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

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
    <main className="flex min-h-screen items-center justify-center bg-[#030014] px-4 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white/[0.05]">
        <CardHeader><CardTitle>注册账号</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="email">邮箱</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="password">密码</Label><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="confirm">确认密码</Label><Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            {message && <p className="text-sm text-emerald-300">{message}</p>}
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button className="w-full" disabled={loading}>{loading ? "提交中…" : "注册"}</Button>
          </form>
          <div className="mt-4 text-sm text-white/60"><Link className="hover:text-white" href="/login">已有账号？返回登录</Link></div>
        </CardContent>
      </Card>
    </main>
  );
}
