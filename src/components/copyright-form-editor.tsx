"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label>软件全称</Label>
          <Input
            value={form.software_full_name}
            onChange={(e) => set("software_full_name", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>软件简称</Label>
          <Input
            value={form.software_short_name}
            onChange={(e) => set("software_short_name", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>版本号</Label>
          <Input
            value={form.version}
            onChange={(e) => set("version", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>软件分类</Label>
          <Input
            value={form.software_category}
            onChange={(e) => set("software_category", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>开发完成日期</Label>
          <Input
            value={form.development_date}
            onChange={(e) => set("development_date", e.target.value)}
            disabled={disabled}
            placeholder="2024-01-01"
          />
        </div>
        <div className="space-y-2">
          <Label>是否发表</Label>
          <div className="flex gap-2">
            <Badge
              variant={!form.is_published ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => !disabled && set("is_published", false)}
            >
              未发表
            </Badge>
            <Badge
              variant={form.is_published ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => !disabled && set("is_published", true)}
            >
              已发表
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {(
          [
            ["development_hardware", "开发硬件"],
            ["runtime_hardware", "运行硬件"],
            ["development_os", "开发操作系统"],
            ["development_tools", "开发工具"],
            ["runtime_platform", "运行平台"],
            ["runtime_environment", "运行环境"],
            ["programming_language", "编程语言"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <Input
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              disabled={disabled}
            />
          </div>
        ))}
        <div className="space-y-2">
          <Label>源程序量（行）</Label>
          <Input
            type="number"
            value={form.source_code_lines || ""}
            onChange={(e) => set("source_code_lines", parseInt(e.target.value, 10) || 0)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>开发目的</Label>
        <Input
          value={form.development_purpose}
          onChange={(e) => set("development_purpose", e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label>面向领域/行业</Label>
        <Input
          value={form.target_industry}
          onChange={(e) => set("target_industry", e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label>主要功能（500~1300 字，当前 {form.main_functions.length} 字）</Label>
        <Textarea
          className="min-h-[120px]"
          value={form.main_functions}
          onChange={(e) => set("main_functions", e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label>技术特点</Label>
        <Textarea
          className="min-h-[80px]"
          value={form.technical_features}
          onChange={(e) => set("technical_features", e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>公司名称</Label>
          <Input
            value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>统一社会信用代码</Label>
          <Input
            value={form.credit_code}
            onChange={(e) => set("credit_code", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
