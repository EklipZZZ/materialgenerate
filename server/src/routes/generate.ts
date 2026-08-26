import { Router, type Response } from "express";
import multer from "multer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { getOwnedApplication } from "../applications.js";
import { requireAuth, requestUser } from "../auth.js";
import { decryptApiKey } from "../crypto.js";
import { supabaseAdmin } from "../db.js";
import { env } from "../env.js";
import { callLlm } from "../llm.js";
import { extractSourceCode } from "../source-extractor.js";
import { formToMarkdown } from "../form.js";
import { deleteObjects, uploadBuffer, signedDownloadUrl } from "../storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const generationBody = z.object({
  application_id: z.string().uuid(),
  config_id: z.string().uuid(),
  table_template: z.string().max(200_000).optional(),
  skip_analyze: z.union([z.string(), z.boolean()]).optional(),
});

const modulePrompts = {
  source: "请根据申请信息和源代码摘要，生成客观的软件著作权申报源代码文档 Markdown。说明系统模块结构、业务流程和关键实体，不要编造联系方式或证照信息，只输出 Markdown。",
  manual: "请根据申请信息和源代码摘要，生成软件用户手册 Markdown。包含软件简介、运行环境、主要功能、操作流程、界面说明和技术支持说明，不要编造电话、地址等联系方式，只输出 Markdown。",
};

const assetRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../assets");

function sendEvent(response: Response, step: string, message: string, data?: unknown) {
  if (response.writableEnded || response.destroyed) return;
  response.write("data: " + JSON.stringify({ step, message, data }) + "\n\n");
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 100) || "software-copyright";
}

function runPython(script: string, args: string[], signal?: AbortSignal): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(env.pythonBin, [join(assetRoot, script), ...args], {
      cwd: assetRoot,
      stdio: ["ignore", "ignore", "pipe"],
      signal,
    });
    child.stderr.on("data", () => undefined);
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error("DOCX conversion failed"));
    });
  });
}

async function llmText(input: Parameters<typeof callLlm>[0]): Promise<string> {
  const result = await callLlm(input);
  if (typeof result !== "string") throw new Error("invalid model response");
  const fence = String.fromCharCode(96).repeat(3);
  return result
    .replace(new RegExp("^" + fence + "(?:markdown|md)?\\s*", "i"), "")
    .replace(new RegExp("\\s*" + fence + "$"), "")
    .trim();
}

export const generateRouter = Router();
generateRouter.use(requireAuth);

const activeGenerationUsers = new Set<string>();

generateRouter.post("/", upload.single("source_code_file"), async (request, response) => {
  const abortController = new AbortController();
  let clientClosed = false;
  const abort = () => {
    clientClosed = true;
    abortController.abort();
  };
  request.once("aborted", abort);
  response.once("close", () => {
    if (!response.writableEnded) abort();
  });

  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();

  const finish = () => {
    if (!response.writableEnded && !response.destroyed) response.end();
  };
  const signal = abortController.signal;
  let tempDir = "";
  let phase = "validate";
  let activeUserId = "";
  let uploadedKeys: string[] = [];
  try {
    const parsed = generationBody.safeParse(request.body);
    if (!parsed.success) {
      sendEvent(response, "error", "生成参数无效");
      finish();
      return;
    }
    if (signal.aborted) return;

    const userId = requestUser(request).id;
    if (activeGenerationUsers.has(userId)) {
      sendEvent(response, "error", "同一账号已有生成任务正在进行，请等待完成");
      finish();
      return;
    }
    activeGenerationUsers.add(userId);
    activeUserId = userId;
    phase = "lookup";
    const [application, configResult] = await Promise.all([
      getOwnedApplication(parsed.data.application_id, userId, signal),
      supabaseAdmin
        .from("llm_configs")
        .select("*")
        .eq("id", parsed.data.config_id)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (!application) {
      sendEvent(response, "error", "申请不存在");
      finish();
      return;
    }
    if (configResult.error || !configResult.data) {
      sendEvent(response, "error", "模型配置不存在");
      finish();
      return;
    }

    const config = configResult.data;
    phase = "decrypt";
    const apiKey = decryptApiKey(config);
    phase = "workspace";
    tempDir = await mkdtemp(join(tmpdir(), "softreg-generation-"));
    let sourceInfo: Awaited<ReturnType<typeof extractSourceCode>> | null = null;
    phase = "source";
    if (request.file) {
      sourceInfo = await extractSourceCode(request.file.buffer, request.file.originalname, (message) => {
        sendEvent(response, "init", message);
      }, signal);
    }

    const sourceSummary = sourceInfo?.summary || "未上传源代码压缩包，将根据申请信息自动生成源代码文档。";
    let finalMarkdown = parsed.data.table_template || formToMarkdown(application);
    const skipAnalyze = parsed.data.skip_analyze === true ||
      parsed.data.skip_analyze === "1" ||
      parsed.data.skip_analyze === "true";
    phase = "analyze";
    if (!skipAnalyze) {
      sendEvent(response, "analyze", "正在分析申请信息");
      finalMarkdown = await llmText({
        provider: config.provider,
        model: config.model,
        apiKey,
        messages: [
          { role: "system", content: "你是软件著作权申报信息整理助手。" },
          { role: "user", content: "请整理以下申请信息并只输出 Markdown 表格。\n\n" + finalMarkdown },
        ],
        temperature: 0.2,
        max_tokens: 5000,
        signal,
      });
    } else {
      sendEvent(response, "analyze", "使用已保存的申请信息");
    }

    sendEvent(response, "source_code", sourceInfo ? "正在整理源代码文档" : "正在生成源代码文档");
    phase = "source-document";
    const sourceMarkdown = sourceInfo?.content || await llmText({
      provider: config.provider,
      model: config.model,
      apiKey,
      messages: [
        { role: "system", content: "你是软件著作权源代码文档撰写专家。" },
        { role: "user", content: modulePrompts.source + "\n\n申请信息：\n" + finalMarkdown },
      ],
      temperature: 0.3,
      max_tokens: 12000,
      signal,
    });
    sendEvent(response, "source_code", "源代码文档内容已准备");

    sendEvent(response, "manual", "正在生成用户手册");
    phase = "manual";
    const manualMarkdown = await llmText({
      provider: config.provider,
      model: config.model,
      apiKey,
      messages: [
        { role: "system", content: "你是软件用户手册撰写专家。" },
        { role: "user", content: modulePrompts.manual + "\n\n申请信息：\n" + finalMarkdown + "\n\n源代码摘要：\n" + sourceSummary },
      ],
      temperature: 0.4,
      max_tokens: 12000,
      signal,
    });
    sendEvent(response, "manual", "用户手册内容已准备");

    sendEvent(response, "convert", "正在转换 DOCX 文件");
    const sourceMdPath = join(tempDir, "source-code.md");
    const manualMdPath = join(tempDir, "user-manual.md");
    const collectionMdPath = join(tempDir, "collection-form.md");
    const sourceDocxPath = join(tempDir, "source-code.docx");
    const manualDocxPath = join(tempDir, "user-manual.docx");
    const softwareName = String(application.software_full_name || application.software_short_name || "软件著作权申报材料");
    const version = String(application.version || "V1.0");
    await Promise.all([
      writeFile(sourceMdPath, sourceMarkdown, "utf8"),
      writeFile(manualMdPath, manualMarkdown, "utf8"),
      writeFile(collectionMdPath, finalMarkdown, "utf8"),
    ]);
    phase = "code-docx";
    await runPython("code_convert.py", [
      "--input_md", sourceMdPath,
      "--output_docx", sourceDocxPath,
      "--software_name", softwareName,
      "--version", version,
    ], signal);
    phase = "manual-docx";
    await runPython("manual_convert.py", [
      "--input_md", manualMdPath,
      "--output_docx", manualDocxPath,
      "--software_name", softwareName,
      "--version", version,
      "--cover", join(assetRoot, "template.docx"),
    ], signal);

    sendEvent(response, "upload", "正在上传生成材料");
    const prefix = "generations/" + userId + "/" + parsed.data.application_id + "/" + Date.now();
    const sourceKey = prefix + "/" + safeName(softwareName) + "-source-code.docx";
    const manualKey = prefix + "/" + safeName(softwareName) + "-user-manual.docx";
    const collectionKey = prefix + "/" + safeName(softwareName) + "-collection-form.md";
    uploadedKeys = [sourceKey, manualKey, collectionKey];
    phase = "upload";
    await Promise.all([
      uploadBuffer(sourceKey, await readFile(sourceDocxPath), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signal),
      uploadBuffer(manualKey, await readFile(manualDocxPath), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signal),
      uploadBuffer(collectionKey, Buffer.from(finalMarkdown, "utf8"), "text/markdown; charset=utf-8", signal),
    ]);

    phase = "record";
    const record = await supabaseAdmin.from("generation_records").insert({
      user_id: userId,
      application_id: parsed.data.application_id,
      file_name: softwareName,
      source_code_summary: sourceSummary,
      source_code_object_key: sourceKey,
      user_manual_object_key: manualKey,
      collection_form_object_key: collectionKey,
      provider: config.provider,
      model: config.model,
      status: "completed",
    }).select("id").single();
    if (record.error || !record.data) throw new Error("generation record creation failed");

    sendEvent(response, "complete", "生成完成", {
      sourceCodeDocx: await signedDownloadUrl(sourceKey),
      userManualDocx: await signedDownloadUrl(manualKey),
      collectionFormMarkdown: await signedDownloadUrl(collectionKey),
      fileName: safeName(softwareName),
      recordId: record.data.id,
    });
    finish();
  } catch {
    console.error("generation pipeline failed at " + phase);
    if (uploadedKeys.length) {
      await deleteObjects(uploadedKeys).catch(() => {
        console.error("Storage cleanup failed after generation error");
      });
    }
    if (signal.aborted || clientClosed) return;
    sendEvent(response, "error", "生成失败，请检查模型配置和服务日志");
    finish();
  } finally {
    request.off("aborted", abort);
    if (activeUserId) activeGenerationUsers.delete(activeUserId);
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
});
