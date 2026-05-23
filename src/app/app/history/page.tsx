"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Record {
  id: string;
  file_name: string;
  source_code_summary: string | null;
  source_code_docx_url: string | null;
  user_manual_docx_url: string | null;
  collection_form_url: string | null;
  status: string;
  created_at: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从 localStorage 检查登录状态
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      // 获取记录 - 传递 userId
      fetch(`/api/records?userId=${userData.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.records) {
            setRecords(data.records);
          }
        })
        .catch((err) => console.error("获取历史记录失败:", err))
        .finally(() => setLoading(false));
    } else {
      router.push("/login");
    }
  }, [router]);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      alert("下载失败");
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* 顶部导航 */}
      <nav className="border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <span className="text-xl font-bold">智笔乾坤</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-white/60 text-sm">欢迎，{user?.username}</span>
            <Button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/");
                router.refresh();
              }}
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              退出
            </Button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">历史记录</h1>
            <p className="text-white/50">查看和管理您之前的生成记录</p>
          </div>
          <Link href="/app">
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0">
              新建生成
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">暂无历史记录</h2>
            <p className="text-white/40 mb-6">开始您的第一次软著材料生成吧</p>
            <Link href="/app">
              <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0">
                立即开始
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <div
                key={record.id}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{record.file_name}</h3>
                    <p className="text-sm text-white/40">{formatDate(record.created_at)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    record.status === "completed"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}>
                    {record.status === "completed" ? "已完成" : "处理中"}
                  </span>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {record.source_code_docx_url && (
                    <button
                      onClick={() => handleDownload(record.source_code_docx_url!, "源代码文档.docx")}
                      className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="16 18 22 12 16 6" />
                            <polyline points="8 6 2 12 8 18" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium">源代码文档</p>
                          <p className="text-xs text-white/40">DOCX</p>
                        </div>
                      </div>
                    </button>
                  )}

                  {record.user_manual_docx_url && (
                    <button
                      onClick={() => handleDownload(record.user_manual_docx_url!, "用户手册.docx")}
                      className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium">用户手册</p>
                          <p className="text-xs text-white/40">DOCX</p>
                        </div>
                      </div>
                    </button>
                  )}

                  {record.collection_form_url && (
                    <button
                      onClick={() => handleDownload(record.collection_form_url!, "采集表.md")}
                      className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium">完整采集表</p>
                          <p className="text-xs text-white/40">Markdown</p>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
