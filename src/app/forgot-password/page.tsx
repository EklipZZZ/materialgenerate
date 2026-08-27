"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BrandLogo, VisualPage } from "@/components/visual-effects";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const { error: resetError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth/reset-password/",
    });
    if (resetError) setError(resetError.message);
    else setMessage("如果该邮箱已注册，密码重置邮件会很快送达。");
  }

  return (
    <VisualPage className="flex items-center justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center"><BrandLogo /></div>
        <Card className="visual-card w-full rounded-3xl border-white/20 bg-[#0a0a1a]/90 p-2 shadow-2xl">
          <CardHeader className="px-6 pb-4 pt-6 text-center">
            <CardTitle className="text-2xl font-bold text-white">找回密码</CardTitle>
            <p className="mt-2 text-sm text-white/60">我们会向你的邮箱发送重置链接</p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-white/80" htmlFor="email">注册邮箱</Label>
                <Input className="h-12 rounded-xl" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </div>
              {message && <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{message}</p>}
              {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
              <Button className="btn-shimmer h-12 w-full rounded-xl text-base font-semibold">发送重置邮件</Button>
            </form>
            <div className="mt-6 text-sm text-white/60"><Link className="transition-colors hover:text-white" href="/login">← 返回登录</Link></div>
          </CardContent>
        </Card>
      </div>
    </VisualPage>
  );
}
