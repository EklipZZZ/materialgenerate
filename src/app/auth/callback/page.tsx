"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { VisualPage } from "@/components/visual-effects";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("正在验证邮箱…");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const code = new URLSearchParams(window.location.search).get("code");
    const result = code
      ? supabase.auth.exchangeCodeForSession(code)
      : supabase.auth.getSession();
    result.then(({ data, error }) => {
      if (error || !data.session) {
        setMessage("验证链接无效或已过期，请重新申请。");
        return;
      }
      router.replace("/app");
    });
  }, [router]);

  return <VisualPage className="flex items-center justify-center text-center text-white"><p className="relative z-10 text-white/80">{message}</p></VisualPage>;
}
