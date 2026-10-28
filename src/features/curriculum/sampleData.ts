// Explicitly-identified DEMO data for the public demo. Contains no real school
// documents, teacher records, or protected endpoints.
import type { Activity, Worksheet, Quiz } from "@/lib/schemas";

export const DEMO_CHAPTER = {
  class: 3,
  subject: "Science",
  chapter: "Plants Around Us",
  passages: [
    { page: 12, text: "Leaves are usually green and flat. The thin lines you can see on a leaf are called veins. Veins carry water and food to all parts of the leaf." },
    { page: 13, text: "Some leaves are long and thin, like grass. Others are broad, like a mango leaf. Looking closely at leaves helps us tell plants apart." },
  ],
};

export const DEMO_ANSWER = {
  grounded: true as const,
  answer:
    "Tell the children that the little lines running across a leaf are called veins. " +
    "Just like the tiny tubes in our body carry blood, the veins in a leaf carry water and " +
    "food to every part of the leaf (page 12). You can ask them to hold a leaf up to the light " +
    "to spot the veins.",
  teachingSuggestions: [
    "Hand out real leaves and let children trace the veins with a finger.",
    "Compare a thin grass leaf with a broad mango leaf (page 13).",
  ],
  citations: [
    { materialId: "00000000-0000-0000-0000-000000000000", chunkIndex: 0, page: 12, quote: "The thin lines you can see on a leaf are called veins." },
  ],
};

export const DEMO_ACTIVITY: Activity = {
  title: "Leaf Detective Game",
  grade: 3, subject: "Science", topic: "Plants Around Us",
  activityType: "game",
  learningObjectives: ["Identify veins, shape and edges of leaves", "Sort leaves by observable features"],
  materials: ["5–8 different leaves per group", "Magnifying glass (optional)", "Sorting sheet"],
  durationMinutes: 30, groupSize: "Groups of 4", difficulty: "easy",
  preparation: ["Collect safe, non-thorny leaves beforehand", "Print one sorting sheet per group"],
  steps: [
    "Give each group a set of leaves.",
    "Ask them to find the veins on each leaf.",
    "Sort leaves into 'thin' and 'broad'.",
    "Each group presents one surprising leaf.",
  ],
  teacherInstructions: ["Move between groups and ask 'where are the veins?'", "Keep it playful — they are detectives!"],
  studentRules: ["Handle leaves gently", "Everyone in the group gets a turn"],
  expectedOutcomes: ["Children can point to veins", "Children can group leaves by shape"],
  assessmentChecklist: ["Points to veins correctly", "Sorts leaves with a reason"],
  answerKey: null,
  adaptations: ["For extra support, pre-sort two leaves as examples"],
  safetyNotes: ["Avoid thorny or unknown plants", "Wash hands after the activity"],
  citations: [DEMO_ANSWER.citations[0]],
};

export const DEMO_WORKSHEET: Worksheet = {
  title: "Plants Around Us — Worksheet",
  grade: 3, subject: "Science", chapter: "Plants Around Us",
  learningObjective: "Recognise parts of a leaf",
  questions: [
    { type: "mcq", prompt: "What are the thin lines on a leaf called?", options: ["Roots", "Veins", "Stems", "Seeds"], answer: "Veins", marks: 1 },
    { type: "true_false", prompt: "All leaves are the same shape.", answer: "false", marks: 1 },
    { type: "fill_blank", prompt: "Veins carry water and ______ to the leaf.", answer: "food", marks: 1 },
  ],
  citations: [DEMO_ANSWER.citations[0]],
};

export const DEMO_QUIZ: Quiz = {
  title: "Plants Quick Quiz",
  grade: 3, subject: "Science",
  questions: [
    { type: "mcq", prompt: "Leaves are usually which colour?", options: ["Blue", "Green", "Red", "Black"], answer: "Green", explanation: "Most leaves contain chlorophyll, which is green.", marks: 1 },
    { type: "true_false", prompt: "Veins carry food to the leaf.", answer: "true", marks: 1 },
  ],
  citations: [DEMO_ANSWER.citations[0]],
};
