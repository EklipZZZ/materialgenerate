import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { Config, HeaderUtils, LLMClient } from "coze-coding-dev-sdk";
import { formToMarkdown, parseMarkdownToForm, type CopyrightFormData } from "@/lib/copyright-form";

async function loadConfig() {
  const path = join(process.cwd(), "assets/template_analysis_cfg.json");
  return JSON.parse(await readFile(path, "utf-8"));
}

async function* streamGenerate(
  client: LLMClient,
  systemPrompt: string,
  userPrompt: string,
  config: { model: string; temperature: number }
) {
  const stream = client.stream(
    [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ],
    { model: config.model, temperature: config.temperature }
  );
  for await (const chunk of stream) {
    if (chunk.content) yield chunk.content.toString();
  }
}

/** 网页端 AI 补全采集表字段（不生成 DOCX，仅返回补全后的表单） */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const form = body.form as CopyrightFormData;
    if (!form?.software_full_name) {
      return NextResponse.json({ error: "请提供表单数据" }, { status: 400 });
    }

    const templateMarkdown = formToMarkdown(form);
    const cfg = await loadConfig();
    const analysisPrompt = cfg.up.replace("{{ template_content }}", templateMarkdown).replace(
      "{{ source_code_summary }}",
      ""
    );

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const llmClient = new LLMClient(new Config(), customHeaders);

    let completed = "";
    for await (const chunk of streamGenerate(
      llmClient,
      cfg.sp,
      analysisPrompt,
      cfg.config
    )) {
      completed += chunk;
    }

    let markdown = completed;
    const mdMatch = completed.match(/```(?:markdown|md)?\s*([\s\S]*?)```/);
    if (mdMatch) markdown = mdMatch[1].trim();
    if (!markdown.includes("### 计算机软件著作权登记信息采集表")) {
      markdown = "### 计算机软件著作权登记信息采集表\n\n" + markdown;
    }

    const enrichedForm = parseMarkdownToForm(markdown, form);
    return NextResponse.json({
      form: enrichedForm,
      markdown,
    });
  } catch (e) {
    console.error("[enrich]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI 补全失败" },
      { status: 500 }
    );
  }
}
