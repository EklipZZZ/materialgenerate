import { formToMarkdown } from "./form";
import { streamLlm } from "./llm";
import { cleanCodeContent, cleanManualContent, manualModules, sourceModules } from "./generation-prompts";
import { extractSourceCode } from "./source-extractor";
import { convertMarkdown } from "./converter";
import { preflightPdf } from "./pdf-generator";
import { convertDocxToPdf } from "./pdf-client";
import type { ApplicationRow } from "./applications";
import templateAnalysisConfig from "../../assets/template_analysis_cfg.json";
import sourceCodeConfig from "../../assets/source_code_generation_cfg.json";
import documentationConfig from "../../assets/documentation_generation_cfg.json";
import type { Provider, ThinkingMode } from "./models";

interface GenerationEvent {
  step: string;
  message: string;
  data?: unknown;
}

export interface GenerationInput {
  application: ApplicationRow;
  tableTemplate: string;
  skipAnalyze: boolean;
  provider: Provider;
  model: string;
  apiKey: string;
  sourceBuffer?: Buffer;
  sourceFileName?: string;
  requestUrl: string;
  signal?: AbortSignal;
  emit: (event: GenerationEvent) => void;
}

export interface GeneratedMaterials {
  sourceMarkdown: string;
  manualMarkdown: string;
  collectionMarkdown: string;
  sourceSummary: string;
  sourceDocx: Buffer;
  manualDocx: Buffer;
  sourcePdf: Buffer;
  manualPdf: Buffer;
  summaryPdf: Buffer;
  pdfWarnings: string[];
  softwareName: string;
  version: string;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("Operation aborted");
    error.name = "AbortError";
    throw error;
  }
}

function limitPromptText(value: string, max = 300_000): string {
  if (value.length <= max) return value;
  return value.slice(0, max) + "\n\n[源代码内容过长，后续内容已省略，仅用于生成摘要。]";
}

function replacePrompt(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll("{{ " + key + " }}", value), template);
}

function configuredThinking(config: { thinking?: string }): ThinkingMode {
  // The legacy generator explicitly disabled DeepSeek reasoning. Keep that
  // behavior for long document generation unless a config opts in later.
  return config.thinking === "enabled" ? "enabled" : "disabled";
}

async function runBounded<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number, signal: AbortSignal) => Promise<string>,
  signal?: AbortSignal,
): Promise<string[]> {
  const results = new Array<string>(items.length);
  const batchController = new AbortController();
  const batchSignal = signal ? AbortSignal.any([signal, batchController.signal]) : batchController.signal;
  let firstError: unknown;
  let nextIndex = 0;
  async function consume() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      if (batchSignal.aborted) return;
      try {
        results[index] = await worker(items[index], index, batchSignal);
      } catch (error) {
        if (!firstError) {
          firstError = error;
          batchController.abort();
        }
        return;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => consume()));
  if (firstError) throw firstError;
  throwIfAborted(signal);
  return results;
}

export async function generateMaterials(input: GenerationInput): Promise<GeneratedMaterials> {
  const { application, emit, signal } = input;
  throwIfAborted(signal);
  let sourceInfo: Awaited<ReturnType<typeof extractSourceCode>> | null = null;
  const retryReporter = (step: string, label: string) => (event: { attempt: number; maxRetries: number; kind: string; operation?: string }) => {
    emit({
      step,
      message: `${label}连接暂时异常，正在自动重试（${event.attempt}/${event.maxRetries}）…`,
      data: { retryAttempt: event.attempt, maxRetries: event.maxRetries, failureKind: event.kind, operation: event.operation },
    });
  };
  if (input.sourceBuffer && input.sourceFileName) {
    emit({ step: "init", message: "正在提取源代码…" });
    sourceInfo = await extractSourceCode(input.sourceBuffer, input.sourceFileName, (message) => {
      emit({ step: "init", message });
    }, signal);
  }

  let collectionMarkdown = input.tableTemplate || formToMarkdown(application);
  if (input.skipAnalyze) {
    emit({ step: "analyze", message: "使用已补全的采集表数据…" });
    if (!collectionMarkdown.includes("### 计算机软件著作权登记信息采集表")) {
      collectionMarkdown = "### 计算机软件著作权登记信息采集表\n\n" + collectionMarkdown;
    }
  } else {
    emit({ step: "analyze", message: "正在分析采集表并补充信息…" });
    const sourceSummary = sourceInfo
      ? `\n\n【用户提供的源代码（请基于此生成准确的采集表内容）】\n\n${limitPromptText(sourceInfo.content)}`
      : "";
    const prompt = replacePrompt(templateAnalysisConfig.up, {
      template_content: collectionMarkdown,
      source_code_summary: sourceSummary,
    });
    let analyzed = "";
    await streamLlm({
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
      messages: [
        { role: "system", content: templateAnalysisConfig.sp },
        { role: "user", content: prompt },
      ],
      temperature: templateAnalysisConfig.config.temperature,
      topP: templateAnalysisConfig.config.top_p,
      maxTokens: templateAnalysisConfig.config.max_completion_tokens,
      thinking: configuredThinking(templateAnalysisConfig.config),
      operation: "analyze",
      signal,
      onRetry: retryReporter("analyze", "采集表模型"),
    }, (chunk) => {
      analyzed += chunk;
      emit({ step: "analyze", message: "正在生成完整采集表…" });
    });
    const match = analyzed.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
    collectionMarkdown = (match?.[1] || analyzed).trim();
    if (!collectionMarkdown.includes("### 计算机软件著作权登记信息采集表")) {
      collectionMarkdown = "### 计算机软件著作权登记信息采集表\n\n" + collectionMarkdown;
    }
  }

  let sourceMarkdown: string;
  if (sourceInfo) {
    emit({ step: "source_code", message: "正在处理上传的源代码…" });
    sourceMarkdown = sourceInfo.content;
    emit({ step: "source_code", message: `源代码处理完成，共${sourceInfo.lineCount}行` });
  } else {
    emit({ step: "source_code", message: `正在生成源代码文档（模块化生成，共${sourceModules.length}个模块）…` });
    const results = await runBounded(sourceModules, 2, async (module, index, batchSignal) => {
      throwIfAborted(batchSignal);
      emit({ step: "source_code", message: `正在生成${module.description}（${index + 1}/${sourceModules.length}）…` });
      let content = "";
      await streamLlm({
        provider: input.provider,
        model: input.model,
        apiKey: input.apiKey,
        messages: [
          { role: "system", content: "你是专业的Python开发者。直接输出纯代码，不要任何标记、注释或说明。" },
          { role: "user", content: replacePrompt(module.prompt, { software_info: collectionMarkdown }) },
        ],
        temperature: sourceCodeConfig.config.temperature,
        topP: sourceCodeConfig.config.top_p,
        maxTokens: sourceCodeConfig.config.max_completion_tokens,
        thinking: configuredThinking(sourceCodeConfig.config),
        operation: `source-code/${module.name}`,
        signal: batchSignal,
        onRetry: retryReporter("source_code", module.description),
      }, (chunk) => {
        content += chunk;
        emit({ step: "source_code", message: `正在生成${module.description}…` });
      });
      const cleaned = cleanCodeContent(content);
      emit({ step: "source_code", message: `${module.description}生成完成，共${cleaned.split("\n").length}行` });
      return cleaned;
    }, signal);
    sourceMarkdown = results.join("\n");
    emit({ step: "source_code", message: `源代码生成完成，共${sourceMarkdown.split("\n").length}行` });
  }

  emit({ step: "manual", message: `正在生成用户手册文档（模块化生成，共${manualModules.length}个章节）…` });
  // Manual chapters are long and the provider can reject two large thinking
  // requests at once. Generate them serially and cancel the batch on failure.
  const manualResults = await runBounded(manualModules, 1, async (module, index, batchSignal) => {
    throwIfAborted(batchSignal);
    emit({ step: "manual", message: `正在生成${module.description}（${index + 1}/${manualModules.length}）…` });
    let content = "";
    await streamLlm({
      provider: input.provider,
      model: input.model,
      apiKey: input.apiKey,
      messages: [
        { role: "system", content: "你是专业的技术文档撰写专家。直接输出Markdown内容，不要表格、分隔线、代码块标记。" },
          { role: "user", content: replacePrompt(module.prompt, { software_info: collectionMarkdown }) },
      ],
      temperature: documentationConfig.config.temperature,
      topP: documentationConfig.config.top_p,
      maxTokens: Math.min(documentationConfig.config.max_completion_tokens, 8000),
      thinking: configuredThinking(documentationConfig.config),
      operation: `manual/${module.name}`,
      signal: batchSignal,
      onRetry: retryReporter("manual", module.description),
    }, (chunk) => {
      content += chunk;
      emit({ step: "manual", message: `正在生成${module.description}…` });
    });
    const cleaned = cleanManualContent(content);
    emit({ step: "manual", message: `${module.description}生成完成，共${cleaned.replace(/\s/g, "").length}字` });
    return cleaned;
  }, signal);
  const manualMarkdown = manualResults.join("\n\n");
  emit({ step: "manual", message: `用户手册生成完成，共${manualMarkdown.replace(/\s/g, "").length}字` });

  throwIfAborted(signal);
  emit({ step: "convert", message: "正在生成 DOCX 和 PDF 文档…" });
  const softwareName = String(application.software_full_name || application.software_short_name || "软件著作权申报材料");
  const version = String(application.version || "V1.0");
  const [sourceDocx, manualDocx, summaryDocx] = await Promise.all([
    convertMarkdown("code", sourceMarkdown, softwareName, version, input.requestUrl, signal),
    convertMarkdown("manual", manualMarkdown, softwareName, version, input.requestUrl, signal),
    convertMarkdown("summary", collectionMarkdown, softwareName, version, input.requestUrl, signal),
  ]);
  emit({ step: "convert", message: "DOCX 文档生成完成，正在使用 LibreOffice 转换源代码、用户手册和摘要 PDF…" });
  const [sourcePdfResult, manualPdfResult, summaryPdfResult] = await Promise.all([
    convertDocxToPdf(sourceDocx, sourceMarkdown, input.requestUrl, signal),
    convertDocxToPdf(manualDocx, manualMarkdown, input.requestUrl, signal),
    convertDocxToPdf(summaryDocx, collectionMarkdown, input.requestUrl, signal),
  ]);
  emit({ step: "convert", message: `源代码 PDF 生成完成，共${sourcePdfResult.pageCount}页` });
  emit({ step: "convert", message: `用户手册 PDF 生成完成，共${manualPdfResult.pageCount}页` });
  emit({ step: "convert", message: `申请信息摘要 PDF 生成完成，共${summaryPdfResult.pageCount}页` });
  const pdfWarnings = [
    ...preflightPdf(sourcePdfResult, softwareName, version, sourceMarkdown, "code"),
    ...preflightPdf(manualPdfResult, softwareName, version, manualMarkdown, "manual"),
    ...preflightPdf(summaryPdfResult, softwareName, version, collectionMarkdown, "summary"),
  ];
  for (const warning of [...new Set(pdfWarnings)]) emit({ step: "convert", message: `PDF 预检提醒：${warning}` });
  emit({ step: "convert", message: "DOCX 和 PDF 文档生成完成" });
  return {
    sourceMarkdown,
    manualMarkdown,
    collectionMarkdown,
    sourceSummary: sourceInfo?.summary || "未上传源代码压缩包，已根据申请信息自动生成源代码文档。",
    sourceDocx,
    manualDocx,
    sourcePdf: sourcePdfResult.buffer,
    manualPdf: manualPdfResult.buffer,
    summaryPdf: summaryPdfResult.buffer,
    pdfWarnings: [...new Set(pdfWarnings)],
    softwareName,
    version,
  };
}
