"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileArchive,
  FileCode2,
  FileOutput,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Play,
  X,
} from "lucide-react";
import { AppShell, PageHeader, Panel, StatusBadge } from "@/components/app-shell";
import { MaterialChecklist } from "@/components/material-checklist";
import { FilingPanel } from "@/components/filing-panel";
import { Button } from "@/components/ui/button";
import { apiEndpoint } from "@/lib/api-base";
import { authorizedFetch } from "@/lib/auth";
import { type ByokConfig } from "@/lib/byok";
import { getApplicationProgress } from "@/lib/application-progress";
import { loadPersistedByok } from "@/lib/llm-config-client";
import { getApplication, type ApplicationRecord } from "@/lib/softreg-api";
import {
  getSavedSourceArchive,
  type SavedSourceArchive,
} from "@/lib/source-upload";

interface GenerationResult {
  jobId?: string;
  sourceCodeDocx?: string;
  sourceCodePdf?: string;
  userManualDocx?: string;
  userManualPdf?: string;
  collectionFormMarkdown?: string;
  fileName?: string;
  recordId?: string;
  pdfWarnings?: string[];
}

interface GenerationJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  current_step: string;
  progress: number;
  error_message?: string | null;
}

interface StreamEvent {
  step: string;
  message: string;
  data?: GenerationResult & { chunk?: string; jobId?: string; stage?: string };
}

async function fetchLatestGenerationJob(applicationId: string): Promise<GenerationJob | null> {
  try {
    const response = await authorizedFetch(apiEndpoint(`/api/generation-jobs?applicationId=${encodeURIComponent(applicationId)}`));
    if (!response.ok) return null;
    const body = await response.json().catch(() => ({})) as { data?: { job?: GenerationJob } | null };
    return body.data?.job || null;
  } catch {
    return null;
  }
}

const generationSteps = [
  { key: "init", label: "读取申请信息", description: "确认登记字段和源码输入" },
  { key: "analyze", label: "整理采集表", description: "生成材料所需的结构化信息" },
  { key: "source_code", label: "生成源代码文档", description: "整理源码章节和说明" },
  { key: "manual", label: "生成用户手册", description: "编写操作流程和功能说明" },
  { key: "convert", label: "生成文档格式", description: "准备可下载的 DOCX 和 PDF 文件" },
  { key: "upload", label: "保存生成结果", description: "上传并创建历史记录" },
];

function stepIndex(step: string): number {
  return generationSteps.findIndex((item) => item.key === step);
}

function sourceReviewIsCurrent(archive: SavedSourceArchive | null, applicationUpdatedAt?: string): boolean {
  return Boolean(archive
    && archive.reviewStatus !== "pending"
    && archive.reviewedApplicationUpdatedAt === applicationUpdatedAt
    && archive.reviewedSourceUpdatedAt === archive.updatedAt);
}

function sourceReviewLabel(archive: SavedSourceArchive | null, applicationUpdatedAt?: string): string {
  if (!archive) return "未关联源码，生成器将根据申请信息生成源码材料";
  if (!sourceReviewIsCurrent(archive, applicationUpdatedAt)) return "待核对：请回申请页处理";
  return archive.reviewStatus === "skipped" ? "已跳过核对，将使用该源码" : "已确认，将使用该源码";
}

function resultItems() {
  return [
    { key: "sourceCodeDocx", label: "源代码文档", description: "DOCX", icon: FileCode2 },
    { key: "sourceCodePdf", label: "源代码文档", description: "PDF", icon: FileText },
    { key: "userManualDocx", label: "用户手册", description: "DOCX", icon: FileText },
    { key: "userManualPdf", label: "用户手册", description: "PDF", icon: FileText },
    { key: "collectionFormMarkdown", label: "采集表", description: "Markdown", icon: FileOutput },
  ] as const;
}

export default function GenerationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [byok, setByok] = useState<ByokConfig | null>(null);
  const [savedSourceArchive, setSavedSourceArchive] = useState<SavedSourceArchive | null>(null);
  const [currentStep, setCurrentStep] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [latestJob, setLatestJob] = useState<GenerationJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [materialRefresh, setMaterialRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestStatus = latestJob?.status;

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([getApplication(id), loadPersistedByok(), fetchLatestGenerationJob(id), getSavedSourceArchive(id)])
      .then(([record, storedByok, job, archive]) => {
        if (!active) return;
        setApplication(record);
        setByok(storedByok);
        setLatestJob(job);
        setSavedSourceArchive(archive);
        if (job && (job.status === "failed" || job.status === "cancelled")) {
          setCurrentStep(job.current_step);
          setMessage(job.error_message || "上一次生成任务未完成");
        } else if (job && (job.status === "queued" || job.status === "running")) {
          setCurrentStep(job.current_step);
          setMessage(`上一次生成任务进行中（${job.progress}%）`);
        } else if (job?.status === "completed") {
          setCurrentStep("complete");
          setMessage("上一次生成已完成，可在下方材料清单中下载文件。");
        }
        setError(null);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "加载申请失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!id || !latestStatus || !["queued", "running"].includes(latestStatus)) return;
    let active = true;
    const timer = window.setInterval(() => {
      void fetchLatestGenerationJob(id).then((job) => {
        if (!active || !job) return;
        setLatestJob(job);
        setCurrentStep(job.current_step);
        if (job.status === "completed") {
          setMessage("生成已完成，可在下方材料清单中下载文件。");
          setMaterialRefresh((current) => current + 1);
        } else if (job.status === "failed" || job.status === "cancelled") {
          setMessage(job.error_message || "生成任务未完成");
        } else {
          setMessage(`生成任务进行中（${job.progress}%）`);
        }
      });
    }, 2_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id, latestStatus]);

  async function generate() {
    if (!application || !id) return;
    if (!byok?.id) {
      setError("请先在设置中保存 AI 模型配置");
      return;
    }
    if (savedSourceArchive && !sourceReviewIsCurrent(savedSourceArchive, application.updated_at)) {
      setError("当前申请关联的源码尚未完成核对，或申请内容已变化。请回申请页完成源码核对后再生成");
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);
    setLatestJob(null);
    setCurrentStep("init");
    setMessage("正在启动生成服务…");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await authorizedFetch(apiEndpoint("/api/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: id,
          llmConfigId: byok.id,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const bodyText = await response.text();
        let message = bodyText || "生成请求失败";
        try {
          const body = JSON.parse(bodyText) as { msg?: string };
          message = body.msg || message;
        } catch {
          // Keep the plain response when the server did not return JSON.
        }
        throw new Error(message);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("生成服务没有返回进度流");
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: GenerationResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6)) as StreamEvent;
          setCurrentStep(event.step);
          setMessage(event.message);
          if (event.step === "error") {
            if (event.data?.jobId) {
              setLatestJob({
                id: event.data.jobId,
                status: "failed",
                current_step: event.data.stage || event.step,
                progress: 0,
                error_message: event.message,
              });
            }
            throw new Error(event.message);
          }
          if (event.step === "complete" && event.data) finalResult = event.data;
        }
      }

      setResult(finalResult);
      if (finalResult?.jobId) {
        setLatestJob({ id: finalResult.jobId, status: "completed", current_step: "complete", progress: 100 });
        setMaterialRefresh((current) => current + 1);
      } else {
        const job = await fetchLatestGenerationJob(id);
        if (job) {
          setLatestJob(job);
          setCurrentStep(job.current_step);
          setMessage(job.error_message || `生成任务状态：${job.status}`);
          if (job.status === "failed" || job.status === "cancelled") {
            setError(job.error_message || "生成任务未完成");
          } else if (job.status === "completed") {
            setError("生成任务已完成，但文件结果未返回，请刷新页面查看材料清单。");
          } else {
            setError("生成连接已中断，任务仍在服务器处理；请等待任务状态更新。");
          }
        } else {
          setError("生成连接已中断，任务状态暂不可用，请刷新页面查看。");
        }
        setMaterialRefresh((current) => current + 1);
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") setError("已取消生成");
      else setError(cause instanceof Error ? cause.message : "生成失败");
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  const progress = application ? getApplicationProgress(application) : null;
  const activeIndex = stepIndex(currentStep);
  const retryableJob = latestJob && (latestJob.status === "failed" || latestJob.status === "cancelled") ? latestJob : null;

  return (
    <AppShell>
      <PageHeader
        eyebrow="材料生成 / 配置"
        title="生成申报材料"
        description={application?.software_full_name || "选择源码和生成选项，准备完整申报文件。"}
      >
        <Link className="app-back-link" href="/app/generate"><ArrowLeft size={14} />返回材料生成</Link>
        {application && <StatusBadge status={result || latestJob?.status === "completed" ? "complete" : progress?.percent === 100 ? "ready" : "editing"} />}
      </PageHeader>

      {error && <div className="app-feedback app-feedback--error">{error}</div>}

      {loading ? (
        <Panel><p className="app-panel__empty-line">正在加载申请…</p></Panel>
      ) : !application ? (
        <Panel><p className="app-panel__empty-line">未找到这条申请。</p></Panel>
      ) : (
        <div className="generation-layout">
          <Panel>
            <div className="app-panel__header">
              <div>
                <h2 className="app-panel__title">生成配置</h2>
                <p className="app-panel__description">这里只读取最新已保存的申请信息；源码压缩包在申请页上传和核对，生成过程不会改写表单。</p>
              </div>
              <Link className="app-inline-link" href={`/app/applications/${application.id}`}>编辑申请 <ArrowLeft size={13} className="app-arrow-forward" /></Link>
            </div>
            <div className="generation-config">
              <div className="generation-config__row">
                <div className="generation-field">
                  <span className="form-label">使用模型</span>
                  <div className="generation-value"><span className="generation-value__icon"><LockKeyhole size={14} /></span>{byok?.id ? `${byok.provider} / ${byok.model} · ****${byok.keyLast4}` : "尚未保存 AI 配置"}</div>
                </div>
                <div className="generation-field">
                  <span className="form-label">申请完成度</span>
                  <div className="generation-value"><span className="generation-value__icon"><Check size={14} /></span>{progress?.completed ?? 0} / {progress?.total ?? 0} 项已填写</div>
                </div>
              </div>

              <div className="generation-field generation-field--spaced">
                <span className="form-label">源码来源</span>
                <div className={`generation-source-status ${savedSourceArchive && !sourceReviewIsCurrent(savedSourceArchive, application.updated_at) ? "generation-source-status--warning" : ""}`}>
                  <FileArchive size={18} />
                  <span><strong>{savedSourceArchive?.fileName || "未上传源码压缩包"}</strong><small>{savedSourceArchive ? `${Math.ceil(savedSourceArchive.size / 1024 / 1024)} MB · ${sourceReviewLabel(savedSourceArchive, application.updated_at)}` : sourceReviewLabel(null)}</small></span>
                  <Link className="app-inline-link" href={`/app/applications/${application.id}`}>去申请页管理源码</Link>
                </div>
              </div>

              {!byok?.id && (
                <div className="generation-notice">
                  <LockKeyhole size={15} />
                  <span>生成材料需要已保存的 AI 模型配置。完整 API Key 只在服务端解密使用。</span>
                  <Link href="/settings/llm-keys">去设置</Link>
                </div>
              )}

              <div className="generation-actions">
                <Button type="button" onClick={() => void generate()} disabled={generating || (savedSourceArchive !== null && !sourceReviewIsCurrent(savedSourceArchive, application.updated_at)) || !byok?.id || latestStatus === "queued" || latestStatus === "running"}>
                  {generating ? <LoaderCircle className="app-spin" size={16} /> : <Play size={16} />}
                  {generating ? "生成中…" : "开始生成"}
                </Button>
                {generating && <Button type="button" variant="outline" onClick={() => abortRef.current?.abort()}><X size={15} />取消生成</Button>}
              </div>

              {(generating || currentStep || message) && (
                <div className="generation-live" aria-live="polite">
                    <div className="generation-live__heading"><span>实时进度</span><small>{message}{latestJob && (latestJob.status === "queued" || latestJob.status === "running") ? ` · ${latestJob.progress}%` : ""}</small></div>
                  <div className="generation-progress">
                    {generationSteps.map((step, index) => {
                      const done = activeIndex >= 0 && index < activeIndex;
                      const active = step.key === currentStep;
                      return (
                        <div className={`generation-progress__item ${active ? "generation-progress__item--active" : ""} ${done ? "generation-progress__item--done" : ""}`} key={step.key}>
                          <span className="generation-progress__icon">{done ? <Check size={13} /> : active && generating ? <LoaderCircle className="app-spin" size={13} /> : <span>{index + 1}</span>}</span>
                          <span><strong>{step.label}</strong><small>{step.description}</small></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {retryableJob && !generating && (
                <div className="generation-notice">
                  <X size={15} />
                  <span>{retryableJob.error_message || "上一次生成任务失败，可以重新尝试。"}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void generate()}>重新生成</Button>
                </div>
              )}

              {result && (
                <div className="generation-output">
                  <div className="generation-output__heading">
                    <div><h3><CheckCircle2 size={17} />材料已生成</h3><p>{result.fileName || application.software_full_name} 的文件已经保存，可以分别下载。</p></div>
                    <Link className="app-inline-link" href="/app/history">查看历史 <ArrowLeft size={13} className="app-arrow-forward" /></Link>
                  </div>
                  <div className="generation-result-list">
                    {resultItems().map(({ key, label, description, icon: Icon }) => {
                      const href = result[key];
                      if (!href) return null;
                      return <a className="generation-result" href={href} target="_blank" rel="noreferrer" key={key}><span className="generation-result__name"><Icon size={16} /><span><strong>{label}</strong><small>{description}</small></span></span><span className="generation-result__download"><Download size={14} />下载</span></a>;
                    })}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="generation-side-panel">
            <div className="generation-side-panel__application">
              <small>当前申请</small>
              <h2>{application.software_full_name || "未填写软件全称"}</h2>
              <p>{application.software_short_name || "未填写简称"} · {application.version || "V1.0"}</p>
            </div>
            <div className="generation-side-panel__meta">
              <div><span>软件类别</span><strong>{application.software_category || "未填写"}</strong></div>
              <div><span>开发语言</span><strong>{application.programming_language || "未填写"}</strong></div>
              <div><span>源码行数</span><strong>{application.source_code_lines ? `${application.source_code_lines.toLocaleString()} 行` : "未填写"}</strong></div>
              <div><span>生成方式</span><strong>AI 辅助生成</strong></div>
            </div>
            <div className="generation-side-panel__tip"><FileOutput size={15} /><span>生成结果会自动写入生成记录，签名下载链接只在短时间内有效。</span></div>
          </Panel>
        </div>
      )}
      {application && !loading && (
        <Panel className="generation-material-panel">
          <MaterialChecklist
            applicationId={application.id}
            developmentMethod={application.development_method}
            refreshToken={materialRefresh}
          />
        </Panel>
      )}
      {application && !loading && (
        <Panel className="generation-material-panel">
          <FilingPanel
            applicationId={application.id}
            holderCount={application.copyright_holders.length}
            developmentMethod={application.development_method}
            softwareName={application.software_full_name}
          />
        </Panel>
      )}
    </AppShell>
  );
}
