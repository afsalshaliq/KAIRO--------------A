import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { sendPedagogicalQuery, CONTROLLED_REFUSAL_MESSAGE } from "@/services/aiAssistant";
import { Spinner, useToast } from "@/components/ui";
import { aiAssistantImage } from "@/assets/generated";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

let msgSeq = 0;
function newMessageId(prefix: string): string {
  msgSeq += 1;
  return `${prefix}-${Date.now()}-${msgSeq}`;
}

const SAMPLE_PROMPTS = [
  "How can I introduce fractions using classroom objects to Class 3?",
  "Suggest a 15-minute hands-on science experiment for plant parts.",
  "What is an effective strategy to handle student misconceptions about gravity?",
  "Help me structure a 45-minute lesson plan on photosynthesis.",
];

export default function TeacherAIAssistant() {
  const { profile } = useAuth();
  const { school } = useTenant();
  const toast = useToast();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "assistant",
      content: `Hello ${profile?.full_name || "Teacher"}. I am your KAIRO Pedagogical Assistant for ${school?.name || "your school"}.\n\nI can assist with lesson preparation, classroom explanations, pedagogical strategies, student engagement techniques, and curriculum alignment. What educational concept are we exploring today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (userText?: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || loading || !school || !profile) return;

    const userMsg: Message = {
      id: newMessageId("usr"),
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      const reply = await sendPedagogicalQuery({
        schoolId: school.id,
        teacherId: profile.id,
        messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
      });

      const assistantMsg: Message = {
        id: newMessageId("asst"),
        role: "assistant",
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: newMessageId("asst-err"),
          role: "assistant",
          content: "I encountered an error connecting to the educational model. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast("success", "Copied to clipboard!"),
      () => toast("error", "Unable to copy to clipboard.")
    );
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-3.5">
          <img
            src={aiAssistantImage}
            alt="Pedagogical AI Assistant"
            className="w-12 h-12 rounded-xl object-cover border border-border shadow-xs shrink-0"
          />
          <div>
            <h1 className="text-xl font-extrabold text-fg tracking-tight">Pedagogical AI Assistant</h1>
            <p className="text-xs text-muted">
              Grounded strictly in teaching, lesson prep, and student-learning strategies for {school?.name || "your school"}
            </p>
          </div>
        </div>

        <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Guardrails Active
        </span>
      </div>

      {/* Controlled scope notice */}
      <div className="bg-surface rounded-xl border border-border px-3.5 py-2 text-xs text-muted flex items-center justify-between shadow-xs">
        <span>
          <strong className="text-fg">Controlled Scope:</strong> This assistant handles educational and pedagogical inquiries only. Off-topic queries receive a controlled refusal.
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-2xl bg-surface/40 border border-border">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-muted mb-1 px-1">
              <span className="font-semibold">{m.role === "user" ? "You" : "KAIRO Pedagogical Assistant"}</span>
              <span>·</span>
              <span>{m.timestamp}</span>
            </div>

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-xs relative group ${
                m.role === "user"
                  ? "bg-accent text-white rounded-br-none font-medium"
                  : m.content === CONTROLLED_REFUSAL_MESSAGE
                  ? "bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-none font-medium"
                  : "bg-card border border-border text-fg rounded-bl-none shadow-xs"
              }`}
            >
              {m.content}

              {m.role === "assistant" && (
                <button
                  onClick={() => copyToClipboard(m.content)}
                  className="mt-2 text-[10px] text-muted hover:text-accent font-semibold flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
                  title="Copy response to clipboard"
                >
                  <span>Copy Response</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 text-xs text-muted italic">
            <Spinner label="Formulating pedagogical response…" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
        {SAMPLE_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSend(p)}
            className="rounded-full bg-card hover:bg-surface border border-border px-3.5 py-1.5 text-[11px] text-muted hover:text-fg whitespace-nowrap transition-colors cursor-pointer shadow-xs"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2.5 pt-1"
      >
        <input
          type="text"
          placeholder="Ask a question about lesson prep, classroom strategies, or pedagogical explanations…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="input flex-1 py-3"
          aria-label="Pedagogical prompt input"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="btn-primary text-xs px-5 rounded-xl flex items-center gap-1.5 shrink-0"
        >
          <span>Send</span>
          <span>→</span>
        </button>
      </form>
    </div>
  );
}
