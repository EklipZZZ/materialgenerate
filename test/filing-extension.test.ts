import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { chromium, type Page } from "@playwright/test";
import { build } from "esbuild";
import { EMPTY_COPYRIGHT_FORM, type CopyrightFormData, type CopyrightHolder } from "../src/lib/copyright-form.ts";
import { R11_URL, type FilingManifest, type FileTransferMessage } from "../src/lib/filing-protocol.ts";

const officialBundle = resolve(process.cwd(), "browser-extension/dist/official-content.js");
let bundlePromise: Promise<void> | null = null;

function ensureOfficialBundle(): Promise<void> {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      mkdirSync(resolve(process.cwd(), "browser-extension/dist"), { recursive: true });
      await build({
        entryPoints: [resolve(process.cwd(), "browser-extension/src/official-content.ts")],
        outfile: officialBundle,
        bundle: true,
        format: "iife",
        platform: "browser",
        target: "chrome120",
        legalComments: "none",
      });
    })();
  }
  return bundlePromise;
}

type PortalMessage = Record<string, unknown>;

function holder(type: "person" | "organization", index: number): CopyrightHolder {
  return {
    holder_type: type,
    name: type === "person" ? `测试人员${index}` : `测试单位${index}`,
    category: type === "person" ? "自然人" : "企业法人",
    document_type: type === "person" ? "居民身份证" : "统一社会信用代码证书",
    document_number: type === "person" ? `1101011990010100${10 + index}` : `91310000TEST0000${index}`,
    nationality: "中国",
    province: "北京市",
    city: "北京市",
    ...(type === "person" ? { birth_or_established_date: "1990-01-01" } : {}),
    sort_order: index,
  };
}

function formFor(holders: CopyrightHolder[], developmentMethod: "independent" | "cooperative"): CopyrightFormData {
  return {
    ...EMPTY_COPYRIGHT_FORM,
    id: "00000000-0000-4000-8000-000000000001",
    software_full_name: "模拟 R11 软著填报系统",
    software_short_name: "模拟填报",
    version: "V1.0",
    software_category: "应用软件",
    development_date: "2026-08-01",
    development_method: developmentMethod,
    development_hardware: "PC",
    runtime_hardware: "PC",
    development_os: "Windows 11",
    development_tools: "TypeScript",
    runtime_platform: "Windows 11",
    runtime_environment: "Chrome",
    programming_language: "TypeScript",
    source_code_lines: 1200,
    development_purpose: "验证浏览器扩展填报流程",
    target_industry: "软件服务",
    main_functions: "模拟申请系统用于验证软件著作权登记表的字段映射、著作权人分类、材料上传和人工暂停流程。".repeat(8),
    technical_features: "使用语义字段定位并在写入后校验结果。",
    copyright_holders: holders,
  };
}

function fixture(form: CopyrightFormData, fileCount: number): string {
  const rows = form.copyright_holders.map((current, index) => `
    <div data-holder-row class="holder-row">
      <div class="form-item"><label for="holder-type-${index}">著作权人类型</label><select id="holder-type-${index}"><option value="person">个人</option><option value="organization">机构</option></select></div>
      <div class="form-item"><label for="holder-name-${index}">姓名/单位名称</label><input id="holder-name-${index}"></div>
      <div class="form-item"><label for="holder-category-${index}">著作权人类别/单位类别</label><input id="holder-category-${index}"></div>
      <div class="form-item"><label for="holder-document-type-${index}">证件类型</label><input id="holder-document-type-${index}"></div>
      <div class="form-item"><label for="holder-document-number-${index}">证件号码/统一社会信用代码</label><input id="holder-document-number-${index}"></div>
      <div class="form-item"><label for="holder-nationality-${index}">国籍</label><input id="holder-nationality-${index}"></div>
      <div class="form-item"><label for="holder-province-${index}">省份</label><select id="holder-province-${index}"><option>北京市</option><option>上海市</option></select></div>
      <div class="form-item"><label for="holder-city-${index}">城市</label><select id="holder-city-${index}"><option>北京市</option><option>上海市</option></select></div>
      <div class="form-item"><label for="holder-date-${index}">出生日期/成立日期</label><input id="holder-date-${index}"></div>
    </div>`).join("");
  const files = [
    ["source-pdf", "源程序鉴别材料 PDF"],
    ["manual-pdf", "文档鉴别材料 PDF"],
    ["cooperation-pdf", "合作开发协议"],
  ].slice(0, fileCount).map(([id, label]) => `<div class="form-item"><label for="${id}">${label}</label><input id="${id}" type="file"></div>`).join("");
  return `<!doctype html><html><body>
    <h1>模拟 R11 计算机软件著作权登记申请</h1>
    <div class="form-item"><label for="software-full-name">软件全称</label><input id="software-full-name"></div>
    <div class="form-item"><label for="software-short-name">软件简称</label><input id="software-short-name"></div>
    <div class="form-item"><label for="version">版本号</label><input id="version"></div>
    <div class="form-item"><label for="software-category">软件分类</label><input id="software-category"></div>
    <div class="form-item"><label for="development-date">开发完成日期</label><input id="development-date"></div>
    <div class="form-item"><label for="work-type">软件作品说明</label><select id="work-type"><option value="original">原创</option><option value="modified">修改</option></select></div>
    <div class="form-item"><label for="development-method">开发方式</label><select id="development-method"><option value="independent">单独开发</option><option value="cooperative">合作开发</option></select></div>
    <div class="form-item"><label for="rights-acquisition-method">权利取得方式</label><select id="rights-acquisition-method"><option value="original">原始取得</option><option value="transfer">受让</option></select></div>
    <div class="form-item"><label for="rights-scope">权利范围</label><select id="rights-scope"><option value="all">全部权利</option><option value="partial">部分权利</option></select></div>
    <div class="form-item"><label for="application-method">申请办理方式</label><select id="application-method"><option value="copyright_holder">著作权人申请办理</option><option value="agent">代理人申请办理</option></select></div>
    <div class="form-item"><label for="published">是否发表</label><select id="published"><option value="false">未发表</option><option value="true">已发表</option></select></div>
    <div class="form-item"><label for="applicant-address">申请人地址</label><input id="applicant-address"></div>
    <div class="form-item"><label for="postal-code">邮政编码</label><input id="postal-code"></div>
    <div class="form-item"><label for="contact-name">联系人</label><input id="contact-name"></div>
    <div class="form-item"><label for="contact-phone">联系电话</label><input id="contact-phone"></div>
    <div class="form-item"><label for="development-hardware">开发的硬件环境</label><input id="development-hardware"></div>
    <div class="form-item"><label for="runtime-hardware">运行的硬件环境</label><input id="runtime-hardware"></div>
    <div class="form-item"><label for="development-os">开发操作系统</label><input id="development-os"></div>
    <div class="form-item"><label for="development-tools">软件开发环境工具</label><input id="development-tools"></div>
    <div class="form-item"><label for="runtime-platform">运行平台操作系统</label><input id="runtime-platform"></div>
    <div class="form-item"><label for="runtime-environment">软件运行支撑环境</label><input id="runtime-environment"></div>
    <div class="form-item"><label for="programming-language">编程语言</label><input id="programming-language"></div>
    <div class="form-item"><label for="source-code-lines">源程序量</label><input id="source-code-lines"></div>
    <div class="form-item"><label for="development-purpose">开发目的</label><input id="development-purpose"></div>
    <div class="form-item"><label for="target-industry">面向领域/行业</label><input id="target-industry"></div>
    <div class="form-item"><label for="main-functions">软件的主要功能</label><textarea id="main-functions"></textarea></div>
    <div class="form-item"><label for="technical-features">软件技术特点</label><input id="technical-features"></div>
    <section id="holders"><h2>著作权人</h2>${rows}</section>
    ${files}
    <div class="form-item"><label for="signature-pdf">申请确认签章页</label><input id="signature-pdf" type="file" style="display:none"></div>
    <button id="final-submit" onclick="window.__finalSubmitClicks++">最终提交</button>
    <script>window.__finalSubmitClicks = 0;</script>
  </body></html>`;
}

function multiPageFixture(form: CopyrightFormData, delayFirstApplicationNavigation = false): string {
  const serializedForm = JSON.stringify(form).replace(/</g, "\\u003c");
  const serializedDelay = JSON.stringify(delayFirstApplicationNavigation);
  return `<!doctype html><html><body>
    <main id="r11-app"></main>
    <script>
      const form = ${serializedForm};
      const delayFirstApplicationNavigation = ${serializedDelay};
      const app = document.getElementById("r11-app");
      let applicationNextAttempts = 0;
      let finalSubmitClicks = 0;
      window.__finalSubmitClicks = finalSubmitClicks;
      window.__applicationValues = {};
      window.__developmentValues = {};
      window.__featureValues = {};

      function inputField(label, id, tag = "input") {
        return '<div class="fillin_item">' + label + '<div class="hd-input"><' + tag + ' id="' + id + '"></' + tag + '></div></div>';
      }

      function selectField(label, id, options) {
        return '<div class="fillin_item">' + label + '<div class="hd-select" data-name="' + id + '"><div class="box"></div><div class="dropdown" style="display:none">' + options.map((item) => '<div class="hd-option" data-value="' + item + '">' + item + '</div>').join("") + '</div></div></div>';
      }

      function radioField(label, name, options) {
        return '<div class="fillin_item">' + label + '<div class="hd-radio-group">' + options.map((item) => '<label class="hd-radio-button"><input type="radio" name="' + name + '" value="' + item + '"><span>' + item + '</span></label>').join("") + '</div></div>';
      }

      function dateField(label, id) {
        return '<div class="fillin_item">' + label + '<div class="datePicker"><input class="datepicker-input" id="' + id + '" readonly><div class="datepicker-main" style="display:none"><div class="calendar-title">2026年8月</div><table><tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table></div></div></div>';
      }

      function holderRow(index) {
        const holder = form.copyright_holders[index];
        const options = holder.holder_type === "person" ? ["自然人", "企业法人"] : ["自然人", holder.category || "企业法人"];
        return '<div class="formGroup-item" data-holder-index="' + index + '">'
          + selectField("人员类型", "holder-type-" + index, options)
          + inputField("姓名/名称", "holder-name-" + index)
          + selectField("证件类型", "holder-document-type-" + index, [holder.document_type, "统一社会信用代码"])
          + inputField("证件号码", "holder-document-number-" + index)
          + selectField("国籍", "holder-nationality-" + index, ["中国", "其他"])
          + '<div class="fillin_item">省市<div class="hd-cascader" data-province="' + holder.province + '" data-city="' + holder.city + '"><div class="label"></div><div class="dropdown" style="display:none"><ul class="options"><li class="option" data-level="province">' + holder.province + '</li></ul></div></div></div>'
          + '</div>';
      }

      function wireControls() {
        document.querySelectorAll(".hd-select").forEach((control) => {
          const box = control.querySelector(".box");
          const dropdown = control.querySelector(".dropdown");
          box.onclick = () => { dropdown.style.display = dropdown.style.display === "none" ? "block" : "none"; };
          control.querySelectorAll(".hd-option").forEach((option) => {
            option.onclick = () => {
              control.querySelectorAll(".hd-option").forEach((item) => item.classList.remove("selected"));
              option.classList.add("selected");
              box.textContent = option.textContent;
              dropdown.style.display = "none";
            };
          });
        });
        document.querySelectorAll(".datePicker").forEach((picker) => {
          const input = picker.querySelector("input");
          const calendar = picker.querySelector(".datepicker-main");
          picker.onclick = (event) => {
            if (event.target === input || event.target === picker) calendar.style.display = "block";
          };
          picker.querySelector("td").onclick = () => {
            input.value = form.development_date;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            calendar.style.display = "none";
          };
        });
        document.querySelectorAll(".hd-cascader").forEach((control) => {
          const label = control.querySelector(".label");
          const dropdown = control.querySelector(".dropdown");
          const options = control.querySelector(".options");
          label.onclick = () => { dropdown.style.display = "block"; };
          control.querySelectorAll(".option").forEach((option) => {
            option.onclick = () => {
              if (option.dataset.level === "province") {
                label.textContent = option.textContent;
                options.innerHTML = '<li class="option" data-level="city">' + control.dataset.city + '</li>';
                options.querySelector(".option").onclick = () => {
                  label.textContent = control.dataset.province + " / " + control.dataset.city;
                  dropdown.style.display = "none";
                };
              }
            };
          });
        });
      }

      function renderIdentity() {
        location.hash = "#/identity";
        app.innerHTML = '<h1>选择办理身份</h1><button id="applicant">我是申请人</button><button>我是代理人</button>';
        document.getElementById("applicant").onclick = renderApplication;
      }

      function renderApplication() {
        location.hash = "#/application";
        app.innerHTML = "<h1>软件申请信息</h1>"
          + inputField("软件全称", "software-full-name")
          + inputField("软件简称", "software-short-name")
          + inputField("版本号", "version")
          + selectField("权利取得方式", "rights-acquisition-method", ["原始取得", "继受取得"])
          + radioField("权利范围", "rights-scope", ["全部权利", "部分权利"])
          + '<button id="next-application">下一步</button>';
        wireControls();
        document.getElementById("next-application").onclick = () => {
          applicationNextAttempts += 1;
          if (delayFirstApplicationNavigation && applicationNextAttempts === 1) {
            const error = document.createElement("div");
            error.className = "error";
            error.textContent = "不能为空";
            app.appendChild(error);
            window.setTimeout(() => error.remove(), 900);
            return;
          }
          window.__applicationValues = {
            fullName: document.getElementById("software-full-name").value,
            shortName: document.getElementById("software-short-name").value,
            version: document.getElementById("version").value,
            rights: document.querySelector("[data-name='rights-acquisition-method'] .box").textContent,
            scope: document.querySelector("input[name='rights-scope']:checked").value,
          };
          window.setTimeout(renderDevelopment, 160);
        };
      }

      function renderDevelopment() {
        location.hash = "#/development";
        app.innerHTML = "<h1>软件开发信息</h1>"
          + selectField("软件分类", "software-category", [form.software_category, "其他"])
          + radioField("软件作品说明", "work-type", ["原创", "修改"])
          + selectField("开发方式", "development-method", ["单独开发", "合作开发"])
          + (form.development_method === "independent" ? "" : radioField("是否多个著作权人共同享有软件著作权", "shared-holder", ["是", "否"]))
          + dateField("开发完成日期", "development-date")
          + radioField("是否发表", "published", ["未发表", "已发表"])
          + '<section class="formGroup" id="holder-list">' + holderRow(0) + '</section>'
          + '<div class="fillin_item">合作开发合同或协议<div class="upLoadBox"><input id="cooperation-proof" class="hdUpload-inputFile" type="file"><span class="proof-status"></span></div></div>'
          + '<button id="add-holder">+添加著作权人</button><button id="next-development">下一步</button>';
        wireControls();
        document.getElementById("cooperation-proof").onchange = () => {
          window.setTimeout(() => { document.querySelector(".proof-status").textContent = "上传成功"; }, 120);
        };
        document.getElementById("add-holder").onclick = () => {
          document.getElementById("holder-list").insertAdjacentHTML("beforeend", holderRow(1));
          wireControls();
        };
        document.getElementById("next-development").onclick = () => {
          window.__developmentValues = {
            category: document.querySelector("[data-name='software-category'] .box").textContent,
            workType: document.querySelector("input[name='work-type']:checked").value,
            method: document.querySelector("[data-name='development-method'] .box").textContent,
            date: document.getElementById("development-date").value,
            published: document.querySelector("input[name='published']:checked").value,
            sharedHolder: document.querySelector("input[name='shared-holder']:checked")?.value || "",
            holder0: document.getElementById("holder-name-0").value,
            holder1: document.getElementById("holder-name-1")?.value || "",
            document0: document.getElementById("holder-document-number-0").value,
            document1: document.getElementById("holder-document-number-1")?.value || "",
            area0: document.querySelector("[data-holder-index='0'] .hd-cascader .label").textContent,
            area1: document.querySelector("[data-holder-index='1'] .hd-cascader .label")?.textContent || "",
          };
          window.setTimeout(renderFeatures, 160);
        };
      }

      function renderFeatures() {
        location.hash = "#/features";
        app.innerHTML = "<h1>软件功能与特点</h1>"
          + inputField("开发的硬件环境", "development-hardware")
          + inputField("运行的硬件环境", "runtime-hardware")
          + inputField("开发该软件的操作系统", "development-os")
          + inputField("软件开发环境工具", "development-tools")
          + inputField("软件运行平台", "runtime-platform")
          + inputField("软件运行支撑环境", "runtime-environment")
          + '<div class="fillin_item">编程语言<div class="hd-checkbox-group"><label><input type="checkbox" value="TypeScript"><span>TypeScript</span></label></div><textarea placeholder="若有需要，请输入其他编程语言..."></textarea></div>'
          + inputField("源程序量", "source-code-lines")
          + inputField("开发目的", "development-purpose")
          + inputField("面向领域/行业", "target-industry")
          + inputField("软件的主要功能", "main-functions", "textarea")
          + inputField("软件的技术特点", "technical-features", "textarea")
          + '<button id="next-features">下一步</button>';
        wireControls();
        document.getElementById("next-features").onclick = () => {
          window.__featureValues = {
            developmentHardware: document.getElementById("development-hardware").value,
            developmentOs: document.getElementById("development-os").value,
            sourceLines: document.getElementById("source-code-lines").value,
            mainFunctions: document.getElementById("main-functions").value,
            technicalFeatures: document.getElementById("technical-features").value,
            language: document.querySelector("input[type='checkbox']:checked").value,
            otherLanguage: document.querySelector("textarea[placeholder*='其他编程语言']").value,
          };
          window.setTimeout(renderConfirm, 160);
        };
      }

      function renderConfirm() {
        location.hash = "#/confirm";
        app.innerHTML = '<h1>确认信息</h1><button id="final-submit" onclick="window.__finalSubmitClicks++">确认填报</button>';
      }

      renderIdentity();
    </script>
  </body></html>`;
}

type TestMaterialKind = "source_code_pdf" | "user_manual_pdf" | "cooperation_agreement" | "signature_page";

function manifestForKinds(form: CopyrightFormData, kinds: TestMaterialKind[]): FilingManifest {
  return {
    jobId: "00000000-0000-4000-8000-000000000002",
    targetUrl: R11_URL,
    adapterVersion: "r11-v1",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    application: form,
    filingProfile: {
      applicant_address: "北京市海淀区模拟路 1 号",
      postal_code: "100000",
      contact_name: "测试联系人",
      contact_phone: "13800000000",
    },
    materials: kinds.map((kind, index) => ({
      id: `00000000-0000-4000-8000-00000000001${index + 3}`,
      kind,
      fileName: `${kind}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 4 + index,
      checksum: null,
      downloadUrl: `https://storage.example.test/material-${index}`,
    })),
  };
}

function manifestFor(form: CopyrightFormData, fileCount: number): FilingManifest {
  const kinds = ["source_code_pdf", "user_manual_pdf", "cooperation_agreement"].slice(0, fileCount) as Array<"source_code_pdf" | "user_manual_pdf" | "cooperation_agreement">;
  return manifestForKinds(form, kinds);
}

async function installMockRuntime(page: Page): Promise<void> {
  await page.evaluate(() => {
    const messages: unknown[] = [];
    let listener: ((message: unknown) => void) | null = null;
    Object.defineProperty(window, "__messages", { value: messages, configurable: true });
    Object.defineProperty(window, "__deliver", { value: (message: unknown) => listener?.(message), configurable: true });
    Object.defineProperty(window, "chrome", {
      value: { runtime: {
        onMessage: { addListener: (next: (message: unknown) => void) => { listener = next; } },
        sendMessage: (message: unknown) => { messages.push(message); return Promise.resolve(); },
      } },
      configurable: true,
    });
  });
}

async function messages(page: Page): Promise<PortalMessage[]> {
  return page.evaluate(() => ((window as unknown as { __messages: PortalMessage[] }).__messages || []));
}

async function deliver(page: Page, message: FileTransferMessage | PortalMessage): Promise<void> {
  await page.evaluate((value) => {
    (window as unknown as { __deliver: (message: unknown) => void }).__deliver(value);
  }, message);
}

async function waitForCode(page: Page, code: string, timeout = 10_000): Promise<void> {
  await page.waitForFunction((expected) => {
    const items = (window as unknown as { __messages: PortalMessage[] }).__messages || [];
    return items.some((item) => (item.event as PortalMessage | undefined)?.code === expected);
  }, code, { timeout });
}

async function waitForEventType(page: Page, type: string): Promise<void> {
  await page.waitForFunction((expected) => {
    const items = (window as unknown as { __messages: PortalMessage[] }).__messages || [];
    return items.some((item) => (item.event as PortalMessage | undefined)?.type === expected);
  }, type, { timeout: 10_000 });
}

async function respondToMaterial(page: Page, manifest: FilingManifest, materialId: string): Promise<void> {
  const material = manifest.materials.find((item) => item.id === materialId);
  assert.ok(material);
  const size = material.sizeBytes || 4;
  const bytes = new Uint8Array(size);
  bytes.fill(65);
  const base64 = Buffer.from(bytes).toString("base64");
  await deliver(page, {
    protocol: "softreg-filing/v1",
    source: "softreg-extension",
    type: "FILE_TRANSFER_START",
    jobId: manifest.jobId,
    materialId,
    fileName: material.fileName,
    mimeType: material.mimeType,
    sizeBytes: bytes.byteLength,
  });
  await deliver(page, {
    protocol: "softreg-filing/v1",
    source: "softreg-extension",
    type: "FILE_TRANSFER_CHUNK",
    jobId: manifest.jobId,
    materialId,
    index: 0,
    total: 1,
    base64,
  });
  await deliver(page, {
    protocol: "softreg-filing/v1",
    source: "softreg-extension",
    type: "FILE_TRANSFER_END",
    jobId: manifest.jobId,
    materialId,
  });
}

async function runFormScenario(page: Page, form: CopyrightFormData, fileCount: number): Promise<void> {
  const manifest = manifestFor(form, fileCount);
  await page.setContent(fixture(form, fileCount));
  await installMockRuntime(page);
  await page.addScriptTag({ path: officialBundle });
  await page.waitForFunction(() => (window as unknown as { __messages: PortalMessage[] }).__messages?.some((item) => item.type === "OFFICIAL_READY"));
  await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "BEGIN_FILING", jobId: manifest.jobId, manifest });
  await waitForCode(page, "review_required");
  assert.equal(await page.locator("#software-full-name").inputValue(), form.software_full_name);
  assert.equal(await page.locator("#development-method").inputValue(), form.development_method);
  assert.equal(await page.locator("#applicant-address").inputValue(), "北京市海淀区模拟路 1 号");
  assert.equal(await page.locator("#postal-code").inputValue(), "100000");
  assert.equal(await page.locator("#contact-name").inputValue(), "测试联系人");
  assert.equal(await page.locator("#contact-phone").inputValue(), "13800000000");
  assert.equal(await page.locator("#holder-name-0").inputValue(), form.copyright_holders[0].name);
  if (form.copyright_holders[1]) assert.equal(await page.locator("#holder-name-1").inputValue(), form.copyright_holders[1].name);
  assert.equal(await page.locator("#final-submit").evaluate((element) => (element.ownerDocument.defaultView as unknown as { __finalSubmitClicks: number }).__finalSubmitClicks), 0);

  await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "RESUME_FILING", jobId: manifest.jobId, manifest });
  for (const material of manifest.materials) {
    await page.waitForFunction((id) => {
      const items = (window as unknown as { __messages: PortalMessage[] }).__messages || [];
      return items.some((item) => item.type === "FILE_REQUEST" && item.materialId === id);
    }, material.id);
    await respondToMaterial(page, manifest, material.id);
  }
  await waitForCode(page, "signature_page_required");
  assert.equal(await page.locator("#final-submit").evaluate((element) => (element.ownerDocument.defaultView as unknown as { __finalSubmitClicks: number }).__finalSubmitClicks), 0);
}

test("R11 simulated portal maps person, organization, cooperative and mixed holders safely", async () => {
  await ensureOfficialBundle();
  const browser = await chromium.launch({ headless: true });
  try {
    const scenarios: Array<{ holders: CopyrightHolder[]; method: "independent" | "cooperative"; files: number }> = [
      { holders: [holder("person", 0)], method: "independent", files: 2 },
      { holders: [holder("organization", 0)], method: "independent", files: 2 },
      { holders: [holder("person", 0), holder("person", 1)], method: "cooperative", files: 3 },
      { holders: [holder("person", 0), holder("organization", 1)], method: "cooperative", files: 3 },
    ];
    for (const scenario of scenarios) {
      const page = await browser.newPage();
      await runFormScenario(page, formFor(scenario.holders, scenario.method), scenario.files);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test("R11 multi-page SPA fills each page after the user chooses applicant identity", async () => {
  await ensureOfficialBundle();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const form = formFor([holder("person", 0), holder("organization", 1)], "cooperative");
    await page.setContent(multiPageFixture(form));
    await installMockRuntime(page);
    await page.addScriptTag({ path: officialBundle });
    await page.waitForFunction(() => (window as unknown as { __messages: PortalMessage[] }).__messages?.some((item) => item.type === "OFFICIAL_READY"));
    const manifest = manifestFor(form, 3);
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "BEGIN_FILING", jobId: manifest.jobId, manifest });
    await waitForCode(page, "login_required");
    await page.locator("#applicant").click();
    const proof = manifest.materials.find((material) => material.kind === "cooperation_agreement");
    assert.ok(proof);
    await page.waitForFunction((id) => {
      const items = (window as unknown as { __messages: PortalMessage[] }).__messages || [];
      return items.some((item) => item.type === "FILE_REQUEST" && item.materialId === id);
    }, proof.id);
    await respondToMaterial(page, manifest, proof.id);
    await waitForCode(page, "review_required");

    assert.equal(await page.evaluate(() => location.hash), "#/confirm");
    assert.equal(await page.locator("#final-submit").count(), 1);
    assert.equal(await page.locator("#final-submit").evaluate((element) => (element.ownerDocument.defaultView as unknown as { __finalSubmitClicks: number }).__finalSubmitClicks), 0);
    const values = await page.evaluate(() => ({
      application: (window as unknown as { __applicationValues?: Record<string, string> }).__applicationValues,
      development: (window as unknown as { __developmentValues?: Record<string, string> }).__developmentValues,
      features: (window as unknown as { __featureValues?: Record<string, string> }).__featureValues,
    }));
    assert.equal(values.application?.fullName, form.software_full_name);
    assert.equal(values.application?.rights, "原始取得");
    assert.equal(values.development?.method, "合作开发");
    assert.equal(values.development?.date, form.development_date);
    assert.equal(values.development?.sharedHolder, "是");
    assert.equal(values.development?.holder0, form.copyright_holders[0].name);
    assert.equal(values.development?.holder1, form.copyright_holders[1].name);
    assert.match(values.development?.area0 || "", /北京市/);
    assert.match(values.features?.developmentHardware || "", /PC/);
    assert.equal(values.features?.sourceLines, String(form.source_code_lines));
    assert.equal(values.features?.language, "TypeScript");
    assert.equal(values.features?.otherLanguage, "");
    const allMessages = await messages(page);
    assert.equal(allMessages.some((item) => (item.event as PortalMessage | undefined)?.code === "portal_structure_changed"), false);
    assert.equal(allMessages.some((item) => item.type === "FILE_REQUEST" && item.materialId === proof.id), true);
    await page.close();
  } finally {
    await browser.close();
  }
});

test("R11 retries a navigation after the portal validates before Vue state settles", async () => {
  await ensureOfficialBundle();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const form = formFor([holder("person", 0)], "independent");
    await page.setContent(multiPageFixture(form, true));
    await installMockRuntime(page);
    await page.addScriptTag({ path: officialBundle });
    await page.waitForFunction(() => (window as unknown as { __messages: PortalMessage[] }).__messages?.some((item) => item.type === "OFFICIAL_READY"));
    const manifest = manifestFor(form, 2);
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "BEGIN_FILING", jobId: manifest.jobId, manifest });
    await waitForCode(page, "login_required");
    await page.locator("#applicant").click();
    await waitForCode(page, "review_required", 20_000);
    assert.equal(await page.evaluate(() => location.hash), "#/confirm");
    const allMessages = await messages(page);
    assert.equal(allMessages.some((item) => (item.event as PortalMessage | undefined)?.code === "field_verification_failed"), false);
    await page.close();
  } finally {
    await browser.close();
  }
});

test("R11 login and CAPTCHA prompt pauses without trying credentials", async () => {
  await ensureOfficialBundle();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent("<div>个人用户 机构 密码登录 立即登录</div><input placeholder='请输入用户名'><input type='password' placeholder='请输入密码'><button>立即登录</button>");
    await installMockRuntime(page);
    await page.addScriptTag({ path: officialBundle });
    const form = formFor([holder("person", 0)], "independent");
    const manifest = manifestFor(form, 2);
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "BEGIN_FILING", jobId: manifest.jobId, manifest });
    await waitForCode(page, "login_required");
    const current = await messages(page);
    assert.equal(current.some((item) => item.type === "FILE_REQUEST"), false);
    assert.equal(await page.locator("input[placeholder='请输入用户名']").inputValue(), "");
    await page.close();
  } finally {
    await browser.close();
  }
});

test("R11 landing page opens the software registration entry from its current table structure", async () => {
  await ensureOfficialBundle();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><body>
      <table><tbody><tr><td><div class="link-box">
        <div class="text-box"><h1>计算机软件著作权登记申请</h1><p>为原始取得或从他方继受取得的软件申请著作权登记</p></div>
        <div class="form-box"><button id="r11-entry" onclick="window.__entryClicks++">立即登记</button></div>
      </div></td><td><h1>计算机软件著作权转让或专有许可合同登记申请</h1><button>立即登记</button></td></tr></tbody></table>
      <script>window.__entryClicks = 0;</script>
    </body></html>`);
    await installMockRuntime(page);
    await page.addScriptTag({ path: officialBundle });
    const manifest = manifestFor(formFor([holder("person", 0)], "independent"), 2);
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "BEGIN_FILING", jobId: manifest.jobId, manifest });
    await page.waitForFunction(() => (window as unknown as { __entryClicks: number }).__entryClicks === 1);
    assert.equal(await page.locator("#r11-entry").count(), 1);
    await page.close();
  } finally {
    await browser.close();
  }
});

test("R11 signature page can be uploaded after the user returns from manual signing", async () => {
  await ensureOfficialBundle();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const form = formFor([holder("person", 0)], "independent");
    const firstManifest = manifestFor(form, 2);
    await page.setContent(fixture(form, 2));
    await installMockRuntime(page);
    await page.addScriptTag({ path: officialBundle });
    await page.waitForFunction(() => (window as unknown as { __messages: PortalMessage[] }).__messages?.some((item) => item.type === "OFFICIAL_READY"));
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "BEGIN_FILING", jobId: firstManifest.jobId, manifest: firstManifest });
    await waitForCode(page, "review_required");
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "RESUME_FILING", jobId: firstManifest.jobId, manifest: firstManifest });
    for (const material of firstManifest.materials) {
      await page.waitForFunction((id) => {
        const items = (window as unknown as { __messages: PortalMessage[] }).__messages || [];
        return items.some((item) => item.type === "FILE_REQUEST" && item.materialId === id);
      }, material.id);
      await respondToMaterial(page, firstManifest, material.id);
    }
    await waitForCode(page, "signature_page_required");

    const resumedManifest = manifestForKinds(form, ["source_code_pdf", "user_manual_pdf", "signature_page"]);
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "RESUME_FILING", jobId: resumedManifest.jobId, manifest: resumedManifest });
    const signature = resumedManifest.materials.find((material) => material.kind === "signature_page");
    assert.ok(signature);
    await page.waitForFunction((id) => {
      const items = (window as unknown as { __messages: PortalMessage[] }).__messages || [];
      return items.some((item) => item.type === "FILE_REQUEST" && item.materialId === id);
    }, signature.id);
    await respondToMaterial(page, resumedManifest, signature.id);
    await waitForEventType(page, "FILING_COMPLETED");
    assert.equal(await page.locator("#signature-pdf").evaluate((input) => (input as HTMLInputElement).files?.[0]?.name), signature.fileName);
    assert.equal(await page.locator("#final-submit").evaluate((element) => (element.ownerDocument.defaultView as unknown as { __finalSubmitClicks: number }).__finalSubmitClicks), 0);
    await page.close();
  } finally {
    await browser.close();
  }
});

test("R11 accepts a manually uploaded file after automatic injection needs user help", async () => {
  await ensureOfficialBundle();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const form = formFor([holder("person", 0)], "independent");
    const firstManifest = manifestFor(form, 2);
    await page.setContent(fixture(form, 2));
    await installMockRuntime(page);
    await page.addScriptTag({ path: officialBundle });
    await page.waitForFunction(() => (window as unknown as { __messages: PortalMessage[] }).__messages?.some((item) => item.type === "OFFICIAL_READY"));
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "BEGIN_FILING", jobId: firstManifest.jobId, manifest: firstManifest });
    await waitForCode(page, "review_required");
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "RESUME_FILING", jobId: firstManifest.jobId, manifest: firstManifest });
    for (const material of firstManifest.materials) {
      await page.waitForFunction((id) => {
        const items = (window as unknown as { __messages: PortalMessage[] }).__messages || [];
        return items.some((item) => item.type === "FILE_REQUEST" && item.materialId === id);
      }, material.id);
      await respondToMaterial(page, firstManifest, material.id);
    }
    await waitForCode(page, "signature_page_required");

    const resumedManifest = manifestForKinds(form, ["source_code_pdf", "user_manual_pdf", "signature_page"]);
    const signature = resumedManifest.materials.find((material) => material.kind === "signature_page");
    assert.ok(signature);
    await page.locator("#signature-pdf").setInputFiles({ name: "manual-signed.pdf", mimeType: "application/pdf", buffer: Buffer.from([1, 2, 3]) });
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "RESUME_FILING", jobId: resumedManifest.jobId, manifest: resumedManifest });
    await waitForEventType(page, "FILING_COMPLETED");
    const allMessages = await messages(page);
    assert.equal(allMessages.some((item) => item.type === "FILE_REQUEST" && item.materialId === signature.id), false);
    assert.equal(await page.locator("#final-submit").evaluate((element) => (element.ownerDocument.defaultView as unknown as { __finalSubmitClicks: number }).__finalSubmitClicks), 0);
    await page.close();
  } finally {
    await browser.close();
  }
});

test("R11 ambiguous fields stop before any write", async () => {
  await ensureOfficialBundle();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent("<label>软件全称<input id='one'></label><label>软件全称<input id='two'></label>");
    await installMockRuntime(page);
    await page.addScriptTag({ path: officialBundle });
    const manifest = manifestFor(formFor([holder("person", 0)], "independent"), 2);
    await deliver(page, { protocol: "softreg-filing/v1", source: "softreg-extension", type: "BEGIN_FILING", jobId: manifest.jobId, manifest });
    await waitForCode(page, "field_ambiguous");
    assert.equal(await page.locator("#one").inputValue(), "");
    assert.equal(await page.locator("#two").inputValue(), "");
    await page.close();
  } finally {
    await browser.close();
  }
});
