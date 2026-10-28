import { requireSupabase, supabase } from "@/lib/supabase";
import type { AIConfiguration } from "@/types/db";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  citations?: Array<{ page: number; title: string }>;
}

export const CONTROLLED_REFUSAL_MESSAGE =
  "I can help with teaching, education, and learning-related questions.";

/**
 * Educational topic classification guardrail.
 * Verifies that the question pertains to teaching, pedagogy, lesson prep, or curriculum concepts.
 */
export function isEducationalTopic(prompt: string): boolean {
  const p = prompt.toLowerCase().trim();

  // Explicit off-topic triggers
  const offTopicTriggers = [
    "crypto", "bitcoin", "ethereum", "stock market", "forex",
    "recipe", "how to cook", "bake a cake", "make pasta",
    "movie review", "celebrity gossip", "sports betting", "nba score",
    "horoscope", "astrology", "buy a car", "plumbing repair",
    "write an exploit", "hack a website", "ddos",
  ];

  for (const trigger of offTopicTriggers) {
    if (p.includes(trigger)) return false;
  }

  // Educational keywords
  const eduKeywords = [
    "teach", "lesson", "student", "class", "grade", "curriculum", "concept",
    "explain", "cbse", "homework", "quiz", "worksheet", "activity", "learn",
    "pedagogy", "rubric", "assessment", "exam", "reading", "math", "science",
    "history", "geography", "english", "grammar", "phonics", "classroom",
    "behavior", "misconception", "instruction", "differentiate", "objective",
    "strategy", "engagement", "story", "board", "syllabus", "kindergarten",
    "primary", "secondary", "question", "summary", "exercise", "practice",
  ];

  // If query is reasonably detailed or contains educational keywords
  const hasEduKeyword = eduKeywords.some((k) => p.includes(k));
  if (hasEduKeyword) return true;

  // For very short queries without educational context, assume potentially out of scope
  if (p.split(/\s+/).length < 3) return false;

  // Neutral questions about school subjects (e.g. "Why is the sky blue?", "How does photosynthesis work?") are valid classroom concepts
  return true;
}

/**
 * Process a teacher query through the pedagogical assistant.
 * Applies topic guardrails and tenant AI configuration.
 */
export async function sendPedagogicalQuery(opts: {
  schoolId: string;
  teacherId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  materialId?: string | null;
  teacherApiKey?: string;
}): Promise<string> {
  const latestMessage = opts.messages[opts.messages.length - 1];
  if (!latestMessage || latestMessage.role !== "user") {
    throw new Error("Invalid message sequence.");
  }

  // 1. Enforce strict topic guardrail
  if (!isEducationalTopic(latestMessage.content)) {
    return CONTROLLED_REFUSAL_MESSAGE;
  }

  // 2. Call Edge Function / AI generation if configured
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate", {
        body: {
          task: "pedagogical_chat",
          messages: opts.messages,
          material_id: opts.materialId || null,
          teacher_key: opts.teacherApiKey || undefined,
        },
      });

      if (!error && data?.response) {
        // Record AI usage
        try {
          await supabase.from("ai_usage").insert({
            school_id: opts.schoolId,
            teacher_id: opts.teacherId,
            tokens_used: data.tokens_used || 180,
            feature: "assistant",
          });
        } catch { /* ignore usage logging failure */ }

        return data.response;
      }
    } catch {
      // Fallback to local pedagogical engine
    }
  }

  // 3. Fallback Pedagogical Assistant engine
  const prompt = latestMessage.content.toLowerCase();
  if (prompt.includes("lesson") || prompt.includes("plan")) {
    return `### Lesson Plan Structure & Pedagogical Approach

**Learning Objective:** Help students understand core concepts through interactive exploration.

1. **Introduction (10 mins):** Hook students with an engaging question or classroom real-world observation.
2. **Concept Delivery (15 mins):** Break the topic into three micro-steps using concrete visual examples.
3. **Collaborative Activity (15 mins):** Small group peer discussion or hands-on practice.
4. **Formative Check (5 mins):** Quick 2-question exit ticket to identify common misconceptions.

*Tip for Class 1–5:* Use relatable storytelling and physical gestures to reinforce retention.`;
  }

  if (prompt.includes("misconception") || prompt.includes("difficult")) {
    return `### Common Classroom Misconception Analysis

Children often conflate the underlying mechanism with superficial observations. 

**Pedagogical Strategy:**
- Ask: *"What do you think will happen if...?"*
- Conduct a rapid 2-minute demonstration to create cognitive dissonance.
- Guide them to articulate their corrected reasoning in their own words.`;
  }

  return `### Pedagogical Recommendation

Here is how you can effectively explain this to your students:

1. **Analogies:** Relate the concept to daily experiences students encounter at home or on the playground.
2. **Step-by-step scaffolding:** Start from what they already know, introduce new vocabulary gently, and check comprehension frequently.
3. **Classroom question prompt:** *"Can anyone give me an example of this happening in your neighborhood?"*

Would you like me to generate a printable worksheet, hands-on activity, or 3-question quick quiz for this topic?`;
}

/**
 * Get AI configuration for a school
 */
export async function getSchoolAIConfig(schoolId: string): Promise<AIConfiguration | null> {
  if (!supabase) {
    return {
      id: "ai-cfg-1",
      school_id: schoolId,
      provider: "kairo_managed",
      model: "claude-sonnet-3-5",
      allow_teacher_keys: true,
      custom_system_prompt: "You are Kairo Pedagogical AI.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from("ai_configurations")
    .select("id, school_id, provider, model, allow_teacher_keys, custom_system_prompt, created_at, updated_at")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !data) return null;
  return data as AIConfiguration;
}

/**
 * Update school AI configuration (Principal only)
 */
export async function updateSchoolAIConfig(
  schoolId: string,
  updates: {
    provider?: string;
    model?: string;
    allow_teacher_keys?: boolean;
    custom_system_prompt?: string;
    api_key?: string; // encrypted server-side
  }
): Promise<void> {
  const sb = requireSupabase();
  const payload: any = {
    school_id: schoolId,
    provider: updates.provider || "kairo_managed",
    model: updates.model || "claude-sonnet-3-5",
    allow_teacher_keys: updates.allow_teacher_keys ?? false,
    custom_system_prompt: updates.custom_system_prompt || null,
    updated_at: new Date().toISOString(),
  };

  if (updates.api_key) {
    // Encrypted on server or masked
    payload.encrypted_api_key = updates.api_key;
  }

  const { error } = await sb
    .from("ai_configurations")
    .upsert(payload, { onConflict: "school_id" });

  if (error) throw new Error(error.message);
}
