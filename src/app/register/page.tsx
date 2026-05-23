"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // 检查是否已登录
    fetch(`${window.location.origin}/api/auth/me`)
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          router.push("/app");
        }
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password || !confirmPassword) {
      setError("请填写所有必填项");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (password.length < 8) {
      setError("密码至少8位");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${window.location.origin}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, confirmPassword }),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/login?registered=true");
      } else {
        setError(data.error || "注册失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center p-4 relative overflow-hidden">
      {/* 简化背景特效 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* 细网格 */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
          <defs>
            <pattern id="grid-reg" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-reg)" />
        </svg>
        
        {/* 减少线条 - 只有2条 */}
        <div className="absolute h-[1px] rounded-full" style={{
          width: '180px',
          top: '30%',
          left: '-180px',
          background: 'linear-gradient(90deg, transparent 0%, #8b5cf6 50%, transparent 100%)',
          animation: 'flowLine 14s linear infinite',
          animationDelay: '2s',
          boxShadow: '0 0 6px #8b5cf6',
        }} />
        <div className="absolute h-[1px] rounded-full" style={{
          width: '160px',
          top: '70%',
          left: '-160px',
          background: 'linear-gradient(90deg, transparent 0%, #06b6d4 50%, transparent 100%)',
          animation: 'flowLine 13s linear infinite',
          animationDelay: '7s',
          boxShadow: '0 0 6px #06b6d4',
        }} />
        
        {/* 减少粒子 - 只有8个 */}
        {[0,1,2,3,4,5,6,7].map((i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              background: i % 2 === 0 ? '#8b5cf6' : '#06b6d4',
              top: `${20 + i * 8}%`,
              left: `${5 + i * 13}%`,
              animation: `float ${5 + i % 3}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
              boxShadow: `0 0 4px ${i % 2 === 0 ? '#8b5cf6' : '#06b6d4'}`,
            }}
          />
        ))}
      </div>

      <style jsx global>{`
        @keyframes flowLine {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(calc(100vw + 350px)); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { transform: translateY(-15px) scale(1.2); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .btn-shimmer {
          background: linear-gradient(90deg, #8b5cf6, #06b6d4, #8b5cf6);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">智笔乾坤</span>
          </Link>
        </div>

        {/* 表单 */}
        <div className="bg-[#0a0a1a] border border-white/20 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-center mb-2 text-white">
            创建账号
          </h2>
          <p className="text-white/60 text-center mb-8">开启您的软著文档创作之旅</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                placeholder="2-20位字母或数字"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                placeholder="8位以上"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">确认密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-5 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                placeholder="再次输入密码"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center py-2 bg-red-500/10 rounded-lg border border-red-500/30">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-shimmer w-full py-4 rounded-xl text-white font-semibold text-lg shadow-lg shadow-violet-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-violet-500/50 hover:scale-[1.02]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  注册中...
                </span>
              ) : "立即注册"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-white/70">
              已有账号？{" "}
              <Link href="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
                立即登录
              </Link>
            </p>
          </div>
        </div>

        {/* 返回首页 */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-white/50 hover:text-white/80 text-sm transition-colors inline-flex items-center gap-1">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
