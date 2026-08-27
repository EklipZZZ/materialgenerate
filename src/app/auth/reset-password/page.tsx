"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BrandLogo, VisualPage } from "@/components/visual-effects";

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
    <VisualPage className="flex items-center justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center"><BrandLogo /></div>
        <Card className="visual-card w-full rounded-3xl border-white/20 bg-[#0a0a1a]/90 p-2 shadow-2xl">
          <CardHeader className="px-6 pb-4 pt-6 text-center">
            <CardTitle className="text-2xl font-bold text-white">设置新密码</CardTitle>
            <p className="mt-2 text-sm text-white/60">请设置一个至少 8 位的新密码</p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-white/80" htmlFor="password">新密码</Label>
                <Input className="h-12 rounded-xl" id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 8 位" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80" htmlFor="confirm">确认新密码</Label>
                <Input className="h-12 rounded-xl" id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入密码" />
              </div>
              {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
              <Button className="btn-shimmer h-12 w-full rounded-xl text-base font-semibold">更新密码</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </VisualPage>
  );
}
