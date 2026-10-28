#!/usr/bin/env node
/**
 * DEV-ONLY seed: create fixed test logins so you can click through both portals.
 *
 *   super@royalschool.test     role=super_admin  (full control, incl. principals)
 *   admin@royalschool.test     role=admin        (principal)
 *   teacher@royalschool.test   role=teacher      (+ one live assignment: Class 1 / A / English)
 *
 * Both get a KNOWN password (unlike provision-first-admin.mjs, which never sets
 * one) because these are throwaway test accounts for a development project.
 *
 * ⚠️  NEVER run this against a production Supabase project. It is gated behind
 *     ALLOW_DEV_SEED=yes precisely so it cannot run by accident.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="service-role-key"
 *   $env:ALLOW_DEV_SEED="yes"
 *   # optional: $env:DEV_SEED_PASSWORD="YourDevPassword1!"
 *   node scripts/seed-dev-users.mjs
 *
 * Usage (bash):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ALLOW_DEV_SEED=yes \
 *     node scripts/seed-dev-users.mjs
 */
import { createClient } from "@supabase/supabase-js";

function need(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v.trim();
}

if ((process.env.ALLOW_DEV_SEED || "").toLowerCase() !== "yes") {
  console.error(
    "Refusing to run: set ALLOW_DEV_SEED=yes to confirm this is a DEV project.\n" +
      "This creates test accounts with known passwords and must never touch production.",
  );
  process.exit(1);
}

const url = need("SUPABASE_URL");
const serviceKey = need("SUPABASE_SERVICE_ROLE_KEY");
const DEV_PASSWORD = (process.env.DEV_SEED_PASSWORD || "KairoDev!2026").trim();
const ACADEMIC_YEAR = process.env.DEV_SEED_YEAR || "2025-2026";

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const USERS = [
  { email: "super@royalschool.test", full_name: "Dev Super Admin", role: "super_admin" },
  { email: "admin@royalschool.test", full_name: "Dev Admin", role: "admin" },
  { email: "teacher@royalschool.test", full_name: "Dev Teacher", role: "teacher" },
];

async function findUserByEmail(addr) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === addr);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function upsertUser({ email, full_name, role }) {
  email = email.toLowerCase();
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name, role },
    });
    if (error) throw error;
    user = data.user;
    console.log(`  created auth user  ${email}`);
  } else {
    // Reset the password so the known dev password always works.
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: DEV_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    console.log(`  reset password for ${email}`);
  }

  // Authoritative role/status live in profiles (never trusted from the client).
  const { error: pErr } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email, full_name, role, status: "active" }, { onConflict: "id" });
  if (pErr) throw pErr;
  return user;
}

async function assignTeacher(teacherId) {
  // Give the teacher one live assignment so the teacher portal isn't empty:
  // Class grade 1 / Section A / English (all seeded by migration 0004).
  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("grade", 1)
    .eq("academic_year", ACADEMIC_YEAR)
    .maybeSingle();
  if (!cls) {
    console.log("  (skipped assignment — no Class 1 found; run migration 0004 first)");
    return;
  }
  const { data: section } = await supabase
    .from("sections")
    .select("id")
    .eq("class_id", cls.id)
    .eq("name", "A")
    .maybeSingle();
  const { data: subject } = await supabase
    .from("subjects")
    .select("id")
    .eq("name", "English")
    .maybeSingle();
  if (!section || !subject) {
    console.log("  (skipped assignment — Section A or English subject missing)");
    return;
  }
  const { error } = await supabase.from("teacher_assignments").upsert(
    {
      teacher_id: teacherId,
      class_id: cls.id,
      section_id: section.id,
      subject_id: subject.id,
      is_revoked: false,
    },
    { onConflict: "teacher_id,section_id,subject_id" },
  );
  if (error) throw error;
  console.log("  assigned teacher -> Class 1 / A / English");
}

async function main() {
  console.log(`Seeding DEV test users into ${url}\n`);
  let teacherId = null;
  for (const u of USERS) {
    console.log(u.email);
    const user = await upsertUser(u);
    if (u.role === "teacher") teacherId = user.id;
  }
  if (teacherId) await assignTeacher(teacherId);

  console.log("\n✅ Dev test accounts ready:\n");
  console.log(`   super@royalschool.test     ${DEV_PASSWORD}`);
  console.log(`   admin@royalschool.test     ${DEV_PASSWORD}`);
  console.log(`   teacher@royalschool.test   ${DEV_PASSWORD}`);
  console.log(
    "\nThese are INSECURE test accounts. Do not reuse this project or password for anything real.\n" +
      "To let the teacher generate AI content, upload & publish a material for Class 1 / English in the admin portal.\n",
  );
}

main().catch((e) => {
  console.error("\n❌ Dev seed failed:", e.message || e);
  process.exit(1);
});
