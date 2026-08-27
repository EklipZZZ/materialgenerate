"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  CircleHelp,
  ChevronRight,
  FileCheck2,
  FileOutput,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "总览", href: "/app", icon: LayoutDashboard },
  { label: "我的申请", href: "/app/applications", icon: FileText },
  { label: "材料生成", href: "/app/generate", icon: FileOutput },
  { label: "生成记录", href: "/app/history", icon: History },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/app" ? pathname === href : pathname.startsWith(href);
}

function activeLabel(pathname: string): string {
  if (pathname.startsWith("/settings")) return "设置";
  return navItems.find((item) => isActive(pathname, item.href))?.label || "总览";
}

export function ProductLogo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  const content = (
    <span className={cn("product-logo", compact && "product-logo--compact")}>
      <span className="product-logo__mark">著</span>
      {!compact && (
        <span className="product-logo__copy">
          <strong>软著申报助手</strong>
          <small>SOFTWARE COPYRIGHT</small>
        </span>
      )}
    </span>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <div className="app-loading">
        <span className="app-loading__mark">著</span>
        <span>正在加载工作区</span>
      </div>
    );
  }

  if (!user) return null;

  const sectionLabel = activeLabel(pathname);
  const email = user.email || "已登录用户";
  const avatar = email.slice(0, 1).toUpperCase();

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          type="button"
          className="app-sidebar-backdrop"
          aria-label="关闭导航栏"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn("app-sidebar", sidebarOpen && "app-sidebar--open")}>
        <div className="app-sidebar__brand">
          <ProductLogo href="/app" />
          <button
            type="button"
            className="app-icon-button app-sidebar__close"
            aria-label="关闭导航栏"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={17} />
          </button>
        </div>

        <div className="app-workspace-switch">
          <span className="app-workspace-switch__mark">软</span>
          <span className="app-workspace-switch__copy">
            <strong>软著申报空间</strong>
            <small>个人工作区</small>
          </span>
          <ChevronRight size={15} />
        </div>

        <p className="app-nav-label">工作区</p>
        <nav className="app-nav" aria-label="主导航">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              onClick={() => setSidebarOpen(false)}
              className={cn("app-nav__item", isActive(pathname, href) && "app-nav__item--active")}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "我的申请" && <span className="app-nav__count">资料</span>}
            </Link>
          ))}
        </nav>

        <div className="app-sidebar__fill" />

        <button type="button" className="app-nav__item app-nav__item--muted">
          <CircleHelp size={17} strokeWidth={1.8} />
          <span>帮助与说明</span>
        </button>
        <Link
          href="/settings/llm-keys"
          onClick={() => setSidebarOpen(false)}
          className={cn("app-nav__item app-nav__item--muted", pathname.startsWith("/settings") && "app-nav__item--active")}
        >
          <Settings2 size={17} strokeWidth={1.8} />
          <span>设置</span>
        </Link>

        <div className="app-user-card">
          <span className="app-user-card__avatar">{avatar}</span>
          <span className="app-user-card__copy">
            <strong>{email}</strong>
            <small>个人账户</small>
          </span>
          <button type="button" className="app-icon-button" aria-label="退出登录" onClick={() => void handleSignOut()}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__left">
            <button
              type="button"
              className="app-icon-button app-menu-button"
              aria-label="打开导航栏"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="app-breadcrumbs">
              <span>软著申报助手</span>
              <ChevronRight size={14} />
              <strong>{sectionLabel}</strong>
            </div>
          </div>
          <div className="app-topbar__right">
            <span className="app-security-note"><ShieldCheck size={14} /> 安全工作区</span>
            <span className="app-topbar__account">{email}</span>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {children && <div className="page-header__actions">{children}</div>}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("app-panel", className)}>{children}</section>;
}

const statusCopy: Record<string, { label: string; tone: string }> = {
  draft: { label: "编辑中", tone: "draft" },
  editing: { label: "编辑中", tone: "draft" },
  ready: { label: "待生成", tone: "ready" },
  generating: { label: "生成中", tone: "generating" },
  complete: { label: "已完成", tone: "complete" },
  completed: { label: "已完成", tone: "complete" },
  success: { label: "已完成", tone: "complete" },
  failed: { label: "失败", tone: "failed" },
  error: { label: "失败", tone: "failed" },
};

export function StatusBadge({ status, label }: { status?: string | null; label?: string }) {
  const normalized = String(status || "draft").toLowerCase();
  const copy = statusCopy[normalized] || { label: status || "编辑中", tone: "draft" };
  return (
    <span className={cn("app-status", `app-status--${copy.tone}`)}>
      <span className="app-status__dot" />
      {label || copy.label}
    </span>
  );
}

export function EmptyState({ title, description, action, icon = <FileCheck2 size={22} /> }: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="app-empty-state">
      <span className="app-empty-state__icon">{icon}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="app-empty-state__action">{action}</div>}
    </div>
  );
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
