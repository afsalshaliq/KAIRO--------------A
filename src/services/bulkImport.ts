import { requireSupabase, supabase } from "@/lib/supabase";

export interface ImportTeacherRow {
  email: string;
  fullName: string;
  department?: string;
  phone?: string;
  degree?: string;
}

export interface ImportValidationResult {
  validRows: ImportTeacherRow[];
  invalidRows: Array<{ row: number; data: Record<string, string>; errors: string[] }>;
  duplicates: Array<{ row: number; email: string }>;
  totalCount: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse and validate CSV text content for Bulk Teacher Import.
 * Strictly verifies column headers, data formats, and flags existing duplicates.
 */
export async function validateTeacherImportCSV(
  csvText: string,
  existingEmails: string[] = []
): Promise<ImportValidationResult> {
  let normalized = csvText.trim();
  // If the CSV string was pasted on a single line without newlines, recover row boundaries before each email
  if (!normalized.includes("\n") && !normalized.includes("\r")) {
    normalized = normalized.replace(/\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "\n$1");
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV file must contain at least a header row and one teacher record.");
  }

  // Parse header
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  const emailIdx = headers.findIndex((h) => h.includes("email"));
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const deptIdx = headers.findIndex((h) => h.includes("dept") || h.includes("department"));
  const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile"));
  const degreeIdx = headers.findIndex((h) => h.includes("degree") || h.includes("qualification"));

  if (emailIdx === -1 || nameIdx === -1) {
    throw new Error("CSV must include columns for 'Email' and 'Full Name' (or 'Name').");
  }

  const validRows: ImportTeacherRow[] = [];
  const invalidRows: ImportValidationResult["invalidRows"] = [];
  const duplicates: ImportValidationResult["duplicates"] = [];
  const seenInBatch = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = rawLine.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const rowNum = i + 1;

    const email = (cols[emailIdx] || "").toLowerCase().trim();
    const fullName = (cols[nameIdx] || "").trim();
    const department = deptIdx !== -1 ? cols[deptIdx] || "General" : "General";
    const phone = phoneIdx !== -1 ? cols[phoneIdx] || "" : "";
    const degree = degreeIdx !== -1 ? cols[degreeIdx] || "" : "";

    const errors: string[] = [];
    if (!email) {
      errors.push("Missing email address");
    } else if (!EMAIL_REGEX.test(email)) {
      errors.push(`Invalid email format: "${email}"`);
    }

    if (!fullName) {
      errors.push("Missing teacher name");
    }

    if (seenInBatch.has(email) || existingEmails.map((e) => e.toLowerCase()).includes(email)) {
      duplicates.push({ row: rowNum, email });
      errors.push(`Duplicate email: "${email}" already exists`);
    }

    if (errors.length > 0) {
      invalidRows.push({
        row: rowNum,
        data: { email, fullName, department, phone, degree },
        errors,
      });
    } else {
      seenInBatch.add(email);
      validRows.push({ email, fullName, department, phone, degree });
    }
  }

  return {
    validRows,
    invalidRows,
    duplicates,
    totalCount: lines.length - 1,
  };
}

/**
 * Execute bulk creation of validated teacher accounts.
 */
export async function executeTeacherImport(opts: {
  schoolId: string;
  actorsId: string;
  teachers: ImportTeacherRow[];
  defaultPassword?: string;
}): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;

  if (!supabase) {
    // In mock mode, pretend to create
    return { created: opts.teachers.length, errors: [] };
  }

  const sb = requireSupabase();

  for (const t of opts.teachers) {
    try {
      const { data, error } = await sb.functions.invoke("admin", {
        body: {
          action: "invite_teacher",
          email: t.email,
          fullName: t.fullName,
          department: t.department,
          schoolId: opts.schoolId,
          password: opts.defaultPassword,
        },
      });

      if (error || data?.error) {
        errors.push(`Failed for ${t.email}: ${error?.message || data?.error}`);
      } else {
        created++;
      }
    } catch (err) {
      errors.push(`Failed for ${t.email}: ${(err as Error).message}`);
    }
  }

  // Audit bulk import operation
  try {
    await sb.from("audit_logs").insert({
      school_id: opts.schoolId,
      actor_id: opts.actorsId,
      action: "teacher.bulk_import",
      target: opts.schoolId,
      meta: {
        total: opts.teachers.length,
        created,
        failures: errors.length,
      },
    });
  } catch {
    // Non-blocking audit log
  }

  return { created, errors };
}
