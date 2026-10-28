import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared, strict validation schemas. Used by forms, services, and — crucially —
// to validate AI-generated structured output before it is ever persisted.
// ---------------------------------------------------------------------------

export const grade = z.number().int().min(1).max(5);

export const email = z.string().trim().toLowerCase().email();

export const roleEnum = z.enum(["super_admin", "admin", "principal", "teacher_admin", "teacher"]);
export const statusEnum = z.enum(["active", "suspended", "deactivated"]);

export const schoolCreateSchema = z.object({
  name: z.string().trim().min(2, "School name must be at least 2 characters").max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Slug must contain only letters, numbers, and hyphens"),
  domain: z.string().trim().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be valid hex color").optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be valid hex color").optional(),
});

export const teacherRequestSchema = z.object({
  type: z.enum(["leave", "extra_period", "schedule", "teacher_admin"]),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  details: z.record(z.string(), z.unknown()),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(10, "Announcement content must be at least 10 characters"),
  audience: z.enum(["all", "teacher_admins", "department", "specific"]),
  targetDepartment: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(8, "At least 8 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const inviteTeacherSchema = z.object({
  email,
  fullName: z.string().trim().min(1, "Name is required").max(120),
});

export const classSchema = z.object({
  grade,
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, "Use e.g. 2025-2026"),
});

export const sectionSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().trim().min(1).max(8),
});

export const assignmentSchema = z.object({
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
  subjectId: z.string().uuid(),
});

// ---- Upload validation ----------------------------------------------------
export const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export const uploadMetaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  classId: z.string().uuid(),
  sectionId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid(),
  chapter: z.string().trim().max(120).default(""),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
});

// ---- Citations (validated against actually-retrieved chunks) --------------
export const citationSchema = z.object({
  materialId: z.string().uuid(),
  chunkIndex: z.number().int().min(0),
  page: z.number().int().min(1).nullable(),
  quote: z.string().min(1).max(600),
});
export type Citation = z.infer<typeof citationSchema>;

export const answerSchema = z.object({
  grounded: z.boolean(),
  answer: z.string().min(1),
  teachingSuggestions: z.array(z.string()).default([]),
  citations: z.array(citationSchema).default([]),
});
export type AiAnswer = z.infer<typeof answerSchema>;

// ---- Activity ----------------------------------------------------
export const ACTIVITY_TYPES = [
  "hands_on", "puzzle", "game", "riddle", "roleplay", "storytelling",
  "group_challenge", "matching", "experiment", "real_world",
  "movement", "drawing", "revision",
] as const;

export const activitySchema = z.object({
  title: z.string().min(1),
  grade,
  subject: z.string().min(1),
  topic: z.string().default(""),
  activityType: z.enum(ACTIVITY_TYPES),
  learningObjectives: z.array(z.string().min(1)).min(1),
  materials: z.array(z.string()),
  durationMinutes: z.number().int().min(1).max(180),
  groupSize: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  preparation: z.array(z.string()),
  steps: z.array(z.string().min(1)).min(1),
  teacherInstructions: z.array(z.string()),
  studentRules: z.array(z.string()),
  expectedOutcomes: z.array(z.string().min(1)).min(1),
  assessmentChecklist: z.array(z.string()),
  answerKey: z.array(z.string()).nullable().default(null),
  adaptations: z.array(z.string()),
  safetyNotes: z.array(z.string()),
  citations: z.array(citationSchema).default([]),
});
export type Activity = z.infer<typeof activitySchema>;

// ---- Worksheet ----------------------------------------------------
export const questionTypeEnum = z.enum([
  "mcq", "fill_blank", "match", "true_false", "short_answer", "draw_label",
]);

export const worksheetQuestionSchema = z.object({
  type: questionTypeEnum,
  prompt: z.string().min(1),
  options: z.array(z.string()).optional(),
  answer: z.string().min(1),
  marks: z.number().int().min(0).default(1),
}).superRefine((q, ctx) => {
  if ((q.type === "mcq" || q.type === "match") && (!q.options || q.options.length < 2)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${q.type} needs at least 2 options` });
  }
  if (q.type === "mcq" && q.options && !q.options.includes(q.answer)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCQ answer must be one of the options" });
  }
});

export const worksheetSchema = z.object({
  title: z.string().min(1),
  grade,
  subject: z.string().min(1),
  chapter: z.string().default(""),
  learningObjective: z.string().default(""),
  questions: z.array(worksheetQuestionSchema).min(1),
  citations: z.array(citationSchema).default([]),
});
export type Worksheet = z.infer<typeof worksheetSchema>;

// ---- Quiz ----------------------------------------------------
export const quizQuestionSchema = z.object({
  type: z.enum(["mcq", "true_false", "fill_blank", "short_answer"]),
  prompt: z.string().min(1),
  options: z.array(z.string()).optional(),
  answer: z.string().min(1),
  explanation: z.string().optional(),
  marks: z.number().int().min(0).default(1),
}).superRefine((q, ctx) => {
  if (q.type === "mcq") {
    if (!q.options || q.options.length < 2)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCQ needs at least 2 options" });
    else if (!q.options.includes(q.answer))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCQ answer must be one of the options" });
  }
  if (q.type === "true_false" && !["true", "false"].includes(q.answer.toLowerCase()))
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "true/false answer must be 'true' or 'false'" });
});

export const quizSchema = z.object({
  title: z.string().min(1),
  grade,
  subject: z.string().min(1),
  questions: z.array(quizQuestionSchema).min(1),
  citations: z.array(citationSchema).default([]),
});
export type Quiz = z.infer<typeof quizSchema>;

/**
 * Validate AI citations against the chunks actually retrieved. Any citation that
 * doesn't point at a real retrieved chunk is dropped — the model cannot invent
 * page numbers or sources that weren't in the authorized context.
 */
export function validateCitations(
  citations: Citation[],
  retrieved: { materialId: string; chunkIndex: number; page: number | null }[],
): Citation[] {
  return citations.filter((c) =>
    retrieved.some(
      (r) => r.materialId === c.materialId && r.chunkIndex === c.chunkIndex,
    ),
  );
}
