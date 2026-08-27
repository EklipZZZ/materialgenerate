"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const { error: resetError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/auth/reset-password/" });
    if (resetError) setError(resetError.message);
    else setMessage("如果邮箱已注册，密码重置邮件会很快送达。");
    setLoading(false);
  }

  return (
    <AuthShell title="找回密码" description="我们会向你的注册邮箱发送密码重置链接。" footer={<Link className="auth-link" href="/login">返回登录</Link>}>
      <form onSubmit={submit} className="auth-form">
        <div className="auth-field"><label htmlFor="email">注册邮箱</label><Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></div>
        {message && <div className="auth-message">{message}</div>}
        {error && <div className="auth-error">{error}</div>}
        <Button className="auth-submit" disabled={loading}>{loading ? "发送中…" : "发送重置邮件"}<ArrowRight size={15} /></Button>
      </form>
    </AuthShell>
  );
}
