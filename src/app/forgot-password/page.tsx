"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

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
    <main className="flex min-h-screen items-center justify-center bg-[#030014] px-4 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white/[0.05]">
        <CardHeader><CardTitle>找回密码</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="email">注册邮箱</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            {message && <p className="text-sm text-emerald-300">{message}</p>}
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button className="w-full">发送重置邮件</Button>
          </form>
          <div className="mt-4 text-sm text-white/60"><Link className="hover:text-white" href="/login">返回登录</Link></div>
        </CardContent>
      </Card>
    </main>
  );
}
