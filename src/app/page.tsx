"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";

export default function HomePage() {
  const { user, loading } = useAuth();
  return (
    <main className="min-h-screen bg-[#030014] px-6 py-20 text-white">
      <div className="mx-auto max-w-5xl">
        <nav className="flex items-center justify-between">
          <span className="text-xl font-semibold">软著申报助手</span>
          {!loading && (user ? (
            <Link href="/app"><Button>进入工作台</Button></Link>
          ) : (
            <div className="flex gap-2"><Link href="/login"><Button variant="ghost">登录</Button></Link><Link href="/register"><Button>注册</Button></Link></div>
          ))}
        </nav>
        <section className="py-28 text-center">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-violet-300">独立 AI 软著申报系统</p>
          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">从申请信息到申报材料</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/60">
            在线提交申请信息，使用自己的模型 API Key 进行补全，并生成可下载的源码文档、用户手册和采集表。
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link href={user ? "/app" : "/register"}><Button size="lg">开始使用</Button></Link>
            <Link href="/login"><Button size="lg" variant="outline">已有账号登录</Button></Link>
          </div>
        </section>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["申请管理", "保存并维护自己的申请记录，不再依赖提取码。"],
            ["模型配置", "支持 OpenAI 与 DeepSeek，多条配置可切换，密钥仅服务端保存密文。"],
            ["材料生成", "上传源码压缩包或自动生成源码文档，并下载 DOCX 材料。"],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
