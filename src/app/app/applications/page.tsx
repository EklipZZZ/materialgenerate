"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileOutput, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  AppShell,
  EmptyState,
  PageHeader,
  Panel,
  StatusBadge,
  formatDateTime,
} from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getApplicationProgress, getApplicationStatus } from "@/lib/application-progress";
import {
  deleteApplication,
  listApplications,
  type ApplicationRecord,
} from "@/lib/softreg-api";

type ApplicationFilter = "all" | "editing" | "ready";

function displayStatus(application: ApplicationRecord): string {
  return application.status === "completed"
    ? "complete"
    : getApplicationStatus(application);
}

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ApplicationFilter>("all");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    listApplications()
      .then((items) => {
        if (active) {
          setApplications(items);
          setError(null);
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "加载申请失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter((application) => {
      const matchesSearch = !query || [
        application.software_full_name,
        application.software_short_name,
        application.software_category,
      ].some((value) => value.toLowerCase().includes(query));
      const status = getApplicationStatus(application);
      return matchesSearch && (filter === "all" || status === filter);
    });
  }, [applications, filter, search]);

  async function remove(id: string) {
    if (!window.confirm("确认删除这条申请？生成记录和关联文件也会一并移除。")) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteApplication(id);
      setApplications((current) => current.filter((item) => item.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除申请失败");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="申报空间 / 我的申请"
        title="我的申请"
        description="集中管理软件登记信息，完成资料后再进入材料生成。"
      >
        <Button asChild>
          <Link href="/app/applications/new"><Plus size={16} />新建申请</Link>
        </Button>
      </PageHeader>

      <div className="app-toolbar">
        <div className="app-toolbar__filters">
          <div className="app-search-wrap">
            <Search size={15} aria-hidden="true" />
            <Input
              className="app-search-input"
              aria-label="搜索申请"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索软件名称"
            />
          </div>
          <div className="app-segmented" role="group" aria-label="申请状态筛选">
            {(["all", "editing", "ready"] as const).map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item === "all" ? "全部" : item === "editing" ? "编辑中" : "可生成"}
              </button>
            ))}
          </div>
        </div>
        <span className="app-toolbar__summary">共 {filtered.length} 条申请</span>
      </div>

      {error && <div className="app-feedback app-feedback--error">{error}</div>}

      <Panel className="app-table-panel">
        {loading ? (
          <p className="app-panel__empty-line">正在加载申请…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileOutput size={22} />}
            title={applications.length === 0 ? "还没有申请" : "没有匹配的申请"}
            description={applications.length === 0 ? "新建一条申请，开始整理软件登记材料。" : "试试调整关键词或状态筛选。"}
            action={applications.length === 0 ? <Button asChild><Link href="/app/applications/new"><Plus size={16} />新建申请</Link></Button> : undefined}
          />
        ) : (
          <div className="app-table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  <th>软件名称</th>
                  <th>完成度</th>
                  <th>状态</th>
                  <th>最近更新</th>
                  <th><span className="sr-only">操作</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((application) => {
                  const progress = getApplicationProgress(application);
                  const deleting = deletingId === application.id;
                  return (
                    <tr key={application.id}>
                      <td>
                        <Link className="app-table__name app-table__name-link" href={`/app/applications/${application.id}`}>
                          {application.software_full_name || "未填写软件全称"}
                        </Link>
                        <span className="app-table__subtext">{application.software_short_name || "未填写简称"}</span>
                      </td>
                      <td>
                        <div className="app-table-progress">
                          <span className="app-progress-track"><span style={{ width: `${progress.percent}%` }} /></span>
                          <small>{progress.percent}%</small>
                        </div>
                      </td>
                      <td><StatusBadge status={displayStatus(application)} /></td>
                      <td>{formatDateTime(application.updated_at || application.created_at)}</td>
                      <td>
                        <div className="app-table__actions">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon-sm" variant="ghost" aria-label={`打开 ${application.software_full_name || "申请"} 的操作菜单`}>
                                <MoreHorizontal size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/app/applications/${application.id}`}><Pencil size={14} />编辑申请</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/app/generate/${application.id}`}><FileOutput size={14} />生成材料</Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={deleting}
                                onSelect={() => void remove(application.id)}
                              >
                                <Trash2 size={14} />{deleting ? "删除中…" : "删除申请"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
