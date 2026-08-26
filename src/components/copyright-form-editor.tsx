"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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

  const textFields: Array<[keyof CopyrightFormData, string]> = [
    ["software_full_name", "软件全称"],
    ["software_short_name", "软件简称"],
    ["version", "版本号"],
    ["software_category", "软件分类"],
    ["development_date", "开发完成日期"],
    ["development_hardware", "开发硬件环境"],
    ["runtime_hardware", "运行硬件环境"],
    ["development_os", "开发操作系统"],
    ["development_tools", "开发工具"],
    ["runtime_platform", "运行平台"],
    ["runtime_environment", "运行环境"],
    ["programming_language", "编程语言"],
    ["development_purpose", "开发目的"],
    ["target_industry", "面向领域/行业"],
    ["company_name", "公司名称"],
    ["credit_code", "统一社会信用代码"],
  ];

  return (
    <div className="space-y-5 max-h-[68vh] overflow-y-auto pr-2">
      <div className="grid gap-4 sm:grid-cols-2">
        {textFields.map(([key, label]) => (
          <div className="space-y-2" key={key}>
            <Label htmlFor={String(key)}>{label}</Label>
            <Input
              id={String(key)}
              value={String(form[key] ?? "")}
              onChange={(event) => set(key, event.target.value as CopyrightFormData[typeof key])}
              disabled={disabled}
            />
          </div>
        ))}
        <div className="space-y-2">
          <Label htmlFor="source_code_lines">源程序量（行）</Label>
          <Input
            id="source_code_lines"
            type="number"
            min={0}
            value={form.source_code_lines || ""}
            onChange={(event) => set("source_code_lines", Number(event.target.value) || 0)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>是否发表</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={!form.is_published ? "default" : "outline"}
              onClick={() => set("is_published", false)}
              disabled={disabled}
            >
              未发表
            </Button>
            <Button
              type="button"
              size="sm"
              variant={form.is_published ? "default" : "outline"}
              onClick={() => set("is_published", true)}
              disabled={disabled}
            >
              已发表
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="main_functions">主要功能</Label>
        <Textarea
          id="main_functions"
          className="min-h-36"
          value={form.main_functions}
          onChange={(event) => set("main_functions", event.target.value)}
          disabled={disabled}
          placeholder="建议填写 500～1300 字"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="technical_features">技术特点</Label>
        <Textarea
          id="technical_features"
          className="min-h-24"
          value={form.technical_features}
          onChange={(event) => set("technical_features", event.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
