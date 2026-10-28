import { requireSupabase } from "@/lib/supabase";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from "@/lib/schemas";
import type { Material } from "@/types/db";
import { recordKairoMove } from "./audit";

export function validateFile(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number]))
    return `Unsupported type "${file.type || "unknown"}". Allowed: PDF, DOCX, PPTX, TXT.`;
  if (file.size > MAX_UPLOAD_BYTES)
    return `File is ${(file.size / 1e6).toFixed(1)} MB; max is ${MAX_UPLOAD_BYTES / 1e6} MB.`;
  if (file.size === 0) return "File is empty.";
  return null;
}

export async function listMaterials(): Promise<Material[]> {
  const { data, error } = await requireSupabase()
    .from("curriculum_materials").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Material[];
}

/** Upload to private storage, create the material row (status=uploaded), enqueue processing. */
export async function uploadMaterial(file: File, meta: {
  title: string; classId: string; sectionId: string | null; subjectId: string;
  chapter: string; academicYear: string;
}): Promise<Material> {
  const err = validateFile(file);
  if (err) throw new Error(err);
  const sb = requireSupabase();
  const uid = (await sb.auth.getUser()).data.user?.id;
  if (!uid) throw new Error("You must be signed in to upload.");
  const id = crypto.randomUUID();
  const objectPath = `${id}/${file.name}`;

  const up = await sb.storage.from("curriculum").upload(objectPath, file, {
    contentType: file.type, upsert: false,
  });
  if (up.error) throw up.error;

  const { data, error } = await sb.from("curriculum_materials").insert({
    id,
    title: meta.title,
    uploaded_by: uid,
    class_id: meta.classId,
    section_id: meta.sectionId,
    subject_id: meta.subjectId,
    chapter: meta.chapter,
    academic_year: meta.academicYear,
    file_path: objectPath,
    mime_type: file.type,
    byte_size: file.size,
    status: "uploaded",
    is_published: false,
  }).select().single();
  if (error) throw error;

  // Trigger async processing (extraction + chunking + embeddings) server-side.
  await sb.functions.invoke("process-document", { body: { materialId: id } }).catch(() => {});
  recordKairoMove({
    action: "material.upload",
    target: meta.title,
    actorId: uid,
    meta: { materialId: id, chapter: meta.chapter, classId: meta.classId, byte_size: file.size },
  });
  return data as Material;
}

export async function retryProcessing(materialId: string): Promise<void> {
  const sb = requireSupabase();
  await sb.from("curriculum_materials").update({ status: "processing", error_message: null }).eq("id", materialId);
  const { error } = await sb.functions.invoke("process-document", { body: { materialId } });
  if (error) throw new Error(error.message);
  recordKairoMove({
    action: "material.process",
    target: materialId,
    meta: { status: "retrying" },
  });
}

export async function setPublished(materialId: string, published: boolean): Promise<void> {
  const { error } = await requireSupabase()
    .from("curriculum_materials").update({ is_published: published }).eq("id", materialId);
  if (error) throw error;
  recordKairoMove({
    action: published ? "material.publish" : "material.unpublish",
    target: materialId,
  });
}

export async function archiveMaterial(materialId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from("curriculum_materials").update({ status: "archived", is_published: false }).eq("id", materialId);
  if (error) throw error;
  recordKairoMove({
    action: "material.archive",
    target: materialId,
  });
}

/** Signed download URL — authorized by storage RLS, so unauthorized files 403. */
export async function signedUrl(filePath: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage.from("curriculum").createSignedUrl(filePath, 300);
  if (error) throw error;
  return data.signedUrl;
}
