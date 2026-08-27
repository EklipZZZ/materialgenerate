"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    if (password.length < 8) {
      setError("密码长度至少需要 8 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const redirectTo = window.location.origin + "/auth/callback/";
    const { data, error: signUpError } = await getSupabaseBrowserClient().auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (signUpError) setError(signUpError.message);
    else if (data.session) router.push("/app");
    else setMessage("注册成功。请查收验证邮件，完成验证后再登录。");
    setLoading(false);
  }

  return (
    <AuthShell
      title="创建账户"
      description="建立你的申报空间，集中管理软件登记材料。"
      footer={<span>已有账户？ <Link className="auth-link" href="/login">返回登录</Link></span>}
    >
      <form onSubmit={submit} className="auth-form">
        <div className="auth-field"><label htmlFor="email">邮箱</label><Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></div>
        <div className="auth-field"><label htmlFor="password">密码</label><Input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位字符" autoComplete="new-password" /></div>
        <div className="auth-field"><label htmlFor="confirm">确认密码</label><Input id="confirm" type="password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="再次输入密码" autoComplete="new-password" /></div>
        {message && <div className="auth-message">{message}</div>}
        {error && <div className="auth-error">{error}</div>}
        <Button className="auth-submit" disabled={loading}>{loading ? "提交中…" : "创建账户"}<ArrowRight size={15} /></Button>
      </form>
    </AuthShell>
  );
}
