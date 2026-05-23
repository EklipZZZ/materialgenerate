"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 检查是否已登录
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    if (isLoggedIn === "true") {
      window.location.href = "/app";
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }
    
    setLoading(true);
    try {
      const baseUrl = window.location.origin;
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // 存储登录状态到 localStorage
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("user", JSON.stringify(data.user));
        window.location.href = "/app";
      } else {
        setError(data.error || "登录失败");
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
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
          <defs>
            <pattern id="grid-login" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-login)" />
        </svg>
        
        <div className="absolute h-[1px] rounded-full" style={{
          width: '200px',
          top: '20%',
          left: '-200px',
          background: 'linear-gradient(90deg, transparent 0%, #8b5cf6 50%, transparent 100%)',
          animation: 'flowLine 15s linear infinite',
          boxShadow: '0 0 6px #8b5cf6',
        }} />
        <div className="absolute h-[1px] rounded-full" style={{
          width: '150px',
          top: '60%',
          left: '-150px',
          background: 'linear-gradient(90deg, transparent 0%, #06b6d4 50%, transparent 100%)',
          animation: 'flowLine 12s linear infinite',
          animationDelay: '5s',
          boxShadow: '0 0 6px #06b6d4',
        }} />
        
        {[0,1,2,3,4,5,6,7].map((i) => (
          <div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              background: i % 2 === 0 ? '#8b5cf6' : '#06b6d4',
              top: `${15 + i * 10}%`,
              left: `${10 + i * 12}%`,
              animation: `float ${6 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
              boxShadow: `0 0 6px ${i % 2 === 0 ? '#8b5cf6' : '#06b6d4'}`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes flowLine {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(calc(100vw + 400px)); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 1; }
        }
      `}</style>

      {/* 登录卡片 */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-[#0a0a1a] border border-white/20 rounded-2xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-white text-center mb-2">登录账号</h1>
          <p className="text-white/60 text-center mb-8">欢迎回来</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm text-center py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>

          <p className="text-white/50 text-center mt-6">
            还没有账号？{" "}
            <Link href="/register" className="text-violet-400 font-semibold hover:text-violet-300 transition-colors">
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
