"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Code,
  BookOpen,
  FileCheck,
  CloudUpload,
  FileCode,
  FileArchive,
  Layers,
  FileBox,
  RefreshCw,
  Clock,
  History,
  Search,
} from "lucide-react";
import {
  CopyrightQueryPanel,
  type QueryPanelGeneratePayload,
} from "@/components/copyright-query-panel";

interface GenerateResult {
  sourceCodeDocx: string;
  userManualDocx: string;
  collectionFormMarkdown: string;
  fileName?: string;
}

interface SSEData {
  step: string;
  message: string;
  data?: {
    chunk?: string;
    sourceCodeDocx?: string;
    userManualDocx?: string;
    collectionFormMarkdown?: string;
    fileName?: string;
  };
}

type StepStatus = 'pending' | 'active' | 'completed' | 'error';

interface StepInfo {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: StepStatus;
}

const initialSteps: StepInfo[] = [
  { id: 'init', label: '加载配置', icon: <RefreshCw className="h-4 w-4" />, status: 'pending' },
  { id: 'analyze', label: '分析采集表', icon: <FileCheck className="h-4 w-4" />, status: 'pending' },
  { id: 'source_code', label: '生成源代码', icon: <Code className="h-4 w-4" />, status: 'pending' },
  { id: 'manual', label: '生成用户手册', icon: <BookOpen className="h-4 w-4" />, status: 'pending' },
  { id: 'convert', label: '转换文档', icon: <FileText className="h-4 w-4" />, status: 'pending' },
  { id: 'upload', label: '上传文件', icon: <CloudUpload className="h-4 w-4" />, status: 'pending' },
];

export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceCodeFile, setSourceCodeFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState<StepInfo[]>(initialSteps);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [inputMode, setInputMode] = useState<"query" | "upload">("query");
  const [queryPayload, setQueryPayload] = useState<QueryPanelGeneratePayload | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMounted(true);
    // 使用 localStorage 检查登录状态
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const userStr = localStorage.getItem("user");
    if (isLoggedIn === "true" && userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.md') && !selectedFile.name.endsWith('.markdown')) {
        setError('请上传 Markdown 格式的文件（.md）');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setSteps(initialSteps);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.md') && !droppedFile.name.endsWith('.markdown')) {
        setError('请上传 Markdown 格式的文件（.md）');
        return;
      }
      setFile(droppedFile);
      setError(null);
      setResult(null);
      setSteps(initialSteps);
    }
  }, []);

  const handleSourceCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setSourceCodeFile(selectedFile);
    }
  }, []);

  const handleSourceCodeDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setSourceCodeFile(droppedFile);
    }
  }, []);

  const updateStepStatus = (stepId: string, status: StepStatus) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const handleGenerate = async () => {
    const useQuery = inputMode === 'query' && queryPayload;
    if (!useQuery && !file) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setSteps(initialSteps.map(s => ({ ...s, status: 'pending' as StepStatus })));
    setCurrentMessage('正在初始化...');

    abortControllerRef.current = new AbortController();

    try {
      let response: Response;

      if (useQuery && queryPayload) {
        const body: Record<string, unknown> = {
          tableTemplate: queryPayload.tableTemplate,
          skipAnalyze: queryPayload.skipAnalyze,
        };
        if (user?.id) body.userId = user.id;

        if (sourceCodeFile) {
          const formData = new FormData();
          formData.append('template_file', new File([queryPayload.tableTemplate], 'collection.md', { type: 'text/markdown' }));
          formData.append('source_code_file', sourceCodeFile);
          if (user?.id) formData.append('user_id', user.id);
          formData.append('skip_analyze', queryPayload.skipAnalyze ? '1' : '0');
          response = await fetch('/api/generate', {
            method: 'POST',
            body: formData,
            signal: abortControllerRef.current.signal,
          });
        } else {
          response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: abortControllerRef.current.signal,
          });
        }
      } else {
        const formData = new FormData();
        formData.append('template_file', file!);
        if (sourceCodeFile) {
          formData.append('source_code_file', sourceCodeFile);
        }
        if (user?.id) {
          formData.append('user_id', user.id);
        }

        response = await fetch('/api/generate', {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current.signal,
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成失败');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const defaultFileName =
        useQuery && queryPayload
          ? queryPayload.fileName
          : file!.name.replace('.md', '').replace('.markdown', '');

      let finalData: GenerateResult = {
        sourceCodeDocx: '',
        userManualDocx: '',
        collectionFormMarkdown: '',
        fileName: defaultFileName,
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: SSEData = JSON.parse(line.slice(6));
              
              setCurrentMessage(data.message);

              if (data.step === 'error') {
                setError(data.message);
                setSteps(prev => prev.map(s => 
                  s.status === 'active' ? { ...s, status: 'error' as StepStatus } : s
                ));
              } else if (data.step === 'complete') {
                setSteps(prev => prev.map(s => ({ ...s, status: 'completed' as StepStatus })));
                if (data.data) {
                  finalData = {
                    sourceCodeDocx: data.data.sourceCodeDocx || '',
                    userManualDocx: data.data.userManualDocx || '',
                    collectionFormMarkdown: data.data.collectionFormMarkdown || '',
                    fileName: data.data.fileName || finalData.fileName,
                  };
                  setResult(finalData);
                }
              } else {
                updateStepStatus(data.step, 'active');
                setSteps(prev => {
                  const currentIndex = prev.findIndex(s => s.id === data.step);
                  return prev.map((s, i) => {
                    if (i < currentIndex) return { ...s, status: 'completed' as StepStatus };
                    if (i === currentIndex) return { ...s, status: 'active' as StepStatus };
                    return s;
                  });
                });
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('生成已取消');
      } else {
        setError(err instanceof Error ? err.message : '生成过程中发生错误');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setError('下载失败，请重试');
    }
  };

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progressPercent = (completedSteps / steps.length) * 100;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#030014] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030014] text-white relative overflow-hidden">
      {/* 背景特效 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-transparent rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-cyan-600/20 via-blue-600/10 to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        
        {mounted && (
          <>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute h-[1px] bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"
                style={{
                  width: '250px',
                  top: `${15 + i * 14}%`,
                  left: '-250px',
                  animation: `flowLine ${10 + i * 2}s linear infinite`,
                  animationDelay: `${i * 1.5}s`,
                }}
              />
            ))}
          </>
        )}

        <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <style jsx global>{`
        @keyframes flowLine {
          0% { transform: translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(calc(100vw + 500px)); opacity: 0; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
          50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.5); }
        }
        .btn-shimmer {
          background: linear-gradient(90deg, #8b5cf6, #06b6d4, #8b5cf6);
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
        .btn-shimmer:hover {
          animation: shimmer 1.5s linear infinite;
          transform: scale(1.02);
        }
        .card-glow:hover {
          box-shadow: 0 0 30px rgba(139, 92, 246, 0.2);
        }
        .upload-zone {
          transition: all 0.3s ease;
        }
        .upload-zone:hover {
          border-color: rgba(139, 92, 246, 0.5) !important;
          background: rgba(139, 92, 246, 0.05) !important;
        }
        .upload-zone.drag-over {
          border-color: #06b6d4 !important;
          background: rgba(6, 182, 212, 0.1) !important;
        }
        .icon-shine {
          position: relative;
        }
        .icon-shine::after {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          background: linear-gradient(45deg, #8b5cf6, #06b6d4, #ec4899, #8b5cf6);
          background-size: 300% 300%;
          animation: shimmer 4s linear infinite;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .icon-shine:hover::after {
          opacity: 1;
        }
      `}</style>

      {/* 顶部导航 */}
      <nav className="relative z-50 border-b border-white/10 bg-[#030014]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform" />
              <svg className="absolute inset-0 w-11 h-11 p-2.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">智笔乾坤</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/app/history">
              <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 icon-shine">
                <History className="h-4 w-4 mr-2" />
                历史记录
              </Button>
            </Link>
            <span className="text-white/60 text-sm hidden sm:block">欢迎，{user.username}</span>
            <Button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/";
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
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white via-violet-200 to-cyan-200 bg-clip-text text-transparent">
            软著材料生成
          </h1>
          <p className="text-white/50 text-lg">输入小程序查询码补全信息，或上传采集表，自动生成鉴别材料</p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          <Button
            variant={inputMode === "query" ? "default" : "outline"}
            onClick={() => setInputMode("query")}
            className={inputMode === "query" ? "bg-emerald-600" : "border-white/20 text-white/70"}
          >
            <Search className="h-4 w-4 mr-2" />
            查询码导入
          </Button>
          <Button
            variant={inputMode === "upload" ? "default" : "outline"}
            onClick={() => setInputMode("upload")}
            className={inputMode === "upload" ? "bg-violet-600" : "border-white/20 text-white/70"}
          >
            <Upload className="h-4 w-4 mr-2" />
            上传 MD（备用）
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* 左侧 - 输入区 */}
          <div className="lg:col-span-2 space-y-6">
            {inputMode === "query" && (
              <CopyrightQueryPanel
                disabled={isGenerating}
                onReadyToGenerate={(payload) => {
                  setQueryPayload(payload);
                  setInputMode("query");
                  setError(null);
                }}
              />
            )}

            {inputMode === "upload" && (
            <>
            {/* 采集表上传 */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl card-glow transition-all hover:border-violet-500/30">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center icon-shine">
                  <FileBox className="h-6 w-6 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">上传采集表</h2>
                  <p className="text-sm text-white/50">Markdown 格式（.md）</p>
                </div>
              </div>

              <div
                className={`upload-zone border-2 border-dashed rounded-2xl ${
                  file 
                    ? 'border-emerald-400/50 bg-emerald-500/5' 
                    : 'border-white/20'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('drag-over'); }}
                onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove('drag-over'); }}
              >
                <input
                  type="file"
                  accept=".md,.markdown"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  disabled={isGenerating}
                />
                <label htmlFor="file-upload" className={`block p-12 text-center cursor-pointer ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}>
                  {file ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center icon-shine">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white text-lg">{file.name}</p>
                        <p className="text-sm text-white/40 mt-2">{(file.size / 1024).toFixed(2)} KB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 icon-shine">
                        <Upload className="h-8 w-8 text-white/40" />
                      </div>
                      <p className="font-semibold text-white/70 mb-2 text-lg">点击上传或拖拽文件到此处</p>
                      <p className="text-sm text-white/40">支持 .md 格式</p>
                    </div>
                  )}
                </label>
              </div>

              <div className="mt-5 flex items-center justify-between p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-white/70">需要模板？</p>
                    <p className="text-xs text-white/40">下载标准采集表模板</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all">
                  <a href="/采集表模板.md" download="计算机软件著作权登记信息采集表.md">
                    <Download className="h-4 w-4 mr-1" />
                    下载模板
                  </a>
                </Button>
              </div>
            </div>
            </>
            )}

            {/* 源代码上传 */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl card-glow transition-all hover:border-cyan-500/30">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center icon-shine">
                  <FileArchive className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">上传源代码（可选）</h2>
                  <p className="text-sm text-white/50">支持 .zip, .tar.gz 格式</p>
                </div>
              </div>

              <div
                className={`upload-zone border-2 border-dashed rounded-2xl p-6 ${
                  sourceCodeFile 
                    ? 'border-emerald-400/50 bg-emerald-500/5' 
                    : 'border-white/20'
                }`}
                onDrop={handleSourceCodeDrop}
                onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add('drag-over'); }}
                onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove('drag-over'); }}
              >
                <input
                  type="file"
                  accept=".zip,.tar,.gz,.rar"
                  onChange={handleSourceCodeChange}
                  className="hidden"
                  id="source-code-upload"
                  disabled={isGenerating}
                />
                <label htmlFor="source-code-upload" className={`block text-center cursor-pointer ${isGenerating ? 'pointer-events-none opacity-60' : ''}`}>
                  {sourceCodeFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <Code className="h-5 w-5 text-emerald-400" />
                      <span className="font-semibold text-white">{sourceCodeFile.name}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-white/50">点击或拖拽上传源代码压缩包</p>
                  )}
                </label>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <Alert variant="destructive" className="rounded-xl bg-red-500/10 border-red-500/30 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* 生成按钮 */}
            {inputMode === "query" && queryPayload && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                已载入：<strong>{queryPayload.fileName}</strong>
                {queryPayload.skipAnalyze ? "（将跳过采集表分析，直接生成）" : ""}
              </div>
            )}

            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                (inputMode === "query" ? !queryPayload : !file)
              }
              className="btn-shimmer w-full h-14 text-base font-semibold text-white border-0 rounded-xl shadow-lg shadow-violet-500/30 disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  生成中...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Layers className="h-5 w-5" />
                  开始生成
                </span>
              )}
            </Button>
            
            {isGenerating && (
              <Button
                variant="ghost"
                onClick={handleCancel}
                className="w-full text-white/50 hover:text-white hover:bg-white/10"
              >
                取消
              </Button>
            )}

            {/* 生成进度 */}
            {isGenerating && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl card-glow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-white/60 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {currentMessage}
                  </span>
                  <span className="text-sm font-semibold text-white">{completedSteps}/{steps.length}</span>
                </div>
                <Progress value={progressPercent} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-cyan-500" />
                
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-4">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center gap-1.5 p-2 rounded-lg text-xs font-medium transition-all ${
                        step.status === 'completed' 
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : step.status === 'active'
                          ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
                          : step.status === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-white/5 text-white/40'
                      }`}
                    >
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : step.status === 'active' ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : step.status === 'error' ? (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <span className="shrink-0">{step.icon}</span>
                      )}
                      <span className="truncate hidden sm:inline">{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右侧 - 结果/说明 */}
          <div className="space-y-6">
            {/* 生成结果 */}
            {result && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 backdrop-blur-xl card-glow">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center icon-shine">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">生成完成</h2>
                    <p className="text-sm text-white/50">共 3 个文件</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {result.sourceCodeDocx && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-blue-500/30 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center icon-shine">
                          <Code className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">源代码文档</p>
                          <Badge variant="secondary" className="text-xs mt-0.5 bg-blue-500/20 text-blue-300">DOCX</Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full bg-white/10 hover:bg-white/20 text-white border-0 transition-all hover:scale-[1.02]"
                        onClick={() => handleDownload(result.sourceCodeDocx, '源代码文档.docx')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下载
                      </Button>
                    </div>
                  )}

                  {result.userManualDocx && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-purple-500/30 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center icon-shine">
                          <BookOpen className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">用户手册</p>
                          <Badge variant="secondary" className="text-xs mt-0.5 bg-purple-500/20 text-purple-300">DOCX</Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full bg-white/10 hover:bg-white/20 text-white border-0 transition-all hover:scale-[1.02]"
                        onClick={() => handleDownload(result.userManualDocx, '用户手册.docx')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下载
                      </Button>
                    </div>
                  )}

                  {result.collectionFormMarkdown && (
                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-amber-500/30 transition-colors">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center icon-shine">
                          <FileText className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">完整采集表</p>
                          <Badge variant="secondary" className="text-xs mt-0.5 bg-amber-500/20 text-amber-300">Markdown</Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full bg-white/10 hover:bg-white/20 text-white border-0 transition-all hover:scale-[1.02]"
                        onClick={() => handleDownload(result.collectionFormMarkdown, '采集表.md')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下载
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 说明 */}
            {!result && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl card-glow">
                <h2 className="text-lg font-semibold mb-4">使用流程</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5 icon-shine">
                      <span className="text-xs font-bold text-violet-400">1</span>
                    </div>
                    <p className="text-sm text-white/60">上传 Markdown 格式采集表</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5 icon-shine">
                      <span className="text-xs font-bold text-cyan-400">2</span>
                    </div>
                    <p className="text-sm text-white/60">系统处理并生成文档</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5 icon-shine">
                      <span className="text-xs font-bold text-emerald-400">3</span>
                    </div>
                    <p className="text-sm text-white/60">下载生成的材料文件</p>
                  </div>
                </div>
              </div>
            )}

            {/* 提示卡片 */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl card-glow">
              <h3 className="text-sm font-semibold mb-3 text-white/80">注意事项</h3>
              <ul className="text-sm text-white/50 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-violet-400">·</span>
                  源代码文档约 2000-3000 行
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">·</span>
                  用户手册约 8000-10000 字
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400">·</span>
                  生成时间约 3-10 分钟
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">·</span>
                  上传源代码可获得更精准结果
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
