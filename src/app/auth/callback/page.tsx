"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("正在验证账户…");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const code = new URLSearchParams(window.location.search).get("code");
    const result = code ? supabase.auth.exchangeCodeForSession(code) : supabase.auth.getSession();
    result.then(({ data, error }) => {
      if (error || !data.session) {
        setMessage("验证链接无效或已过期，请重新登录或注册。");
        return;
      }
      router.replace("/app");
    });
  }, [router]);

  return <AuthShell title="账户验证" description="请稍候，我们正在确认你的登录状态。"><p className="auth-callback-message">{message}</p></AuthShell>;
}
