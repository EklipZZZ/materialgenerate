"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleHelp, ExternalLink, Link2, LoaderCircle, LockKeyhole, PauseCircle, Play, RotateCcw, Square, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listApplicationMaterials } from "@/lib/materials-api";
import { type ApplicationMaterial } from "@/lib/materials";
import { getFilingProfile } from "@/lib/filing-profile-api";
import { isFilingProfileComplete, type FilingProfile } from "@/lib/filing-profile";
import { FILING_EXTENSION_SOURCE, FILING_PROTOCOL, FILING_SOURCE, R11_URL, isExtensionToAppMessage, type ExtensionToAppMessage } from "@/lib/filing-protocol";
import {
  cancelFilingJob,
  createFilingJob,
  getFilingJob,
  getLatestFilingJob,
  isActiveFilingJob,
  recordFilingEvent,
  resumeFilingJob,
  type FilingEvent,
  type FilingJob,
} from "@/lib/filing-api";

interface Props {
  applicationId: string;
  holderCount: number;
  developmentMethod: string;
  softwareName?: string;
}

const statusLabels: Record<FilingJob["status"], string> = {
  created: "正在准备",
  waiting_extension: "等待扩展",
  opening_portal: "正在打开官方页面",
  waiting_login: "等待手动登录",
  filling: "正在填写申请",
  waiting_review: "等待人工复核",
  uploading: "正在上传材料",
  waiting_user: "等待人工操作",
  completed: "填写和上传已完成",
  failed: "需要重试",
  cancelled: "已取消",
};

const eventLabels: Record<string, string> = {
  extension_ready: "扩展已连接",
  portal_opened: "官方页面已打开",
  login_required: "请在官方页面手动登录、验证",
  login_detected: "已检测到登录状态",
  form_started: "开始填写申请表",
  form_filled: "申请表已填写，等待复核",
  review_required: "请复核官方页面中的字段",
  materials_ready: "材料已就绪",
  upload_started: "开始上传材料",
  upload_completed: "材料上传完成",
  signature_page_required: "请处理申请确认签章页",
  manual_upload_required: "请在官方页面人工上传材料",
  unsupported_development_method: "当前扩展暂不支持该开发方式",
  field_not_found: "官方页面缺少目标字段",
  field_ambiguous: "目标字段无法唯一确认",
  field_verification_failed: "字段写入校验失败",
  portal_structure_changed: "官方页面结构可能已变化",
  extension_disconnected: "扩展连接已中断",
  cancelled_by_user: "已由用户取消",
  completed: "自动填写和上传已完成",
  unknown_error: "自动填报遇到未分类错误",
};

function materialReady(material?: ApplicationMaterial): boolean {
  return Boolean(material && (material.status === "generated" || material.status === "uploaded"));
}

function statusInstruction(job: FilingJob | null): string {
  if (!job) return "先生成源代码和用户手册 PDF，再从这里开始。";
  if (job.status === "waiting_extension" || job.status === "created") return "请保持本申请页面打开，并确认 Chrome 扩展已连接。";
  if (job.status === "waiting_login") return "请在新打开的版权中心页面手动选择个人用户/机构并完成登录、验证码、短信或实名验证。";
  if (job.status === "waiting_review") return "请在官方页面核对申请信息。确认无误后，在这里点击“继续填报”，扩展才会进入材料上传。";
  if (job.status === "waiting_user") {
    if (job.error_code === "signature_page_required") return "请在官方页面生成申请确认签章页，下载、打印、签字/盖章后，将 PDF 上传回本申请，再点击“继续填报”。";
    if (job.error_code === "manual_upload_required") return "官方文件控件无法被安全确认。请按官方页面提示人工上传，完成后可以点击“继续填报”重新配对。";
    return "请完成页面提示的人工步骤，然后点击“继续填报”。";
  }
  if (job.status === "completed") return "材料已填写并上传。扩展不会点击签字盖章或最终提交，请在官方页面人工复核并完成后续操作。";
  if (job.status === "failed") return job.error_message || "自动填报未完成，请检查官方页面后重试。";
  if (job.status === "cancelled") return "任务已取消，可以重新开始。";
  return "扩展正在处理，请保持官方页面打开。";
}

export function FilingPanel({ applicationId, holderCount, developmentMethod, softwareName }: Props) {
  const [extensionReady, setExtensionReady] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [job, setJob] = useState<FilingJob | null>(null);
  const [events, setEvents] = useState<FilingEvent[]>([]);
  const [materials, setMaterials] = useState<ApplicationMaterial[]>([]);
  const [filingProfile, setFilingProfile] = useState<FilingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const jobRef = useRef<FilingJob | null>(null);
  const extensionLastSeenRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [latest, materialResult, profile] = await Promise.all([
        getLatestFilingJob(applicationId),
        listApplicationMaterials(applicationId),
        getFilingProfile(),
      ]);
      setJob(latest);
      jobRef.current = latest;
      setMaterials(materialResult.materials);
      setFilingProfile(profile);
      if (latest) {
        const details = await getFilingJob(latest.id);
        setEvents(details.events);
        setJob(details.job);
        jobRef.current = details.job;
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取填报状态失败");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    let active = true;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!active || event.source !== window || event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== "object") return;
      const candidate = event.data as Record<string, unknown>;
      if (candidate.protocol === FILING_PROTOCOL && candidate.source === FILING_EXTENSION_SOURCE && candidate.type === "EXTENSION_READY" && typeof candidate.version === "string") {
        extensionLastSeenRef.current = Date.now();
        setExtensionReady(true);
        setExtensionVersion(candidate.version);
        return;
      }
      if (!isExtensionToAppMessage(event.data)) return;
      const incoming = event.data as ExtensionToAppMessage;
      if (incoming.type === "EXTENSION_READY") return;
      if (jobRef.current && incoming.jobId !== jobRef.current.id) return;
      const apiEvent = incoming.type === "FILING_COMPLETED"
        ? { type: incoming.type, step: "completed" as const, code: "completed" as const, progress: 100 }
        : { type: incoming.type, step: incoming.step, code: incoming.code, ...(incoming.type === "FILING_PROGRESS" ? { progress: incoming.progress } : {}), ...(incoming.type === "FILING_FAILED" ? { retryable: incoming.retryable } : {}) };
      void recordFilingEvent(incoming.jobId, apiEvent).then((next) => {
        if (!active) return;
        setJob(next);
        jobRef.current = next;
        setMessage(eventLabels[apiEvent.code] || "填报状态已更新");
        if (next.status === "completed" || next.status === "failed") void load();
      }).catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "同步填报事件失败");
      });
    };
    window.addEventListener("message", onMessage);
    const loadTimer = window.setTimeout(() => void load(), 0);
    const extensionTimer = window.setInterval(() => {
      if (extensionLastSeenRef.current > 0 && Date.now() - extensionLastSeenRef.current > 12_000) {
        setExtensionReady(false);
        setExtensionVersion(null);
      }
    }, 3_000);
    return () => {
      active = false;
      window.clearTimeout(loadTimer);
      window.clearInterval(extensionTimer);
      window.removeEventListener("message", onMessage);
    };
  }, [load]);

  useEffect(() => {
    if (!job || !isActiveFilingJob(job)) return;
    let active = true;
    const timer = window.setInterval(() => {
      void getFilingJob(job.id).then((details) => {
        if (!active) return;
        setJob(details.job);
        jobRef.current = details.job;
        setEvents(details.events);
      }).catch(() => undefined);
    }, 2_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [job]);

  const byKind = useMemo(() => new Map(materials.map((material) => [material.kind, material])), [materials]);
  const coreMaterialsReady = materialReady(byKind.get("source_code_pdf")) && materialReady(byKind.get("user_manual_pdf"));
  const proofKind = developmentMethod === "cooperative"
    ? "cooperation_agreement"
    : developmentMethod === "commissioned"
      ? "commission_agreement"
      : developmentMethod === "assigned_task" ? "task_order" : null;
  const filingMaterialsReady = coreMaterialsReady && (!proofKind || materialReady(byKind.get(proofKind)));
  const profileReady = isFilingProfileComplete(filingProfile);
  const active = isActiveFilingJob(job);
  const canResume = Boolean(job && ["waiting_user", "waiting_review", "failed", "waiting_login", "filling", "opening_portal"].includes(job.status));
  const recentEvents = events.slice(-3).reverse();

  function post(message: Record<string, unknown>): void {
    window.postMessage({ protocol: FILING_PROTOCOL, source: FILING_SOURCE, ...message }, window.location.origin);
  }

  async function start(): Promise<void> {
    if (!extensionReady) {
      setError("未检测到 Chrome 扩展，请先按安装说明加载扩展并刷新本页面。");
      return;
    }
    if (!coreMaterialsReady) {
      setError("请先生成源代码 PDF 和用户手册 PDF。");
      return;
    }
    if (!filingMaterialsReady) {
      setError("请先准备当前开发方式要求的条件协议或证明材料。");
      return;
    }
    if (!profileReady) {
      setError("请先在设置中完善官网填报资料（地址、邮编、联系人和电话）。");
      return;
    }
    const holderText = holderCount > 0 ? `${holderCount} 名已明确录入的著作权人` : "著作权人信息";
    if (!window.confirm(`即将把“${softwareName || "当前申请"}”的申请字段（包含${holderText}）和已生成材料的短期下载地址发送给本机 Chrome 扩展，并打开中国版权保护中心 R11 页面。扩展不会获取密码、验证码或 Supabase Token。是否继续？`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await createFilingJob(applicationId, extensionVersion || undefined);
      setJob(created.job);
      jobRef.current = created.job;
      setEvents([]);
      post({ type: "START_FILING", manifest: created.manifest });
      setMessage("填报任务已启动，正在打开官方页面。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建填报任务失败");
    } finally {
      setBusy(false);
    }
  }

  async function resume(): Promise<void> {
    if (!job || !canResume) return;
    if (!extensionReady) {
      setError("未检测到 Chrome 扩展，请先安装或重新连接扩展。");
      return;
    }
    if (!window.confirm("将重新读取当前申请和材料，并把最新字段与短期材料下载地址发送给本机扩展。请确认官方页面已停在可继续的位置。")) return;
    setBusy(true);
    setError(null);
    try {
      const resumed = await resumeFilingJob(job.id, extensionVersion || undefined);
      setJob(resumed.job);
      jobRef.current = resumed.job;
      post({ type: "RESUME_FILING", manifest: resumed.manifest });
      setMessage("已发送继续填报指令，请保持官方页面打开。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "恢复填报失败");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(): Promise<void> {
    if (!job || !active || !window.confirm("确认取消当前自动填报任务？官方页面不会替你提交申请。")) return;
    setBusy(true);
    setError(null);
    try {
      const cancelled = await cancelFilingJob(job.id);
      setJob(cancelled);
      jobRef.current = cancelled;
      post({ type: "CANCEL_FILING", jobId: job.id });
      setMessage("填报任务已取消。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "取消填报失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="filing-panel">
      <div className="filing-panel__header">
        <div>
          <h2 className="app-panel__title">官方网页自动填报</h2>
          <p className="app-panel__description">Chrome 扩展负责填写 R11 表单和上传材料；登录、验证码、签章和最终提交保留人工操作。</p>
        </div>
        <span className={`filing-connection ${extensionReady ? "filing-connection--ready" : ""}`}>
          {extensionReady ? <Link2 size={14} /> : <Unplug size={14} />}
          {extensionReady ? `扩展已连接${extensionVersion ? ` · v${extensionVersion}` : ""}` : "扩展未连接"}
        </span>
      </div>
      {error && <div className="app-feedback app-feedback--error">{error}</div>}
      {message && <div className="app-feedback app-feedback--success">{message}</div>}
      {loading ? <p className="app-panel__empty-line">正在读取填报状态…</p> : (
        <>
          <div className="filing-panel__notice">
            <LockKeyhole size={15} />
            <span>数据只在当前任务中传给本机扩展；扩展不读取 Cookie、密码或验证码，也不会点击“最终提交”。</span>
          </div>
          <div className="filing-panel__meta">
            <span><strong>目标</strong> 中国版权保护中心 R11</span>
            <a href={R11_URL} target="_blank" rel="noreferrer">查看官方入口 <ExternalLink size={13} /></a>
            <span><strong>前置材料</strong> {filingMaterialsReady ? "源代码 PDF、用户手册 PDF及条件材料已就绪" : "请先准备 PDF 和条件材料"}</span>
            <span><strong>官网资料</strong> {profileReady ? "已配置" : <><Link className="app-inline-link" href="/settings/filing-profile">未配置，前往设置</Link></>}</span>
          </div>
          {job && (
            <div className="filing-progress">
              <div className="filing-progress__top"><strong>{statusLabels[job.status]}</strong><span>{job.progress}%</span></div>
              <div className="app-progress-track" aria-label={`自动填报进度 ${job.progress}%`}><span style={{ width: `${job.progress}%` }} /></div>
              <p>{statusInstruction(job)}</p>
            </div>
          )}
          <div className="filing-panel__actions">
            {!active && <Button type="button" onClick={() => void start()} disabled={busy || loading || !filingMaterialsReady || !profileReady}>
              {busy ? <LoaderCircle className="app-spin" size={15} /> : job?.status === "failed" || job?.status === "cancelled" ? <RotateCcw size={15} /> : <Play size={15} />}
              {job?.status === "failed" || job?.status === "cancelled" ? "重新开始填报" : "开始自动填报"}
            </Button>}
            {canResume && <Button type="button" variant="secondary" onClick={() => void resume()} disabled={busy}>
              {busy ? <LoaderCircle className="app-spin" size={15} /> : <RotateCcw size={15} />}继续填报
            </Button>}
            {active && <Button type="button" variant="outline" onClick={() => void cancel()} disabled={busy}><Square size={14} />取消任务</Button>}
          </div>
          {recentEvents.length > 0 && <div className="filing-events" aria-label="最近填报事件">
            {recentEvents.map((event) => <div className="filing-event" key={event.id}><CheckCircle2 size={13} /><span>{eventLabels[event.code] || "填报状态已更新"}</span><time>{new Date(event.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></div>)}
          </div>}
          {!job && <div className="filing-panel__help"><CircleHelp size={15} /><span>第一次使用请先确认前置材料和官网填报资料都已就绪；签章页不阻塞第一次填写申请表。</span></div>}
          {job?.status === "completed" && <div className="filing-panel__help"><PauseCircle size={15} /><span>自动化终点是“填写并上传后暂停”。请在官方页面自行复核、生成/处理签章页并完成最终提交。</span></div>}
        </>
      )}
    </div>
  );
}
