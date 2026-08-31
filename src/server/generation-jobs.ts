import { ApiError } from "./http";
import { getSupabaseAdmin } from "./config";
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

export async function createGenerationJob(input: {
  userId: string;
  applicationId: string;
  provider: Provider;
  model: string;
}): Promise<GenerationJobRow> {
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
  if (result.error) {
    if (result.error.code === "23505") {
      throw new ApiError(409, "同一申请已有生成任务正在进行，请等待完成");
    }
    throw new Error("generation job creation failed");
  }
  return result.data as GenerationJobRow;
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
  return result.data as GenerationJobRow | null;
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
