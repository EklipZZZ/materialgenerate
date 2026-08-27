"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileCheck2, LockKeyhole, WandSparkles } from "lucide-react";
import { AppShell, PageHeader, Panel } from "@/components/app-shell";
import { ApplicationForm } from "@/components/application-form";
import type { ApplicationRecord } from "@/lib/softreg-api";

export default function NewApplicationPage() {
  const router = useRouter();

  function handleCreated(application: ApplicationRecord) {
    if (application.id) router.replace(`/app/applications/${application.id}`);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="我的申请 / 新建"
        title="新建申请"
        description="先录入软件登记基础信息，保存后可以继续编辑或使用 AI 补全。"
      >
        <Link className="app-back-link" href="/app/applications"><ArrowLeft size={14} />返回申请列表</Link>
      </PageHeader>

      <div className="form-layout">
        <Panel>
          <div className="app-panel__header">
            <div>
              <h2 className="app-panel__title">申请信息</h2>
              <p className="app-panel__description">带有基础信息的申请更容易获得稳定的材料结果。</p>
            </div>
          </div>
          <div className="app-panel__body">
            <ApplicationForm onCreated={handleCreated} />
          </div>
        </Panel>

        <Panel className="form-side-card">
          <div className="app-panel__header app-panel__header--plain">
            <div>
              <h2 className="app-panel__title">填写建议</h2>
              <p className="app-panel__description">信息越完整，后续生成越顺畅。</p>
            </div>
          </div>
          <div className="app-panel__body">
            <div className="form-side-card__item">
              <FileCheck2 size={16} />
              <div><strong>先填软件名称</strong><p>软件全称、简称和版本号会出现在所有材料中。</p></div>
            </div>
            <div className="form-side-card__item">
              <WandSparkles size={16} />
              <div><strong>AI 可以辅助补全</strong><p>保存后进入编辑页，使用临时 API Key 生成建议。</p></div>
            </div>
            <div className="form-side-card__item">
              <LockKeyhole size={16} />
              <div><strong>数据按账户隔离</strong><p>申请只会展示给当前登录账户，Key 仅保存在当前 Tab。</p></div>
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
