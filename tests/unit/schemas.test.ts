import { describe, it, expect } from "vitest";
import {
  loginSchema, inviteTeacherSchema, classSchema, uploadMetaSchema,
  activitySchema, worksheetSchema, quizSchema, answerSchema,
  schoolCreateSchema, teacherRequestSchema,
  validateCitations, type Citation,
} from "@/lib/schemas";

const MID = "11111111-1111-4111-8111-111111111111"; // valid v4 UUID

describe("auth & form schemas", () => {
  it("accepts a valid login and normalizes email", () => {
    const r = loginSchema.parse({ email: "  TEACHER@Royal.EDU ", password: "supersecret" });
    expect(r.email).toBe("teacher@royal.edu");
  });

  it("rejects short passwords and bad emails", () => {
    expect(loginSchema.safeParse({ email: "x@y.z", password: "123" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "notanemail", password: "longenough" }).success).toBe(false);
  });

  it("invite requires a name", () => {
    expect(inviteTeacherSchema.safeParse({ email: "a@b.co", fullName: "" }).success).toBe(false);
    expect(inviteTeacherSchema.safeParse({ email: "a@b.co", fullName: "Asha" }).success).toBe(true);
  });

  it("class grade is bounded to 1..5", () => {
    expect(classSchema.safeParse({ grade: 3, academicYear: "2025-2026" }).success).toBe(true);
    expect(classSchema.safeParse({ grade: 6, academicYear: "2025-2026" }).success).toBe(false);
    expect(classSchema.safeParse({ grade: 0, academicYear: "2025-2026" }).success).toBe(false);
    expect(classSchema.safeParse({ grade: 3, academicYear: "25-26" }).success).toBe(false);
  });

  it("upload metadata validates uuids and academic year", () => {
    expect(uploadMetaSchema.safeParse({
      title: "Plants", classId: MID, subjectId: MID, academicYear: "2025-2026",
    }).success).toBe(true);
    expect(uploadMetaSchema.safeParse({
      title: "Plants", classId: "nope", subjectId: MID, academicYear: "2025-2026",
    }).success).toBe(false);
  });
});

describe("AI output schemas", () => {
  const baseActivity = {
    title: "Leaf Detective", grade: 3, subject: "Science", topic: "Leaves",
    activityType: "game", learningObjectives: ["Identify leaf veins"], materials: ["leaves"],
    durationMinutes: 30, groupSize: "Groups of 4", difficulty: "easy",
    preparation: [], steps: ["Collect leaves", "Sort them"], teacherInstructions: [],
    studentRules: [], expectedOutcomes: ["Children classify leaves"], assessmentChecklist: [],
    answerKey: null, adaptations: [], safetyNotes: [], citations: [],
  };

  it("accepts a well-formed activity", () => {
    expect(activitySchema.safeParse(baseActivity).success).toBe(true);
  });

  it("rejects an activity with an invalid type or grade", () => {
    expect(activitySchema.safeParse({ ...baseActivity, activityType: "homework" }).success).toBe(false);
    expect(activitySchema.safeParse({ ...baseActivity, grade: 7 }).success).toBe(false);
  });

  it("rejects an activity with no steps or no objectives", () => {
    expect(activitySchema.safeParse({ ...baseActivity, steps: [] }).success).toBe(false);
    expect(activitySchema.safeParse({ ...baseActivity, learningObjectives: [] }).success).toBe(false);
  });

  it("worksheet MCQ answer must be one of the options", () => {
    const bad = worksheetSchema.safeParse({
      title: "WS", grade: 3, subject: "Science",
      questions: [{ type: "mcq", prompt: "Pick", options: ["A", "B"], answer: "C", marks: 1 }],
    });
    expect(bad.success).toBe(false);

    const good = worksheetSchema.safeParse({
      title: "WS", grade: 3, subject: "Science",
      questions: [{ type: "mcq", prompt: "Pick", options: ["A", "B"], answer: "B", marks: 1 }],
    });
    expect(good.success).toBe(true);
  });

  it("worksheet MCQ requires at least 2 options", () => {
    const r = worksheetSchema.safeParse({
      title: "WS", grade: 3, subject: "Science",
      questions: [{ type: "mcq", prompt: "Pick", options: ["only"], answer: "only", marks: 1 }],
    });
    expect(r.success).toBe(false);
  });

  it("quiz true/false answer must be 'true' or 'false'", () => {
    const bad = quizSchema.safeParse({
      title: "Q", grade: 3, subject: "Science",
      questions: [{ type: "true_false", prompt: "Sky is green?", answer: "maybe", marks: 1 }],
    });
    expect(bad.success).toBe(false);

    const good = quizSchema.safeParse({
      title: "Q", grade: 3, subject: "Science",
      questions: [{ type: "true_false", prompt: "Sky is blue?", answer: "true", marks: 1 }],
    });
    expect(good.success).toBe(true);
  });

  it("answer schema fills array defaults", () => {
    const r = answerSchema.parse({ grounded: true, answer: "Because chlorophyll." });
    expect(r.citations).toEqual([]);
    expect(r.teachingSuggestions).toEqual([]);
  });
});

describe("citation validation (anti-hallucination)", () => {
  const retrieved = [
    { materialId: MID, chunkIndex: 0, page: 5 },
    { materialId: MID, chunkIndex: 2, page: 7 },
  ];

  it("keeps citations that point at retrieved chunks", () => {
    const cites: Citation[] = [{ materialId: MID, chunkIndex: 0, page: 5, quote: "leaf veins" }];
    expect(validateCitations(cites, retrieved)).toHaveLength(1);
  });

  it("drops citations the model invented (not in retrieved context)", () => {
    const cites: Citation[] = [
      { materialId: MID, chunkIndex: 99, page: 42, quote: "made up" },
      { materialId: "22222222-2222-4222-8222-222222222222", chunkIndex: 0, page: 1, quote: "wrong doc" },
    ];
    expect(validateCitations(cites, retrieved)).toHaveLength(0);
  });
});

describe("Multi-tenant schemas & validators", () => {
  it("validates school creation", () => {
    expect(schoolCreateSchema.safeParse({ name: "Royal School", slug: "royal" }).success).toBe(true);
    expect(schoolCreateSchema.safeParse({ name: "R", slug: "royal" }).success).toBe(false);
    expect(schoolCreateSchema.safeParse({ name: "Royal", slug: "Royal School!" }).success).toBe(false);
  });

  it("validates teacher request schema", () => {
    expect(teacherRequestSchema.safeParse({
      type: "leave",
      title: "Medical Leave",
      details: { date: "2026-10-20" },
    }).success).toBe(true);

    expect(teacherRequestSchema.safeParse({
      type: "invalid_type",
      title: "Medical",
      details: {},
    }).success).toBe(false);
  });

  it("classifies educational topics vs off-topic queries", async () => {
    const { isEducationalTopic } = await import("@/services/aiAssistant");
    expect(isEducationalTopic("How do I teach photosynthesis to grade 3 students?")).toBe(true);
    expect(isEducationalTopic("Can you suggest a collaborative classroom math game?")).toBe(true);
    expect(isEducationalTopic("What is the best recipe to bake a chocolate cake?")).toBe(false);
    expect(isEducationalTopic("Which crypto coins will pump in 2026?")).toBe(false);
  });

  it("validates bulk teacher import CSV", async () => {
    const { validateTeacherImportCSV } = await import("@/services/bulkImport");
    const validCsv = `Email,Full Name,Department,Phone\nteacher1@royal.edu,Asha Patel,Science,+1234567890\nteacher2@royal.edu,Rohan Sharma,Math,+1234567891`;
    const res = await validateTeacherImportCSV(validCsv);
    expect(res.validRows).toHaveLength(2);
    expect(res.invalidRows).toHaveLength(0);

    const duplicateCsv = `Email,Full Name\nteacher1@royal.edu,Asha Patel\nteacher1@royal.edu,Duplicate Asha`;
    const dupRes = await validateTeacherImportCSV(duplicateCsv);
    expect(dupRes.duplicates.length).toBeGreaterThan(0);

    const userPastedCsv = `Email,Full Name,Department,Phone arun.kumar@example.com,Arun Kumar,Science,9876543210 priya.sharma@example.com,Priya Sharma,Languages,9876543211 rahul.verma@example.com,Rahul Verma,Science,9876543212 sneha.reddy@example.com,Sneha Reddy,Science,9876543213 vijay.rao@example.com,Vijay Rao,Computer Studies,9876543214 ananya.iyer@example.com,Ananya Iyer,Science,9876543215 karthik.menon@example.com,Karthik Menon,Social Studies,9876543216 meera.patel@example.com,Meera Patel,Social Studies,9876543217`;
    const userRes = await validateTeacherImportCSV(userPastedCsv);
    expect(userRes.validRows).toHaveLength(8);
    expect(userRes.invalidRows).toHaveLength(0);
    expect(userRes.validRows[0].email).toBe("arun.kumar@example.com");
    expect(userRes.validRows[0].fullName).toBe("Arun Kumar");
    expect(userRes.validRows[0].department).toBe("Science");
    expect(userRes.validRows[0].phone).toBe("9876543210");
  });
});
