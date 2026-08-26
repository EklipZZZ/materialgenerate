"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) setError(signInError.message);
    else router.push("/app");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030014] px-4 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white/[0.05]">
        <CardHeader><CardTitle>登录软著申报助手</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="email">邮箱</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="password">密码</Label><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button className="w-full" disabled={loading}>{loading ? "登录中…" : "登录"}</Button>
          </form>
          <div className="mt-4 flex justify-between text-sm text-white/60">
            <Link className="hover:text-white" href="/forgot-password">忘记密码</Link>
            <Link className="hover:text-white" href="/register">注册账号</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
