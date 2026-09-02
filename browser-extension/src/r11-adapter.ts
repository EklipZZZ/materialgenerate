import type { CopyrightFormData, CopyrightHolder } from "../../src/lib/copyright-form.ts";
import type { FilingProfile } from "../../src/lib/filing-profile.ts";
import type { MaterialKind } from "../../src/lib/materials.ts";

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
  holder_type: ["著作权人类型", "权利人类型", "人员类型", "主体类型"],
  name: ["著作权人名称", "姓名/名称", "姓名或名称", "姓名", "单位名称", "权利人名称", "请输入姓名", "请输入单位名称"],
  category: ["著作权人类别", "单位类别", "主体类别"],
  document_type: ["证件类型", "身份证明类型"],
  document_number: ["证件号码", "统一社会信用代码", "身份证号", "证件号", "请输入证件号码"],
  nationality: ["国籍", "国家/地区", "所在国家", "国家"],
  province: ["省份", "所在省"],
  city: ["城市", "所在城市"],
  area: ["省市", "省份城市", "所在地区", "地区"],
  birth_or_established_date: ["出生日期", "成立日期"],
} as const;

const choiceAliases = {
  work_type: ["软件作品说明", "作品说明", "作品类型"],
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

function normalizedValue(value: string): string {
  return normalizeVisibleText(value).replace(/[，、,;；/\\|]/g, "");
}

export function isVisible(element: Element): boolean {
  const node = element as HTMLElement;
  if (node.hidden || node.getAttribute("aria-hidden") === "true") return false;
  const style = typeof window !== "undefined" ? window.getComputedStyle(node) : null;
  return style?.display !== "none" && style?.visibility !== "hidden";
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
  const parent = element.closest(FIELD_CONTEXT_SELECTOR);
  return parent?.textContent || "";
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
  const candidates = uniqueElements(Array.from(root.querySelectorAll(CHOICE_CONTROL_SELECTOR)).filter(isVisible));
  const scored = candidates.map((element) => ({ element, score: scoreText(element, aliases) })).filter((item) => item.score > 0);
  if (!scored.length) throw new AdapterError("field_not_found", aliases.join("/"));
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max).map((item) => item.element);
  if (winners.length !== 1) throw new AdapterError("field_ambiguous", aliases.join("/"));
  return winners[0] as HTMLElement;
}

function findUniqueChoiceControlIfPresent(root: ParentNode, aliases: readonly string[]): HTMLElement | null {
  const candidates = uniqueElements(Array.from(root.querySelectorAll(CHOICE_CONTROL_SELECTOR)).filter(isVisible));
  const scored = candidates.map((element) => ({ element, score: scoreText(element, aliases) })).filter((item) => item.score > 0);
  if (!scored.length) return null;
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max).map((item) => item.element);
  if (winners.length !== 1) throw new AdapterError("field_ambiguous", aliases.join("/"));
  return winners[0] as HTMLElement;
}

function dispatchValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLElement): void {
  try {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: null }));
  } catch {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
}

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  element.focus();
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  dispatchValue(element);
}

function readControlValue(element: HTMLElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
  const nested = element.querySelector("input,textarea,select") as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
  if (nested) return nested.value;
  if (element.matches(".hd-select,.hd-cascader")) return element.querySelector(".box,.label,[role='combobox']")?.textContent || "";
  return element.textContent || "";
}

function verifyValue(element: HTMLElement, value: string): void {
  if (normalizedValue(readControlValue(element)) !== normalizedValue(value)) throw new AdapterError("field_verification_failed");
}

function calendarWrapper(element: HTMLElement): HTMLElement | null {
  return element.closest(".datePicker,.datepicker,.hd-date-picker,.date-picker") as HTMLElement | null;
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function dateText(element: Element): string {
  return (element as HTMLInputElement).value || element.textContent || "";
}

function dateCellIsDisabled(cell: Element): boolean {
  const className = typeof (cell as HTMLElement).className === "string" ? (cell as HTMLElement).className : "";
  return cell.getAttribute("aria-disabled") === "true" || /disabled|other-month|prev-month|next-month/.test(className);
}

function visibleCalendar(root: ParentNode): HTMLElement | null {
  const candidates = Array.from(root.querySelectorAll(".datepicker-main,.datepicker-panel,.date-picker-panel,.calendar,[role='dialog']"));
  return (candidates.find((candidate) => isVisible(candidate)) as HTMLElement | undefined) || null;
}

function calendarMonth(root: ParentNode): { year: number; month: number } | null {
  const calendar = visibleCalendar(root);
  if (!calendar) return null;
  const text = calendar.textContent || "";
  const match = /(20\d{2})\D{0,6}(1[0-2]|0?[1-9])\D/.exec(text);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

function calendarNavigation(root: ParentNode, direction: "previous" | "next"): HTMLElement | null {
  const calendar = visibleCalendar(root);
  if (!calendar) return null;
  const candidates = Array.from(calendar.querySelectorAll("button,a,[role='button'],[class*='month'],[class*='arrow'],[class*='prev'],[class*='next']")).filter(isVisible);
  const terms = direction === "previous"
    ? ["上一月", "上个月", "上一年", "prev", "previous", "<", "‹"]
    : ["下一月", "下个月", "下一年", "next", ">", "›"];
  const matches = candidates.filter((candidate) => {
    const text = normalizeVisibleText(candidate.getAttribute("aria-label") || candidate.getAttribute("title") || candidate.textContent || "");
    const className = typeof (candidate as HTMLElement).className === "string" ? normalizeVisibleText((candidate as HTMLElement).className) : "";
    return terms.some((term) => text.includes(normalizeVisibleText(term)) || className.includes(normalizeVisibleText(term)));
  });
  return matches.length === 1 ? matches[0] as HTMLElement : null;
}

async function setDatePickerValue(element: HTMLElement, value: string): Promise<void> {
  const target = parseDate(value);
  const wrapper = calendarWrapper(element);
  if (!target || !wrapper) {
    if (element instanceof HTMLInputElement && !element.readOnly && !isDisabled(element)) {
      setInputValue(element, value);
      verifyValue(element, value);
      return;
    }
    throw new AdapterError("field_verification_failed", "日期格式或日期控件无法确认");
  }
  const input = wrapper.querySelector("input") as HTMLInputElement | null;
  if (input && normalizedValue(dateText(input)) === normalizedValue(value)) return;
  if (isDisabled(input || wrapper)) {
    if (input && normalizedValue(dateText(input)) === normalizedValue(value)) return;
    throw new AdapterError("field_verification_failed", "日期控件已禁用且内容不一致");
  }
  (input || wrapper).click();
  await waitForDomUpdate(2);
  const maxAttempts = 24;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const calendar = visibleCalendar(wrapper.ownerDocument || document);
    if (!calendar) throw new AdapterError("field_verification_failed", "日期日历未打开");
    const cells = Array.from(calendar.querySelectorAll("td,[role='gridcell']"))
      .filter((cell) => isVisible(cell) && !dateCellIsDisabled(cell))
      .filter((cell) => /^0?\d{1,2}$/.test((cell.textContent || "").trim()));
    const matches = cells.filter((cell) => Number((cell.textContent || "").trim()) === target.day);
    const visibleMonth = calendarMonth(wrapper.ownerDocument || document);
    if ((!visibleMonth || (visibleMonth.year === target.year && visibleMonth.month === target.month)) && matches.length === 1) {
      (matches[0] as HTMLElement).click();
      await waitForDomUpdate(2);
      if (input && normalizedValue(dateText(input)) !== normalizedValue(value)) throw new AdapterError("field_verification_failed", "日期选择后校验不一致");
      return;
    }
    const targetMonthIndex = target.year * 12 + target.month;
    const currentMonthIndex = visibleMonth ? visibleMonth.year * 12 + visibleMonth.month : targetMonthIndex;
    const direction = targetMonthIndex < currentMonthIndex ? "previous" : "next";
    const navigation = calendarNavigation(wrapper.ownerDocument || document, direction);
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
    return;
  }
  if (element instanceof HTMLSelectElement) {
    const wanted = [value, ...labels].map(normalizedValue);
    const option = Array.from(element.options).find((candidate) => wanted.includes(normalizedValue(candidate.value)) || wanted.includes(normalizedValue(candidate.textContent || "")));
    if (!option) throw new AdapterError("field_verification_failed");
    element.value = option.value;
    dispatchValue(element);
    if (normalizedValue(element.value) !== normalizedValue(option.value)) throw new AdapterError("field_verification_failed");
    return;
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setInputValue(element, value);
    verifyValue(element, value);
    return;
  }
  const nested = element.querySelector("input,textarea") as HTMLInputElement | HTMLTextAreaElement | null;
  if (nested && !nested.readOnly) {
    setInputValue(nested, value);
    verifyValue(nested, value);
    return;
  }
  if (element.isContentEditable || element.getAttribute("contenteditable") === "true") {
    element.textContent = value;
    dispatchValue(element);
    verifyValue(element, value);
    return;
  }
  throw new AdapterError("field_verification_failed", "控件不是可写文本控件");
}

function controlContainer(element: Element): HTMLElement {
  return (element.closest(`${FIELD_CONTEXT_SELECTOR},.upload-box,.upload-item,.file-item,.formGroup,.hdUpload,.hd-upload,.upLoadBox,[class*='hdUpload'],[class*='upLoad']`) || element.parentElement || element) as HTMLElement;
}

function choiceText(element: Element): string {
  return normalizeVisibleText(element.textContent || element.getAttribute("aria-label") || element.getAttribute("value") || "");
}

function optionMatches(element: Element, wanted: readonly string[]): boolean {
  const text = choiceText(element);
  return wanted.some((item) => text === normalizeVisibleText(item) || text.includes(normalizeVisibleText(item)));
}

async function chooseCustomSelect(control: HTMLElement, root: ParentNode, value: string, labels: readonly string[]): Promise<void> {
  const box = (control.querySelector(".box,[role='combobox'],.select-box") || control) as HTMLElement;
  const wanted = [value, ...labels];
  const current = control.querySelector(".box,[role='combobox'],.select-box")?.textContent || "";
  const normalizedCurrent = normalizeVisibleText(current);
  if (wanted.some((item) => normalizedCurrent === normalizeVisibleText(item) || normalizedCurrent.includes(normalizeVisibleText(item)))) return;
  box.click();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const localOptions = uniqueElements([
      ...Array.from(control.querySelectorAll(".hd-option,[role='option'],.option,li")),
    ]).filter(isVisible);
    const optionCandidates = localOptions.length
      ? localOptions
      : uniqueElements(Array.from(root.querySelectorAll(".hd-option,[role='option']")).filter(isVisible));
    const exactValue = optionCandidates.filter((option) => choiceText(option) === normalizeVisibleText(value));
    const exact = exactValue.length ? exactValue : optionCandidates.filter((option) => labels.some((item) => choiceText(option) === normalizeVisibleText(item)));
    const matches = exact.length ? exact : optionCandidates.filter((option) => optionMatches(option, wanted));
    if (matches.length === 1) {
      (matches[0] as HTMLElement).click();
      await waitForDomUpdate(2);
      const selected = control.querySelector(".hd-option.selected,[role='option'][aria-selected='true'],.option.selected");
      const visibleText = control.querySelector(".box,.label,[role='combobox']")?.textContent || selected?.textContent || "";
      if (!optionMatches({ textContent: visibleText } as Element, wanted)) throw new AdapterError("field_verification_failed");
      return;
    }
    if (matches.length > 1) throw new AdapterError("field_ambiguous", `下拉选项无法唯一确认：${value}`);
    await waitForDomUpdate(2);
    // Some portal builds mount the dropdown lazily and leave the first
    // click with an empty/closed menu. Re-open only when it is visibly
    // closed; never toggle an already-open menu while options are loading.
    const dropdown = control.querySelector(".dropdown,.select-dropdown,.hd-select-dropdown") as HTMLElement | null;
    if (dropdown && !isVisible(dropdown)) box.click();
  }
  throw new AdapterError("field_not_found", `下拉选项无法确认：${value}`);
}

async function chooseCascader(control: HTMLElement, root: ParentNode, values: readonly string[]): Promise<void> {
  if (isDisabled(control)) {
    const current = normalizeVisibleText(control.textContent || "");
    if (!values.every((value) => current.includes(normalizeVisibleText(value)))) throw new AdapterError("field_verification_failed");
    return;
  }
  const label = (control.querySelector(".label,[role='combobox'],.box") || control) as HTMLElement;
  label.click();
  await waitForDomUpdate(2);
  for (const value of values) {
    const localOptions = uniqueElements([
      ...Array.from(control.querySelectorAll(".dropdown li,.dropdown .option,[role='option'],.options li")),
    ]).filter(isVisible);
    const options = localOptions.length
      ? localOptions
      : uniqueElements(Array.from(root.querySelectorAll(".hd-cascader .dropdown li,.hd-cascader [role='option']")).filter(isVisible));
    const matches = options.filter((option) => choiceText(option) === normalizeVisibleText(value));
    if (matches.length !== 1) throw new AdapterError(matches.length ? "field_ambiguous" : "field_not_found", `级联选项无法唯一确认：${value}`);
    (matches[0] as HTMLElement).click();
    await waitForDomUpdate(2);
  }
  const current = normalizeVisibleText(control.textContent || "");
  if (!values.every((value) => current.includes(normalizeVisibleText(value)))) throw new AdapterError("field_verification_failed");
}

function choiceContainer(control: HTMLElement): HTMLElement {
  return control.matches(".hd-select,.hd-cascader,.hd-radio-group,[role='radiogroup'],.radio-group,.hd-checkbox-group,.checkbox-group")
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
  if (control.matches(".hd-cascader")) {
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
    await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
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

function findButton(root: ParentNode, aliases: readonly string[]): HTMLElement {
  const buttons = uniqueElements(Array.from(root.querySelectorAll("button,a,[role='button'],input[type='button'],input[type='submit']")).filter(isVisible).filter((element) => !isDisabled(element)));
  const scored = buttons.map((element) => ({ element, score: scoreAction(element, aliases) })).filter((item) => item.score > 0);
  if (!scored.length) throw new AdapterError("field_not_found");
  const max = Math.max(...scored.map((item) => item.score));
  const winners = scored.filter((item) => item.score === max);
  if (winners.length !== 1) throw new AdapterError("field_ambiguous");
  return winners[0].element as HTMLElement;
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
  const controls = Array.from(root.querySelectorAll(TEXT_CONTROL_SELECTOR)).filter(isVisible);
  return controls.some((element) => scoreText(element, textFieldAliases.software_full_name || []) >= 30);
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
  if (hasUploadControls(root) && !hasApplicationForm(root)) return "materials";
  if (hasApplicationForm(root)) return "legacy";
  return "unknown";
}

export class R11Adapter {
  constructor(private readonly root: Document = document) {}

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
    await fillText(this.root, textFieldAliases.software_full_name || [], form.software_full_name);
    await fillOptionalText(this.root, textFieldAliases.software_short_name || [], form.software_short_name);
    await fillText(this.root, textFieldAliases.version || [], form.version);
    await choose(this.root, choiceAliases.rights_acquisition_method, form.rights_acquisition_method, choiceLabels.rights_acquisition_method[form.rights_acquisition_method]);
    await waitForDomUpdate(2);
    if (form.rights_acquisition_method !== "original") {
      const secondaryAliases = ["继受取得方式", "权利取得类型", "取得方式"];
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
    await fillTextOrChoice(this.root, textFieldAliases.software_category || [], form.software_category, [form.software_category]);
    await choose(this.root, choiceAliases.work_type, form.work_type, choiceLabels.work_type[form.work_type]);
    await choose(this.root, choiceAliases.development_method, form.development_method, choiceLabels.development_method[form.development_method]);
    await waitForDomUpdate(2);
    if (form.development_method !== "independent") {
      const sharedHolderControl = findUniqueChoiceControlIfPresent(this.root, choiceAliases.cooperate_is_only);
      if (sharedHolderControl) {
        await choose(this.root, choiceAliases.cooperate_is_only, form.copyright_holders.length > 1 ? "是" : "否", form.copyright_holders.length > 1 ? ["是"] : ["否"]);
      }
    }
    await fillText(this.root, textFieldAliases.development_date || [], form.development_date);
    await choose(this.root, choiceAliases.is_published, String(form.is_published), choiceLabels.is_published[String(form.is_published) as "true" | "false"]);
    await waitForDomUpdate(2);
    if (form.is_published) {
      await fillText(this.root, textFieldAliases.first_publication_date || [], form.first_publication_date);
      await fillText(this.root, textFieldAliases.first_publication_country || [], form.first_publication_country);
      await fillText(this.root, textFieldAliases.first_publication_city || [], form.first_publication_city);
    }
    await this.fillHolders(form.copyright_holders, false);
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
      ["technical_features", textFieldAliases.technical_features || []],
    ];
    for (const [field, aliases] of fields) {
      const raw = form[field];
      const value = typeof raw === "number" ? String(raw) : String(raw || "");
      if (value) await fillText(this.root, aliases, value);
    }
    if (form.programming_language) await this.fillProgrammingLanguage(form.programming_language);
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
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const labeledOptions = Array.from(group.querySelectorAll("label,button,[role='checkbox'],.hd-checkbox,.checkbox")).filter(isVisible);
        options = uniqueElements((labeledOptions.length
          ? labeledOptions
          : Array.from(group.querySelectorAll("input[type='checkbox']"))).filter(isVisible)) as HTMLElement[];
        if (options.length || attempt === 19) break;
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

  private async fillHolders(holders: CopyrightHolder[], legacy: boolean): Promise<void> {
    if (!holders.length) throw new AdapterError("field_not_found", "著作权人");
    let rows = holderRows(this.root);
    while (rows.length < holders.length) {
      const button = findButton(this.root, ["增加著作权人", "添加著作权人", "新增著作权人", "增加权利人"]);
      button.click();
      await waitForDomUpdate(3);
      rows = holderRows(this.root);
      if (rows.length < holders.length) throw new AdapterError("portal_structure_changed", "著作权人行未完成渲染");
    }
    if (rows.length !== holders.length) throw new AdapterError("field_ambiguous", "著作权人行数无法确认");
    for (const [index, holder] of holders.entries()) await this.fillHolderRow(rows[index], holder, legacy);
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
      return;
    }

    const typeLabels = holder.holder_type === "person"
      ? [holder.category || "自然人", "自然人", "个人"]
      : [holder.category || "企业法人", "企业法人", "企业", "单位"];
    await fillTextOrChoice(row, holderAliases.holder_type, holder.category || holder.holder_type, typeLabels);
    await fillText(row, holderAliases.name, holder.name);
    await fillTextOrChoice(row, holderAliases.document_type, holder.document_type, [holder.document_type, holder.holder_type === "person" ? "居民身份证" : "统一社会信用代码"]);
    await fillText(row, holderAliases.document_number, holder.document_number);
    await fillTextOrChoice(row, holderAliases.nationality, holder.nationality, [holder.nationality, "中国"]);
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

  clickNext(): void {
    const button = findButton(this.root, ["下一步"]);
    const text = normalizeVisibleText(button.textContent || "");
    if (text.includes("提交") || text.includes("申报") || text.includes("确认填报")) throw new AdapterError("portal_structure_changed", "拒绝点击最终提交按钮");
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
