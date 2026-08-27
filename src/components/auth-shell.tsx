"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ProductLogo } from "@/components/app-shell";

interface Props {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, description, children, footer }: Props) {
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <div className="auth-layout__brand">
          <ProductLogo href="/" />
        </div>
        <section className="auth-card">
          <div className="auth-card__heading">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          {children}
          {footer && <div className="auth-card__footer">{footer}</div>}
        </section>
        <Link className="auth-home-link" href="/">返回产品首页</Link>
      </div>
    </main>
  );
}
