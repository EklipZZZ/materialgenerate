export type MaterialKind =
  | "source_code_docx"
  | "source_code_pdf"
  | "user_manual_docx"
  | "user_manual_pdf"
  | "application_summary_pdf"
  | "cooperation_agreement"
  | "signature_page"
  | "holder_identity_proof"
  | "commission_agreement"
  | "task_order";

export type MaterialStatus =
  | "missing"
  | "generated"
  | "uploaded"
  | "awaiting_official"
  | "awaiting_user"
  | "invalid";

export interface ApplicationMaterial {
  id: string;
  application_id: string;
  generation_record_id?: string | null;
  holder_id?: string | null;
  kind: MaterialKind;
  status: MaterialStatus;
  required: boolean;
  source: "generated" | "uploaded" | "official";
  file_name?: string | null;
  object_key?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  checksum?: string | null;
  download_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialsSummary {
  complete: boolean;
  requiredCount: number;
  readyCount: number;
}

export const materialLabels: Record<MaterialKind, string> = {
  source_code_docx: "源代码 DOCX",
  source_code_pdf: "源代码 PDF",
  user_manual_docx: "用户手册 DOCX",
  user_manual_pdf: "用户手册 PDF",
  application_summary_pdf: "申请信息摘要 PDF",
  cooperation_agreement: "合作开发协议",
  signature_page: "申请确认签章页",
  holder_identity_proof: "著作权人身份证明",
  commission_agreement: "委托开发协议",
  task_order: "下达任务开发证明",
};

export const generatedMaterialKinds: MaterialKind[] = [
  "source_code_docx",
  "source_code_pdf",
  "user_manual_docx",
  "user_manual_pdf",
  "application_summary_pdf",
];

export const visibleMaterialKinds: MaterialKind[] = [
  ...generatedMaterialKinds,
  "cooperation_agreement",
  "signature_page",
];

export const uploadableMaterialKinds: MaterialKind[] = [
  "cooperation_agreement",
  "signature_page",
  "holder_identity_proof",
];
