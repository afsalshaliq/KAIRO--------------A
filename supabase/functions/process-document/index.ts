// process-document — extract text from an uploaded curriculum file, chunk it,
// embed (when a provider is configured), and store chunks. Updates the material
// status and processing job. Admin-only trigger; the material is only made
// retrievable once status = 'ready'.
import { json, preflight } from "../_shared/cors.ts";
import { HttpError, requireAdmin, serviceClient } from "../_shared/auth.ts";
import { providerConfig } from "../_shared/ai.ts";

const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let svc;
  try {
    svc = serviceClient();
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  let materialId = "";
  try {
    await requireAdmin(req, svc);
    const body = await req.json().catch(() => ({}));
    materialId = String(body.materialId ?? "");
    if (!materialId) throw new HttpError(400, "materialId is required.");

    const { data: material, error: mErr } = await svc
      .from("curriculum_materials")
      .select("id,file_path,mime_type,title")
      .eq("id", materialId)
      .single();
    if (mErr || !material) throw new HttpError(404, "Material not found.");

    await svc.from("curriculum_materials")
      .update({ status: "processing", error_message: null }).eq("id", materialId);
    const { data: job } = await svc.from("document_processing_jobs")
      .insert({ material_id: materialId, status: "processing", attempts: 1 })
      .select("id").single();

    // 1) Download from private storage.
    const dl = await svc.storage.from("curriculum").download(material.file_path);
    if (dl.error || !dl.data) throw new HttpError(500, `Download failed: ${dl.error?.message}`);
    const bytes = new Uint8Array(await dl.data.arrayBuffer());

    // 2) Extract text (best-effort, format-aware).
    const text = await extractText(bytes, material.mime_type);
    if (!text.trim()) {
      throw new HttpError(
        422,
        "No extractable text found. For scanned PDFs, upload a text-based copy.",
      );
    }

    // 3) Chunk.
    const chunks = chunkText(text);

    // 4) Embed when a provider is configured (optional; retrieval also works lexically).
    const cfg = providerConfig();
    let embeddings: (number[] | null)[] = chunks.map(() => null);
    if (cfg && Deno.env.get("EMBEDDING_MODEL")) {
      embeddings = await embedAll(chunks, cfg).catch(() => chunks.map(() => null));
    }

    // 5) Replace chunks atomically-ish.
    await svc.from("material_chunks").delete().eq("material_id", materialId);
    const rows = chunks.map((content, i) => ({
      material_id: materialId,
      chunk_index: i,
      content,
      page_ref: null,
      embedding: embeddings[i],
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await svc.from("material_chunks").insert(rows.slice(i, i + 500));
      if (error) throw new HttpError(500, `Chunk insert failed: ${error.message}`);
    }

    await svc.from("curriculum_materials")
      .update({ status: "ready", error_message: null }).eq("id", materialId);
    if (job?.id) {
      await svc.from("document_processing_jobs").update({ status: "done" }).eq("id", job.id);
    }

    return json({ ok: true, chunks: rows.length, embedded: !!(cfg && Deno.env.get("EMBEDDING_MODEL")) });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = (e as Error).message;
    if (materialId) {
      await svc.from("curriculum_materials")
        .update({ status: "failed", error_message: message }).eq("id", materialId).catch(() => {});
      await svc.from("document_processing_jobs")
        .update({ status: "failed", error: message })
        .eq("material_id", materialId).eq("status", "processing").catch(() => {});
    }
    return json({ error: message }, status);
  }
});

async function extractText(bytes: Uint8Array, mime: string): Promise<string> {
  if (mime === "text/plain") {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return await extractOoxml(bytes, mime);
  }
  if (mime === "application/pdf") {
    return extractPdfText(bytes);
  }
  // Fallback: decode as UTF-8 and keep printable runs.
  return cleanup(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
}

// DOCX/PPTX are zip archives of XML. Unzip the relevant parts and strip tags.
async function extractOoxml(bytes: Uint8Array, mime: string): Promise<string> {
  const { unzipSync } = await import("https://esm.sh/fflate@0.8.2");
  const files = unzipSync(bytes);
  const isDocx = mime.includes("wordprocessingml");
  const wanted = Object.keys(files).filter((name) =>
    isDocx
      ? name === "word/document.xml" ||
        (name.startsWith("word/") && name.endsWith(".xml") && /header|footer/.test(name))
      : name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
  );
  const dec = new TextDecoder();
  const parts: string[] = [];
  for (const name of wanted.sort()) {
    const xml = dec.decode(files[name]);
    // Insert spaces at paragraph/line boundaries before stripping tags.
    const spaced = xml
      .replace(/<\/w:p>|<\/a:p>|<w:br\/?>|<a:br\/?>/g, "\n")
      .replace(/<[^>]+>/g, " ");
    parts.push(decodeEntities(spaced));
  }
  return cleanup(parts.join("\n"));
}

// Minimal PDF text extraction: pull text from content streams' Tj/TJ operators.
function extractPdfText(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const out: string[] = [];
  // ( ... ) Tj   and   [ (..) (..) ] TJ
  const tjRe = /\((?:\\.|[^\\()])*\)\s*Tj/g;
  const arrRe = /\[((?:[^\][]|\\.)*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = tjRe.exec(raw))) out.push(unescapePdf(m[0].replace(/\s*Tj$/, "")));
  while ((m = arrRe.exec(raw))) {
    const inner = m[1];
    const strRe = /\((?:\\.|[^\\()])*\)/g;
    let s: RegExpExecArray | null;
    const line: string[] = [];
    while ((s = strRe.exec(inner))) line.push(unescapePdf(s[0]));
    out.push(line.join(""));
  }
  return cleanup(out.join("\n"));
}

function unescapePdf(lit: string): string {
  return lit
    .replace(/^\(/, "").replace(/\)$/, "")
    .replace(/\\n/g, "\n").replace(/\\r/g, "\n").replace(/\\t/g, " ")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function cleanup(s: string): string {
  return s.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function chunkText(text: string): string[] {
  const clean = cleanup(text);
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + CHUNK_CHARS, clean.length);
    if (end < clean.length) {
      const nextBreak = clean.lastIndexOf("\n", end);
      const nextSpace = clean.lastIndexOf(" ", end);
      const soft = Math.max(nextBreak, nextSpace);
      if (soft > i + CHUNK_CHARS * 0.6) end = soft;
    }
    const piece = clean.slice(i, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    i = end - CHUNK_OVERLAP;
    if (i < 0) i = 0;
  }
  return chunks.length ? chunks : [clean];
}

async function embedAll(
  chunks: string[],
  cfg: { apiKey: string; baseUrl: string },
): Promise<(number[] | null)[]> {
  const model = Deno.env.get("EMBEDDING_MODEL")!;
  const base = (Deno.env.get("EMBEDDING_BASE_URL") ?? cfg.baseUrl).replace(/\/$/, "");
  const key = Deno.env.get("EMBEDDING_API_KEY") ?? cfg.apiKey;
  const out: (number[] | null)[] = [];
  for (let i = 0; i < chunks.length; i += 64) {
    const batch = chunks.slice(i, i + 64);
    const res = await fetch(`${base}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, input: batch }),
    });
    if (!res.ok) throw new Error(`Embedding provider ${res.status}`);
    const data = await res.json();
    for (const d of data.data ?? []) out.push(d.embedding ?? null);
  }
  return out.length === chunks.length ? out : chunks.map(() => null);
}
