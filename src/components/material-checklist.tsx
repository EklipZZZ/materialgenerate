"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Download, FileCheck2, FileSignature, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteApplicationMaterial,
  listApplicationMaterials,
  uploadApplicationMaterial,
} from "@/lib/materials-api";
import {
  materialLabels,
  visibleMaterialKinds,
  type ApplicationMaterial,
  type MaterialKind,
  type MaterialsSummary,
} from "@/lib/materials";

interface Props {
  applicationId: string;
  developmentMethod: string;
  refreshToken?: number;
}

function statusLabel(material?: ApplicationMaterial): string {
  if (!material) return "尚未生成";
  if (material.status === "generated") return "已生成";
  if (material.status === "uploaded") return "已上传";
  if (material.status === "awaiting_official") return "等待官方系统生成";
  if (material.status === "awaiting_user") return "等待上传";
  if (material.status === "invalid") return "需重新上传";
  return "待补齐";
}

function statusIcon(material?: ApplicationMaterial) {
  if (material?.status === "generated" || material?.status === "uploaded") return <CheckCircle2 size={14} />;
  if (material?.status === "awaiting_official") return <Clock3 size={14} />;
  if (material?.status === "invalid") return <AlertTriangle size={14} />;
  return <FileText size={14} />;
}

export function MaterialChecklist({ applicationId, developmentMethod, refreshToken }: Props) {
  const [materials, setMaterials] = useState<ApplicationMaterial[]>([]);
  const [summary, setSummary] = useState<MaterialsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKind, setBusyKind] = useState<MaterialKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listApplicationMaterials(applicationId);
      setMaterials(result.materials);
      setSummary(result.summary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取材料清单失败");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, refreshToken]);

  const byKind = useMemo(() => new Map(materials.map((material) => [material.kind, material])), [materials]);
  const visibleKinds = visibleMaterialKinds.filter((kind) => kind !== "cooperation_agreement" || developmentMethod === "cooperative");
  const materialGroups = [
    {
      key: "generated",
      title: "生成材料",
      description: "由本系统生成，可下载后留档或按需提交。",
      kinds: visibleKinds.filter((kind) => ["source_code_docx", "user_manual_docx"].includes(kind)),
    },
    {
      key: "filing",
      title: "自动填报前置材料",
      description: "开始官网自动填报前，源代码 PDF、用户手册 PDF 和条件协议必须就绪。",
      kinds: visibleKinds.filter((kind) => ["source_code_pdf", "user_manual_pdf", "cooperation_agreement", "commission_agreement", "task_order"].includes(kind)),
    },
    {
      key: "official",
      title: "官方后续材料",
      description: "由版权中心生成，完成打印、签字/盖章后再上传。",
      kinds: visibleKinds.filter((kind) => kind === "signature_page"),
    },
  ].filter((group) => group.kinds.length > 0);

  async function upload(kind: MaterialKind, file: File) {
    setBusyKind(kind);
    setError(null);
    setMessage(null);
    try {
      await uploadApplicationMaterial(applicationId, kind, file);
      await load();
      setMessage(`${materialLabels[kind]}已上传`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "材料上传失败");
    } finally {
      setBusyKind(null);
    }
  }

  async function remove(material: ApplicationMaterial) {
    if (!window.confirm(`确认删除“${material.file_name || materialLabels[material.kind]}”？`)) return;
    setBusyKind(material.kind);
    setError(null);
    try {
      await deleteApplicationMaterial(applicationId, material.id);
      await load();
      setMessage("材料已删除");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "材料删除失败");
    } finally {
      setBusyKind(null);
    }
  }

  function renderMaterial(kind: MaterialKind) {
    const material = byKind.get(kind);
    const uploadable = kind === "cooperation_agreement" || kind === "signature_page";
    const busy = busyKind === kind;
    return (
      <div className={`material-item material-item--${material?.status || "missing"}`} key={kind}>
        <span className="material-item__icon">{statusIcon(material)}</span>
        <div className="material-item__copy">
          <strong>{materialLabels[kind]}</strong>
          <small>{material?.file_name || statusLabel(material)}</small>
        </div>
        <span className="material-item__status">{statusLabel(material)}</span>
        {material?.download_url && <a className="material-item__action" href={material.download_url} target="_blank" rel="noreferrer"><Download size={13} />下载</a>}
        {uploadable && (
          <label className="material-item__action material-item__upload">
            {busy ? <LoaderCircle className="app-spin" size={13} /> : <Upload size={13} />}
            {material?.status === "uploaded" ? "替换" : "上传"}
            <input
              className="sr-only"
              type="file"
              accept={kind === "signature_page" ? ".pdf,application/pdf" : ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
              disabled={busyKind !== null}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) void upload(kind, file);
              }}
            />
          </label>
        )}
        {material && uploadable && material.status === "uploaded" && <Button type="button" size="icon-sm" variant="ghost" aria-label={`删除${materialLabels[kind]}`} onClick={() => void remove(material)} disabled={busy}><Trash2 size={13} /></Button>}
      </div>
    );
  }

  return (
    <div className="material-checklist">
      <div className="material-checklist__header">
        <div><h2 className="app-panel__title">材料清单</h2><p className="app-panel__description">生成材料与官方系统材料分开记录，签章页需要在线打印、签章后再上传 PDF。</p></div>
        {summary && <span className={`material-checklist__summary ${summary.filingReady ? "material-checklist__summary--complete" : ""}`}><FileCheck2 size={14} />填报前置 {summary.filingReadyCount} / {summary.filingRequiredCount} · 全部材料 {summary.readyCount} / {summary.requiredCount}</span>}
      </div>
      {error && <div className="app-feedback app-feedback--error">{error}</div>}
      {message && <div className="app-feedback app-feedback--success">{message}</div>}
      {loading ? <p className="app-panel__empty-line">正在读取材料状态…</p> : (
        <div className="material-list">
          {materialGroups.map((group) => (
            <section className="material-checklist__group" key={group.key}>
              <div className="material-checklist__group-heading">
                <div>
                  <h3 className="material-checklist__group-title">{group.title}</h3>
                  <p className="material-checklist__group-description">{group.description}</p>
                </div>
              </div>
              <div className="material-checklist__group-list">
                {group.kinds.map(renderMaterial)}
              </div>
            </section>
          ))}
        </div>
      )}
      <div className="material-checklist__footnote"><FileSignature size={14} /><span>“自动填报前置材料”只要求源代码 PDF、用户手册 PDF及条件协议；申请确认签章页属于官方后续材料，请在官方系统生成、打印并完成签章后上传原比例 PDF。</span></div>
    </div>
  );
}
