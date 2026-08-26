"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) {
      setError(password.length < 8 ? "密码至少需要 8 位" : "两次输入的密码不一致");
      return;
    }
    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else router.replace("/app");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030014] px-4 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white/[0.05]">
        <CardHeader><CardTitle>设置新密码</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="password">新密码</Label><Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="confirm">确认新密码</Label><Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button className="w-full">更新密码</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
