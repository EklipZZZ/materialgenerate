import type { CopyrightFormData, CopyrightHolder } from "../../src/lib/copyright-form.ts";
import type { MaterialKind } from "../../src/lib/materials.ts";

export type AdapterErrorCode =
  | "unsupported_development_method"
  | "field_not_found"
  | "field_ambiguous"
  | "field_verification_failed"
  | "portal_structure_changed"
  | "manual_upload_required";

export class AdapterError extends Error {
  constructor(public readonly code: AdapterErrorCode, message: string = code) {
    super(message);
    this.name = "AdapterError";
  }
}

const TEXT_CONTROL_SELECTOR = "input:not([type='hidden']):not([type='file']), textarea, select, [role='textbox'], [role='combobox']";

const textFieldAliases: Partial<Record<keyof CopyrightFormData, string[]>> = {
  software_full_name: ["软件全称", "软件名称"],
  software_short_name: ["软件简称"],
  version: ["版本号", "软件版本"],
  software_category: ["软件分类", "分类号"],
  development_date: ["开发完成日期", "完成日期"],
  rights_scope_description: ["权利范围说明"],
  original_registration_number: ["原登记号", "原软件登记号"],
  modification_description: ["修改说明"],
  first_publication_date: ["首次发表日期", "发表日期"],
  first_publication_country: ["首次发表国家", "发表国家"],
  first_publication_city: ["首次发表城市", "发表城市"],
  applicant_address: ["申请人地址", "联系地址", "通讯地址"],
  postal_code: ["邮政编码", "邮编"],
  contact_name: ["联系人", "联系代表"],
  contact_phone: ["联系电话", "联系人电话", "手机"],
  contact_email: ["电子邮箱", "邮箱", "电子邮件"],
  development_hardware: ["开发的硬件环境", "开发硬件环境"],
  runtime_hardware: ["运行的硬件环境", "运行硬件环境"],
  development_os: ["开发操作系统"],
  development_tools: ["软件开发环境工具", "开发工具"],
  runtime_platform: ["运行平台操作系统", "运行平台"],
  runtime_environment: ["软件运行支撑环境", "运行环境"],
  programming_language: ["编程语言"],
  source_code_lines: ["源程序量", "源码代码行数", "代码行数"],
  development_purpose: ["开发目的"],
  target_industry: ["面向领域/行业", "面向领域", "所属行业"],
  main_functions: ["软件的主要功能", "主要功能"],
  technical_features: ["软件技术特点", "技术特点"],
};

const holderAliases = {
  holder_type: ["著作权人类型", "权利人类型", "主体类型"],
  name: ["著作权人名称", "姓名", "单位名称", "权利人名称"],
  category: ["著作权人类别", "单位类别", "主体类别"],
  document_type: ["证件类型", "身份证明类型"],
  document_number: ["证件号码", "统一社会信用代码", "身份证号", "证件号"],
  nationality: ["国籍"],
  province: ["省份", "所在省"],
  city: ["城市", "所在城市"],
  birth_or_established_date: ["出生日期", "成立日期"],
} as const;

const choiceAliases = {
  work_type: ["软件作品说明", "作品说明", "作品类型"],
  development_method: ["开发方式"],
  rights_acquisition_method: ["权利取得方式"],
  rights_scope: ["权利范围"],
  application_method: ["申请办理方式", "办理方式"],
  is_published: ["是否发表", "发表状态"],
} as const;

const choiceLabels = {
  work_type: { original: ["原创", "原始"], modified: ["修改", "改编"] },
  development_method: { independent: ["单独开发", "独立开发"], cooperative: ["合作开发"] },
  rights_acquisition_method: { original: ["原始取得", "原始"], transfer: ["受让", "转让"], inheritance: ["继承"], assumption: ["承受"] },
  rights_scope: { all: ["全部权利", "全部"], partial: ["部分权利", "部分"] },
  application_method: { copyright_holder: ["著作权人申请办理", "著作权人"], agent: ["代理人申请办理", "代理人"] },
  is_published: { true: ["已发表", "是"], false: ["未发表", "否"] },
} as const;

const uploadAliases: Record<MaterialKind, string[]> = {
  source_code_pdf: ["源代码 PDF", "源程序鉴别材料", "源程序", "源代码"],
  user_manual_pdf: ["用户手册 PDF", "文档鉴别材料", "用户手册", "软件说明书", "文档"],
  cooperation_agreement: ["合作开发协议", "合作协议"],
  commission_agreement: ["委托开发协议", "委托协议"],
  task_order: ["下达任务开发证明", "任务书", "任务开发证明"],
  signature_page: ["申请确认签章页", "签章页", "签字盖章页"],
  source_code_docx: ["源代码 DOCX"],
  user_manual_docx: ["用户手册 DOCX"],
  application_summary_pdf: ["申请信息摘要 PDF", "申请表"],
  holder_identity_proof: ["身份证明", "主体资格证明"],
};

export function normalizeVisibleText(value: string): string {
  return value.replace(/[\s\u3000:：*（）()【】\[\]<>]/g, "").toLowerCase();
}

export function isVisible(element: Element): boolean {
  const node = element as HTMLElement;
  if (node.hidden || node.getAttribute("aria-hidden") === "true") return false;
  const style = typeof window !== "undefined" ? window.getComputedStyle(node) : null;
  return style?.display !== "none" && style?.visibility !== "hidden";
}

function textOf(element: Element): string {
  const node = element as HTMLElement;
  const parts = [
    element.getAttribute("aria-label") || "",
    element.getAttribute("title") || "",
    element.getAttribute("name") || "",
    element.getAttribute("placeholder") || "",
    element.getAttribute("id") || "",
  ];
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const id = element.getAttribute("id");
    if (id) parts.push(document.querySelector(`label[for='${CSS.escape(id)}']`)?.textContent || "");
  }
  const label = element.closest("label");
  if (label) parts.push(label.textContent || "");
  const parent = element.closest("td,fieldset,.form-item,.form-group,.ant-form-item,.el-form-item,[data-field]");
  if (parent) parts.push(parent.textContent || "");
  return parts.concat(node.dataset ? Object.values(node.dataset).filter((value): value is string => typeof value === "string") : []).join(" ");
}

function scoreText(element: Element, aliases: readonly string[]): number {
  const raw = textOf(element);
  const normalized = normalizeVisibleText(raw);
  let best = 0;
  for (const alias of aliases) {
    const target = normalizeVisibleText(alias);
    if (!target) continue;
    if (normalized === target) best = Math.max(best, 100);
    else if (normalized.includes(target)) best = Math.max(best, 60);
    else if (target.includes(normalized) && normalized.length >= 2) best = Math.max(best, 30);
  }
  return best;
}

function uniqueElements<T extends Element>(elements: T[]): T[] {
  return Array.from(new Set(elements));
}

export function findUniqueSemanticControl(root: ParentNode, aliases: readonly string[], selector = TEXT_CONTROL_SELECTOR): HTMLElement {
  const candidates = uniqueElements(Array.from(root.querySelectorAll(selector)).filter(isVisible));
  const scored = candidates.map((element) => ({ element, score: scoreText(element, aliases) })).filter((item) => item.score > 0);
  if (!scored.length) throw new AdapterError("field_not_found", aliases.join("/"));
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max).map((item) => item.element);
  if (winners.length !== 1) throw new AdapterError("field_ambiguous", aliases.join("/"));
  return winners[0] as HTMLElement;
}

function dispatchValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  dispatchValue(element);
}

function normalizedValue(value: string): string {
  return value.replace(/[\s\u3000]/g, "").toLowerCase();
}

function setControlValue(element: HTMLElement, value: string, labels: readonly string[] = []): void {
  if (element instanceof HTMLSelectElement) {
    const wanted = [value, ...labels].map(normalizedValue);
    const option = Array.from(element.options).find((candidate) => wanted.includes(normalizedValue(candidate.value)) || wanted.includes(normalizedValue(candidate.textContent || "")));
    if (!option) throw new AdapterError("field_verification_failed");
    element.value = option.value;
    dispatchValue(element);
    if (normalizedValue(element.value) !== normalizedValue(option.value)) throw new AdapterError("field_verification_failed");
    return;
  }
  if (element instanceof HTMLInputElement && (element.type === "radio" || element.type === "checkbox")) {
    const checked = value === "true" || value === "1";
    element.checked = checked;
    dispatchValue(element);
    if (element.checked !== checked) throw new AdapterError("field_verification_failed");
    return;
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setInputValue(element, value);
    if (normalizedValue(element.value) !== normalizedValue(value)) throw new AdapterError("field_verification_failed");
    return;
  }
  element.textContent = value;
}

function controlContainer(element: Element): HTMLElement {
  return (element.closest("td,fieldset,.form-item,.form-group,.ant-form-item,.el-form-item,[data-field]") || element.parentElement || element) as HTMLElement;
}

function findChoiceIn(root: ParentNode, aliases: readonly string[], labels: readonly string[]): HTMLElement {
  const control = findUniqueSemanticControl(root, aliases);
  if (control instanceof HTMLSelectElement) return control;
  const container = controlContainer(control);
  const wanted = labels.map(normalizeVisibleText);
  const choices = uniqueElements(Array.from(container.querySelectorAll("label,button,[role='radio'],[role='option'],input[type='radio'],input[type='checkbox']")).filter(isVisible));
  const matches = choices.filter((choice) => {
    const text = normalizeVisibleText(choice.textContent || choice.getAttribute("aria-label") || choice.getAttribute("value") || "");
    return wanted.some((item) => text === item || text.includes(item));
  });
  if (matches.length !== 1) throw new AdapterError(matches.length ? "field_ambiguous" : "field_not_found");
  return matches[0] as HTMLElement;
}

function choose(root: ParentNode, aliases: readonly string[], value: string, labels: readonly string[]): void {
  const control = findUniqueSemanticControl(root, aliases);
  if (control instanceof HTMLSelectElement) {
    setControlValue(control, value, labels);
    return;
  }
  const choice = findChoiceIn(root, aliases, labels);
  if (choice instanceof HTMLInputElement) {
    choice.click();
  } else {
    choice.click();
    if (choice.getAttribute("aria-checked") !== "true" && choice.getAttribute("aria-selected") !== "true") {
      choice.setAttribute("aria-checked", "true");
      choice.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  const selected = choice instanceof HTMLInputElement ? choice.checked : choice.getAttribute("aria-checked") === "true" || choice.getAttribute("aria-selected") === "true";
  if (!selected) throw new AdapterError("field_verification_failed");
}

function fillText(root: ParentNode, aliases: readonly string[], value: string): void {
  const control = findUniqueSemanticControl(root, aliases);
  setControlValue(control, value);
}

function fillOptionalText(root: ParentNode, aliases: readonly string[], value: string): void {
  if (!value) return;
  fillText(root, aliases, value);
}

function waitForDomUpdate(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function holderRows(root: ParentNode): HTMLElement[] {
  const explicit = Array.from(root.querySelectorAll("[data-holder-row],.copyright-holder-row,.holder-row")).filter(isVisible) as HTMLElement[];
  if (explicit.length) return uniqueElements(explicit);
  const controls = Array.from(root.querySelectorAll(TEXT_CONTROL_SELECTOR)).filter((element) => scoreText(element, holderAliases.name) > 0 && isVisible(element));
  const rows: HTMLElement[] = [];
  for (const control of controls) {
    const row = control.closest("tr,fieldset,[class*='holder'],[class*='copyright']") as HTMLElement | null;
    if (row && !rows.includes(row)) rows.push(row);
  }
  return rows;
}

function findButton(root: ParentNode, aliases: readonly string[]): HTMLElement {
  const buttons = uniqueElements(Array.from(root.querySelectorAll("button,a,[role='button'],input[type='button'],input[type='submit']")).filter(isVisible));
  const scored = buttons.map((element) => ({ element, score: scoreText(element, aliases) })).filter((item) => item.score > 0);
  if (!scored.length) throw new AdapterError("field_not_found");
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max);
  if (winners.length !== 1) throw new AdapterError("field_ambiguous");
  return winners[0].element as HTMLElement;
}

export function hasVisibleLoginPrompt(root: ParentNode = document): boolean {
  const body = root instanceof Document ? root.body : root as HTMLElement;
  const text = normalizeVisibleText(body?.innerText || root.textContent || "");
  const hasLoginText = text.includes("立即登录") || text.includes("密码登录") || text.includes("验证码登录");
  const hasCredentialControl = Array.from(root.querySelectorAll("input")).some((element) => isVisible(element) && (element.getAttribute("placeholder") || element.getAttribute("type")));
  return hasLoginText && hasCredentialControl;
}

export function hasApplicationForm(root: ParentNode = document): boolean {
  const controls = Array.from(root.querySelectorAll(TEXT_CONTROL_SELECTOR)).filter(isVisible);
  return controls.some((element) => scoreText(element, textFieldAliases.software_full_name || []) >= 30);
}

export function hasUploadControls(root: ParentNode = document): boolean {
  return Array.from(root.querySelectorAll("input[type='file']")).some((element) => {
    const input = element as HTMLInputElement;
    return !input.disabled && (isVisible(input) || isVisible(controlContainer(input)));
  });
}

export class R11Adapter {
  constructor(private readonly root: Document = document) {}

  isLandingPage(): boolean {
    const text = normalizeVisibleText(this.root.body?.innerText || "");
    return text.includes("计算机软件著作权登记申请") && Array.from(this.root.querySelectorAll("button,a,[role='button']")).some((element) => isVisible(element) && normalizeVisibleText(element.textContent || "").includes("立即登记"));
  }

  openR11Entry(): void {
    const targetTitle = normalizeVisibleText("计算机软件著作权登记申请");
    const headings = uniqueElements(Array.from(this.root.querySelectorAll("h1,h2,h3,[role='heading']"))
      .filter(isVisible)
      .filter((element) => normalizeVisibleText(element.textContent || "").includes(targetTitle)));
    if (headings.length === 1) {
      const container = headings[0].closest("td,article,section,li,[class*='card'],[class*='item'],[class*='link-box'],[data-entry]") as HTMLElement | null;
      const buttons = container
        ? uniqueElements(Array.from(container.querySelectorAll("button,a,[role='button']")).filter(isVisible).filter((element) => normalizeVisibleText(element.textContent || "").includes("立即登记")))
        : [];
      if (buttons.length === 1) {
        (buttons[0] as HTMLElement).click();
        return;
      }
      if (buttons.length > 1) throw new AdapterError("field_ambiguous");
    }
    if (headings.length > 1) throw new AdapterError("field_ambiguous");
    const cards = Array.from(this.root.querySelectorAll("article,section,li,.card,[class*='card'],[class*='item']")).filter(isVisible).filter((element) => normalizeVisibleText(element.textContent || "").includes("计算机软件著作权登记申请"));
    const cardButtons = uniqueElements(cards.flatMap((card) => Array.from(card.querySelectorAll("button,a,[role='button']")).filter((element) => normalizeVisibleText(element.textContent || "").includes("立即登记"))));
    if (cardButtons.length !== 1) throw new AdapterError(cardButtons.length ? "field_ambiguous" : "field_not_found");
    (cardButtons[0] as HTMLElement).click();
  }

  async fillApplication(form: CopyrightFormData): Promise<void> {
    if (form.development_method !== "independent" && form.development_method !== "cooperative") {
      throw new AdapterError("unsupported_development_method");
    }
    const root = this.root;
    const textFields: Array<keyof CopyrightFormData> = [
      "software_full_name", "software_short_name", "version", "software_category", "development_date",
      "applicant_address", "postal_code", "contact_name", "contact_phone", "contact_email",
      "development_hardware", "runtime_hardware", "development_os", "development_tools",
      "runtime_platform", "runtime_environment", "programming_language", "source_code_lines",
      "development_purpose", "target_industry", "main_functions", "technical_features",
    ];
    for (const field of textFields) {
      const value = String(form[field] ?? "");
      if (!value && field !== "software_short_name") continue;
      const aliases = textFieldAliases[field];
      if (aliases) fillText(root, aliases, value);
    }
    choose(root, choiceAliases.work_type, form.work_type, choiceLabels.work_type[form.work_type]);
    choose(root, choiceAliases.development_method, form.development_method, choiceLabels.development_method[form.development_method]);
    choose(root, choiceAliases.rights_acquisition_method, form.rights_acquisition_method, choiceLabels.rights_acquisition_method[form.rights_acquisition_method]);
    choose(root, choiceAliases.rights_scope, form.rights_scope, choiceLabels.rights_scope[form.rights_scope]);
    choose(root, choiceAliases.application_method, form.application_method, choiceLabels.application_method[form.application_method]);
    choose(root, choiceAliases.is_published, String(form.is_published), choiceLabels.is_published[String(form.is_published) as "true" | "false"]);
    // Official form implementations often render conditional controls after
    // a select/change event. Let that render settle before querying them.
    await waitForDomUpdate();
    if (form.work_type === "modified") {
      fillText(root, textFieldAliases.original_registration_number || [], form.original_registration_number);
      fillText(root, textFieldAliases.modification_description || [], form.modification_description);
    }
    if (form.rights_scope === "partial") fillText(root, textFieldAliases.rights_scope_description || [], form.rights_scope_description);
    if (form.is_published) {
      fillText(root, textFieldAliases.first_publication_date || [], form.first_publication_date);
      fillText(root, textFieldAliases.first_publication_country || [], form.first_publication_country);
      fillText(root, textFieldAliases.first_publication_city || [], form.first_publication_city);
    }
    await this.fillHolders(form.copyright_holders);
  }

  private async fillHolders(holders: CopyrightHolder[]): Promise<void> {
    if (!holders.length) throw new AdapterError("field_not_found");
    let rows = holderRows(this.root);
    while (rows.length < holders.length) {
      const button = findButton(this.root, ["增加著作权人", "添加著作权人", "新增著作权人", "增加权利人"]);
      button.click();
      await waitForDomUpdate();
      rows = holderRows(this.root);
      if (rows.length < holders.length) throw new AdapterError("portal_structure_changed");
    }
    if (rows.length !== holders.length) throw new AdapterError("field_ambiguous");
    for (const [index, holder] of holders.entries()) await this.fillHolderRow(rows[index], holder);
  }

  private async fillHolderRow(row: HTMLElement, holder: CopyrightHolder): Promise<void> {
    choose(row, holderAliases.holder_type, holder.holder_type, holder.holder_type === "person" ? ["个人", "自然人"] : ["机构", "企业", "单位"]);
    await waitForDomUpdate();
    fillText(row, holderAliases.name, holder.name);
    fillText(row, holderAliases.category, holder.category);
    fillText(row, holderAliases.document_type, holder.document_type);
    fillText(row, holderAliases.document_number, holder.document_number);
    fillText(row, holderAliases.nationality, holder.nationality);
    fillText(row, holderAliases.province, holder.province);
    fillText(row, holderAliases.city, holder.city);
    if (holder.holder_type === "person") fillOptionalText(row, holderAliases.birth_or_established_date, holder.birth_or_established_date || "");
  }

  clickNextToMaterials(): void {
    const button = findButton(this.root, ["保存并下一步", "下一步", "继续填写", "继续"]).textContent || "";
    if (normalizeVisibleText(button).includes("提交") || normalizeVisibleText(button).includes("申报")) throw new AdapterError("portal_structure_changed");
    findButton(this.root, ["保存并下一步", "下一步", "继续填写", "继续"]).click();
  }

  findUploadInput(kind: MaterialKind): HTMLInputElement {
    const aliases = uploadAliases[kind];
    const candidates = Array.from(this.root.querySelectorAll("input[type='file']")).filter((element) => {
      const input = element as HTMLInputElement;
      return !input.disabled && (isVisible(input) || isVisible(controlContainer(input)));
    });
    const scored = candidates.map((element) => ({ element, score: scoreText(element, aliases) })).filter((item) => item.score > 0);
    if (!scored.length) {
      if (candidates.length === 1) return candidates[0] as HTMLInputElement;
      throw new AdapterError(candidates.length ? "field_ambiguous" : "field_not_found");
    }
    const max = Math.max(...scored.map((item) => item.score));
    const winners = scored.filter((item) => item.score === max);
    if (winners.length !== 1) throw new AdapterError("field_ambiguous");
    return winners[0].element as HTMLInputElement;
  }

  uploadAcknowledged(input: HTMLInputElement): boolean {
    if (input.files && input.files.length > 0) return true;
    const container = controlContainer(input);
    const text = normalizeVisibleText(container.textContent || "");
    return text.includes("上传成功") || text.includes("文件已上传") || text.includes("已选择");
  }
}
