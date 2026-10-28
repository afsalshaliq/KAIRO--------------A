// ai-generate — the only path to AI generation. Enforces assignment-based
// access, retrieves REAL curriculum chunks, calls the provider server-side, and
// validates output + citations before returning. No silent fallback to general
// knowledge: if nothing is retrieved or the provider is unconfigured, it says so.
import { json, preflight } from "../_shared/cors.ts";
import {
  HttpError,
  requireActiveTeacher,
  serviceClient,
  type Caller,
} from "../_shared/auth.ts";
import {
  chat,
  groundingBlock,
  INJECTION_GUARD,
  parseJsonObject,
  providerConfig,
  retrieve,
  validateCitations,
  type RetrievedChunk,
} from "../_shared/ai.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface MaterialCtx {
  id: string;
  grade: number;
  subject: string;
  chapter: string;
  title: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let svc: SupabaseClient;
  try {
    svc = serviceClient();
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  try {
    const teacher = await requireActiveTeacher(req, svc);
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? "");
    const materialId = String(body.materialId ?? "");
    if (!materialId) throw new HttpError(400, "Pick a chapter (materialId) first.");

    // Authorization: ready + published + a live assignment for this teacher.
    const material = await assertAccess(svc, teacher, materialId);

    const cfg = providerConfig();
    if (!cfg) {
      throw new HttpError(
        503,
        "AI is not configured on the server. Set AI_PROVIDER_API_KEY (and AI_MODEL / AI_PROVIDER_BASE_URL) for the Edge Functions, then try again.",
      );
    }

    switch (kind) {
      case "answer":
        return await handleAnswer(svc, teacher, material, body, cfg);
      case "activity":
        return await handleActivity(svc, material, body, cfg);
      case "worksheet":
        return await handleWorksheet(svc, material, body, cfg);
      case "quiz":
        return await handleQuiz(svc, material, body, cfg);
      default:
        throw new HttpError(400, `Unknown kind: ${kind || "(none)"}`);
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});

async function assertAccess(
  svc: SupabaseClient,
  teacher: Caller,
  materialId: string,
): Promise<MaterialCtx> {
  const { data: m } = await svc
    .from("curriculum_materials")
    .select("id,class_id,subject_id,section_id,chapter,title,status,is_published,classes(grade),subjects(name)")
    .eq("id", materialId)
    .single();
  if (!m) throw new HttpError(404, "Material not found.");
  if (m.status !== "ready" || !m.is_published) {
    throw new HttpError(403, "This chapter is not available for AI use yet.");
  }

  let q = svc
    .from("teacher_assignments")
    .select("id,section_id")
    .eq("teacher_id", teacher.id)
    .eq("class_id", m.class_id)
    .eq("subject_id", m.subject_id)
    .eq("is_revoked", false);
  if (m.section_id) q = q.eq("section_id", m.section_id);
  const { data: assigns } = await q.limit(1);
  if (!assigns || assigns.length === 0) {
    throw new HttpError(403, "You are not assigned to this class/subject.");
  }

  const grade = (m as any).classes?.grade;
  const subject = (m as any).subjects?.name ?? "";
  if (typeof grade !== "number" || grade < 1 || grade > 5) {
    throw new HttpError(422, "Material is linked to an invalid class grade.");
  }
  return { id: m.id, grade, subject, chapter: m.chapter ?? "", title: m.title };
}

// ---- Answer (grounded Q&A) ------------------------------------------------
async function handleAnswer(
  svc: SupabaseClient,
  teacher: Caller,
  material: MaterialCtx,
  body: Record<string, unknown>,
  cfg: ReturnType<typeof providerConfig> & object,
): Promise<Response> {
  const question = String(body.question ?? "").trim();
  if (!question) throw new HttpError(400, "Ask a question.");

  const retrieved = await retrieve(svc, material.id, question);
  const system =
    `You are KAIRO, a teaching assistant for Royal School (CBSE), Class ${material.grade} ${material.subject}. ` +
    INJECTION_GUARD +
    ` Reply with a JSON object: {"grounded": boolean, "answer": string, "teachingSuggestions": string[], "citations": [{"materialId": string, "chunkIndex": number, "page": number|null, "quote": string}]}. ` +
    `Cite only chunkIndex values present in the context. If the context lacks the answer, set grounded=false and explain that the chapter does not cover it.`;
  const user =
    `CURRICULUM CONTEXT (material ${material.id}):\n${groundingBlock(retrieved)}\n\nQUESTION: ${question}`;

  const parsed = parseJsonObject(await chat(cfg, system, user));
  const citations = validateCitations((parsed as any).citations, retrieved);
  const grounded = retrieved.length > 0 && Boolean((parsed as any).grounded) && citations.length > 0;
  const answer = {
    grounded,
    answer: String((parsed as any).answer ?? "").trim() ||
      "The chapter material does not cover this. Try rephrasing or pick another chapter.",
    teachingSuggestions: asStringArray((parsed as any).teachingSuggestions),
    citations,
  };

  // Persist the conversation (owner = teacher; RLS enforces privacy).
  let sessionId = String(body.sessionId ?? "");
  if (!sessionId) {
    const { data: s } = await svc.from("chat_sessions")
      .insert({ teacher_id: teacher.id, material_id: material.id, title: question.slice(0, 80) })
      .select("id").single();
    sessionId = s?.id ?? "";
  }
  if (sessionId) {
    await svc.from("chat_messages").insert([
      { session_id: sessionId, teacher_id: teacher.id, role: "user", content: question },
      {
        session_id: sessionId, teacher_id: teacher.id, role: "assistant",
        content: answer.answer, citations: answer.citations,
      },
    ]);
  }
  return json({ answer, sessionId });
}

// ---- Activity -------------------------------------------------------------
async function handleActivity(
  svc: SupabaseClient,
  material: MaterialCtx,
  body: Record<string, unknown>,
  cfg: ReturnType<typeof providerConfig> & object,
): Promise<Response> {
  const activityType = String(body.activityType ?? "game");
  const objective = String(body.objective ?? "");
  const query = `${material.chapter} ${material.subject} ${activityType} ${objective}`.trim();
  const retrieved = await retrieve(svc, material.id, query, 8);
  requireContext(retrieved);

  const system =
    `You design hands-on CBSE classroom activities for Class ${material.grade} ${material.subject}. ` +
    INJECTION_GUARD +
    ` Output a single JSON object matching exactly: {"title":string,"grade":${material.grade},"subject":${JSON.stringify(material.subject)},"topic":string,"activityType":${JSON.stringify(activityType)},"learningObjectives":string[],"materials":string[],"durationMinutes":number,"groupSize":string,"difficulty":"easy"|"medium"|"hard","preparation":string[],"steps":string[],"teacherInstructions":string[],"studentRules":string[],"expectedOutcomes":string[],"assessmentChecklist":string[],"answerKey":string[]|null,"adaptations":string[],"safetyNotes":string[],"citations":[{"materialId":string,"chunkIndex":number,"page":number|null,"quote":string}]}. ` +
    `Age-appropriate for Class ${material.grade}. Ground every fact in the context and cite chunkIndex values from it.`;
  const user =
    `CURRICULUM CONTEXT (material ${material.id}):\n${groundingBlock(retrieved)}\n\n` +
    `Make a "${activityType}" activity. Duration ~${Number(body.durationMinutes) || 30} min, ` +
    `group size "${String(body.groupSize ?? "Groups of 4")}", difficulty "${String(body.difficulty ?? "easy")}".` +
    (objective ? ` Objective: ${objective}.` : "") +
    (body.materialsAvailable ? ` Available materials: ${String(body.materialsAvailable)}.` : "");

  const parsed = parseJsonObject(await chat(cfg, system, user));
  const activity = finalizeResource(parsed, material, activityType);
  activity.citations = validateCitations((parsed as any).citations, retrieved);
  return json({ activity });
}

// ---- Worksheet ------------------------------------------------------------
async function handleWorksheet(
  svc: SupabaseClient,
  material: MaterialCtx,
  body: Record<string, unknown>,
  cfg: ReturnType<typeof providerConfig> & object,
): Promise<Response> {
  const types = asStringArray(body.types).filter(Boolean);
  const count = clampInt(Number(body.count) || 6, 1, 20);
  const retrieved = await retrieve(svc, material.id, `${material.chapter} ${material.subject} worksheet`, 8);
  requireContext(retrieved);

  const system =
    `You write print-ready CBSE worksheets for Class ${material.grade} ${material.subject}. ` +
    INJECTION_GUARD +
    ` Output one JSON object: {"title":string,"grade":${material.grade},"subject":${JSON.stringify(material.subject)},"chapter":${JSON.stringify(material.chapter)},"learningObjective":string,"questions":[{"type":"mcq"|"fill_blank"|"match"|"true_false"|"short_answer"|"draw_label","prompt":string,"options":string[]?,"answer":string,"marks":number}],"citations":[{"materialId":string,"chunkIndex":number,"page":number|null,"quote":string}]}. ` +
    `MCQ/match questions MUST include >=2 options, and an MCQ "answer" MUST equal one of its options verbatim. Ground everything in the context.`;
  const user =
    `CURRICULUM CONTEXT (material ${material.id}):\n${groundingBlock(retrieved)}\n\n` +
    `Create ${count} questions of types [${types.join(", ") || "mcq, fill_blank, true_false"}], ` +
    `difficulty "${String(body.difficulty ?? "easy")}", for Class ${material.grade}.`;

  const parsed = parseJsonObject(await chat(cfg, system, user));
  const worksheet = {
    ...parsed,
    grade: material.grade,
    subject: material.subject,
    chapter: material.chapter,
    citations: validateCitations((parsed as any).citations, retrieved),
  };
  return json({ worksheet });
}

// ---- Quiz -----------------------------------------------------------------
async function handleQuiz(
  svc: SupabaseClient,
  material: MaterialCtx,
  body: Record<string, unknown>,
  cfg: ReturnType<typeof providerConfig> & object,
): Promise<Response> {
  const types = asStringArray(body.types).filter(Boolean);
  const count = clampInt(Number(body.count) || 5, 1, 20);
  const retrieved = await retrieve(svc, material.id, `${material.chapter} ${material.subject} quiz`, 8);
  requireContext(retrieved);

  const system =
    `You write short CBSE quizzes for Class ${material.grade} ${material.subject}. ` +
    INJECTION_GUARD +
    ` Output one JSON object: {"title":string,"grade":${material.grade},"subject":${JSON.stringify(material.subject)},"questions":[{"type":"mcq"|"true_false"|"fill_blank"|"short_answer","prompt":string,"options":string[]?,"answer":string,"explanation":string?,"marks":number}],"citations":[{"materialId":string,"chunkIndex":number,"page":number|null,"quote":string}]}. ` +
    `MCQ needs >=2 options and "answer" must equal one option verbatim. true_false "answer" must be "true" or "false". Ground everything in the context.`;
  const user =
    `CURRICULUM CONTEXT (material ${material.id}):\n${groundingBlock(retrieved)}\n\n` +
    `Create ${count} questions of types [${types.join(", ") || "mcq, true_false"}], ` +
    `difficulty "${String(body.difficulty ?? "easy")}", for Class ${material.grade}.`;

  const parsed = parseJsonObject(await chat(cfg, system, user));
  const quiz = {
    ...parsed,
    grade: material.grade,
    subject: material.subject,
    citations: validateCitations((parsed as any).citations, retrieved),
  };
  return json({ quiz });
}

// ---- helpers --------------------------------------------------------------
function requireContext(retrieved: RetrievedChunk[]): void {
  if (retrieved.length === 0) {
    throw new HttpError(
      422,
      "No curriculum text is available for this chapter yet. Re-process the document, then try again.",
    );
  }
}

function finalizeResource(
  parsed: Record<string, unknown>,
  material: MaterialCtx,
  activityType: string,
): any {
  return {
    ...parsed,
    grade: material.grade,
    subject: material.subject,
    topic: String((parsed as any).topic ?? material.chapter ?? ""),
    activityType,
    citations: [],
  };
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
