import { ApiError } from "./http";
import { getServerEnv, getSupabaseAdmin } from "./config";
import type { Provider } from "./models";

export type GenerationJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface GenerationJobRow {
  id: string;
  user_id: string;
  application_id: string;
  status: GenerationJobStatus;
  current_step: string;
  progress: number;
  provider: Provider | null;
  model: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_STALE_JOB_MS = 6 * 60 * 1000;
const staleJobMessage = "上一次生成请求已中断，任务已自动标记为失败，可以重新生成";

async function recoverStaleGenerationJob(input: { userId: string; applicationId: string }): Promise<boolean> {
  // The generate function is capped at 300 seconds on the current Vercel
  // plan. A dead request must not leave the user locked out for 30 minutes.
  const staleMs = Math.max(60_000, Math.min(getServerEnv().generationJobStaleMs, DEFAULT_STALE_JOB_MS));
  const staleBefore = new Date(Date.now() - staleMs).toISOString();
  const now = new Date().toISOString();
  const result = await getSupabaseAdmin()
    .from("generation_jobs")
    .update({
      status: "failed",
      error_message: staleJobMessage,
      completed_at: now,
      updated_at: now,
    })
    .eq("application_id", input.applicationId)
    .eq("user_id", input.userId)
    .in("status", ["queued", "running"])
    .lt("updated_at", staleBefore)
    .select("id,user_id,current_step,progress");

  if (result.error) throw new Error("stale generation job recovery failed");
  const recovered = result.data || [];
  if (!recovered.length) return false;

  await getSupabaseAdmin().from("job_events").insert(recovered.map((job) => ({
    job_id: job.id,
    user_id: job.user_id,
    step: job.current_step,
    message: "检测到上一次请求已中断，已自动释放生成任务锁。",
    progress: job.progress,
    metadata: { failure_kind: "stale_job_recovered", retryable: true },
  })));
  // Releasing the lock is more important than the optional diagnostic event.
  return true;
}

export async function createGenerationJob(input: {
  userId: string;
  applicationId: string;
  provider: Provider;
  model: string;
}): Promise<GenerationJobRow> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await getSupabaseAdmin()
      .from("generation_jobs")
      .insert({
        user_id: input.userId,
        application_id: input.applicationId,
        status: "queued",
        current_step: "queued",
        progress: 0,
        provider: input.provider,
        model: input.model,
      })
      .select("*")
      .single();
    if (!result.error) return result.data as GenerationJobRow;
    if (result.error.code !== "23505" || attempt > 0 || !(await recoverStaleGenerationJob(input))) {
      if (result.error.code === "23505") {
        throw new ApiError(409, "同一申请已有生成任务正在进行，请等待完成");
      }
      throw new Error("generation job creation failed");
    }
  }
  throw new Error("generation job creation failed");
}

export async function updateGenerationJob(
  jobId: string,
  userId: string,
  patch: Partial<Pick<GenerationJobRow, "status" | "current_step" | "progress" | "error_message" | "started_at" | "completed_at">>,
): Promise<void> {
  const result = await getSupabaseAdmin()
    .from("generation_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId);
  if (result.error) throw new Error("generation job update failed");
}

export async function recordJobEvent(input: {
  jobId: string;
  userId: string;
  step: string;
  message: string;
  progress?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const result = await getSupabaseAdmin().from("job_events").insert({
    job_id: input.jobId,
    user_id: input.userId,
    step: input.step,
    message: input.message,
    progress: input.progress,
    metadata: input.metadata || null,
  });
  if (result.error) throw new Error("generation job event creation failed");
}

export async function getOwnedGenerationJob(jobId: string, userId: string): Promise<GenerationJobRow | null> {
  const result = await getSupabaseAdmin()
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw new Error("generation job lookup failed");
  return result.data as GenerationJobRow | null;
}

export async function getLatestOwnedGenerationJob(applicationId: string, userId: string): Promise<GenerationJobRow | null> {
  const result = await getSupabaseAdmin()
    .from("generation_jobs")
    .select("*")
    .eq("application_id", applicationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error("generation job lookup failed");
  const job = result.data as GenerationJobRow | null;
  if (job && (job.status === "queued" || job.status === "running")) {
    const staleMs = Math.max(60_000, Math.min(getServerEnv().generationJobStaleMs, DEFAULT_STALE_JOB_MS));
    if (Date.now() - new Date(job.updated_at).getTime() > staleMs && await recoverStaleGenerationJob({ userId, applicationId })) {
      const refreshed = await getSupabaseAdmin()
        .from("generation_jobs")
        .select("*")
        .eq("application_id", applicationId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (refreshed.error) throw new Error("generation job lookup failed");
      return refreshed.data as GenerationJobRow | null;
    }
  }
  return job;
}

export async function getOwnedJobEvents(jobId: string, userId: string) {
  const result = await getSupabaseAdmin()
    .from("job_events")
    .select("id,job_id,step,message,progress,metadata,created_at")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (result.error) throw new Error("generation job event lookup failed");
  return result.data || [];
}
