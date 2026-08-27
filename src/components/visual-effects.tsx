"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const particles = Array.from({ length: 14 }, (_, index) => ({
  top: `${8 + ((index * 47) % 84)}%`,
  left: `${4 + ((index * 61) % 92)}%`,
  color: index % 3 === 0 ? "#ec4899" : index % 2 === 0 ? "#8b5cf6" : "#06b6d4",
  delay: `${(index * 0.45) % 5}s`,
  duration: `${6 + (index % 4) * 1.5}s`,
}));

export function VisualEffects() {
  return (
    <div className="visual-effects" aria-hidden="true">
      <div className="visual-effects__orb visual-effects__orb--violet" />
      <div className="visual-effects__orb visual-effects__orb--cyan" />
      <div className="visual-effects__orb visual-effects__orb--pink" />
      <div className="visual-effects__grid" />

      <div className="visual-effects__lines">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            className="visual-effects__line"
            key={`horizontal-${index}`}
            style={{
              top: `${14 + index * 19}%`,
              animationDelay: `${index * 2.5}s`,
              animationDuration: `${17 + index * 2}s`,
              background: `linear-gradient(90deg, transparent, ${particles[index].color}, transparent)`,
              boxShadow: `0 0 8px ${particles[index].color}`,
            }}
          />
        ))}
        {[0, 1, 2].map((index) => (
          <span
            className="visual-effects__line visual-effects__line--vertical"
            key={`vertical-${index}`}
            style={{
              left: `${20 + index * 31}%`,
              animationDelay: `${index * 3}s`,
              animationDuration: `${16 + index * 2}s`,
              background: `linear-gradient(180deg, transparent, ${particles[index + 5].color}, transparent)`,
              boxShadow: `0 0 8px ${particles[index + 5].color}`,
            }}
          />
        ))}
      </div>

      <div className="visual-effects__particles">
        {particles.map((particle, index) => (
          <span
            className="visual-effects__particle"
            key={index}
            style={{
              top: particle.top,
              left: particle.left,
              backgroundColor: particle.color,
              boxShadow: `0 0 8px ${particle.color}`,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>

      <svg className="visual-effects__connections" viewBox="0 0 1000 700" preserveAspectRatio="none">
        <defs>
          <linearGradient id="visual-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <path d="M -30 210 Q 220 145 480 240 T 1030 165" fill="none" stroke="url(#visual-line-gradient)" strokeWidth="1" />
        <path d="M -30 510 Q 230 440 500 535 T 1030 455" fill="none" stroke="url(#visual-line-gradient)" strokeWidth="1" />
      </svg>
    </div>
  );
}

export function VisualPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("visual-page", className)}>
      <VisualEffects />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}

export function BrandLogo({ href = "/", className, label = "智笔乾坤" }: { href?: string; className?: string; label?: string }) {
  const content = (
    <span className={cn("brand-logo", className)}>
      <span className="brand-logo__mark">
        <span className="brand-logo__halo" />
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </span>
      <span className="brand-logo__name">{label}</span>
    </span>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
