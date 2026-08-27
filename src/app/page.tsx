"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo, VisualPage } from "@/components/visual-effects";

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
}

function FeatureIcon({ kind }: { kind: number }) {
  const gradients = [
    ["#06b6d4", "#8b5cf6", "#ec4899"],
    ["#10b981", "#06b6d4", "#8b5cf6"],
    ["#f59e0b", "#ef4444", "#ec4899"],
    ["#3b82f6", "#8b5cf6", "#f59e0b"],
    ["#ec4899", "#3b82f6", "#10b981"],
    ["#06b6d4", "#ec4899", "#10b981"],
  ][kind];
  const gradientId = `feature-gradient-${kind}`;

  return (
    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={gradients[0]} />
          <stop offset="50%" stopColor={gradients[1]} />
          <stop offset="100%" stopColor={gradients[2]} />
        </linearGradient>
      </defs>
      {kind === 0 && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={`url(#${gradientId})`} />
          <polyline points="14 2 14 8 20 8" stroke={`url(#${gradientId})`} />
          <line x1="16" y1="13" x2="8" y2="13" stroke={`url(#${gradientId})`} />
          <line x1="16" y1="17" x2="8" y2="17" stroke={`url(#${gradientId})`} />
        </>
      )}
      {kind === 1 && (
        <>
          <polyline points="16 18 22 12 16 6" stroke={`url(#${gradientId})`} />
          <polyline points="8 6 2 12 8 18" stroke={`url(#${gradientId})`} />
          <line x1="12" y1="2" x2="12" y2="22" stroke={`url(#${gradientId})`} />
        </>
      )}
      {kind === 2 && (
        <>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke={`url(#${gradientId})`} />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke={`url(#${gradientId})`} />
          <line x1="8" y1="7" x2="16" y2="7" stroke={`url(#${gradientId})`} />
          <line x1="8" y1="11" x2="14" y2="11" stroke={`url(#${gradientId})`} />
        </>
      )}
      {kind === 3 && (
        <>
          <circle cx="12" cy="12" r="10" stroke={`url(#${gradientId})`} />
          <polyline points="12 6 12 12 16 14" stroke={`url(#${gradientId})`} />
        </>
      )}
      {kind === 4 && (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={`url(#${gradientId})`} />
          <polyline points="7 10 12 15 17 10" stroke={`url(#${gradientId})`} />
          <line x1="12" y1="15" x2="12" y2="3" stroke={`url(#${gradientId})`} />
        </>
      )}
      {kind === 5 && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke={`url(#${gradientId})`} />
          <line x1="3" y1="9" x2="21" y2="9" stroke={`url(#${gradientId})`} />
          <line x1="9" y1="21" x2="9" y2="9" stroke={`url(#${gradientId})`} />
        </>
      )}
    </svg>
  );
}

const features: Feature[] = [
  { icon: <FeatureIcon kind={0} />, title: "申请信息管理", description: "保存并维护自己的申请记录，不再依赖提取码。" },
  { icon: <FeatureIcon kind={1} />, title: "临时模型 Key", description: "支持 OpenAI 与 DeepSeek，API Key 只在当前标签页暂存。" },
  { icon: <FeatureIcon kind={2} />, title: "标准化代码生成", description: "生成符合软件著作权申报规范的源代码文档。" },
  { icon: <FeatureIcon kind={3} />, title: "AI 用户手册", description: "根据申请信息和源码自动生成完整的用户手册。" },
  { icon: <FeatureIcon kind={4} />, title: "多格式导出", description: "支持 DOCX、Markdown 等格式导出和下载。" },
  { icon: <FeatureIcon kind={5} />, title: "历史记录管理", description: "云端保存生成记录，随时查看并下载历史材料。" },
];

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <VisualPage>
      <nav className="visual-reveal relative z-10 border-b border-white/10 bg-[#030014]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <BrandLogo />
          {!loading && (
            <div className="flex items-center gap-2 sm:gap-3">
              {user ? (
                <>
                  <span className="hidden text-sm text-white/60 sm:block">欢迎回来</span>
                  <Link href="/app"><Button className="btn-shimmer rounded-xl px-5 text-white">进入工作台</Button></Link>
                </>
              ) : (
                <>
                  <Link href="/login"><Button variant="ghost" className="px-4 text-white/80 hover:bg-white/10 hover:text-white">登录</Button></Link>
                  <Link href="/register"><Button className="btn-shimmer rounded-xl px-5 text-white">免费注册</Button></Link>
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16">
        <section className="visual-reveal visual-reveal--delay-2 mb-20 text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            <span className="text-sm text-white/70">软著材料智能生成平台</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            <span className="gradient-heading">从申请信息</span>
            <br />
            <span className="gradient-heading--color">到申报材料</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl">
            在线提交申请信息，使用自己的模型 API Key 进行补全，生成可下载的源码文档、用户手册和采集表。
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href={user ? "/app" : "/register"}>
              <Button className="btn-shimmer rounded-2xl px-10 py-4 text-lg font-medium text-white">立即开始</Button>
            </Link>
            <Link href={user ? "/app/history" : "/login"}>
              <Button variant="outline" className="rounded-2xl px-10 py-4 text-lg font-medium">{user ? "查看生成历史" : "已有账号登录"}</Button>
            </Link>
          </div>
        </section>

        <section className="visual-reveal visual-reveal--delay-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="feature-card card-hover group relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.08] to-transparent p-7 backdrop-blur-sm">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-violet-500/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="icon-glow feature-icon icon-shine relative z-10 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-white/10 to-white/5">
                {feature.icon}
              </div>
              <h2 className="relative z-10 mb-3 bg-gradient-to-r from-white to-white/80 bg-clip-text text-xl font-semibold text-transparent">{feature.title}</h2>
              <p className="relative z-10 leading-relaxed text-white/55">{feature.description}</p>
              <div className="pointer-events-none absolute inset-0 rounded-2xl border border-transparent opacity-0 transition-opacity duration-500 group-hover:border-violet-400/40 group-hover:opacity-100" />
            </article>
          ))}
        </section>

        <footer className="mt-20 text-center text-sm text-white/30">© 2026 智笔乾坤 · 让创作更简单</footer>
      </main>
    </VisualPage>
  );
}
