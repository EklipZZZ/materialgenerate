"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

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
    const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    else router.push("/app");
    setLoading(false);
  }

  return (
    <AuthShell
      title="登录工作台"
      description="继续管理申请信息并生成软件著作权申报材料。"
      footer={<span>还没有账户？ <Link className="auth-link" href="/register">创建账户</Link></span>}
    >
      <form onSubmit={submit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="email">邮箱</label>
          <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" />
        </div>
        <div className="auth-field">
          <label htmlFor="password">密码</label>
          <Input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" autoComplete="current-password" />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <Button className="auth-submit" disabled={loading}>{loading ? "登录中…" : "登录"}<ArrowRight size={15} /></Button>
      </form>
      <div className="auth-form__row"><span /> <Link className="auth-link" href="/forgot-password">忘记密码？</Link></div>
    </AuthShell>
  );
}
