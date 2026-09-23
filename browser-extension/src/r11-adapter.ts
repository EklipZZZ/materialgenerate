import type { CopyrightFormData, CopyrightHolder } from "../../src/lib/copyright-form.ts";
import type { FilingProfile } from "../../src/lib/filing-profile.ts";
import type { MaterialKind } from "../../src/lib/materials.ts";
import {
  isOfficialSoftwareCategory,
  parseChoiceSelection,
  TECHNICAL_FEATURE_OPTIONS,
} from "../../src/lib/copyright-options.ts";

export type AdapterErrorCode =
  | "unsupported_development_method"
  | "field_not_found"
  | "field_ambiguous"
  | "field_verification_failed"
  | "portal_structure_changed"
  | "manual_upload_required";

export type R11Page =
  | "identity"
  | "application"
  | "development"
  | "features"
  | "confirm"
  | "materials"
  | "legacy"
  | "unknown";

export class AdapterError extends Error {
  constructor(public readonly code: AdapterErrorCode, message: string = code) {
    super(message);
    this.name = "AdapterError";
  }
}

const TEXT_CONTROL_SELECTOR = [
  "input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox'])",
  "textarea",
  "select",
  "[role='textbox']",
  "[role='combobox']",
  "[contenteditable='true']",
].join(",");

const CHOICE_CONTROL_SELECTOR = [
  "select",
  ".hd-select",
  ".hd-cascader",
  "[role='combobox']",
  ".hd-radio-group",
  "[role='radiogroup']",
  ".radio-group",
  ".hd-checkbox-group",
  ".checkbox-group",
].join(",");

const FIELD_CONTEXT_SELECTOR = [
  ".fillin_item",
  ".formGroup-item-body-left-item",
  ".formGroup-item",
  ".form-item",
  ".form-group",
  ".ant-form-item",
  ".el-form-item",
  "fieldset",
  "td",
  "[data-field]",
].join(",");

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
  development_hardware: ["开发的硬件环境", "开发硬件环境"],
  runtime_hardware: ["运行的硬件环境", "运行硬件环境"],
  development_os: ["开发该软件的操作系统", "开发的操作系统", "开发操作系统"],
  development_tools: ["软件开发环境 / 开发工具", "软件开发环境/开发工具", "软件开发环境工具", "开发环境工具", "开发工具"],
  runtime_platform: ["该软件的运行平台 / 操作系统", "该软件的运行平台/操作系统", "软件运行平台", "运行平台操作系统", "运行平台"],
  runtime_environment: ["软件运行支撑环境", "运行支撑环境", "运行环境"],
  programming_language: ["编程语言", "开发语言"],
  source_code_lines: ["源程序量", "源程序代码行数", "源码代码行数", "代码行数"],
  development_purpose: ["开发目的"],
  target_industry: ["面向领域/行业", "面向领域", "所属行业"],
  main_functions: ["软件的主要功能", "主要功能"],
  technical_features: ["软件的技术特点", "软件技术特点", "技术特点"],
};

const filingProfileAliases: Array<[keyof FilingProfile, readonly string[]]> = [
  ["applicant_address", ["申请人地址", "联系地址", "通讯地址"]],
  ["postal_code", ["邮政编码", "邮编"]],
  ["contact_name", ["联系人", "联系代表"]],
  ["contact_phone", ["联系电话", "联系人电话", "手机"]],
];

const holderAliases = {
  holder_type: ["著作权人类型", "权利人类型", "人员类型", "身份类别", "主体类型", "请选择身份类别"],
  name: ["著作权人名称", "姓名/名称", "姓名或名称", "姓名", "单位名称", "权利人名称", "请输入姓名", "请输入单位名称"],
  category: ["著作权人类别", "单位类别", "主体类别"],
  document_type: ["证件类型", "身份证明类型", "请选择证件类型"],
  document_number: ["证件号码", "统一社会信用代码", "身份证号", "证件号", "请输入证件号码"],
  nationality: ["国籍", "国家/地区", "所在国家", "国家", "请选择国家", "请选择国家/地区"],
  province: ["省份", "所在省", "请输入省份", "请输入省份(限中文)"],
  city: ["城市", "所在城市", "请输入城市", "请输入城市(限中文)"],
  area: ["省市", "省份城市", "所在地区", "地区", "请选择地区", "无地区信息"],
  birth_or_established_date: ["出生日期", "成立日期"],
} as const;

const choiceAliases = {
  work_type: ["软件作品说明", "软件说明", "作品说明", "作品类型"],
  development_method: ["开发方式", "开发模式"],
  rights_acquisition_method: ["权利取得方式"],
  rights_scope: ["权利范围"],
  application_method: ["申请办理方式", "办理方式"],
  is_published: ["是否发表", "发表状态"],
  cooperate_is_only: ["是否多个著作权人共同享有软件著作权", "多个著作权人共同享有软件著作权"],
} as const;

const choiceLabels = {
  work_type: { original: ["原创", "原始", "原始作品"], modified: ["修改", "修改作品", "改编"] },
  development_method: {
    independent: ["单独开发", "独立开发"],
    cooperative: ["合作开发"],
    commissioned: ["委托开发"],
    assigned_task: ["下达任务开发", "任务开发"],
  },
  rights_acquisition_method: {
    original: ["原始取得", "原始"],
    transfer: ["继受取得", "受让", "转让"],
    inheritance: ["继受取得", "继承"],
    assumption: ["继受取得", "承受"],
  },
  rights_scope: { all: ["全部权利", "全部"], partial: ["部分权利", "部分"] },
  application_method: { copyright_holder: ["著作权人申请办理", "著作权人"], agent: ["代理人申请办理", "代理人"] },
  is_published: { true: ["已发表", "是"], false: ["未发表", "否"] },
} as const;

// The application keeps the user-facing legacy label "应用软件", while the
// current R11 portal exposes the corresponding option as "APP". Keep this
// conversion at the browser boundary; it must not change the saved form data.
const officialSoftwareCategoryLabels: Record<string, string> = {
  "应用软件": "APP",
  APP: "APP",
  "嵌入式软件": "嵌入式软件",
  "中间件": "中间件",
  "操作系统": "操作系统",
};

function toOfficialSoftwareCategory(value: string): string {
  return officialSoftwareCategoryLabels[value.trim()] || value.trim();
}

function holderDocumentTypeLabels(holder: CopyrightHolder): string[] {
  const labels = [holder.document_type];
  if (holder.holder_type === "person") labels.push("居民身份证", "身份证");
  else labels.push("统一社会信用代码证书", "统一社会信用代码");
  return Array.from(new Set(labels));
}

const uploadAliases: Record<MaterialKind, string[]> = {
  source_code_pdf: ["源代码 PDF", "程序鉴别材料", "源程序鉴别材料", "源程序", "源代码"],
  user_manual_pdf: ["用户手册 PDF", "文档鉴别材料", "用户手册", "软件说明书", "文档"],
  cooperation_agreement: ["合作开发合同或协议", "合作开发协议", "合作协议"],
  commission_agreement: ["委托开发合同或协议", "委托开发协议", "委托协议"],
  task_order: ["项目任务书或合同", "下达任务开发证明", "任务书", "任务开发证明"],
  signature_page: ["申请确认签章页", "签章页", "签字盖章页"],
  source_code_docx: ["源代码 DOCX"],
  user_manual_docx: ["用户手册 DOCX"],
  application_summary_pdf: ["申请信息摘要 PDF", "申请表"],
  holder_identity_proof: ["身份证明", "主体资格证明"],
};

export function normalizeVisibleText(value: string): string {
  return value.replace(/[\s\u3000:：*（）()【】\[\]<>]/g, "").toLowerCase();
}

function normalizedValue(value: string): string {
  return normalizeVisibleText(value).replace(/[，、,;；/\\|]/g, "");
}

export function isVisible(element: Element): boolean {
  if (typeof window === "undefined") return true;
  let current: Element | null = element;
  while (current) {
    const node = current as HTMLElement;
    if (node.hidden || current.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    current = current.parentElement;
  }
  return true;
}

function isDisabled(element: Element): boolean {
  const node = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement;
  const className = typeof node.className === "string" ? node.className : "";
  return Boolean(
    ("disabled" in node && node.disabled)
    || node.getAttribute("aria-disabled") === "true"
    || /(^|\s)(disabled|is-disabled|hd-select-disabled)(\s|$)/i.test(className),
  );
}

function directTextOf(element: Element): string {
  const node = element as HTMLElement;
  const parts = [
    element.getAttribute("aria-label") || "",
    element.getAttribute("title") || "",
    element.getAttribute("name") || "",
    element.getAttribute("placeholder") || "",
    element.getAttribute("id") || "",
    element.getAttribute("data-field") || "",
    element.getAttribute("data-name") || "",
    element.getAttribute("data-testid") || "",
  ];
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const id = element.getAttribute("id");
    if (id) {
      const owner = element.ownerDocument || document;
      const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(id) : id.replace(/['\\]/g, "\\$&");
      parts.push(owner.querySelector(`label[for='${escaped}']`)?.textContent || "");
    }
  }
  const label = element.closest("label");
  if (label) parts.push(label.textContent || "");
  return parts.concat(node.dataset ? Object.values(node.dataset).filter((value): value is string => typeof value === "string") : []).join(" ");
}

function contextTextOf(element: Element): string {
  const parts: string[] = [];

  // R11 uses `.fillin_item` as a visual section, but a single section can
  // contain more than one control (for example the development-method radio
  // group and the “multiple copyright holders” radio group).  The nearest
  // `.fillin_item` therefore is too broad to identify a choice. Prefer the
  // nearest control block and its preceding heading, then fall back to the
  // broad field container for older portal layouts.
  const local = element.closest(
    ".fillin_info,.formGroup-item-body-left-item,.form-item,.form-group,.ant-form-item,.el-form-item,fieldset,td,[data-field]",
  );
  if (local?.textContent) parts.push(local.textContent);

  const section = element.closest(".fillin_item");
  if (section) {
    const headings = Array.from(section.querySelectorAll("h1,h2,h3,h4,h5,h6,[role='heading']"));
    const preceding = headings.filter((heading) => Boolean(heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING));
    const heading = preceding[preceding.length - 1];
    if (heading?.textContent) parts.push(heading.textContent);
  }

  if (!parts.length) {
    const parent = element.closest(FIELD_CONTEXT_SELECTOR);
    if (parent?.textContent) parts.push(parent.textContent);
  }
  return parts.join(" ");
}

function scoreText(element: Element, aliases: readonly string[]): number {
  const direct = normalizeVisibleText(directTextOf(element));
  const context = normalizeVisibleText(contextTextOf(element));
  let directBest = 0;
  let contextBest = 0;
  for (const alias of aliases) {
    const target = normalizeVisibleText(alias);
    if (!target) continue;
    if (direct === target) directBest = Math.max(directBest, 200);
    else if (direct.includes(target)) directBest = Math.max(directBest, 160);
    else if (target.includes(direct) && direct.length >= 2) directBest = Math.max(directBest, 100);
    if (context === target) contextBest = Math.max(contextBest, 40);
    else if (context.includes(target)) contextBest = Math.max(contextBest, 30);
    else if (target.includes(context) && context.length >= 2) contextBest = Math.max(contextBest, 20);
  }
  // A placeholder, aria label, associated label, or data field belongs to
  // one control. Ancestor text is only a fallback because R11 puts the
  // software full name, short name, and version controls in one shared
  // `.fillin_item`; treating that whole ancestor as an equal match makes
  // those three inputs ambiguous and can leave Vue's model empty.
  return directBest || contextBest;
}

function scoreAction(element: Element, aliases: readonly string[]): number {
  const normalized = normalizeVisibleText(element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || "");
  let best = 0;
  for (const alias of aliases) {
    const target = normalizeVisibleText(alias);
    if (normalized === target) best = Math.max(best, 100);
    else if (normalized.includes(target)) best = Math.max(best, 60);
  }
  return best;
}

function uniqueElements<T extends Element>(elements: T[]): T[] {
  return Array.from(new Set(elements));
}

function choiceControls(root: ParentNode): HTMLElement[] {
  const controls = Array.from(root.querySelectorAll(CHOICE_CONTROL_SELECTOR)).filter(isVisible) as HTMLElement[];
  // GetArea renders an `.cascader` wrapper around the real `.hd-cascader`.
  // Only use the wrapper as a fallback for portal builds that do not expose
  // the inner component class; including both at once would make one field
  // look like two equally good matches.
  const legacyCascaders = Array.from(root.querySelectorAll(".cascader"))
    .filter(isVisible)
    .filter((element) => !element.querySelector(".hd-cascader")) as HTMLElement[];
  return uniqueElements([...controls, ...legacyCascaders]);
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

function findUniqueSemanticControlIfPresent(root: ParentNode, aliases: readonly string[], selector = TEXT_CONTROL_SELECTOR): HTMLElement | null {
  const candidates = uniqueElements(Array.from(root.querySelectorAll(selector)).filter(isVisible));
  const scored = candidates.map((element) => ({ element, score: scoreText(element, aliases) })).filter((item) => item.score > 0);
  if (!scored.length) return null;
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max).map((item) => item.element);
  if (winners.length !== 1) throw new AdapterError("field_ambiguous", aliases.join("/"));
  return winners[0] as HTMLElement;
}

function findUniqueChoiceControl(root: ParentNode, aliases: readonly string[]): HTMLElement {
  const candidates = choiceControls(root);
  const scored = candidates.map((element) => ({ element, score: scoreText(element, aliases) })).filter((item) => item.score > 0);
  if (!scored.length) throw new AdapterError("field_not_found", aliases.join("/"));
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max).map((item) => item.element);
  if (winners.length !== 1) throw new AdapterError("field_ambiguous", aliases.join("/"));
  return winners[0] as HTMLElement;
}

function findUniqueChoiceControlIfPresent(root: ParentNode, aliases: readonly string[]): HTMLElement | null {
  const candidates = choiceControls(root);
  const scored = candidates.map((element) => ({ element, score: scoreText(element, aliases) })).filter((item) => item.score > 0);
  if (!scored.length) return null;
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max).map((item) => item.element);
  if (winners.length !== 1) throw new AdapterError("field_ambiguous", aliases.join("/"));
  return winners[0] as HTMLElement;
}

function dispatchInput(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement): void {
  try {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: null }));
  } catch {
    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }
}

function dispatchValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement): void {
  dispatchInput(element);
  element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}

async function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  element.focus();
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  const write = () => {
    if (setter) setter.call(element, value);
    else element.value = value;
    dispatchInput(element);
  };
  write();
  // The official portal uses Vue 2 controlled inputs. The native value is
  // visible immediately, while the component model and its parent props are
  // updated on the next Vue render tick. Let input/change handlers settle on
  // separate ticks and rewrite if a stale parent prop rendered over the value.
  await waitForDomUpdate(1);
  element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  await waitForDomUpdate(2);
  if (element.value !== value) {
    write();
    await waitForDomUpdate(2);
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    await waitForDomUpdate(1);
  }
  // Send one final input/change pair while the field is still focused, then
  // use a real DOM blur so the component and its parent commit the same value
  // before R11 runs its required-field validator. This avoids the small Vue 2
  // window in which a synthetic blur can validate the previous parent prop.
  dispatchInput(element);
  await waitForDomUpdate(1);
  element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  await waitForDomUpdate(2);
  element.blur();
  await waitForDomUpdate(2);
}

function readControlValue(element: HTMLElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
  const customControl = element.matches(".cascader")
    ? (element.querySelector(".hd-cascader") as HTMLElement | null) || element
    : element;
  if (customControl.matches(".hd-select,.hd-cascader")) {
    const display = customControl.querySelector(".box,.label,[role='combobox'],.select-box,.select-value,.selected-value,.hd-select-value") as HTMLElement | null;
    const input = display?.matches("input")
      ? display as HTMLInputElement
      : display?.querySelector("input") as HTMLInputElement | null;
    if (input?.value) return input.value;
    // Do not fall back to the whole custom control when a display node is
    // present. Its dropdown contains every option (often hidden with CSS),
    // so using customControl.textContent would make an empty select appear
    // to already contain whichever option we are looking for.
    return display ? display.textContent || "" : customControl.textContent || "";
  }
  const nested = element.querySelector("input,textarea,select") as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (nested) return nested.value;
  return element.textContent || "";
}

async function waitForStableValue(element: HTMLElement, value: string, labels: readonly string[] = [], timeoutMs = 1_800): Promise<void> {
  const wanted = [value, ...labels].map(normalizedValue).filter(Boolean);
  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;
  while (Date.now() < deadline) {
    const rawCurrent = readControlValue(element);
    const current = normalizedValue(rawCurrent);
    const matches = parseDate(value) && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
      ? dateValuesMatch(rawCurrent, value)
      : element.matches(".hd-select")
      ? controlValueMatches(element, value, labels)
      : wanted.length === 0
        ? current.length === 0
        : wanted.some((item) => current === item || current.includes(item));
    if (matches) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= 50) {
        return;
      }
    } else {
      stableSince = 0;
    }
    await waitForDomUpdate(1);
  }
  throw new AdapterError("field_verification_failed");
}

function calendarWrapper(element: HTMLElement): HTMLElement | null {
  return element.closest(".datePicker,.datepicker,.hd-date-picker,.date-picker") as HTMLElement | null;
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  // The application normally sends YYYY-MM-DD. Accept an ISO timestamp or
  // slash-separated value as well, but always choose the date through the
  // official picker so its Vue model receives the timestamp it expects.
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|T|\s)/.exec(value.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function dateValuesMatch(actual: string, expected: string): boolean {
  if (normalizedValue(actual) === normalizedValue(expected)) return true;
  const actualDate = parseDate(actual);
  const expectedDate = parseDate(expected);
  return Boolean(actualDate && expectedDate
    && actualDate.year === expectedDate.year
    && actualDate.month === expectedDate.month
    && actualDate.day === expectedDate.day);
}

async function waitForDateInputValue(input: HTMLInputElement, expected: string, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;
  while (Date.now() < deadline) {
    if (dateValuesMatch(input.value, expected)) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= 80) return;
    } else {
      stableSince = 0;
    }
    await waitForDomUpdate(1);
  }
  throw new AdapterError("field_verification_failed", "日期选择后官网状态未确认");
}

function dateText(element: Element): string {
  return (element as HTMLInputElement).value || element.textContent || "";
}

function dateCellIsDisabled(cell: Element): boolean {
  const className = typeof (cell as HTMLElement).className === "string" ? (cell as HTMLElement).className : "";
  return cell.getAttribute("aria-disabled") === "true" || /disabled|other-month|prev-month|next-month/.test(className);
}

function isOpenCalendar(element: Element): boolean {
  if (!isVisible(element)) return false;
  const node = element as HTMLElement;
  const style = typeof window !== "undefined" ? window.getComputedStyle(node) : null;
  if (node.matches(".datepicker-main")) {
    // The official R11 date picker keeps the panel mounted and toggles only
    // the `open` class. `display !== none` is therefore not enough to tell an
    // open panel from a closed one.
    return node.classList.contains("open")
      && style?.display !== "none"
      && style?.visibility !== "hidden"
      && style?.opacity !== "0";
  }
  return style?.display !== "none"
    && style?.visibility !== "hidden"
    && style?.opacity !== "0"
    && style?.maxHeight !== "0px";
}

function visibleCalendar(root: ParentNode): HTMLElement | null {
  const candidates = Array.from(root.querySelectorAll(".datepicker-main,.datepicker-panel,.date-picker-panel,.calendar,[role='dialog']"));
  return (candidates.find((candidate) => isOpenCalendar(candidate)) as HTMLElement | undefined) || null;
}

function calendarMonth(root: ParentNode): { year: number; month: number } | null {
  const calendar = visibleCalendar(root);
  if (!calendar) return null;
  // The official non-NB picker keeps all 401 year options mounted inside the
  // hidden year menu. Reading `calendar.textContent` therefore finds 2000
  // before it finds the displayed 2026 header. Read the two visible header
  // controls first and only use the compact NB header as a fallback.
  const selects = Array.from(calendar.querySelectorAll(".datePickerSelect")).filter(isVisible);
  if (selects.length >= 2) {
    const yearText = (selects[0].querySelector(".datePickerSelectText")?.textContent || "").trim();
    const monthText = (selects[1].querySelector(".datePickerSelectText")?.textContent || "").trim();
    const yearMatch = /(20\d{2})/.exec(yearText);
    const monthMatch = /(1[0-2]|0?[1-9])\s*月/.exec(monthText);
    if (yearMatch && monthMatch) return { year: Number(yearMatch[1]), month: Number(monthMatch[1]) };
  }
  const headerText = calendar.querySelector(".datepicker-header")?.textContent || "";
  const headerMatch = /(20\d{2})\s*年\s*(1[0-2]|0?[1-9])\s*月/.exec(headerText);
  return headerMatch ? { year: Number(headerMatch[1]), month: Number(headerMatch[2]) } : null;
}

function calendarNavigation(root: ParentNode, direction: "previous" | "next"): HTMLElement | null {
  const calendar = visibleCalendar(root);
  if (!calendar) return null;
  // R11 has four spans with the same class: previous year, next year,
  // previous month and next month. Selecting by “prev/next” text is not
  // enough because the SVGs have no accessible label. The second control in
  // each direction is the month control. Return its SVG because the official
  // Vue click listener is attached to the SVG, not the wrapper span.
  const className = direction === "previous" ? ".datepicke-btn-prve" : ".datepicke-btn-next";
  const matches = Array.from(calendar.querySelectorAll(`.datepicker-header ${className}`)).filter(isVisible);
  if (matches.length >= 2) {
    const monthButton = matches[1] as HTMLElement;
    return (monthButton.querySelector("svg") as HTMLElement | null) || monthButton;
  }

  // Keep a semantic fallback for older portal builds that expose only one
  // previous/next button with an aria-label or title.
  const candidates = Array.from(calendar.querySelectorAll("button,a,[role='button'],[class*='month'],[class*='arrow'],[class*='prev'],[class*='prve'],[class*='next']")).filter(isVisible);
  const terms = direction === "previous"
    ? ["上一月", "上个月", "prev", "prve", "previous", "<", "‹"]
    : ["下一月", "下个月", "next", ">", "›"];
  const semanticMatches = candidates.filter((candidate) => {
    const text = normalizeVisibleText(candidate.getAttribute("aria-label") || candidate.getAttribute("title") || candidate.textContent || "");
    const candidateClass = typeof (candidate as HTMLElement).className === "string" ? normalizeVisibleText((candidate as HTMLElement).className) : "";
    return terms.some((term) => text.includes(normalizeVisibleText(term)) || candidateClass.includes(normalizeVisibleText(term)));
  });
  return semanticMatches.length === 1 ? semanticMatches[0] as HTMLElement : null;
}

function datePickerSelectFor(calendar: HTMLElement, target: { year: number; month: number }, part: "year" | "month"): HTMLElement | null {
  const selects = Array.from(calendar.querySelectorAll(".datePickerSelect")).filter(isVisible) as HTMLElement[];
  if (selects.length < 2) return null;
  const expectedValue = part === "year" ? String(target.year) : String(target.month);
  const expectedLabels = part === "year"
    ? [`${target.year}年`]
    : [`${target.month}月`, `${String(target.month).padStart(2, "0")}月`];
  const matches = selects.filter((select) => {
    const options = Array.from(select.querySelectorAll(".datePickerSelectMenu .menu"));
    return options.some((option) => {
      const value = option.getAttribute("value") || "";
      const label = option.getAttribute("label") || option.textContent || "";
      return value === expectedValue || expectedLabels.some((item) => normalizeVisibleText(label) === normalizeVisibleText(item));
    });
  });
  return matches.length === 1 ? matches[0] : null;
}

function datePickerSelectText(select: HTMLElement): HTMLElement | null {
  return select.querySelector(".datePickerSelectText") as HTMLElement | null;
}

function datePickerSelectMenu(select: HTMLElement): HTMLElement | null {
  return select.querySelector(".datePickerSelectMenu") as HTMLElement | null;
}

function datePickerMenuIsOpen(menu: HTMLElement): boolean {
  if (!isVisible(menu)) return false;
  const style = typeof window !== "undefined" ? window.getComputedStyle(menu) : null;
  return style?.display !== "none";
}

async function chooseDatePickerPart(calendar: HTMLElement, target: { year: number; month: number }, part: "year" | "month"): Promise<boolean> {
  const select = datePickerSelectFor(calendar, target, part);
  if (!select) return false;
  const expectedValue = part === "year" ? String(target.year) : String(target.month);
  const expectedLabels = part === "year"
    ? [`${target.year}年`]
    : [`${target.month}月`, `${String(target.month).padStart(2, "0")}月`];
  const currentText = datePickerSelectText(select)?.textContent || "";
  const currentMenu = datePickerSelectMenu(select);
  const currentOption = currentMenu
    ? Array.from(currentMenu.querySelectorAll(".menu")).find((option) => option.classList.contains("hd_activeSelect"))
    : null;
  const alreadySelected = currentOption
    ? ((currentOption.getAttribute("value") || "") === expectedValue || expectedLabels.some((item) => normalizeVisibleText(currentOption.getAttribute("label") || currentOption.textContent || "") === normalizeVisibleText(item)))
    : expectedLabels.some((item) => normalizeVisibleText(currentText) === normalizeVisibleText(item));
  if (alreadySelected) return true;
  if (!currentMenu || !datePickerSelectText(select)) return false;

  // This is a real custom select, not a native <select>: open once, wait for
  // its menu, click one exact menu item, then verify that the menu's active
  // marker and displayed text changed. Never click the header again while
  // waiting; a second click would simply close the official menu.
  datePickerSelectText(select)?.click();
  const openDeadline = Date.now() + 2_500;
  while (Date.now() < openDeadline && !datePickerMenuIsOpen(currentMenu)) await waitForDomUpdate(1);
  if (!datePickerMenuIsOpen(currentMenu)) throw new AdapterError("field_verification_failed", `${part === "year" ? "年份" : "月份"}菜单未打开`);

  const options = Array.from(currentMenu.querySelectorAll(".menu")).filter(isVisible);
  const matches = options.filter((option) => {
    const optionValue = option.getAttribute("value") || "";
    const optionLabel = option.getAttribute("label") || option.textContent || "";
    return optionValue === expectedValue || expectedLabels.some((item) => normalizeVisibleText(optionLabel) === normalizeVisibleText(item));
  });
  if (matches.length !== 1) throw new AdapterError(matches.length ? "field_ambiguous" : "field_not_found", `${part === "year" ? "年份" : "月份"}选项无法确认`);
  (matches[0] as HTMLElement).click();

  const selectedDeadline = Date.now() + 2_500;
  while (Date.now() < selectedDeadline) {
    const text = datePickerSelectText(select)?.textContent || "";
    const active = Array.from(currentMenu.querySelectorAll(".menu")).find((option) => option.classList.contains("hd_activeSelect"));
    const selected = active && ((active.getAttribute("value") || "") === expectedValue || expectedLabels.some((item) => normalizeVisibleText(active.getAttribute("label") || active.textContent || "") === normalizeVisibleText(item)));
    const displayed = expectedLabels.some((item) => normalizeVisibleText(text) === normalizeVisibleText(item));
    if (selected || displayed) {
      if (!datePickerMenuIsOpen(currentMenu)) return true;
    }
    await waitForDomUpdate(1);
  }
  throw new AdapterError("field_verification_failed", `${part === "year" ? "年份" : "月份"}选择后官网状态未确认`);
}

async function setDatePickerValue(element: HTMLElement, value: string): Promise<void> {
  const target = parseDate(value);
  const wrapper = calendarWrapper(element);
  if (!target || !wrapper) {
    if (element instanceof HTMLInputElement && !element.readOnly && !isDisabled(element)) {
      await setInputValue(element, value);
      await waitForStableValue(element, value);
      return;
    }
    throw new AdapterError("field_verification_failed", "日期格式或日期控件无法确认");
  }
  const input = wrapper.querySelector("input") as HTMLInputElement | null;
  if (isDisabled(input || wrapper)) {
    if (input && dateValuesMatch(dateText(input), value)) return;
    throw new AdapterError("field_verification_failed", "日期控件已禁用且内容不一致");
  }
  // A retry may enter while the panel is still open. Clicking an already-open
  // R11 picker would close it and make the following day lookup race the
  // component. Open it only when no open panel is present.
  if (!visibleCalendar(wrapper)) (input || wrapper).click();
  const openDeadline = Date.now() + 3_000;
  while (Date.now() < openDeadline && !visibleCalendar(wrapper)) await waitForDomUpdate(1);
  if (!visibleCalendar(wrapper)) throw new AdapterError("field_verification_failed", "日期日历未打开");

  const currentCalendar = visibleCalendar(wrapper);
  if (!currentCalendar) throw new AdapterError("field_verification_failed", "日期日历未打开");
  const currentMonth = calendarMonth(wrapper);
  if (!currentMonth || currentMonth.year !== target.year || currentMonth.month !== target.month) {
    // The current R11 picker exposes year/month menus (the exact controls
    // shown in the user's screenshot). Prefer those menus so a date far from
    // the current month does not require dozens of arrow clicks. A legacy
    // picker without those menus falls back to the exact month arrow pair.
    const selectedYear = await chooseDatePickerPart(currentCalendar, target, "year");
    const selectedMonth = await chooseDatePickerPart(currentCalendar, target, "month");
    if (!selectedYear || !selectedMonth) {
      // At most 24 bounded month changes; no click is issued if the current
      // month cannot be read or the official controls are ambiguous.
      const maxNavigationAttempts = 24;
      for (let attempt = 0; attempt < maxNavigationAttempts; attempt += 1) {
        const visibleMonth = calendarMonth(wrapper);
        if (visibleMonth && visibleMonth.year === target.year && visibleMonth.month === target.month) break;
        const currentIndex = visibleMonth ? visibleMonth.year * 12 + visibleMonth.month : target.year * 12 + target.month;
        const targetIndex = target.year * 12 + target.month;
        const navigation = calendarNavigation(wrapper, targetIndex < currentIndex ? "previous" : "next");
        if (!navigation) throw new AdapterError("field_verification_failed", "日期月份导航无法确认");
        navigation.click();
        await waitForDomUpdate(2);
      }
      const afterNavigation = calendarMonth(wrapper);
      if (!afterNavigation || afterNavigation.year !== target.year || afterNavigation.month !== target.month) {
        throw new AdapterError("field_verification_failed", "日期月份切换后官网状态未确认");
      }
    } else {
      const afterSelect = calendarMonth(wrapper);
      if (!afterSelect || afterSelect.year !== target.year || afterSelect.month !== target.month) {
        throw new AdapterError("field_verification_failed", "日期年月选择后官网状态未确认");
      }
    }
  }
  const maxAttempts = 24;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const calendar = visibleCalendar(wrapper);
    if (!calendar) throw new AdapterError("field_verification_failed", "日期日历未打开");
    const cells = Array.from(calendar.querySelectorAll(".datepicker-body tbody td,tbody td,[role='gridcell']"))
      .filter((cell) => isVisible(cell) && !dateCellIsDisabled(cell))
      .filter((cell) => /^0?\d{1,2}$/.test((cell.textContent || "").trim()));
    const matches = cells.filter((cell) => Number((cell.textContent || "").trim()) === target.day);
    const visibleMonth = calendarMonth(wrapper);
    if (visibleMonth && visibleMonth.year === target.year && visibleMonth.month === target.month) {
      // The real R11 picker renders previous/next-month days in the same
      // tbody without an `other-month` class. Compute the 6x7 grid position
      // from the already confirmed year/month so a duplicate day number from
      // an adjacent month can never be selected accidentally.
      const allCells = Array.from(calendar.querySelectorAll(".datepicker-body tbody td,tbody td,[role='gridcell']"))
        .filter(isVisible);
      // R11 renders the calendar header as 日、一、二、三、四、五、六.
      // `Date#getDay()` uses that same Sunday-first index (0..6); adding 6
      // here would select the previous cell for every date after Sunday.
      const firstWeekday = new Date(target.year, target.month - 1, 1).getDay();
      const targetIndex = firstWeekday + target.day - 1;
      const positional = allCells[targetIndex] as HTMLElement | undefined;
      const targetCell = positional && !dateCellIsDisabled(positional)
        && Number((positional.textContent || "").trim()) === target.day
        ? positional
        : matches.length === 1 ? matches[0] as HTMLElement : undefined;
      if (targetCell) {
        targetCell.click();
      if (input) await waitForDateInputValue(input, value);
      return;
      }
    }
    const targetMonthIndex = target.year * 12 + target.month;
    const currentMonthIndex = visibleMonth ? visibleMonth.year * 12 + visibleMonth.month : targetMonthIndex;
    const direction = targetMonthIndex < currentMonthIndex ? "previous" : "next";
    const navigation = calendarNavigation(wrapper, direction);
    if (!navigation) throw new AdapterError("field_verification_failed", "日期月份导航无法确认");
    navigation.click();
    await waitForDomUpdate(2);
  }
  throw new AdapterError("field_verification_failed", "日期超出可选择范围");
}

async function setControlValue(element: HTMLElement, value: string, labels: readonly string[] = []): Promise<void> {
  if (isDisabled(element)) {
    const current = readControlValue(element);
    if (normalizedValue(current) !== normalizedValue(value) && !labels.some((label) => normalizedValue(current) === normalizedValue(label))) {
      throw new AdapterError("field_verification_failed");
    }
    return;
  }
  const dateWrapper = calendarWrapper(element);
  if (dateWrapper) {
    await setDatePickerValue(element, value);
    await waitForStableValue(element, value);
    return;
  }
  if (element instanceof HTMLSelectElement) {
    const wanted = [value, ...labels].map(normalizedValue);
    const option = Array.from(element.options).find((candidate) => wanted.includes(normalizedValue(candidate.value)) || wanted.includes(normalizedValue(candidate.textContent || "")));
    if (!option) throw new AdapterError("field_verification_failed");
    element.value = option.value;
    dispatchValue(element);
    await waitForStableValue(element, option.value, [option.textContent || ""]);
    return;
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    await setInputValue(element, value);
    await waitForStableValue(element, value);
    return;
  }
  const nested = element.querySelector("input,textarea") as HTMLInputElement | HTMLTextAreaElement | null;
  if (nested && !nested.readOnly) {
    await setInputValue(nested, value);
    await waitForStableValue(nested, value);
    return;
  }
  if (element.isContentEditable || element.getAttribute("contenteditable") === "true") {
    element.textContent = value;
    dispatchValue(element);
    await waitForStableValue(element, value);
    return;
  }
  throw new AdapterError("field_verification_failed", "控件不是可写文本控件");
}

function controlContainer(element: Element): HTMLElement {
  return (element.closest(`${FIELD_CONTEXT_SELECTOR},.upload-box,.upload-item,.file-item,.formGroup,.hdUpload,.hd-upload,.upLoadBox,[class*='hdUpload'],[class*='upLoad']`) || element.parentElement || element) as HTMLElement;
}

function choiceTexts(element: Element): string[] {
  return [
    element.textContent || "",
    element.getAttribute("aria-label") || "",
    element.getAttribute("title") || "",
    element.getAttribute("label") || "",
    element.getAttribute("data-label") || "",
    element.getAttribute("data-value") || "",
    element.getAttribute("value") || "",
  ].map(normalizeVisibleText).filter(Boolean);
}

function choiceText(element: Element): string {
  return choiceTexts(element)[0] || "";
}

function optionMatches(element: Element, wanted: readonly string[]): boolean {
  const texts = choiceTexts(element);
  return wanted.some((item) => {
    const target = normalizeVisibleText(item);
    return texts.some((text) => text === target || text.includes(target));
  });
}

function choiceTextMatches(actual: string, expected: string): boolean {
  const left = normalizedValue(actual);
  const right = normalizedValue(expected);
  if (!left || !right) return false;
  if (left === right) return true;
  // The application commonly stores 江苏省/常州市 while the R11 area API
  // displays 江苏/常州. Only remove administrative suffixes for a fallback;
  // exact labels still win first and ambiguous matches are still rejected.
  const stripAdministrativeSuffix = (value: string) => value.replace(/(特别行政区|自治区|自治州|地区|省|市)$/, "");
  return stripAdministrativeSuffix(left) === stripAdministrativeSuffix(right);
}

function clickCustomOption(option: HTMLElement): void {
  // The portal's hd-option is a Vue component whose listener is attached to
  // the rendered div. Click that concrete option exactly once after bringing
  // it into the scroll viewport. Do not click the select box again: that box
  // is a toggle and a second click closes the menu. HTMLElement.click() is
  // intentional here; it follows the same DOM path as a user's click and is
  // more reliable with the portal's Vue 2 event bridge than writing the box
  // label or dispatching a synthetic event only from the extension world.
  try {
    option.scrollIntoView({ block: "nearest", inline: "nearest" });
  } catch {
    // Some older Chromium/WebView implementations do not accept the options
    // object. The element is still clickable without scrolling.
  }
  option.click();
}

function customSelectDropdown(control: HTMLElement): HTMLElement | null {
  return control.querySelector(".dropdown,.select-dropdown,.hd-select-dropdown") as HTMLElement | null;
}

function controlValueMatches(element: HTMLElement, value: string, labels: readonly string[]): boolean {
  const wanted = [value, ...labels];
  const optionNodes = Array.from(element.querySelectorAll(".hd-option,[role='option'],option"));
  const selectedNodes = optionNodes.filter((option) => option.matches(".selected,[aria-selected='true']:not([aria-selected='false']),:checked"));
  if (selectedNodes.some((option) => optionMatches(option, wanted))) return true;

  // If the official option list is mounted but no matching option is marked
  // selected, a matching display label is not authoritative. This is the
  // exact failure mode of Vue-controlled R11 selects after a native DOM
  // write: the box shows text while the form model remains empty.
  const current = normalizedValue(readControlValue(element));
  const displayMatches = wanted.some((item) => {
    const wanted = normalizedValue(item);
    return Boolean(wanted) && (current === wanted || current.includes(wanted));
  });
  const hasOfficialOptionMarkup = optionNodes.some((option) => option.matches(".hd-option"));
  const dropdown = customSelectDropdown(element);
  if (!hasOfficialOptionMarkup && displayMatches && !(dropdown && isVisible(dropdown))) return true;

  // Vue can update the selected option and close the menu before the display
  // span receives its new label. Treat the selected option as authoritative
  // during that short render window; otherwise a manual selection can be
  // mistaken for an empty field and the next poll would reopen the menu.
  return false;
}

function selectedControlValueMatches(element: HTMLElement, value: string, labels: readonly string[]): boolean {
  const wanted = [value, ...labels];
  const selected = Array.from(element.querySelectorAll(".hd-option,[role='option'],option"))
    .filter((option) => option.matches(".selected,[aria-selected='true']:not([aria-selected='false']),:checked"))
    .some((option) => optionMatches(option, wanted));
  if (selected) return true;

  // R11 derives the visible `.box` label from its Vue model. Once the menu
  // has closed, that label is also the reliable signal that a manual click
  // (or a click handled by Vue before the option class is repainted) already
  // selected the requested value. Never use this while the menu is open:
  // stale text from a previous attempt must not be treated as a selection.
  const dropdown = customSelectDropdown(element);
  if (dropdown && isVisible(dropdown)) return false;
  const current = normalizedValue(readControlValue(element));
  return wanted.some((item) => {
    const target = normalizedValue(item);
    return Boolean(target) && (current === target || current.includes(target));
  });
}

async function chooseCustomSelect(control: HTMLElement, root: ParentNode, value: string, labels: readonly string[]): Promise<void> {
  const box = (control.querySelector(".box,[role='combobox'],.select-box") || control) as HTMLElement;
  const wanted = [value, ...labels];
  const dropdown = customSelectDropdown(control);
  if (!dropdown) throw new AdapterError("field_not_found", `下拉选项无法确认：${value}`);

  // Only an option marked selected by the portal is enough to skip the click.
  // A visible box label alone may be stale DOM text from a previous attempt.
  if (selectedControlValueMatches(control, value, labels)) return;

  // R11's `.box` is a toggle. The previous implementation retried this click
  // while an async list was empty, which alternated between opening and
  // closing the menu. The official component is stable once opened: click it
  // exactly once, poll the same menu for its options, click one exact option,
  // then verify the selected marker. If that contract is not met, stop safely
  // and let the user retry instead of clicking indefinitely.
  const menuWasAlreadyOpen = isVisible(dropdown);
  if (!menuWasAlreadyOpen) box.click();
  const openDeadline = Date.now() + 2_500;
  while (Date.now() < openDeadline && !isVisible(dropdown)) await waitForDomUpdate(1);
  if (!isVisible(dropdown)) throw new AdapterError("portal_structure_changed", `下拉菜单未打开：${value}`);

  // R11 loads country, identity and software-classification options after the
  // component is mounted. Keep polling this control's own visible menu; do
  // not fall back to another open select on the page.
  const optionsDeadline = Date.now() + 8_000;
  while (Date.now() < optionsDeadline) {
    if (selectedControlValueMatches(control, value, labels)) return;
    if (!isVisible(dropdown)) throw new AdapterError("portal_structure_changed", `下拉菜单在选择前关闭：${value}`);
    const optionCandidates = uniqueElements(Array.from(dropdown.querySelectorAll(".hd-option,[role='option'],.option,li")).filter(isVisible));
    const exactValue = optionCandidates.filter((option) => {
      const optionValue = option.getAttribute("value") || option.getAttribute("data-value") || "";
      return normalizeVisibleText(optionValue) === normalizeVisibleText(value);
    });
    const exact = exactValue.length
      ? exactValue
      : optionCandidates.filter((option) => [value, ...labels].some((item) => choiceText(option) === normalizeVisibleText(item)));
    const matches = exact.length ? exact : optionCandidates.filter((option) => optionMatches(option, wanted));
    if (matches.length > 1) throw new AdapterError("field_ambiguous", `下拉选项无法唯一确认：${value}`);
    if (matches.length === 1) {
      // One concrete option click is deliberate. The outer `.box` is a
      // toggle; clicking it again while Vue is repainting reopens the menu
      // and was the source of the previous “一直展开但不选中” loop.
      clickCustomOption(matches[0] as HTMLElement);
      const selectedDeadline = Date.now() + 2_500;
      while (Date.now() < selectedDeadline) {
        if (selectedControlValueMatches(control, value, labels)) return;
        await waitForDomUpdate(1);
      }
      // Do not let the page-level refill call the toggle again. If Vue did
      // not expose a selected option after one exact click, stop and let the
      // user inspect or manually choose the field.
      throw new AdapterError("portal_structure_changed", `下拉选项点击后未确认：${value}`);
    }
    await waitForDomUpdate(2);
  }
  // The menu was opened once and its own option list was inspected for the
  // full bounded window. Retrying the whole page here would toggle the same
  // menu open/closed repeatedly, which is unsafe for the Vue select.
  throw new AdapterError("portal_structure_changed", `下拉选项无法确认：${value}`);
}

async function chooseCascader(control: HTMLElement, root: ParentNode, values: readonly string[]): Promise<void> {
  const cascader = control.matches(".hd-cascader")
    ? control
    : (control.querySelector(".hd-cascader") as HTMLElement | null) || control;
  if (isDisabled(cascader)) {
    const current = normalizeVisibleText(readControlValue(cascader));
    if (!values.every((value) => current.includes(normalizeVisibleText(value)))) throw new AdapterError("field_verification_failed");
    return;
  }
  const label = (cascader.querySelector(".label,[role='combobox'],.box") || cascader) as HTMLElement;
  const existingDropdown = cascader.querySelector(".dropdown") as HTMLElement | null;
  // A retry can run while the official cascader is still open. Its label is a
  // toggle, so only open it when its own menu is not already visible.
  if (!existingDropdown || !isVisible(existingDropdown)) label.click();
  await waitForDomUpdate(2);
  for (const value of values) {
    let selected = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const localOptions = uniqueElements([
        ...Array.from(cascader.querySelectorAll(".dropdown li,.dropdown .option,[role='option'],.options li")),
      ]).filter(isVisible);
      const options = localOptions.length
        ? localOptions
        : uniqueElements(Array.from(root.querySelectorAll(".hd-cascader .dropdown li,.hd-cascader [role='option'],.cascader .dropdown li,.cascader [role='option']")).filter(isVisible));
      const matches = options.filter((option) => choiceTextMatches(choiceText(option), value));
      if (matches.length > 1) throw new AdapterError("field_ambiguous", `级联选项无法唯一确认：${value}`);
      if (matches.length === 1) {
        (matches[0] as HTMLElement).click();
        selected = true;
        await waitForDomUpdate(3);
        break;
      }
      await waitForDomUpdate(2);
    }
    if (!selected) throw new AdapterError("field_not_found", `级联选项无法确认：${value}`);
  }
  const current = normalizeVisibleText(readControlValue(cascader));
  if (!values.every((value) => current.includes(normalizeVisibleText(value)))) throw new AdapterError("field_verification_failed");
}

function choiceContainer(control: HTMLElement): HTMLElement {
  return control.matches(".hd-select,.hd-cascader,.cascader,.hd-radio-group,[role='radiogroup'],.radio-group,.hd-checkbox-group,.checkbox-group")
    ? control
    : controlContainer(control);
}

async function choose(root: ParentNode, aliases: readonly string[], value: string, labels: readonly string[]): Promise<void> {
  const control = findUniqueChoiceControl(root, aliases);
  if (control instanceof HTMLSelectElement) {
    await setControlValue(control, value, labels);
    return;
  }
  if (control.matches(".hd-select")) {
    await chooseCustomSelect(control, root, value, labels);
    return;
  }
  if (control.matches(".hd-cascader,.cascader")) {
    await chooseCascader(control, root, labels.length ? labels : [value]);
    return;
  }
  const container = choiceContainer(control);
  const wanted = labels.length ? labels : [value];
  const labeledChoices = Array.from(container.querySelectorAll("label,button,[role='radio'],[role='option'],.hd-radio-button,.hd-option")).filter(isVisible);
  const choices = uniqueElements((labeledChoices.length
    ? labeledChoices
    : Array.from(container.querySelectorAll("input[type='radio'],input[type='checkbox']"))).filter(isVisible));
  const exact = choices.filter((choice) => wanted.some((item) => choiceText(choice) === normalizeVisibleText(item)));
  const matches = exact.length ? exact : choices.filter((choice) => optionMatches(choice, wanted));
  if (matches.length !== 1) throw new AdapterError(matches.length ? "field_ambiguous" : "field_not_found");
  const choice = matches[0] as HTMLElement;
  const input = choice instanceof HTMLInputElement ? choice : choice.querySelector("input[type='radio'],input[type='checkbox']") as HTMLInputElement | null;
  if (input && input.disabled) {
    if (!input.checked) throw new AdapterError("field_verification_failed");
  } else {
    (input ? (input.closest("label") || input) : choice).click();
    await waitForDomUpdate(2);
  }
  const checked = input ? input.checked : choice.getAttribute("aria-checked") === "true" || choice.getAttribute("aria-selected") === "true" || choice.classList.contains("selected") || choice.classList.contains("active");
  if (!checked) throw new AdapterError("field_verification_failed");
  if (input) await waitForChecked(input);
}

async function waitForChecked(input: HTMLInputElement, timeoutMs = 1_800): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let stableSince = 0;
  while (Date.now() < deadline) {
    if (input.checked) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= 50) return;
    } else {
      stableSince = 0;
    }
    await waitForDomUpdate(1);
  }
  throw new AdapterError("field_verification_failed");
}

async function fillText(root: ParentNode, aliases: readonly string[], value: string): Promise<void> {
  const control = findUniqueSemanticControl(root, aliases);
  await setControlValue(control, value);
}

async function fillOptionalText(root: ParentNode, aliases: readonly string[], value: string): Promise<void> {
  if (!value) return;
  await fillText(root, aliases, value);
}

async function fillTextOrChoice(root: ParentNode, aliases: readonly string[], value: string, labels: readonly string[] = []): Promise<void> {
  const choice = findUniqueChoiceControlIfPresent(root, aliases);
  if (choice) {
    await choose(root, aliases, value, labels.length ? labels : [value]);
    return;
  }
  await fillText(root, aliases, value);
}

async function waitForDomUpdate(rounds = 1): Promise<void> {
  const count = Math.max(1, rounds);
  for (let index = 0; index < count; index += 1) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 24));
  }
}

function holderRows(root: ParentNode): HTMLElement[] {
  const explicit = Array.from(root.querySelectorAll("[data-holder-row],.copyright-holder-row,.holder-row")).filter(isVisible) as HTMLElement[];
  if (explicit.length) return uniqueElements(explicit);
  const official = Array.from(root.querySelectorAll(".formGroup-item")).filter((element) => {
    if (!isVisible(element)) return false;
    return Boolean(element.querySelector(`${TEXT_CONTROL_SELECTOR},${CHOICE_CONTROL_SELECTOR},.hd-cascader`));
  }) as HTMLElement[];
  if (official.length) return uniqueElements(official);
  const controls = Array.from(root.querySelectorAll(TEXT_CONTROL_SELECTOR)).filter((element) => scoreText(element, holderAliases.name) > 0 && isVisible(element));
  const rows: HTMLElement[] = [];
  for (const control of controls) {
    const row = control.closest(`tr,fieldset,.formGroup-item,[class*='holder'],[class*='copyright']`) as HTMLElement | null;
    if (row && !rows.includes(row)) rows.push(row);
  }
  return rows;
}

type HolderTextControl = HTMLInputElement | HTMLTextAreaElement;

interface OfficialHolderControls {
  nationality: HTMLElement;
  area: HTMLElement | null;
  holderType: HTMLElement;
  name: HolderTextControl;
  documentType: HTMLElement;
  documentNumber: HolderTextControl;
}

function visibleHolderTextControls(row: HTMLElement): HolderTextControl[] {
  return Array.from(row.querySelectorAll(
    "input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox']),textarea",
  )).filter(isVisible) as HolderTextControl[];
}

function holderInputWithAliases(inputs: HolderTextControl[], aliases: readonly string[]): HolderTextControl | null {
  const scored = inputs
    .map((element) => ({ element, score: scoreText(element, aliases) }))
    .filter((item) => item.score > 0);
  if (!scored.length) return null;
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max);
  return winners.length === 1 ? winners[0].element : null;
}

/**
 * The real R11 owner editor does not render text labels next to its controls.
 * It renders four `.formGroup-item-body-left-item` blocks in this order:
 * country, area, people type/name, and document type/document number.  The
 * semantic resolver is intentionally kept as a fallback for older builds and
 * test pages, but using it first on R11 makes all three hd-selects look
 * unlabeled and causes the second page to wait until it appears frozen.
 */
function officialHolderControls(row: HTMLElement): OfficialHolderControls | null {
  const blocks = Array.from(row.querySelectorAll(".formGroup-item-body-left-item"))
    .filter(isVisible) as HTMLElement[];
  // Do not apply the positional R11 mapping to the legacy/test layout. Its
  // controls may be in a different order and have explicit labels, which the
  // semantic resolver handles more safely.
  if (blocks.length < 3) return null;
  const selects = Array.from(row.querySelectorAll(".hd-select"))
    .filter(isVisible) as HTMLElement[];
  const area = (row.querySelector(".hd-cascader") as HTMLElement | null)
    || (Array.from(row.querySelectorAll(".cascader")).find(isVisible) as HTMLElement | undefined)
    || null;
  const inputs = visibleHolderTextControls(row);
  if (selects.length < 3 || inputs.length < 2) return null;

  const name = holderInputWithAliases(inputs, holderAliases.name) || inputs[0];
  const documentNumber = holderInputWithAliases(inputs, holderAliases.document_number)
    || inputs.find((input) => input !== name)
    || null;
  if (!documentNumber || documentNumber === name) return null;

  // Prefer the select in the same visual block as the matching input. This
  // remains correct if the portal inserts an optional English-name block.
  const selectInBlock = (input: HolderTextControl): HTMLElement | null => {
    const block = input.closest(".formGroup-item-body-left-item") as HTMLElement | null;
    return block ? (block.querySelector(".hd-select") as HTMLElement | null) : null;
  };
  const holderType = selectInBlock(name) || selects[1];
  const documentType = selectInBlock(documentNumber) || selects[2];
  if (!holderType || !documentType || holderType === documentType) return null;

  // The first hd-select is CountrySelect. The cascader is optional in a few
  // historical layouts, so keep it nullable and let the caller use the
  // semantic province/city fallback when it is absent.
  return {
    nationality: selects[0],
    area,
    holderType,
    name,
    documentType,
    documentNumber,
  };
}

function findButton(root: ParentNode, aliases: readonly string[], includeDisabled = false): HTMLElement {
  const buttons = uniqueElements(Array.from(root.querySelectorAll("button,a,[role='button'],input[type='button'],input[type='submit']"))
    .filter(isVisible)
    .filter((element) => includeDisabled || !isDisabled(element)));
  const scored = buttons.map((element) => ({ element, score: scoreAction(element, aliases) })).filter((item) => item.score > 0);
  if (!scored.length) throw new AdapterError("field_not_found");
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max);
  if (winners.length !== 1) throw new AdapterError("field_ambiguous");
  return winners[0].element as HTMLElement;
}

function findActionIfPresent(root: ParentNode, aliases: readonly string[]): HTMLElement | null {
  const candidates = uniqueElements(Array.from(root.querySelectorAll("button,a,[role='button'],[role='link'],input[type='button'],input[type='submit'],[class*='hd-link']"))
    .filter(isVisible)
    .filter((element) => !isDisabled(element)));
  const scored = candidates.map((element) => ({ element, score: scoreAction(element, aliases) })).filter((item) => item.score > 0);
  if (!scored.length) return null;
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max).map((item) => item.element);
  if (winners.length !== 1) throw new AdapterError("field_ambiguous", aliases.join("/"));
  return winners[0] as HTMLElement;
}

async function saveHolderRow(row: HTMLElement): Promise<void> {
  const save = findActionIfPresent(row, ["保存"]);
  // The first applicant row may already be populated and saved by R11 after
  // the identity step. In that case there is no visible row-level save link.
  if (!save) return;
  save.click();
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (!findActionIfPresent(row, ["保存"])) return;
    await waitForDomUpdate(2);
  }
  throw new AdapterError("field_verification_failed", "著作权人信息尚未保存");
}

function holderValueIfPresent(row: HTMLElement, aliases: readonly string[], choice = false): string | null {
  const control = choice
    ? findUniqueChoiceControlIfPresent(row, aliases)
    : findUniqueSemanticControlIfPresent(row, aliases);
  return control ? readControlValue(control) : null;
}

function hasUsableOfficialHolderValue(value: string | null): boolean {
  if (value === null) return false;
  const normalized = normalizeVisibleText(value);
  return Boolean(normalized) && !["请选择", "请选择国家", "请选择国家地区", "请选择身份类别", "请选择证件类型", "请选择地区", "无地区信息"].some((placeholder) => normalized === placeholder);
}

function officialApplicantRowIsReady(row: HTMLElement, holder: CopyrightHolder): boolean {
  const official = officialHolderControls(row);
  if (official) {
    const name = readControlValue(official.name);
    const documentNumber = readControlValue(official.documentNumber);
    if (!name || !documentNumber) return false;
    if (normalizedValue(name) !== normalizedValue(holder.name) || normalizedValue(documentNumber) !== normalizedValue(holder.document_number)) return false;
    const requiredChoiceValues = [
      readControlValue(official.nationality),
      readControlValue(official.holderType),
      readControlValue(official.documentType),
    ];
    if (requiredChoiceValues.some((value) => !hasUsableOfficialHolderValue(value))) return false;
    return !official.area || hasUsableOfficialHolderValue(readControlValue(official.area));
  }

  // Keep the semantic fallback for an older R11 build or a compatibility
  // page. The current official page takes the structural branch above.
  const name = holderValueIfPresent(row, holderAliases.name);
  const documentNumber = holderValueIfPresent(row, holderAliases.document_number);
  if (!name || !documentNumber) return false;
  if (normalizedValue(name) !== normalizedValue(holder.name) || normalizedValue(documentNumber) !== normalizedValue(holder.document_number)) return false;

  // These controls are required by the real R11 validator. They can be
  // disabled because they came from the authenticated account, but their
  // displayed values must still be present before the extension proceeds.
  const requiredChoiceValues = [
    holderValueIfPresent(row, holderAliases.nationality, true),
    holderValueIfPresent(row, holderAliases.holder_type, true),
    holderValueIfPresent(row, holderAliases.document_type, true),
  ];
  if (requiredChoiceValues.some((value) => !hasUsableOfficialHolderValue(value))) return false;
  const area = row.querySelector(".hd-cascader,.cascader") as HTMLElement | null;
  return !area || hasUsableOfficialHolderValue(readControlValue(area));
}

async function waitForOfficialApplicantRow(row: HTMLElement, holder: CopyrightHolder, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (officialApplicantRowIsReady(row, holder)) return;
    await waitForDomUpdate(3);
  }
  throw new AdapterError("field_verification_failed", "官方账户著作权人信息尚未完成加载或与申请信息不一致");
}

function bodyText(root: ParentNode): string {
  const body = root instanceof Document ? root.body : root as HTMLElement;
  return normalizeVisibleText(body?.innerText || root.textContent || "");
}

export function hasVisibleLoginPrompt(root: ParentNode = document): boolean {
  const text = bodyText(root);
  const hasLoginText = text.includes("立即登录") || text.includes("密码登录") || text.includes("验证码登录");
  const hasCredentialControl = Array.from(root.querySelectorAll("input")).some((element) => isVisible(element) && (element.getAttribute("placeholder") || element.getAttribute("type")));
  return hasLoginText && hasCredentialControl;
}

export function hasApplicationForm(root: ParentNode = document): boolean {
  return hasSemanticCandidate(root, textFieldAliases.software_full_name || []);
}

function hasSemanticCandidate(root: ParentNode, aliases: readonly string[], selector = TEXT_CONTROL_SELECTOR): boolean {
  return Array.from(root.querySelectorAll(selector))
    .filter(isVisible)
    .some((element) => scoreText(element, aliases) >= 30);
}

function hasChoiceCandidate(root: ParentNode, aliases: readonly string[]): boolean {
  return choiceControls(root).some((element) => scoreText(element, aliases) >= 30);
}

function officialSectionControl(root: ParentNode, heading: string, selector: string): HTMLElement | null {
  const target = normalizeVisibleText(heading);
  const sections = uniqueElements(Array.from(root.querySelectorAll(".application .fillin_item,.fillin_item"))
    .filter(isVisible)) as HTMLElement[];
  const matchingSections = sections.filter((section) => Array.from(section.querySelectorAll("h1,h2,h3,h4,h5,h6,[role='heading']"))
    .some((item) => normalizeVisibleText(item.textContent || "").includes(target)));
  if (!matchingSections.length) return null;
  const controls = uniqueElements(matchingSections.flatMap((section) => Array.from(section.querySelectorAll(selector)).filter(isVisible))) as HTMLElement[];
  if (!controls.length) return null;
  if (controls.length !== 1) throw new AdapterError("field_ambiguous", heading);
  return controls[0];
}

/**
 * These readiness checks intentionally only answer “has the portal rendered
 * the controls yet?”. They do not validate values and do not replace the
 * adapter's unique-field checks. R11 mounts each page in several Vue ticks;
 * checking the full set prevents the first heading render from triggering a
 * premature fill attempt.
 */
export function hasApplicationPageControls(root: ParentNode = document): boolean {
  return hasSemanticCandidate(root, textFieldAliases.software_full_name || [])
    && hasSemanticCandidate(root, textFieldAliases.version || [])
    && hasChoiceCandidate(root, choiceAliases.rights_acquisition_method);
}

function hasCurrentR11ApplicationStructure(root: ParentNode): boolean {
  // The old one-page compatibility layout also has software name/version and
  // native selects. The current R11 page has radio groups for the rights
  // scope, so use that extra structural signal only when the hash is absent
  // or not one of the known routes.
  return hasApplicationPageControls(root)
    && choiceControls(root).some((control) => control.matches(".hd-radio-group,[role='radiogroup']") && scoreText(control, choiceAliases.rights_scope) >= 30);
}

export function hasDevelopmentPageControls(root: ParentNode = document): boolean {
  // The R11 development page mounts the owner editor after the classification
  // and development-model components. In a real login session that owner row
  // can arrive several Vue/API ticks after the page route changes. Requiring
  // the row here makes the state machine wait for a condition it can itself
  // handle, which looks like “the second page does nothing”. Use the stable
  // page controls as the readiness anchor; the individual date and owner
  // editors are then waited for by their own bounded setters.
  const officialSections = Array.from(root.querySelectorAll(".application > .fillin_item,.application .fillin_item")).filter(isVisible);
  const hasHeading = (name: string) => officialSections.some((section) => {
    const heading = section.querySelector("h3,h2,h1,[role='heading']");
    return Boolean(heading && normalizeVisibleText(heading.textContent || "").includes(normalizeVisibleText(name)));
  });
  const officialSkeleton = hasHeading("软件分类") && hasHeading("开发方式");
  return (officialSkeleton || hasChoiceCandidate(root, textFieldAliases.software_category || []))
    && (officialSkeleton || hasChoiceCandidate(root, choiceAliases.development_method));
}

export function hasFeaturesPageControls(root: ParentNode = document): boolean {
  return hasSemanticCandidate(root, textFieldAliases.development_hardware || [])
    && hasSemanticCandidate(root, textFieldAliases.main_functions || [])
    && hasChoiceCandidate(root, textFieldAliases.programming_language || []);
}

export function hasUploadControls(root: ParentNode = document): boolean {
  return Array.from(root.querySelectorAll("input[type='file']")).some((element) => {
    const input = element as HTMLInputElement;
    return !input.disabled && (isVisible(input) || isVisible(controlContainer(input)));
  });
}

function customUploadContainer(input: HTMLInputElement): HTMLElement | null {
  const custom = input.parentElement?.closest(".hdUpload,.hd-upload,.upLoadBox,[class*='hdUpload'],[class*='hd-upload'],[class*='upLoad'],[class*='Upload']");
  if (custom instanceof HTMLElement) return custom;
  const candidates = [controlContainer(input)].filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement);
  return candidates.find((candidate) => Boolean(candidate.querySelector(
    ".hdUpload-showFile,.hdUpload-showFile-item,.statusSvg,[class*='progress'],[class*='status']",
  ))) || null;
}

function uploadStatusClass(element: Element): string {
  const className = typeof (element as HTMLElement).className === "string" ? (element as HTMLElement).className : "";
  return normalizeVisibleText(className);
}

function customUploadSucceeded(input: HTMLInputElement): boolean {
  const container = customUploadContainer(input);
  if (!container) return false;
  const statusElements = Array.from(container.querySelectorAll(
    ".hdUpload-showFile,.hdUpload-showFile-item,.statusSvg,[class*='progress'],[class*='status']",
  )).filter(isVisible);
  if (statusElements.some((element) => {
    const status = uploadStatusClass(element);
    return status.includes("over") || status.includes("uploaded") || status.includes("success") || status.includes("complete");
  })) return true;
  const text = normalizeVisibleText(container.textContent || "");
  return text.includes("上传成功") || text.includes("文件已上传") || text.includes("上传完成");
}

export function hasVisibleValidationErrors(root: ParentNode = document): boolean {
  const candidates = Array.from(root.querySelectorAll("[aria-invalid='true'],[role='alert'],.error,.is-error,.has-error,[class*='error'],[class*='Error'],.hd-input-error,.form-error"));
  return candidates.some((element) => {
    if (!isVisible(element)) return false;
    const text = normalizeVisibleText(element.textContent || "");
    return text.includes("不能为空") || text.includes("必填") || text.includes("请输入") || text.includes("请选择") || text.includes("格式不正确") || text.includes("不正确");
  });
}

function routeFromHash(root: ParentNode): string {
  const owner = root instanceof Document ? root.defaultView : null;
  const hash = owner?.location.hash || (typeof window !== "undefined" ? window.location.hash : "");
  const segments = decodeURIComponent(hash.replace(/^#\/?/, "").split("?")[0])
    .split("/")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
  const knownRoutes = ["identity", "application", "development", "features", "confirm", "materials", "success"];
  return [...segments].reverse().find((segment) => knownRoutes.includes(segment)) || segments[0] || "";
}

export function detectR11Page(root: ParentNode = document): R11Page {
  const route = routeFromHash(root);
  if (["identity", "application", "development", "features", "confirm", "materials", "success"].includes(route)) {
    if (route === "success") return "confirm";
    return route as R11Page;
  }
  const text = bodyText(root);
  if (text.includes("选择办理身份") || text.includes("我是申请人") || text.includes("我是代理人")) return "identity";
  if (text.includes("软件申请信息")) return "application";
  if (text.includes("软件开发信息")) return "development";
  if (text.includes("软件功能与特点")) return "features";
  if (text.includes("确认信息") || text.includes("提交材料清单")) return "confirm";
  if (hasCurrentR11ApplicationStructure(root)) return "application";
  if (hasDevelopmentPageControls(root)) return "development";
  if (hasFeaturesPageControls(root)) return "features";
  if (hasUploadControls(root) && !hasApplicationForm(root)) return "materials";
  if (hasApplicationForm(root)) return "legacy";
  return "unknown";
}

export class R11Adapter {
  private operation = "page";

  constructor(private readonly root: Document = document) {}

  diagnosticOperation(): string {
    return this.operation;
  }

  page(): R11Page {
    return detectR11Page(this.root);
  }

  isLandingPage(): boolean {
    const text = bodyText(this.root);
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
    const cards = Array.from(this.root.querySelectorAll("article,section,li,.card,[class*='card'],[class*='item']")).filter(isVisible).filter((element) => normalizeVisibleText(element.textContent || "").includes(targetTitle));
    const cardButtons = uniqueElements(cards.flatMap((card) => Array.from(card.querySelectorAll("button,a,[role='button']")).filter((element) => normalizeVisibleText(element.textContent || "").includes("立即登记"))));
    if (cardButtons.length !== 1) throw new AdapterError(cardButtons.length ? "field_ambiguous" : "field_not_found");
    (cardButtons[0] as HTMLElement).click();
  }

  async fillCurrentPage(form: CopyrightFormData): Promise<R11Page> {
    const page = this.page();
    this.operation = `${page}.start`;
    if (form.development_method !== "independent" && form.development_method !== "cooperative" && form.development_method !== "commissioned" && form.development_method !== "assigned_task") {
      throw new AdapterError("unsupported_development_method");
    }
    if (page === "application") await this.fillApplicationPage(form);
    else if (page === "development") await this.fillDevelopmentPage(form);
    else if (page === "features") await this.fillFeaturesPage(form);
    else if (page === "legacy") await this.fillApplication(form);
    else throw new AdapterError("portal_structure_changed", `当前页面不是可填报的 R11 表单：${page}`);
    await waitForDomUpdate(3);
    return page;
  }

  private async fillApplicationPage(form: CopyrightFormData): Promise<void> {
    this.operation = "application.software_full_name";
    await fillText(this.root, textFieldAliases.software_full_name || [], form.software_full_name);
    this.operation = "application.software_short_name";
    await fillOptionalText(this.root, textFieldAliases.software_short_name || [], form.software_short_name);
    this.operation = "application.version";
    await fillText(this.root, textFieldAliases.version || [], form.version);
    this.operation = "application.rights_acquisition";
    await choose(this.root, choiceAliases.rights_acquisition_method, form.rights_acquisition_method, choiceLabels.rights_acquisition_method[form.rights_acquisition_method]);
    await waitForDomUpdate(2);
    if (form.rights_acquisition_method !== "original") {
      const secondaryAliases = ["继受取得方式", "权利取得类型"];
      const secondary = findUniqueChoiceControlIfPresent(this.root, secondaryAliases);
      if (secondary) {
        const secondaryLabels = form.rights_acquisition_method === "transfer"
          ? ["转让", "受让"]
          : form.rights_acquisition_method === "inheritance" ? ["继承"] : ["承受", "其他"];
        await choose(this.root, secondaryAliases, form.rights_acquisition_method, secondaryLabels);
      }
    }
    await choose(this.root, choiceAliases.rights_scope, form.rights_scope, choiceLabels.rights_scope[form.rights_scope]);
    await waitForDomUpdate(2);
    if (form.rights_scope === "partial") await fillText(this.root, textFieldAliases.rights_scope_description || [], form.rights_scope_description);
  }

  private async fillDevelopmentPage(form: CopyrightFormData): Promise<void> {
    const softwareCategory = form.software_category.trim();
    if (!isOfficialSoftwareCategory(softwareCategory)) {
      throw new AdapterError(
        "portal_structure_changed",
        "软件分类必须先在应用中选择：应用软件、嵌入式软件、中间件或操作系统",
      );
    }
    const officialSoftwareCategory = toOfficialSoftwareCategory(softwareCategory);
    this.operation = "development.software_category";
    const categoryControl = officialSectionControl(this.root, "软件分类", ".hd-select");
    if (categoryControl) {
      await chooseCustomSelect(categoryControl, this.root, officialSoftwareCategory, [officialSoftwareCategory, softwareCategory]);
    } else {
      await fillTextOrChoice(this.root, textFieldAliases.software_category || [], officialSoftwareCategory, [officialSoftwareCategory, softwareCategory]);
    }
    this.operation = "development.work_type";
    await choose(this.root, choiceAliases.work_type, form.work_type, choiceLabels.work_type[form.work_type]);
    this.operation = "development.development_method";
    await choose(this.root, choiceAliases.development_method, form.development_method, choiceLabels.development_method[form.development_method]);
    await waitForDomUpdate(2);
    if (form.development_method !== "independent") {
      this.operation = "development.shared_holders";
      const sharedHolderControl = findUniqueChoiceControlIfPresent(this.root, choiceAliases.cooperate_is_only);
      if (sharedHolderControl) {
        await choose(this.root, choiceAliases.cooperate_is_only, form.copyright_holders.length > 1 ? "是" : "否", form.copyright_holders.length > 1 ? ["是"] : ["否"]);
      }
    }
    this.operation = "development.complete_date";
    const dateControl = officialSectionControl(this.root, "开发完成日期", ".datepicker-input input,.datePicker input,.datepicker input");
    if (dateControl) await setControlValue(dateControl, form.development_date);
    else await fillText(this.root, textFieldAliases.development_date || [], form.development_date);
    this.operation = "development.publish_status";
    await choose(this.root, choiceAliases.is_published, String(form.is_published), choiceLabels.is_published[String(form.is_published) as "true" | "false"]);
    await waitForDomUpdate(2);
    if (form.is_published) {
      this.operation = "development.first_publication";
      await fillText(this.root, textFieldAliases.first_publication_date || [], form.first_publication_date);
      await fillText(this.root, textFieldAliases.first_publication_country || [], form.first_publication_country);
      await fillText(this.root, textFieldAliases.first_publication_city || [], form.first_publication_city);
    }
    // When the user chose “我是申请人”, R11 has already populated and
    // locked the first owner row from the authenticated account. For single
    // development that row is the only owner; for cooperative development,
    // only the rows added by the user still need to be filled. Rewriting row
    // 0 would clear dependent country/area/type fields and is the reason a
    // page can appear filled while R11 still reports required-field errors.
    this.operation = "development.copyright_holders";
    await this.fillHolders(form.copyright_holders, false, form.application_method === "copyright_holder");
  }

  private async fillFeaturesPage(form: CopyrightFormData): Promise<void> {
    const fields: Array<[keyof CopyrightFormData, string[]]> = [
      ["development_hardware", textFieldAliases.development_hardware || []],
      ["runtime_hardware", textFieldAliases.runtime_hardware || []],
      ["development_os", textFieldAliases.development_os || []],
      ["development_tools", textFieldAliases.development_tools || []],
      ["runtime_platform", textFieldAliases.runtime_platform || []],
      ["runtime_environment", textFieldAliases.runtime_environment || []],
      ["source_code_lines", textFieldAliases.source_code_lines || []],
      ["development_purpose", textFieldAliases.development_purpose || []],
      ["target_industry", textFieldAliases.target_industry || []],
      ["main_functions", textFieldAliases.main_functions || []],
    ];
    for (const [field, aliases] of fields) {
      const raw = form[field];
      const value = typeof raw === "number" ? String(raw) : String(raw || "");
      if (value) await fillText(this.root, aliases, value);
    }
    if (form.programming_language) await this.fillProgrammingLanguage(form.programming_language);
    if (form.technical_features) await this.fillTechnicalFeatures(form.technical_features);
  }

  private async fillProgrammingLanguage(value: string): Promise<void> {
    const group = findUniqueChoiceControlIfPresent(this.root, textFieldAliases.programming_language || []);
    const terms = value.split(/[、,，;/；|]/).map((item) => item.trim()).filter(Boolean);
    if (group) {
      // R11 loads the checkbox options asynchronously. Do not fall back to
      // the "other language" textarea while the option list is still empty;
      // doing so can make the page look filled while programLanguage[0]
      // remains empty in the Vue model and the portal rejects 下一步.
      let options: HTMLElement[] = [];
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const labeledOptions = Array.from(group.querySelectorAll("label,button,[role='checkbox'],.hd-checkbox,.checkbox")).filter(isVisible);
        options = uniqueElements((labeledOptions.length
          ? labeledOptions
          : Array.from(group.querySelectorAll("input[type='checkbox']"))).filter(isVisible)) as HTMLElement[];
        if (options.length || attempt === 119) break;
        await waitForDomUpdate(2);
      }
      const unknownTerms: string[] = [];
      let selected = 0;
      for (const term of terms) {
        const matches = options.filter((option) => choiceText(option) === normalizeVisibleText(term));
        if (matches.length > 1) throw new AdapterError("field_ambiguous", `编程语言：${term}`);
        if (matches.length === 1) {
          const option = matches[0];
          const input = option instanceof HTMLInputElement ? option : option.querySelector("input[type='checkbox']") as HTMLInputElement | null;
          if (!input?.checked) (input ? (input.closest("label") || input) : option).click();
          await waitForDomUpdate(1);
          const checked = input ? input.checked : option.getAttribute("aria-checked") === "true" || option.classList.contains("selected") || option.classList.contains("active");
          if (!checked) throw new AdapterError("field_verification_failed", `编程语言未选中：${term}`);
          if (input) await waitForChecked(input);
          selected += 1;
        } else {
          unknownTerms.push(term);
        }
      }
      const freeText = findUniqueSemanticControlIfPresent(this.root, ["其他编程语言", "若有需要，请输入其他编程语言", "请输入其他编程语言", "编程语言（其他）"]);
      if (unknownTerms.length) {
        if (!freeText) throw new AdapterError("field_not_found", `编程语言选项无法确认：${unknownTerms.join("、")}`);
        await setControlValue(freeText, unknownTerms.join("、"));
      }
      if (!selected && !unknownTerms.length) throw new AdapterError("field_not_found", "编程语言选项无法确认");
      return;
    }

    // Legacy/test portals may expose only one free-text field. Keep this
    // fallback, but only after checking for the real R11 checkbox group.
    const textControl = findUniqueSemanticControlIfPresent(this.root, ["其他编程语言", "若有需要，请输入其他编程语言", "请输入其他编程语言", "编程语言（其他）"])
      || findUniqueSemanticControlIfPresent(this.root, textFieldAliases.programming_language || []);
    if (!textControl) throw new AdapterError("field_not_found", "编程语言");
    await setControlValue(textControl, value);
  }

  private async fillTechnicalFeatures(value: string): Promise<void> {
    const selection = parseChoiceSelection(value, TECHNICAL_FEATURE_OPTIONS);
    if (selection.selected.length > 3) {
      throw new AdapterError("field_verification_failed", "软件的技术特点最多只能选择三项");
    }

    // The current R11 component is a checkbox group followed by one free-text
    // textarea. Resolve the group from its own section so the programming
    // language checkboxes cannot be mistaken for technical characteristics.
    const group = officialSectionControl(this.root, "软件的技术特点", ".hd-checkbox-group")
      || findUniqueChoiceControlIfPresent(this.root, ["软件的技术特点", "软件技术特点", "技术特点"]);

    if (selection.selected.length && !group) {
      throw new AdapterError("field_not_found", "软件的技术特点选项");
    }

    if (group) {
      let options: HTMLElement[] = [];
      const deadline = Date.now() + 8_000;
      while (Date.now() < deadline) {
        const labeledOptions = Array.from(group.querySelectorAll(
          "label.hd-checkbox-button,label,button,[role='checkbox'],.hd-checkbox,.checkbox",
        )).filter(isVisible);
        options = uniqueElements((labeledOptions.length
          ? labeledOptions
          : Array.from(group.querySelectorAll("input[type='checkbox']"))).filter(isVisible)) as HTMLElement[];
        if (options.length) break;
        await waitForDomUpdate(2);
      }

      for (const term of selection.selected) {
        const matches = options.filter((option) => choiceText(option) === normalizeVisibleText(term));
        if (matches.length > 1) throw new AdapterError("field_ambiguous", `软件的技术特点：${term}`);
        if (matches.length !== 1) throw new AdapterError("field_not_found", `软件的技术特点选项无法确认：${term}`);
        const option = matches[0];
        const input = option instanceof HTMLInputElement
          ? option
          : option.querySelector("input[type='checkbox']") as HTMLInputElement | null;
        const alreadyChecked = input
          ? input.checked
          : option.getAttribute("aria-checked") === "true"
            || option.getAttribute("aria-selected") === "true"
            || option.classList.contains("selected")
            || option.classList.contains("active");
        if (!alreadyChecked) {
          (input ? (input.closest("label") || input) : option).click();
          await waitForDomUpdate(1);
        }
        const checked = input
          ? input.checked
          : option.getAttribute("aria-checked") === "true"
            || option.getAttribute("aria-selected") === "true"
            || option.classList.contains("selected")
            || option.classList.contains("active");
        if (!checked) throw new AdapterError("field_verification_failed", `软件的技术特点未选中：${term}`);
        if (input) await waitForChecked(input);
      }
    }

    if (selection.custom) {
      const custom = officialSectionControl(this.root, "软件的技术特点", "textarea")
        || findUniqueSemanticControlIfPresent(this.root, ["其他技术特点", "请输入其他技术特点", "软件的技术特点"]);
      if (!custom) throw new AdapterError("field_not_found", "软件的技术特点自定义说明");
      await setControlValue(custom, selection.custom);
    }

    if (!selection.selected.length && !selection.custom && !group) {
      throw new AdapterError("field_not_found", "软件的技术特点");
    }
  }

  async fillApplication(form: CopyrightFormData): Promise<void> {
    const root = this.root;
    const textFields: Array<keyof CopyrightFormData> = [
      "software_full_name", "software_short_name", "version", "software_category", "development_date",
      "development_hardware", "runtime_hardware", "development_os", "development_tools",
      "runtime_platform", "runtime_environment", "programming_language", "source_code_lines",
      "development_purpose", "target_industry", "main_functions", "technical_features",
    ];
    for (const field of textFields) {
      const value = String(form[field] ?? "");
      if (!value && field !== "software_short_name") continue;
      const aliases = textFieldAliases[field];
      if (aliases) await fillText(root, aliases, value);
    }
    await choose(root, choiceAliases.work_type, form.work_type, choiceLabels.work_type[form.work_type]);
    await choose(root, choiceAliases.development_method, form.development_method, choiceLabels.development_method[form.development_method]);
    await choose(root, choiceAliases.rights_acquisition_method, form.rights_acquisition_method, choiceLabels.rights_acquisition_method[form.rights_acquisition_method]);
    await choose(root, choiceAliases.rights_scope, form.rights_scope, choiceLabels.rights_scope[form.rights_scope]);
    await choose(root, choiceAliases.application_method, form.application_method, choiceLabels.application_method[form.application_method]);
    await choose(root, choiceAliases.is_published, String(form.is_published), choiceLabels.is_published[String(form.is_published) as "true" | "false"]);
    await waitForDomUpdate(2);
    if (form.work_type === "modified") {
      await fillText(root, textFieldAliases.original_registration_number || [], form.original_registration_number);
      await fillText(root, textFieldAliases.modification_description || [], form.modification_description);
    }
    if (form.rights_scope === "partial") await fillText(root, textFieldAliases.rights_scope_description || [], form.rights_scope_description);
    if (form.is_published) {
      await fillText(root, textFieldAliases.first_publication_date || [], form.first_publication_date);
      await fillText(root, textFieldAliases.first_publication_country || [], form.first_publication_country);
      await fillText(root, textFieldAliases.first_publication_city || [], form.first_publication_city);
    }
    await this.fillHolders(form.copyright_holders, true);
  }

  async fillFilingProfile(profile: FilingProfile): Promise<boolean> {
    const controls = filingProfileAliases.map(([field, aliases]) => ({
      field,
      aliases,
      control: findUniqueSemanticControlIfPresent(this.root, aliases),
    }));
    if (controls.every((item) => !item.control)) return false;
    // The applicant profile is rendered in a later official dialog. A
    // partial match on an earlier page is not a structure error; wait for
    // the dialog to finish rendering before trying again.
    if (controls.some((item) => !item.control)) return false;
    for (const item of controls) {
      await setControlValue(item.control as HTMLElement, profile[item.field]);
    }
    return true;
  }

  private async fillHolders(holders: CopyrightHolder[], legacy: boolean, firstRowIsOfficialApplicant = false): Promise<void> {
    if (!holders.length) throw new AdapterError("field_not_found", "著作权人");
    const rowsNeeded = firstRowIsOfficialApplicant ? Math.max(1, holders.length) : holders.length;
    let rows = holderRows(this.root);
    // The official account row is created asynchronously after the identity
    // page has completed. Wait for that initial row instead of immediately
    // searching for “+添加著作权人” and failing the whole second page.
    const rowsDeadline = Date.now() + 20_000;
    while (rows.length < Math.min(1, rowsNeeded) && Date.now() < rowsDeadline) {
      await waitForDomUpdate(3);
      rows = holderRows(this.root);
    }
    if (rows.length < Math.min(1, rowsNeeded)) throw new AdapterError("field_not_found", "著作权人行");
    if (firstRowIsOfficialApplicant) await waitForOfficialApplicantRow(rows[0], holders[0]);
    while (rows.length < rowsNeeded) {
      const button = findButton(this.root, ["增加著作权人", "添加著作权人", "新增著作权人", "增加权利人"]);
      button.click();
      const addDeadline = Date.now() + 8_000;
      while (rows.length < rowsNeeded && Date.now() < addDeadline) {
        await waitForDomUpdate(3);
        rows = holderRows(this.root);
      }
      if (rows.length < rowsNeeded) throw new AdapterError("field_not_found", "著作权人行未完成渲染");
    }
    if (rows.length !== rowsNeeded) throw new AdapterError("field_ambiguous", "著作权人行数无法确认");
    const firstFormIndex = firstRowIsOfficialApplicant ? 1 : 0;
    for (let formIndex = firstFormIndex; formIndex < holders.length; formIndex += 1) {
      this.operation = `development.holder.${formIndex}`;
      await this.fillHolderRow(rows[formIndex], holders[formIndex], legacy);
    }
  }

  private async fillHolderRow(row: HTMLElement, holder: CopyrightHolder, legacy: boolean): Promise<void> {
    if (legacy) {
      await choose(row, holderAliases.holder_type, holder.holder_type, holder.holder_type === "person" ? ["个人", "自然人"] : ["机构", "企业", "单位"]);
      await waitForDomUpdate(2);
      await fillText(row, holderAliases.name, holder.name);
      await fillText(row, holderAliases.category, holder.category);
      await fillText(row, holderAliases.document_type, holder.document_type);
      await fillText(row, holderAliases.document_number, holder.document_number);
      await fillText(row, holderAliases.nationality, holder.nationality);
      await fillText(row, holderAliases.province, holder.province);
      await fillText(row, holderAliases.city, holder.city);
      await fillOptionalText(row, holderAliases.birth_or_established_date, holder.birth_or_established_date || "");
      await saveHolderRow(row);
      return;
    }

    const official = officialHolderControls(row);
    if (official) {
      const typeLabels = holder.holder_type === "person"
        ? [holder.category || "自然人", "自然人", "个人"]
        : [holder.category || "企业法人", "企业法人", "企业", "单位"];

      // This is the component order used by the authenticated R11 owner
      // editor. Each custom select is opened once and receives one concrete
      // option click; no DOM value is written directly into a Vue select.
      await chooseCustomSelect(official.nationality, this.root, holder.nationality, [holder.nationality, "中国"]);
      if (official.area) await chooseCascader(official.area, this.root, [holder.province, holder.city]);
      await chooseCustomSelect(official.holderType, this.root, holder.category || holder.holder_type, typeLabels);
      await setControlValue(official.name, holder.name);
      await chooseCustomSelect(official.documentType, this.root, holder.document_type, holderDocumentTypeLabels(holder));
      await setControlValue(official.documentNumber, holder.document_number);
      await saveHolderRow(row);
      return;
    }

    // R11's owner controls are dependent: changing the country clears the
    // area, changing the area refreshes the identity/document options, and
    // changing the holder type refreshes the document type options. Fill in
    // that dependency order so a later select cannot silently reset an
    // earlier value in Vue's model.
    await fillTextOrChoice(row, holderAliases.nationality, holder.nationality, [holder.nationality, "中国"]);

    // The current R11 owner editor uses one lazy province/city cascader. It
    // may expose the inner `.hd-cascader` without a useful “省市” label, so
    // identify that structure before trying the older separate province and
    // city controls. Otherwise the same cascader can be mistaken for both
    // fields or be reported as missing.
    const cascaders = choiceControls(row).filter((control) => control.matches(".hd-cascader,.cascader"));
    if (cascaders.length > 1) throw new AdapterError("field_ambiguous", "著作权人省市");
    if (cascaders.length === 1) {
      await chooseCascader(cascaders[0], this.root, [holder.province, holder.city]);
    } else {
      const provinceControl = findUniqueChoiceControlIfPresent(row, holderAliases.province);
      const cityControl = findUniqueChoiceControlIfPresent(row, holderAliases.city);
      if (provinceControl && cityControl) {
        await choose(row, holderAliases.province, holder.province, [holder.province]);
        await choose(row, holderAliases.city, holder.city, [holder.city]);
      } else {
        const areaControl = findUniqueChoiceControlIfPresent(row, holderAliases.area);
        if (!areaControl) throw new AdapterError("field_not_found", "著作权人省市");
        await chooseCascader(areaControl, this.root, [holder.province, holder.city]);
      }
    }

    const typeLabels = holder.holder_type === "person"
      ? [holder.category || "自然人", "自然人", "个人"]
      : [holder.category || "企业法人", "企业法人", "企业", "单位"];
    await fillTextOrChoice(row, holderAliases.holder_type, holder.category || holder.holder_type, typeLabels);
    await fillText(row, holderAliases.name, holder.name);
    await fillTextOrChoice(row, holderAliases.document_type, holder.document_type, holderDocumentTypeLabels(holder));
    await fillText(row, holderAliases.document_number, holder.document_number);
    await saveHolderRow(row);
  }

  clickNext(): void {
    // Keep the disabled button in the candidate set so an official validation
    // state becomes a retryable verification error instead of a misleading
    // “button/field not found” stop.
    const button = findButton(this.root, ["下一步"], true);
    const text = normalizeVisibleText(button.textContent || "");
    if (text.includes("提交") || text.includes("申报") || text.includes("确认填报")) throw new AdapterError("portal_structure_changed", "拒绝点击最终提交按钮");
    if (isDisabled(button)) throw new AdapterError("field_verification_failed", "官方页面仍在校验，下一步暂不可用");
    button.click();
  }

  clickNextToMaterials(): void {
    this.clickNext();
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
    // The real R11 uploader starts an XHR after the native input changes.
    // `input.files.length > 0` only proves that the browser accepted our
    // File object; it does not prove that the portal has accepted the file.
    // Wait for the uploader's success marker before allowing navigation.
    if (customUploadContainer(input)) return customUploadSucceeded(input);
    if (input.files && input.files.length > 0) return true;
    const container = controlContainer(input);
    const text = normalizeVisibleText(container.textContent || "");
    return text.includes("上传成功") || text.includes("文件已上传") || text.includes("已选择");
  }

  async waitForUploadAcknowledgement(input: HTMLInputElement, timeoutMs = 45_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.uploadAcknowledged(input)) return;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
    }
    throw new AdapterError("manual_upload_required", "官方上传控件未确认文件上传完成");
  }
}
