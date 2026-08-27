"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) {
      setError(password.length < 8 ? "密码长度至少需要 8 位" : "两次输入的密码不一致");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else router.replace("/app");
    setLoading(false);
  }

  return (
    <AuthShell title="设置新密码" description="请设置一个至少 8 位的新密码。">
      <form onSubmit={submit} className="auth-form">
        <div className="auth-field"><label htmlFor="password">新密码</label><Input id="password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位字符" autoComplete="new-password" /></div>
        <div className="auth-field"><label htmlFor="confirm">确认新密码</label><Input id="confirm" type="password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="再次输入新密码" autoComplete="new-password" /></div>
        {error && <div className="auth-error">{error}</div>}
        <Button className="auth-submit" disabled={loading}>{loading ? "保存中…" : "更新密码"}<ArrowRight size={15} /></Button>
      </form>
    </AuthShell>
  );
}
