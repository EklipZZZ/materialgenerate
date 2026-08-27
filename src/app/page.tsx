"use client";

import Link from "next/link";
import { ArrowRight, Bot, Download, FileCheck2, FileText, History, LockKeyhole, ShieldCheck } from "lucide-react";
import { ProductLogo } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";

const features = [
  { icon: FileText, title: "统一管理申请信息", description: "把软件名称、环境、功能说明和权属信息集中在一条申请里。" },
  { icon: Bot, title: "AI 辅助补全", description: "使用自己的模型 Key 获得内容建议，重要字段始终由你确认。" },
  { icon: FileCheck2, title: "按流程生成材料", description: "根据已保存的登记信息，生成源代码文档、用户手册和采集表。" },
  { icon: History, title: "生成记录可追溯", description: "每次生成都保留申请、模型和时间信息，方便后续查找。" },
  { icon: Download, title: "短时安全下载", description: "生成文件通过短时签名链接下载，减少长期暴露风险。" },
  { icon: ShieldCheck, title: "账户数据隔离", description: "申请和生成记录按登录账户隔离，API Key 只保存在当前 Tab。" },
];

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <main className="marketing-page">
      <nav className="marketing-nav">
        <ProductLogo href="/" />
        {!loading && (
          <div className="marketing-nav__actions">
            {user ? (
              <>
                <span className="marketing-nav__greeting">欢迎回来</span>
                <Button asChild variant="secondary"><Link href="/app">进入工作台 <ArrowRight size={14} /></Link></Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost"><Link href="/login">登录</Link></Button>
                <Button asChild><Link href="/register">创建账户</Link></Button>
              </>
            )}
          </div>
        )}
      </nav>

      <section className="marketing-hero">
        <div>
          <span className="marketing-kicker"><span />软件著作权申报工作台</span>
          <h1>把申报信息，整理成<span>可交付的材料。</span></h1>
          <p className="marketing-hero__description">从申请信息管理到源码文档、用户手册和采集表生成，使用清晰的流程完成软件著作权申报准备。</p>
          <div className="marketing-hero__actions">
            <Button asChild size="lg"><Link href={user ? "/app" : "/register"}>{user ? "打开工作台" : "开始使用"}<ArrowRight size={16} /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href={user ? "/app/history" : "/login"}>{user ? "查看生成记录" : "已有账户，登录"}</Link></Button>
          </div>
          <div className="marketing-hero__note"><LockKeyhole size={14} />不保存你的 API Key，所有生成由你配置的模型完成。</div>
        </div>

        <div className="marketing-preview" aria-label="工作台界面预览">
          <div className="marketing-preview__bar"><span /><span /><span /><small>申报空间 / 总览</small></div>
          <div className="marketing-preview__body">
            <div className="marketing-preview__side"><strong>软著申报助手</strong><span className="marketing-preview__side-active">总览</span><span>我的申请</span><span>材料生成</span><span>生成记录</span><span>设置</span></div>
            <div className="marketing-preview__content"><div className="marketing-preview__heading"><span>总览</span><small>最近申请与生成进度</small></div><div className="marketing-preview__cards"><div className="marketing-preview__card"><span>编辑中的申请</span><strong>02</strong></div><div className="marketing-preview__card"><span>生成记录</span><strong>08</strong></div></div><div className="marketing-preview__table"><span>智能材料管理系统</span><span>材料生成　　已完成</span><span>企业服务平台　　编辑中</span></div></div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-section__heading"><div><h2>一个清楚的工作台</h2><p>足够正式，也只保留申报过程中真正需要的功能。</p></div><span className="marketing-section__rule-label">WORKSPACE</span></div>
        <div className="marketing-feature-grid">
          {features.map(({ icon: Icon, title, description }) => <article className="marketing-feature" key={title}><span className="marketing-feature__icon"><Icon size={16} /></span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
      </section>

      <footer className="marketing-footer">© 2026 软著申报助手 · 让材料准备更有秩序</footer>
    </main>
  );
}
