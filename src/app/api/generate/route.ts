import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { supabaseAdmin } from '@/storage/database/supabase-client';

console.log("--- SDK 检查 ---");
console.log("准备动态导入coze-coding-dev-sdk...");

// 配置文件路径
const CONFIG_FILES = {
  templateAnalysis: join(process.cwd(), 'assets/template_analysis_cfg.json'),
  sourceCodeGeneration: join(process.cwd(), 'assets/source_code_generation_cfg.json'),
  documentationGeneration: join(process.cwd(), 'assets/documentation_generation_cfg.json'),
  codeConvertScript: join(process.cwd(), 'assets/code_convert.py'),
  manualConvertScript: join(process.cwd(), 'assets/manual_convert.py'),
  templateDocx: join(process.cwd(), 'assets/template.docx'),
};

// 初始化对象存储（延迟到函数内部）

// 加载配置文件
async function loadConfig(configPath: string) {
  const content = await readFile(configPath, 'utf-8');
  return JSON.parse(content);
}

// 流式调用大模型生成内容
async function* streamGenerateWithLLM(
  client: any,
  systemPrompt: string,
  userPrompt: string,
  config: { model: string; temperature: number; top_p: number; max_completion_tokens: number }
): AsyncGenerator<string> {
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  const stream = client.stream(messages, {
    model: config.model,
    temperature: config.temperature,
  });

  for await (const chunk of stream) {
    if (chunk.content) {
      yield chunk.content.toString();
    }
  }
}

// 解析 Markdown 表格，提取字段值
function parseMarkdownTable(markdown: string): Record<string, string> {
  const result: Record<string, string> = {};
  const rowRegex = /\|\s*\*\*(.+?)\*\*\s*\|\s*(.*?)\s*\|/g;
  let match;
  while ((match = rowRegex.exec(markdown)) !== null) {
    const fieldName = match[1].trim();
    const fieldValue = match[2].trim();
    result[fieldName] = fieldValue;
  }
  return result;
}

function extractSoftwareName(markdown: string): string {
  const fields = parseMarkdownTable(markdown);
  return fields['软件全称'] || '未知软件';
}

function extractVersion(markdown: string): string {
  const fields = parseMarkdownTable(markdown);
  return fields['版本号'] || 'V1.0';
}

// ============ 模块化源代码生成 ============

// 源代码模块定义 - 7个模块，每个约500行，总计约3500行
const SOURCE_CODE_MODULES = [
  {
    name: 'config',
    description: '配置模块',
    prompt: `请为以下软件生成配置模块(config)的Python代码：

软件信息：
{{ software_info }}

要求：
1. 包含系统配置类、数据库配置类、应用配置类
2. 包含配置加载、验证、环境变量读取功能
3. 包含日志配置、缓存配置、API配置
4. 直接输出纯Python代码，不要代码块标记，不要注释
5. 必须生成完整代码，确保每个类定义完整、函数定义完整`
  },
  {
    name: 'models',
    description: '数据模型模块',
    prompt: `请为以下软件生成数据模型模块(models)的Python代码：

软件信息：
{{ software_info }}

要求：
1. 定义核心数据模型类（用户、项目、数据记录等）
2. 包含数据验证、序列化、反序列化方法
3. 包含数据库映射、查询方法
4. 直接输出纯Python代码，不要代码块标记，不要注释
5. 必须生成完整代码，确保每个类定义完整、函数定义完整`
  },
  {
    name: 'utils',
    description: '工具函数模块',
    prompt: `请为以下软件生成工具函数模块(utils)的Python代码：

软件信息：
{{ software_info }}

要求：
1. 包含字符串处理、日期处理、文件操作函数
2. 包含数据转换、格式化、验证函数
3. 包含日志工具、异常处理工具
4. 直接输出纯Python代码，不要代码块标记，不要注释
5. 必须生成完整代码，确保每个函数定义完整`
  },
  {
    name: 'api_routes',
    description: 'API路由模块',
    prompt: `请为以下软件生成API路由模块(api_routes)的Python代码：

软件信息：
{{ software_info }}

要求：
1. 定义RESTful API路由和处理器
2. 包含用户接口、数据接口、系统接口
3. 包含请求处理、响应格式化
4. 直接输出纯Python代码，不要代码块标记，不要注释
5. 必须生成完整代码，确保每个路由处理函数完整`
  },
  {
    name: 'api_middleware',
    description: 'API中间件模块',
    prompt: `请为以下软件生成API中间件模块(api_middleware)的Python代码：

软件信息：
{{ software_info }}

要求：
1. 包含认证中间件、授权中间件
2. 包含请求验证中间件、错误处理中间件
3. 包含日志记录中间件、性能监控中间件
4. 直接输出纯Python代码，不要代码块标记，不要注释
5. 必须生成完整代码，确保每个中间件定义完整`
  },
  {
    name: 'services',
    description: '业务服务模块',
    prompt: `请为以下软件生成业务服务模块(services)的Python代码：

软件信息：
{{ software_info }}

要求：
1. 实现核心业务逻辑服务类
2. 包含数据处理、业务流程控制
3. 包含服务层的数据校验和异常处理
4. 直接输出纯Python代码，不要代码块标记，不要注释
5. 必须生成完整代码，确保每个服务类定义完整`
  },
  {
    name: 'main',
    description: '主程序模块',
    prompt: `请为以下软件生成主程序模块(main)的Python代码：

软件信息：
{{ software_info }}

要求：
1. 包含程序入口、初始化逻辑
2. 包含服务启动、配置加载
3. 包含路由注册、中间件注册
4. 直接输出纯Python代码，不要代码块标记，不要注释
5. 必须生成完整代码，确保程序结构完整`
  }
];

// 生成单个模块
async function* streamGenerateModule(
  client: any,
  moduleInfo: typeof SOURCE_CODE_MODULES[0],
  softwareInfo: string,
  config: { model: string; temperature: number; top_p: number; max_completion_tokens: number }
): AsyncGenerator<string> {
  const prompt = moduleInfo.prompt.replace('{{ software_info }}', softwareInfo);
  
  yield* streamGenerateWithLLM(
    client,
    '你是专业的Python开发者。直接输出纯代码，不要任何标记、注释或说明。',
    prompt,
    config
  );
}

// ============ 模块化用户手册生成 ============

// 用户手册模块定义
const MANUAL_MODULES = [
  {
    name: 'overview',
    description: '软件概况章节',
    prompt: `请为以下软件撰写软件说明书的第1章"软件概况"，约1200字：

软件信息：
{{ software_info }}

【章节结构】
# 软件说明书

## 1 软件概况
### 1.1 软件全称
### 1.2 软件简称
### 1.3 版本号
### 1.4 软件分类
### 1.5 开发单位
### 1.6 开发完成日期

【严格禁止】
- 禁止表格
- 禁止分隔线（---或***）
- 禁止代码块标记
- 禁止带序号列表（1. 2. 3.）

【必须使用】
- 列表用（1）（2）（3）格式
- 段落间用单个空行分隔

直接输出Markdown内容：`
  },
  {
    name: 'functions',
    description: '软件功能章节',
    prompt: `请为以下软件撰写软件说明书的第2章"软件功能"，约2000字：

软件信息：
{{ software_info }}

【章节结构】
## 2 软件功能
### 2.1 功能概述
### 2.2 主要功能模块
（详细描述每个功能模块，包括功能描述、操作步骤、界面说明）
### 2.3 功能特点

【严格禁止】
- 禁止表格
- 禁止分隔线（---或***）
- 禁止代码块标记
- 禁止带序号列表（1. 2. 3.）

【必须使用】
- 列表用（1）（2）（3）格式
- 段落间用单个空行分隔
- 每个模块至少3-5个功能点

直接输出Markdown内容：`
  },
  {
    name: 'environment',
    description: '运行环境与安装章节',
    prompt: `请为以下软件撰写软件说明书的第3-4章"软件运行环境"和"软件安装部署"，约1500字：

软件信息：
{{ software_info }}

【章节结构】
## 3 软件运行环境
### 3.1 硬件环境
### 3.2 软件环境
### 3.3 支撑软件

## 4 软件安装部署
### 4.1 安装步骤
### 4.2 配置说明
### 4.3 部署流程

【严格禁止】
- 禁止表格
- 禁止分隔线（---或***）
- 禁止代码块标记
- 禁止带序号列表（1. 2. 3.）

【必须使用】
- 列表用（1）（2）（3）格式
- 段落间用单个空行分隔

直接输出Markdown内容：`
  },
  {
    name: 'operations',
    description: '操作说明章节',
    prompt: `请为以下软件撰写软件说明书的第5章"软件操作说明"，约2000字：

软件信息：
{{ software_info }}

【章节结构】
## 5 软件操作说明
### 5.1 登录
### 5.2 主界面
### 5.3 功能操作
（详细描述各功能的操作步骤）
### 5.4 数据管理
### 5.5 系统设置

【严格禁止】
- 禁止表格
- 禁止分隔线（---或***）
- 禁止代码块标记
- 禁止带序号列表（1. 2. 3.）

【必须使用】
- 列表用（1）（2）（3）格式
- 段落间用单个空行分隔
- 操作步骤要详细

直接输出Markdown内容：`
  },
  {
    name: 'tech_test',
    description: '技术特点与测试章节',
    prompt: `请为以下软件撰写软件说明书的第6-8章，约1800字：

软件信息：
{{ software_info }}

【章节结构】
## 6 软件技术特点
### 6.1 技术架构
### 6.2 核心技术
### 6.3 创新点

## 7 软件测试
### 7.1 测试环境
### 7.2 测试用例
### 7.3 测试结果

## 8 附录
### 8.1 术语说明
### 8.2 技术支持

【严格禁止】
- 禁止表格
- 禁止分隔线（---或***）
- 禁止代码块标记
- 禁止带序号列表（1. 2. 3.）
- 禁止编造具体的电话号码、地址、邮箱、网址等联系方式
- 禁止编造具体的服务时间

【必须使用】
- 列表用（1）（2）（3）格式
- 段落间用单个空行分隔
- 技术特点突出创新性
- 技术支持部分只写通用的描述，如"用户可通过软件内置的帮助系统获取技术支持"或"请联系开发单位获取技术支持服务"

直接输出Markdown内容：`
  }
];

// 生成单个用户手册模块
async function* streamGenerateManualModule(
  client: any,
  moduleInfo: typeof MANUAL_MODULES[0],
  softwareInfo: string,
  config: { model: string; temperature: number; top_p: number; max_completion_tokens: number },
  sourceCodeContent?: string
): AsyncGenerator<string> {
  let prompt = moduleInfo.prompt.replace('{{ software_info }}', softwareInfo);
  if (sourceCodeContent) {
    prompt = prompt.replace('{{ source_code_summary }}', `\n\n【用户提供的源代码（请基于此生成准确的手册内容）】\n\n${sourceCodeContent}`);
  } else {
    prompt = prompt.replace('{{ source_code_summary }}', '');
  }
  
  yield* streamGenerateWithLLM(
    client,
    '你是专业的技术文档撰写专家。直接输出Markdown内容，不要表格、分隔线、代码块标记。',
    prompt,
    config
  );
}

// 清理用户手册内容
function cleanManualContent(content: string): string {
  let cleaned = content;
  // 去掉代码块标记
  cleaned = cleaned.replace(/```(?:markdown|md)?\n?/gi, '');
  // 去掉分隔线
  cleaned = cleaned.replace(/^[-─]{3,}$/gm, '');
  // 多个空行变成两个
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  // 去掉开头空行
  cleaned = cleaned.replace(/^\s*\n+/, '');
  // 去掉结尾多余空行
  cleaned = cleaned.replace(/\n+$/, '');
  return cleaned;
}

// 清理代码内容
function cleanCodeContent(code: string): string {
  let cleaned = code;
  // 去掉代码块标记
  cleaned = cleaned.replace(/```python\n?/gi, '');
  cleaned = cleaned.replace(/```\n?/g, '');
  // 去掉开头空行
  cleaned = cleaned.replace(/^\s*\n+/, '');
  // 去掉结尾多余空行
  cleaned = cleaned.replace(/\n+$/, '');
  return cleaned;
}

// 调用Python脚本转换MD到DOCX
async function convertMdToDocx(
  scriptPath: string,
  inputMd: string,
  outputDocx: string,
  softwareName: string,
  version: string,
  templateDocx?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      scriptPath,
      '--input_md', inputMd,
      '--output_docx', outputDocx,
      '--software_name', softwareName,
      '--version', version,
    ];

    if (templateDocx && scriptPath.includes('manual_convert.py')) {
      args.push('--cover', templateDocx);
    }

    const childProcess = spawn('python3', args);

    let stderr = '';
    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
      }
    });

    childProcess.on('error', (err: Error) => {
      reject(err);
    });
  });
}

// 上传文件到对象存储
async function uploadToStorage(
  storage: any,
  content: Buffer,
  fileName: string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const key = await storage.uploadFile({
    fileContent: content,
    fileName: `software-copyright/${Date.now()}-${fileName}`,
    contentType: contentType,
  });

  const url = await storage.generatePresignedUrl({
    key,
    expireTime: 3600,
  });

  return { key, url };
}

// SSE 编码器
function encodeSSE(data: { step: string; message: string; data?: unknown }) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  // 动态导入coze-coding-dev-sdk，避免模块加载时的类继承问题
  const { LLMClient, Config, HeaderUtils, S3Storage } = await import('coze-coding-dev-sdk');
  
  console.log("--- SDK 动态导入成功 ---");
  console.log("LLMClient:", typeof LLMClient);
  console.log("S3Storage:", typeof S3Storage);
  
  // 初始化对象存储（延迟初始化，避免顶层执行报错）
  const storage = new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    accessKey: '',
    secretKey: '',
    bucketName: process.env.COZE_BUCKET_NAME,
    region: 'cn-beijing',
  });

  // 支持 JSON 和 formData 两种格式
  let tableTemplate: string | null = null;
  let sourceCodeContent: string | null = null;
  let userId: string | null = null;
  let file: File | null = null;
  let sourceCodeFile: File | null = null;

  const contentType = request.headers.get('Content-Type') || '';

  let skipAnalyze = false;

  if (contentType.includes('application/json')) {
    // JSON 格式
    const body = await request.json();
    tableTemplate = body.tableTemplate || null;
    sourceCodeContent = body.sourceCodeContent || null;
    userId = body.userId || body.user_id || null;
    skipAnalyze = Boolean(body.skipAnalyze);
  } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    // formData 格式
    const formData = await request.formData();
    file = formData.get('template_file') as File;
    sourceCodeFile = formData.get('source_code_file') as File | null;
    userId = formData.get('user_id') as string | null;
    const skipFlag = formData.get('skip_analyze');
    skipAnalyze = skipFlag === '1' || skipFlag === 'true';

    if (!file) {
      return new Response(JSON.stringify({ error: '请上传模板文件' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    tableTemplate = await file.text();
  }

  if (!tableTemplate) {
    return new Response(JSON.stringify({ error: '请提供模板内容' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!tableTemplate.includes('|') || !tableTemplate.includes('---')) {
    return new Response(JSON.stringify({ error: '模板文件必须是有效的 Markdown 表格格式' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const softwareName = extractSoftwareName(tableTemplate);
  const version = extractVersion(tableTemplate);

  // 处理源代码文件
  let sourceCodeInfo: { content: string; fileCount: number; summary: string } | null = null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (step: string, message: string, data?: unknown) => {
        controller.enqueue(encoder.encode(encodeSSE({ step, message, data })));
      };

      try {
        // 处理源代码文件（如果有）
        if (sourceCodeFile) {
          sendProgress('init', '正在提取源代码...');
          const { extractSourceCode } = await import('./source_extractor');
          sourceCodeInfo = await extractSourceCode(sourceCodeFile, sendProgress);
        }

        const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
        const config = new Config();
        const llmClient = new LLMClient(config, customHeaders);

        const tempDir = join(tmpdir(), `software-copyright-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });

        sendProgress('init', '正在加载配置文件...');
        const templateAnalysisCfg = await loadConfig(CONFIG_FILES.templateAnalysis);
        const sourceCodeCfg = await loadConfig(CONFIG_FILES.sourceCodeGeneration);
        const documentationCfg = await loadConfig(CONFIG_FILES.documentationGeneration);

        // 步骤1: 分析并补充采集表（网页已补全时可跳过）
        let finalMarkdown = tableTemplate;
        if (skipAnalyze) {
          sendProgress('analyze', '使用已补全的采集表数据...');
          if (!finalMarkdown.includes('### 计算机软件著作权登记信息采集表')) {
            finalMarkdown = '### 计算机软件著作权登记信息采集表\n\n' + finalMarkdown;
          }
        } else {
          sendProgress('analyze', '正在分析采集表并补充信息...');
          let analysisPrompt = templateAnalysisCfg.up.replace(
            '{{ template_content }}',
            tableTemplate
          );

          if (sourceCodeInfo) {
            analysisPrompt = analysisPrompt.replace(
              '{{ source_code_summary }}',
              `\n\n【用户提供的源代码（请基于此生成准确的采集表内容）】\n\n${sourceCodeInfo.content}`
            );
          } else {
            analysisPrompt = analysisPrompt.replace('{{ source_code_summary }}', '');
          }

          let completedCollectionMarkdown = '';
          for await (const chunk of streamGenerateWithLLM(
            llmClient,
            templateAnalysisCfg.sp,
            analysisPrompt,
            templateAnalysisCfg.config
          )) {
            completedCollectionMarkdown += chunk;
            sendProgress('analyze', '正在生成完整采集表...', { chunk });
          }

          finalMarkdown = completedCollectionMarkdown;
          const mdMatch = completedCollectionMarkdown.match(/```(?:markdown|md)?\s*([\s\S]*?)```/);
          if (mdMatch) {
            finalMarkdown = mdMatch[1].trim();
          }

          if (!finalMarkdown.includes('### 计算机软件著作权登记信息采集表')) {
            finalMarkdown = '### 计算机软件著作权登记信息采集表\n\n' + finalMarkdown;
          }
        }

        // 步骤2: 源代码文档（使用用户上传的或AI生成）
        let sourceCodeMarkdown: string;
        
        if (sourceCodeInfo) {
          // 使用用户上传的源代码
          sendProgress('source_code', '正在处理源代码...');
          sourceCodeMarkdown = sourceCodeInfo.content;
          const totalLines = sourceCodeMarkdown.split('\n').length;
          sendProgress('source_code', `源代码处理完成，共${totalLines}行`);
        } else {
          // AI 生成源代码
          sendProgress('source_code', '正在生成源代码文档（模块化生成，共5个模块）...');
          
          const allModules: string[] = [];
          
          for (let i = 0; i < SOURCE_CODE_MODULES.length; i++) {
            const moduleInfo = SOURCE_CODE_MODULES[i];
            sendProgress('source_code', `正在生成${moduleInfo.description}（${i + 1}/${SOURCE_CODE_MODULES.length}）...`);
            
            let moduleCode = '';
            for await (const chunk of streamGenerateModule(
              llmClient,
              moduleInfo,
              finalMarkdown,
              sourceCodeCfg.config
            )) {
              moduleCode += chunk;
              sendProgress('source_code', `正在生成${moduleInfo.description}...`, { chunk });
            }
            
            const cleanedCode = cleanCodeContent(moduleCode);
            allModules.push(cleanedCode);
            
            const lines = cleanedCode.split('\n').length;
            sendProgress('source_code', `${moduleInfo.description}生成完成，共${lines}行`);
          }
          
          // 合并所有模块
          sourceCodeMarkdown = allModules.join('\n');
          const totalLines = sourceCodeMarkdown.split('\n').length;
          sendProgress('source_code', `源代码生成完成，共${totalLines}行`);
        }

        // 步骤3: 模块化生成用户手册（增强：基于源代码信息）
        sendProgress('manual', '正在生成用户手册文档（模块化生成，共5个章节）...');
        
        const allManualModules: string[] = [];
        
        for (let i = 0; i < MANUAL_MODULES.length; i++) {
          const moduleInfo = MANUAL_MODULES[i];
          sendProgress('manual', `正在生成${moduleInfo.description}（${i + 1}/${MANUAL_MODULES.length}）...`);
          
          let moduleContent = '';
          for await (const chunk of streamGenerateManualModule(
            llmClient,
            moduleInfo,
            finalMarkdown,
            documentationCfg.config,
            sourceCodeInfo?.content
          )) {
            moduleContent += chunk;
            sendProgress('manual', `正在生成${moduleInfo.description}...`, { chunk });
          }
          
          const cleanedContent = cleanManualContent(moduleContent);
          allManualModules.push(cleanedContent);
          
          const chars = cleanedContent.replace(/\s/g, '').length;
          sendProgress('manual', `${moduleInfo.description}生成完成，共${chars}字`);
        }

        // 合并所有用户手册模块
        const manualMarkdown = allManualModules.join('\n\n');
        const totalChars = manualMarkdown.replace(/\s/g, '').length;
        sendProgress('manual', `用户手册生成完成，共${totalChars}字`);

        // 步骤4: 保存临时文件
        sendProgress('convert', '正在转换文档格式...');
        const sourceCodeMdPath = join(tempDir, 'source_code.md');
        const manualMdPath = join(tempDir, 'manual.md');
        const collectionMdPath = join(tempDir, 'collection.md');
        const sourceCodeDocxPath = join(tempDir, 'source_code.docx');
        const manualDocxPath = join(tempDir, 'manual.docx');

        await writeFile(sourceCodeMdPath, sourceCodeMarkdown, 'utf-8');
        await writeFile(manualMdPath, manualMarkdown, 'utf-8');
        await writeFile(collectionMdPath, finalMarkdown, 'utf-8');

        // 步骤5: 调用Python脚本转换
        sendProgress('convert', '正在转换源代码文档...');
        await convertMdToDocx(
          CONFIG_FILES.codeConvertScript,
          sourceCodeMdPath,
          sourceCodeDocxPath,
          softwareName,
          version
        );

        sendProgress('convert', '正在转换用户手册文档...');
        await convertMdToDocx(
          CONFIG_FILES.manualConvertScript,
          manualMdPath,
          manualDocxPath,
          softwareName,
          version,
          CONFIG_FILES.templateDocx
        );

        // 步骤6: 上传文件到对象存储
        sendProgress('upload', '正在上传文件...');

        const sourceCodeBuffer = await readFile(sourceCodeDocxPath);
        const manualBuffer = await readFile(manualDocxPath);
        const markdownBuffer = Buffer.from(finalMarkdown, 'utf-8');

        const [sourceCodeResult, manualResult, markdownResult] = await Promise.all([
          uploadToStorage(
            storage,
            sourceCodeBuffer,
            `${softwareName}_源代码文档.docx`,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ),
          uploadToStorage(
            storage,
            manualBuffer,
            `${softwareName}_用户手册.docx`,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ),
          uploadToStorage(
            storage,
            markdownBuffer,
            `${softwareName}_采集表.md`,
            'text/markdown'
          ),
        ]);

        // 清理临时文件
        try {
          await unlink(sourceCodeMdPath);
          await unlink(manualMdPath);
          await unlink(collectionMdPath);
          await unlink(sourceCodeDocxPath);
          await unlink(manualDocxPath);
        } catch {
          // 忽略清理错误
        }

        sendProgress('complete', '生成完成！', {
          sourceCodeDocx: sourceCodeResult.url,
          userManualDocx: manualResult.url,
          collectionFormMarkdown: markdownResult.url,
        });

        // 保存历史记录（如果有用户ID）
        console.log('[DEBUG] 保存历史记录:', { userId, supabaseAdmin: !!supabaseAdmin });
        if (userId && supabaseAdmin) {
          try {
            console.log('[DEBUG] 开始插入记录:', { userId, softwareName, version });
            const { data, error } = await supabaseAdmin.from('generation_records').insert({
              user_id: userId,
              file_name: softwareName || '未命名项目',
              source_code_summary: `版本: ${version || 'V1.0'}, 文件数: ${sourceCodeInfo?.fileCount || 0}`,
              source_code_docx_url: sourceCodeResult.url,
              user_manual_docx_url: manualResult.url,
              collection_form_url: markdownResult.url,
              status: 'completed',
            }).select();
            console.log('[DEBUG] 插入结果:', { data, error });
          } catch (err) {
            console.error('保存历史记录失败:', err);
          }
        } else {
          console.log('[DEBUG] 跳过保存: userId=', userId, 'supabaseAdmin=', !!supabaseAdmin);
        }

        controller.close();
      } catch (error) {
        sendProgress('error', `生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
