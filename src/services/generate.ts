import { requireSupabase } from "@/lib/supabase";
import { activitySchema, worksheetSchema, quizSchema, answerSchema } from "@/lib/schemas";
import type { Activity, Worksheet, Quiz, AiAnswer } from "@/lib/schemas";
import type { HistoryRow } from "@/types/db";
import { recordKairoMove } from "./audit";

/**
 * All generation goes through the `ai-generate` Edge Function, which enforces
 * assignment-based access, runs retrieval, calls the provider server-side, and
 * validates output. We re-validate the returned payload here as defence in depth.
 */
async function invokeAi<T>(kind: string, body: Record<string, unknown>): Promise<T> {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke("ai-generate", { body: { kind, ...body } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function askQuestion(materialId: string, question: string, sessionId?: string): Promise<AiAnswer & { sessionId: string }> {
  const res = await invokeAi<any>("answer", { materialId, question, sessionId });
  const parsed = answerSchema.parse(res.answer);
  recordKairoMove({
    action: "ai.assistant.query",
    target: materialId,
    meta: { questionLength: question.length, sessionId: res.sessionId },
  });
  return { ...parsed, sessionId: res.sessionId };
}

export async function generateActivity(input: Record<string, unknown>): Promise<Activity> {
  const res = await invokeAi<{ activity: unknown }>("activity", input);
  return activitySchema.parse(res.activity);
}

export async function generateWorksheet(input: Record<string, unknown>): Promise<Worksheet> {
  const res = await invokeAi<{ worksheet: unknown }>("worksheet", input);
  return worksheetSchema.parse(res.worksheet);
}

export async function generateQuiz(input: Record<string, unknown>): Promise<Quiz> {
  const res = await invokeAi<{ quiz: unknown }>("quiz", input);
  return quizSchema.parse(res.quiz);
}

// ---- Persistence (RLS guarantees owner = auth.uid()) ----------------------
export async function saveActivity(a: Activity, materialId: string | null): Promise<string> {
  const sb = requireSupabase();
  const uid = (await sb.auth.getUser()).data.user!.id;
  const { data, error } = await sb.from("activities").insert({
    teacher_id: uid, material_id: materialId, title: a.title, grade: a.grade,
    subject: a.subject, topic: a.topic, payload: a,
  }).select("id").single();
  if (error) throw error;
  await recordHistory("activity", data.id, materialId, a.title, `${a.activityType} • Grade ${a.grade}`, a);
  recordKairoMove({
    action: "ai.generate.activity",
    target: a.title,
    actorId: uid,
    meta: { activityId: data.id, grade: a.grade, subject: a.subject, activityType: a.activityType },
  });
  return data.id;
}

export async function saveWorksheet(w: Worksheet, materialId: string | null): Promise<string> {
  const sb = requireSupabase();
  const uid = (await sb.auth.getUser()).data.user!.id;
  const { data, error } = await sb.from("worksheets").insert({
    teacher_id: uid, material_id: materialId, title: w.title, grade: w.grade,
    subject: w.subject, payload: w,
  }).select("id").single();
  if (error) throw error;
  await recordHistory("worksheet", data.id, materialId, w.title, `${w.questions.length} questions`, w);
  recordKairoMove({
    action: "ai.generate.worksheet",
    target: w.title,
    actorId: uid,
    meta: { worksheetId: data.id, grade: w.grade, subject: w.subject, questions: w.questions.length },
  });
  return data.id;
}

export async function saveQuiz(q: Quiz, materialId: string | null): Promise<string> {
  const sb = requireSupabase();
  const uid = (await sb.auth.getUser()).data.user!.id;
  const { data, error } = await sb.from("quizzes").insert({
    teacher_id: uid, material_id: materialId, title: q.title, grade: q.grade,
    subject: q.subject, payload: q,
  }).select("id").single();
  if (error) throw error;
  await recordHistory("quiz", data.id, materialId, q.title, `${q.questions.length} questions`, q);
  recordKairoMove({
    action: "ai.generate.quiz",
    target: q.title,
    actorId: uid,
    meta: { quizId: data.id, grade: q.grade, subject: q.subject, questions: q.questions.length },
  });
  return data.id;
}

async function recordHistory(
  type: HistoryRow["resource_type"], resourceId: string | null,
  materialId: string | null, title: string, summary: string, payload: unknown,
): Promise<void> {
  const sb = requireSupabase();
  const uid = (await sb.auth.getUser()).data.user!.id;
  await sb.from("generation_history").insert({
    teacher_id: uid, resource_type: type, resource_id: resourceId,
    material_id: materialId, title, summary, payload,
  });
}

export async function listHistory(filters?: {
  type?: string; search?: string;
}): Promise<HistoryRow[]> {
  let q = requireSupabase().from("generation_history").select("*").order("created_at", { ascending: false });
  if (filters?.type) q = q.eq("resource_type", filters.type);
  if (filters?.search) q = q.ilike("title", `%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data as HistoryRow[];
}

export async function deleteHistory(id: string): Promise<void> {
  const { error } = await requireSupabase().from("generation_history").delete().eq("id", id);
  if (error) throw error;
}
