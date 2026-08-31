"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_COPYRIGHT_HOLDER,
  type CopyrightFormData,
  type CopyrightHolder,
  type HolderType,
} from "@/lib/copyright-form";
import {
  COPYRIGHT_MAIN_FUNCTIONS_MAX,
  COPYRIGHT_MAIN_FUNCTIONS_MIN,
  COPYRIGHT_SHORT_TEXT_MAX,
  COPYRIGHT_TECHNICAL_FEATURES_MAX,
  characterCount,
} from "@/lib/copyright-constraints";
import {
  PROGRAMMING_LANGUAGE_OPTIONS,
  SOFTWARE_CATEGORY_OPTIONS,
  TARGET_INDUSTRY_OPTIONS,
} from "@/lib/copyright-options";

interface Props {
  form: CopyrightFormData;
  onChange: (form: CopyrightFormData) => void;
  disabled?: boolean;
}

const holderCategories: Record<HolderType, string[]> = {
  person: ["自然人"],
  organization: ["企业法人", "事业单位法人", "机关法人", "社会团体法人", "其他组织"],
};

const holderDocumentTypes: Record<HolderType, string[]> = {
  person: ["居民身份证", "护照", "港澳居民来往内地通行证", "台湾居民来往大陆通行证", "其他身份证件"],
  organization: ["统一社会信用代码证书", "营业执照", "事业单位法人证书", "其他证件"],
};

const developmentMethodLabels = {
  independent: "单独开发",
  cooperative: "合作开发",
} as const;

const CUSTOM_OPTION = "__custom__";

interface ChoiceOrCustomFieldProps {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
}

function ChoiceOrCustomField({ id, label, value, options, onChange, disabled, maxLength }: ChoiceOrCustomFieldProps) {
  const [customMode, setCustomMode] = useState(() => Boolean(value && !options.includes(value)));
  const showingCustom = !options.includes(value) && (customMode || Boolean(value));

  return (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>{label}</label>
      <select
        id={id}
        className="app-select"
        value={showingCustom ? CUSTOM_OPTION : value}
        onChange={(event) => {
          if (event.target.value === CUSTOM_OPTION) {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(event.target.value);
          }
        }}
        disabled={disabled}
      >
        <option value="">请选择</option>
        {options.map((option) => <option value={option} key={option}>{option}</option>)}
        <option value={CUSTOM_OPTION}>自定义填写</option>
      </select>
      {showingCustom && (
        <Input
          className="form-field__custom-input"
          aria-label={`${label}自定义内容`}
          value={value}
          maxLength={maxLength}
          placeholder={`填写${label}`}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}

export function CopyrightFormEditor({ form, onChange, disabled }: Props) {
  const set = <K extends keyof CopyrightFormData>(key: K, value: CopyrightFormData[K]) => {
    onChange({ ...form, [key]: value });
  };

  const input = (key: keyof CopyrightFormData, label: string, type = "text", placeholder?: string, maxLength?: number) => (
    <div className="form-field" key={key}>
      <label className="form-label" htmlFor={String(key)}>{label}</label>
      <Input
        id={String(key)}
        type={type}
        min={type === "number" ? 0 : undefined}
        value={String(form[key] ?? "")}
        placeholder={placeholder}
        maxLength={maxLength}
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

  const setHolder = (index: number, patch: Partial<CopyrightHolder>) => {
    const copyright_holders = form.copyright_holders.map((holder, holderIndex) => (
      holderIndex === index ? { ...holder, ...patch } : holder
    ));
    set("copyright_holders", copyright_holders);
  };

  const addHolder = () => {
    set("copyright_holders", [
      ...form.copyright_holders,
      { ...EMPTY_COPYRIGHT_HOLDER, sort_order: form.copyright_holders.length },
    ]);
  };

  const removeHolder = (index: number) => {
    set("copyright_holders", form.copyright_holders
      .filter((_, holderIndex) => holderIndex !== index)
      .map((holder, sortOrder) => ({ ...holder, sort_order: sortOrder })));
  };

  const selectHolderType = (index: number, holderType: HolderType) => {
    setHolder(index, {
      holder_type: holderType,
      category: holderCategories[holderType][0],
      document_type: holderDocumentTypes[holderType][0],
      birth_or_established_date: "",
    });
  };

  return (
    <div className="application-editor">
      <section className="form-section">
        <div className="form-section__header">
          <h2>软件基本信息</h2>
          <p>登记证书上展示的软件名称、版本和发表状态。</p>
        </div>
        <div className="form-grid">
          {input("software_full_name", "软件全称")}
          {input("software_short_name", "软件简称")}
          {input("version", "版本号")}
          <ChoiceOrCustomField
            id="software_category"
            label="软件分类"
            value={form.software_category}
            options={SOFTWARE_CATEGORY_OPTIONS}
            maxLength={COPYRIGHT_SHORT_TEXT_MAX}
            onChange={(value) => set("software_category", value)}
            disabled={disabled}
          />
          {input("development_date", "开发完成日期", "date")}
          <div className="form-field">
            <label className="form-label" htmlFor="work_type">软件作品说明</label>
            <select id="work_type" className="app-select" value={form.work_type} onChange={(event) => set("work_type", event.target.value as CopyrightFormData["work_type"])} disabled={disabled}>
              <option value="original">原创</option>
              <option value="modified">修改</option>
            </select>
          </div>
          <div className="form-field">
            <span className="form-label">是否已发表</span>
            <div className="form-toggle-group">
              <Button type="button" size="sm" variant={!form.is_published ? "default" : "outline"} onClick={() => set("is_published", false)} disabled={disabled}>未发表</Button>
              <Button type="button" size="sm" variant={form.is_published ? "default" : "outline"} onClick={() => set("is_published", true)} disabled={disabled}>已发表</Button>
            </div>
          </div>
          {form.is_published && <>
            {input("first_publication_date", "首次发表日期", "date")}
            {input("first_publication_country", "首次发表国家")}
            {input("first_publication_city", "首次发表城市")}
          </>}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <h2>著作权人</h2>
          <p>请明确录入实际著作权人；参与开发但不主张权利的人员不要添加。个人和单位可以混合录入。</p>
        </div>
        <div className="holder-list">
          {form.copyright_holders.map((holder, index) => {
            const typeLabel = holder.holder_type === "person" ? "自然人" : "企业 / 单位";
            return (
              <div className="holder-card" key={holder.id || `${holder.holder_type}-${index}`}>
                <div className="holder-card__header">
                  <strong>著作权人 {index + 1}</strong>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeHolder(index)} disabled={disabled}><Trash2 size={14} />删除</Button>
                </div>
                <div className="form-grid">
                  <div className="form-field">
                    <label className="form-label" htmlFor={`holder-${index}-type`}>主体类型</label>
                    <select id={`holder-${index}-type`} className="app-select" value={holder.holder_type} onChange={(event) => selectHolderType(index, event.target.value as HolderType)} disabled={disabled}>
                      <option value="person">自然人</option>
                      <option value="organization">企业 / 单位</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor={`holder-${index}-name`}>{typeLabel === "自然人" ? "姓名" : "单位名称"}</label>
                    <Input id={`holder-${index}-name`} value={holder.name} onChange={(event) => setHolder(index, { name: event.target.value })} disabled={disabled} />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor={`holder-${index}-category`}>主体类别</label>
                    <select id={`holder-${index}-category`} className="app-select" value={holder.category} onChange={(event) => setHolder(index, { category: event.target.value })} disabled={disabled}>
                      {holderCategories[holder.holder_type].map((item) => <option value={item} key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor={`holder-${index}-document-type`}>证件类型</label>
                    <select id={`holder-${index}-document-type`} className="app-select" value={holder.document_type} onChange={(event) => setHolder(index, { document_type: event.target.value })} disabled={disabled}>
                      {holderDocumentTypes[holder.holder_type].map((item) => <option value={item} key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="form-field form-field--full">
                    <label className="form-label" htmlFor={`holder-${index}-document-number`}>{holder.holder_type === "person" ? "证件号码" : "统一社会信用代码或其他证件号码"}</label>
                    <Input id={`holder-${index}-document-number`} value={holder.document_number} onChange={(event) => setHolder(index, { document_number: event.target.value })} disabled={disabled} />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor={`holder-${index}-nationality`}>国籍</label>
                    <Input id={`holder-${index}-nationality`} value={holder.nationality} onChange={(event) => setHolder(index, { nationality: event.target.value })} disabled={disabled} />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor={`holder-${index}-province`}>省份</label>
                    <Input id={`holder-${index}-province`} value={holder.province} onChange={(event) => setHolder(index, { province: event.target.value })} disabled={disabled} />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor={`holder-${index}-city`}>城市</label>
                    <Input id={`holder-${index}-city`} value={holder.city} onChange={(event) => setHolder(index, { city: event.target.value })} disabled={disabled} />
                  </div>
                  {holder.holder_type === "person" && (
                    <div className="form-field">
                      <label className="form-label" htmlFor={`holder-${index}-birth-date`}>出生日期</label>
                      <Input id={`holder-${index}-birth-date`} type="date" value={holder.birth_or_established_date || ""} onChange={(event) => setHolder(index, { birth_or_established_date: event.target.value })} disabled={disabled} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={addHolder} disabled={disabled}><Plus size={15} />添加著作权人</Button>
          {!form.copyright_holders.length && <p className="form-hint">可以先保存软件基本信息，提交前请补齐至少一名著作权人的完整证件信息。</p>}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <h2>开发方式与权利说明</h2>
          <p>这些字段对应官方登记表中的作品说明、开发方式、权利取得方式和权利范围。</p>
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label className="form-label" htmlFor="development_method">开发方式</label>
            <select id="development_method" className="app-select" value={form.development_method} onChange={(event) => set("development_method", event.target.value as CopyrightFormData["development_method"])} disabled={disabled}>
              {Object.entries(developmentMethodLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
              {!Object.hasOwn(developmentMethodLabels, form.development_method) && <option value={form.development_method}>历史预留方式</option>}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="rights_acquisition_method">权利取得方式</label>
            <select id="rights_acquisition_method" className="app-select" value={form.rights_acquisition_method} onChange={(event) => set("rights_acquisition_method", event.target.value as CopyrightFormData["rights_acquisition_method"])} disabled={disabled}>
              <option value="original">原始取得</option><option value="transfer">受让</option><option value="inheritance">继承</option><option value="assumption">承受</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="rights_scope">权利范围</label>
            <select id="rights_scope" className="app-select" value={form.rights_scope} onChange={(event) => set("rights_scope", event.target.value as CopyrightFormData["rights_scope"])} disabled={disabled}>
              <option value="all">全部权利</option><option value="partial">部分权利</option>
            </select>
          </div>
          {form.work_type === "modified" && <>
            {input("original_registration_number", "原登记号")}
            <div className="form-field form-field--full">
              <label className="form-label" htmlFor="modification_description">修改说明</label>
              <Textarea id="modification_description" className="min-h-24" value={form.modification_description} onChange={(event) => set("modification_description", event.target.value)} disabled={disabled} />
            </div>
          </>}
          {form.rights_scope === "partial" && <div className="form-field form-field--full">
            <label className="form-label" htmlFor="rights_scope_description">权利范围说明</label>
            <Textarea id="rights_scope_description" className="min-h-24" value={form.rights_scope_description} onChange={(event) => set("rights_scope_description", event.target.value)} disabled={disabled} />
          </div>}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <h2>申请人和联系人</h2>
          <p>申请人、地址和联系人信息均可暂不填写；如果选择代理人办理，再按实际情况补充。</p>
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label className="form-label" htmlFor="application_method">申请办理方式</label>
            <select id="application_method" className="app-select" value={form.application_method} onChange={(event) => set("application_method", event.target.value as CopyrightFormData["application_method"])} disabled={disabled}>
              <option value="copyright_holder">著作权人申请办理</option><option value="agent">代理人申请办理</option>
            </select>
          </div>
          {input("postal_code", "邮政编码")}
          {input("contact_name", "联系人")}
          {input("contact_phone", "联系电话", "tel")}
          {input("contact_email", "联系邮箱", "email")}
          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="applicant_address">申请人地址</label>
            <Input id="applicant_address" value={form.applicant_address} onChange={(event) => set("applicant_address", event.target.value)} disabled={disabled} />
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <h2>开发与运行环境</h2>
          <p>用于说明软件开发工具、运行平台和技术栈。</p>
        </div>
        <div className="form-grid">
          {input("development_hardware", "开发的硬件环境", "text", undefined, COPYRIGHT_SHORT_TEXT_MAX)}
          {input("runtime_hardware", "运行的硬件环境", "text", undefined, COPYRIGHT_SHORT_TEXT_MAX)}
          {input("development_os", "开发操作系统", "text", undefined, COPYRIGHT_SHORT_TEXT_MAX)}
          {input("runtime_platform", "运行平台操作系统", "text", undefined, COPYRIGHT_SHORT_TEXT_MAX)}
          {input("development_tools", "软件开发环境工具", "text", undefined, COPYRIGHT_SHORT_TEXT_MAX)}
          {input("runtime_environment", "软件运行支撑环境", "text", undefined, COPYRIGHT_SHORT_TEXT_MAX)}
          <ChoiceOrCustomField
            id="programming_language"
            label="编程语言"
            value={form.programming_language}
            options={PROGRAMMING_LANGUAGE_OPTIONS}
            maxLength={COPYRIGHT_SHORT_TEXT_MAX}
            onChange={(value) => set("programming_language", value)}
            disabled={disabled}
          />
          {input("source_code_lines", "源码代码行数", "number")}
        </div>
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <h2>软件说明</h2>
          <p>尽量使用客观、完整的业务描述，方便后续生成源代码文档和用户手册。</p>
        </div>
        <div className="form-grid">
          {input("development_purpose", "开发目的", "text", undefined, COPYRIGHT_SHORT_TEXT_MAX)}
          <ChoiceOrCustomField
            id="target_industry"
            label="面向领域 / 行业"
            value={form.target_industry}
            options={TARGET_INDUSTRY_OPTIONS}
            maxLength={COPYRIGHT_SHORT_TEXT_MAX}
            onChange={(value) => set("target_industry", value)}
            disabled={disabled}
          />
          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="main_functions">软件的主要功能</label>
            <Textarea id="main_functions" className="min-h-36" maxLength={COPYRIGHT_MAIN_FUNCTIONS_MAX} value={form.main_functions} onChange={(event) => set("main_functions", event.target.value)} disabled={disabled} placeholder="请完整描述软件解决的问题、主要模块、关键功能和用户操作流程。" />
            <span className={characterCount(form.main_functions) > 0 && (characterCount(form.main_functions) < COPYRIGHT_MAIN_FUNCTIONS_MIN || characterCount(form.main_functions) > COPYRIGHT_MAIN_FUNCTIONS_MAX) ? "form-hint form-hint--error" : "form-hint"}>
              当前 {characterCount(form.main_functions)} / {COPYRIGHT_MAIN_FUNCTIONS_MIN}～{COPYRIGHT_MAIN_FUNCTIONS_MAX} 字符
            </span>
          </div>
          <div className="form-field form-field--full">
            <label className="form-label" htmlFor="technical_features">软件技术特点</label>
            <Textarea id="technical_features" className="min-h-24" maxLength={COPYRIGHT_TECHNICAL_FEATURES_MAX} value={form.technical_features} onChange={(event) => set("technical_features", event.target.value)} disabled={disabled} placeholder="例如：权限管理、数据处理、接口服务、部署方式等。" />
            <span className={characterCount(form.technical_features) > COPYRIGHT_TECHNICAL_FEATURES_MAX ? "form-hint form-hint--error" : "form-hint"}>
              当前 {characterCount(form.technical_features)} / {COPYRIGHT_TECHNICAL_FEATURES_MAX} 字符
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
