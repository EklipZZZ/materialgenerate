"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const features = [
    {
      icon: (
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
          <defs>
            <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="url(#g1)" />
          <polyline points="14 2 14 8 20 8" stroke="url(#g1)" />
          <line x1="16" y1="13" x2="8" y2="13" stroke="url(#g1)" />
          <line x1="16" y1="17" x2="8" y2="17" stroke="url(#g1)" />
        </svg>
      ),
      title: "智能采集表分析",
      desc: "上传 Markdown 采集表，系统自动解析项目信息"
    },
    {
      icon: (
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
          <defs>
            <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <polyline points="16 18 22 12 16 6" stroke="url(#g2)" />
          <polyline points="8 6 2 12 8 18" stroke="url(#g2)" />
          <line x1="12" y1="2" x2="12" y2="22" stroke="url(#g2)" />
        </svg>
      ),
      title: "标准化代码生成",
      desc: "生成符合软著规范的源代码文档"
    },
    {
      icon: (
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
          <defs>
            <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="url(#g3)" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="url(#g3)" />
          <line x1="8" y1="7" x2="16" y2="7" stroke="url(#g3)" />
          <line x1="8" y1="11" x2="14" y2="11" stroke="url(#g3)" />
        </svg>
      ),
      title: "专业手册编写",
      desc: "自动生成专业用户手册，内容完整详实"
    },
    {
      icon: (
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
          <defs>
            <linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10" stroke="url(#g4)" />
          <polyline points="12 6 12 12 16 14" stroke="url(#g4)" />
        </svg>
      ),
      title: "高效快速生成",
      desc: "全程自动化处理，3-10 分钟完成"
    },
    {
      icon: (
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
          <defs>
            <linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="url(#g5)" />
          <polyline points="7 10 12 15 17 10" stroke="url(#g5)" />
          <line x1="12" y1="15" x2="12" y2="3" stroke="url(#g5)" />
        </svg>
      ),
      title: "多格式导出",
      desc: "支持 DOCX、Markdown 等格式导出"
    },
    {
      icon: (
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
          <defs>
            <linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="url(#g6)" />
          <line x1="3" y1="9" x2="21" y2="9" stroke="url(#g6)" />
          <line x1="9" y1="21" x2="9" y2="9" stroke="url(#g6)" />
        </svg>
      ),
      title: "历史记录管理",
      desc: "云端保存生成记录，随时查看复用"
    },
  ];

  return (
    <div className="min-h-screen bg-[#030014] text-white overflow-hidden relative">
      {/* 背景特效层 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* 纯黑背景 */}
        
        {/* 网格线 */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* 流彩流动线条 - 简化版 */}
        {mounted && (
          <>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="absolute h-[1px] rounded-full"
                style={{
                  width: '300px',
                  top: `${15 + i * 20}%`,
                  left: '-300px',
                  background: `linear-gradient(90deg, transparent 0%, hsl(${(i * 90 + 180) % 360}, 100%, 60%) 50%, transparent 100%)`,
                  animation: `flowLine ${18 + i * 3}s linear infinite`,
                  animationDelay: `${i * 3}s`,
                  boxShadow: `0 0 6px hsl(${(i * 90 + 180) % 360}, 100%, 60%)`,
                }}
              />
            ))}
            {[...Array(2)].map((_, i) => (
              <div
                key={`v${i}`}
                className="absolute w-[1px] rounded-full"
                style={{
                  height: '200px',
                  left: `${20 + i * 40}%`,
                  top: '-200px',
                  background: `linear-gradient(180deg, transparent 0%, hsl(${(i * 120 + 280) % 360}, 100%, 60%) 50%, transparent 100%)`,
                  animation: `flowLineV ${15 + i * 4}s linear infinite`,
                  animationDelay: `${i * 4}s`,
                  boxShadow: `0 0 6px hsl(${(i * 120 + 280) % 360}, 100%, 60%)`,
                }}
              />
            ))}
          </>
        )}

        {/* 流彩浮动粒子 - 简化版 */}
        {mounted && (
          <div className="absolute inset-0">
            {[...Array(12)].map((_, i) => (
              <div
                key={`p${i}`}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  background: i % 2 === 0 ? '#8b5cf6' : '#06b6d4',
                  top: `${10 + (i * 47) % 80}%`,
                  left: `${5 + (i * 63) % 90}%`,
                  animation: `float ${6 + (i % 3) * 2}s ease-in-out infinite`,
                  animationDelay: `${(i * 0.5) % 5}s`,
                  boxShadow: `0 0 6px ${i % 2 === 0 ? '#8b5cf6' : '#06b6d4'}`,
                }}
              />
            ))}
          </div>
        )}

        {/* 流彩连接线 - 简化版 */}
        {mounted && (
          <svg className="absolute inset-0 w-full h-full opacity-[0.08]">
            <defs>
              <linearGradient id="lineGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <path d="M 10% 30% Q 30% 25% 50% 35% T 90% 25%" fill="none" stroke="url(#lineGrad1)" strokeWidth="1" />
            <path d="M 5% 65% Q 25% 60% 45% 70% T 95% 60%" fill="none" stroke="url(#lineGrad1)" strokeWidth="1" />
          </svg>
        )}
      </div>

      {/* 动画样式 */}
      <style jsx global>{`
        @keyframes flowLine {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(calc(100vw + 600px)); opacity: 0; }
        }
        @keyframes flowLineV {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(calc(100vh + 400px)); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.5); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.5)); }
          50% { filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.8)); }
        }
        .btn-shimmer {
          background: linear-gradient(90deg, #8b5cf6, #06b6d4, #8b5cf6);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
        .btn-shimmer:hover {
          animation: shimmer 1.5s linear infinite;
        }
        .icon-glow:hover svg {
          animation: glow 1.5s ease-in-out infinite;
        }
        .card-hover {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-hover:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3), 0 0 40px rgba(6, 182, 212, 0.2);
        }
        .feature-icon {
          transition: all 0.4s ease;
        }
        .feature-card:hover .feature-icon {
          transform: scale(1.1) rotate(5deg);
        }
      `}</style>

      {/* 导航栏 */}
      <nav className={`relative z-10 flex items-center justify-between px-8 py-5 transition-all duration-1000 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30" />
            <div className="absolute inset-0 w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 animate-pulse opacity-50 blur-sm" />
            <svg className="absolute inset-0 w-11 h-11 p-2.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-white via-violet-200 to-cyan-200 bg-clip-text text-transparent tracking-wide">
            智笔乾坤
          </span>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-white/60 hidden sm:block">欢迎回来</span>
              <Button
                onClick={() => router.push("/app")}
                className="btn-shimmer text-white border-0 font-medium px-6 py-2.5 rounded-xl"
              >
                进入控制台
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 px-5">
                  登录
                </Button>
              </Link>
              <Link href="/register">
                <Button className="btn-shimmer text-white border-0 font-medium px-6 py-2.5 rounded-xl">
                  免费注册
                </Button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* 主内容 */}
      <main className="relative z-10 px-4 sm:px-8 py-12 max-w-7xl mx-auto">
        {/* Hero 区域 */}
        <div className={`text-center mb-20 transition-all duration-1000 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-white/70">软著材料智能生成平台</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-violet-200 to-white bg-clip-text text-transparent">
              软著材料
            </span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
              一键生成
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            上传采集表，系统自动生成符合规范的源代码文档与用户手册，
            <br className="hidden sm:block" />
            让软件著作权申请变得简单高效
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Button
                onClick={() => router.push("/app")}
                className="btn-shimmer text-white border-0 px-10 py-4 text-lg rounded-2xl font-medium"
              >
                立即使用
              </Button>
            ) : (
              <>
                <Link href="/register">
                  <Button className="btn-shimmer text-white border-0 px-10 py-4 text-lg rounded-2xl font-medium">
                    立即开始
                  </Button>
                </Link>
                <Link href="/login">
                  <Button className="px-10 py-4 text-lg rounded-2xl font-medium bg-white text-black transition-all duration-500 hover:bg-black hover:text-white hover:shadow-[0_0_25px_rgba(147,51,234,0.5)]">
                    已有账号登录
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 功能卡片 */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-1000 delay-400 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          {features.map((feature, index) => (
            <div
              key={index}
              className="feature-card group relative p-7 rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent border border-white/[0.1] backdrop-blur-sm card-hover"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* 卡片光效 */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="feature-icon relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mb-5 icon-glow">
                {feature.icon}
              </div>
              
              <h3 className="relative z-10 text-xl font-semibold mb-3 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                {feature.title}
              </h3>
              
              <p className="relative z-10 text-white/50 leading-relaxed">
                {feature.desc}
              </p>
              
              {/* 卡片边框光效 */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-b from-violet-500/50 via-transparent to-cyan-500/50" />
              </div>
            </div>
          ))}
        </div>

        {/* 底部 */}
        <footer className="mt-20 text-center text-white/30 text-sm">
          <p>© 2026 智笔乾坤 · 让创作更简单</p>
        </footer>
      </main>
    </div>
  );
}
