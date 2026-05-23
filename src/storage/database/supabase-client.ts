import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

// 懒加载环境变量
function loadEnv(): { 
  url: string; 
  anonKey: string; 
  serviceRoleKey: string | undefined;
} {
  // 尝试加载 .env 文件
  try {
    require('dotenv').config({ path: '.env' });
  } catch {
    // dotenv not available, continue
  }

  // 尝试从 Python 获取环境变量
  try {
    const pythonCode = `
from coze_workload_identity import Client
import json
client = Client()
env_vars = client.get_project_env_vars()
client.close()
result = {var.key: var.value for var in env_vars}
print(json.dumps(result))
`;
    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    
    const envVars = JSON.parse(output.trim());
    
    return {
      url: envVars.COZE_SUPABASE_URL || '',
      anonKey: envVars.COZE_SUPABASE_ANON_KEY || '',
      serviceRoleKey: envVars.COZE_SUPABASE_SERVICE_ROLE_KEY,
    };
  } catch {
    // Python fallback failed
  }

  // 回退到进程环境变量
  return {
    url: process.env.COZE_SUPABASE_URL || '',
    anonKey: process.env.COZE_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.COZE_SUPABASE_SERVICE_ROLE_KEY,
  };
}

// 获取凭证
const credentials = loadEnv();

// 默认凭证用于构建时
const DEFAULT_URL = 'https://br-regal-hare-6f4bdfc3.supabase2.aidap-global.cn-beijing.volces.com';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjMzNTg4NTAwMjIsInJvbGUiOiJhbm9uIn0.O5MoZbwdOnhbP_r2XSmNsK9eOCj6-WLnZjWDsEda7VU';
const DEFAULT_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjMzNTg4NTAwMjIsInJvbGUiOiJzZXJ2aWNlX3JvbGUifQ.-Z6PvW6o-MabrhgVTpMRQW9zkFZUguS9f9K4X-uISrE';

const url = credentials.url || DEFAULT_URL;
const anonKey = credentials.anonKey || DEFAULT_ANON_KEY;
const serviceRoleKey = credentials.serviceRoleKey || DEFAULT_SERVICE_ROLE_KEY;

// 创建客户端
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 导出获取函数
export function getSupabase(): SupabaseClient {
  return supabaseAdmin;
}

// 兼容别名
export const getSupabaseClient = getSupabase;
