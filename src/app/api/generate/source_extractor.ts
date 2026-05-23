import { spawn } from 'child_process';
import { writeFile, mkdir, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// 支持的代码文件扩展名
const CODE_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
  '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
  '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.xml', '.sql',
  '.sh', '.bash', '.ps1',
  '.md', '.txt', '.ini', '.conf', '.cfg', '.env'
];

// 忽略的目录
const IGNORE_DIRS = [
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'out', 'target', 'bin', 'obj',
  '__pycache__', '.pytest_cache', '.venv', 'venv',
  '.next', '.nuxt', '.cache',
  'coverage', '.nyc_output',
  'vendor', 'packages', '.idea', '.vscode'
];

// 忽略的文件
const IGNORE_FILES = [
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.DS_Store', 'Thumbs.db',
  '*.min.js', '*.min.css', '*.bundle.js'
];

interface ExtractedSource {
  content: string;
  fileCount: number;
  summary: string;
  fileList: string[];
}

export async function extractSourceCode(
  file: File,
  sendProgress: (step: string, message: string, data?: unknown) => void
): Promise<ExtractedSource> {
  const tempDir = join(tmpdir(), `source-code-${Date.now()}`);
  const extractDir = join(tempDir, 'extracted');
  const uploadPath = join(tempDir, 'upload');

  await mkdir(extractDir, { recursive: true });
  await mkdir(uploadPath, { recursive: true });

  sendProgress('init', '正在解压源代码包...');

  // 保存上传的文件
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.endsWith('.tar.gz') ? 'source.tar.gz' : 'source.zip';
  const uploadFilePath = join(uploadPath, fileName);
  await writeFile(uploadFilePath, buffer);

  // 解压文件
  let extractCmd: string[];
  if (file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz')) {
    extractCmd = ['tar', '-xzf', uploadFilePath, '-C', extractDir];
  } else {
    // 对于 zip，使用 unzip
    extractCmd = ['unzip', '-q', uploadFilePath, '-d', extractDir];
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(extractCmd[0], extractCmd.slice(1));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`解压失败，退出码: ${code}`));
    });
    proc.on('error', reject);
  });

  sendProgress('init', '正在扫描代码文件...');

  // 递归扫描代码文件
  const codeFiles: string[] = [];
  
  async function scanDir(dir: string) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // 跳过忽略的目录
          if (!IGNORE_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          // 检查扩展名
          const ext = entry.name.toLowerCase();
          const isCodeFile = CODE_EXTENSIONS.some(e => ext.endsWith(e));
          const isIgnoreFile = IGNORE_FILES.some(pattern => {
            if (pattern.startsWith('*')) {
              return ext.endsWith(pattern.slice(1));
            }
            return entry.name === pattern;
          });
          
          if (isCodeFile && !isIgnoreFile) {
            codeFiles.push(fullPath);
          }
        }
      }
    } catch {
      // 忽略无法读取的目录
    }
  }

  await scanDir(extractDir);

  sendProgress('init', `发现 ${codeFiles.length} 个代码文件，正在读取...`);

  // 读取所有代码文件内容
  const contents: string[] = [];
  
  for (let i = 0; i < codeFiles.length; i++) {
    const filePath = codeFiles[i];
    try {
      const content = await readFile(filePath, 'utf-8');
      // 过滤空文件和过大的文件（>500KB）
      if (content.length > 0 && content.length < 500 * 1024) {
        contents.push(content);
      }
    } catch {
      // 忽略无法读取的文件
    }
    
    if ((i + 1) % 50 === 0) {
      sendProgress('init', `已读取 ${i + 1}/${codeFiles.length} 个文件...`);
    }
  }

  // 合并所有代码（直接拼接，不过滤空行）
  const fullCode = contents.join('\n');

  // 生成摘要
  const fileList = codeFiles.map(f => f.replace(extractDir + '/', ''));
  const summary = generateSummary(fileList, contents);

  sendProgress('init', `源代码提取完成：${contents.length} 个文件，共 ${fullCode.split('\n').length} 行`);

  return {
    content: fullCode,
    fileCount: contents.length,
    summary,
    fileList
  };
}

function generateSummary(fileList: string[], contents: string[]): string {
  // 统计文件类型
  const extCount: Record<string, number> = {};
  for (const f of fileList) {
    const ext = f.split('.').pop()?.toLowerCase() || 'unknown';
    extCount[ext] = (extCount[ext] || 0) + 1;
  }

  // 统计总行数
  const totalLines = contents.reduce((sum, c) => sum + c.split('\n').length, 0);

  // 统计主要文件（行数最多的）
  const fileLines = contents.map((c, i) => ({ name: fileList[i], lines: c.split('\n').length }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 10);

  let summary = `源代码包含 ${contents.length} 个文件，共 ${totalLines} 行代码。\n\n`;
  summary += `文件类型分布：\n`;
  for (const [ext, count] of Object.entries(extCount).sort((a, b) => b[1] - a[1])) {
    summary += `- ${ext}: ${count} 个文件\n`;
  }

  summary += `\n主要文件（按行数）：\n`;
  for (const f of fileLines) {
    summary += `- ${f.name}: ${f.lines} 行\n`;
  }

  return summary;
}
