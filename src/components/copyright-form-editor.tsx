"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CopyrightFormData } from "@/lib/copyright-form";

interface Props {
  form: CopyrightFormData;
  onChange: (form: CopyrightFormData) => void;
  disabled?: boolean;
}

export function CopyrightFormEditor({ form, onChange, disabled }: Props) {
  const set = <K extends keyof CopyrightFormData>(key: K, value: CopyrightFormData[K]) => {
    onChange({ ...form, [key]: value });
  };

  const input = (key: keyof CopyrightFormData, label: string, type = "text") => (
    <div className="form-field" key={key}>
      <label className="form-label" htmlFor={String(key)}>{label}</label>
      <Input
        id={String(key)}
        type={type}
        min={type === "number" ? 0 : undefined}
        value={String(form[key] ?? "")}
        onChange={(event) => {
          const value = key === "source_code_lines"
            ? Number.parseInt(event.target.value, 10) || 0
            : event.target.value;
          set(key, value as CopyrightFormData[typeof key]);
        }}
        disabled={disabled}
      />
    </div>
  );

  return (
    <div className="application-editor">
      <section className="form-section">
        <div className="form-section__header">
          <h2>软件基本信息</h2>
          <p>登记证书上展示的名称和版本信息。</p>
        </div>
        <div className="form-grid">
          {input("software_full_name", "软件全称")}
          {input("software_short_name", "软件简称")}
          {input("version", "版本号")}
          {input("software_category", "软件分类")}
          {input("development_date", "开发完成日期", "date")}
          <div className="form-field">
            <span className="form-label">是否已发表</span>
            <div className="form-toggle-group">
              <Button type="button" size="sm" variant={!form.is_published ? "default" : "outline"} onClick={() => set("is_published", false)} disabled={disabled}>未发表</Button>
              <Button type="button" size="sm" variant={form.is_published ? "default" : "outline"} onClick={() => set("is_published", true)} disabled={disabled}>已发表</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <h2>开发与运行环境</h2>
          <p>用于说明软件开发工具、运行平台和技术栈。</p>
        </div>
        <div className="form-grid">
          {input("development_hardware", "开发硬件环境")}
          {input("runtime_hardware", "运行硬件环境")}
          {input("development_os", "开发操作系统")}
          {input("runtime_platform", "运行平台")}
          {input("development_tools", "开发工具")}
          {input("runtime_environment", "运行环境")}
          {input("programming_language", "编程语言")}
          {input("source_code_lines", "源码代码行数", "number")}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <h2>软件说明</h2>
          <p>尽量使用客观、完整的业务描述，方便后续生成材料。</p>
        </div>
        <div className="form-grid">
          {input("development_purpose", "开发目的")}
          {input("target_industry", "面向领域 / 行业")}
          {input("company_name", "著作权人 / 公司名称")}
          {input("credit_code", "统一社会信用代码")}
          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="main_functions">主要功能</label>
            <Textarea id="main_functions" className="min-h-36" value={form.main_functions} onChange={(event) => set("main_functions", event.target.value)} disabled={disabled} placeholder="建议填写软件解决的问题、主要模块和用户操作流程。" />
            <span className="form-hint">建议填写 500–1300 字。</span>
          </div>
          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="technical_features">技术特点</label>
            <Textarea id="technical_features" className="min-h-24" value={form.technical_features} onChange={(event) => set("technical_features", event.target.value)} disabled={disabled} placeholder="例如：权限管理、数据处理、接口服务、部署方式等。" />
          </div>
        </div>
      </section>
    </div>
  );
}
