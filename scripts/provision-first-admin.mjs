#!/usr/bin/env node
/**
 * Securely provision the FIRST admin account.
 *
 * - Never hardcodes or prints a password.
 * - Creates (or promotes) the admin user with the service role, then issues a
 *   one-time recovery link so the admin sets their OWN password.
 * - Reads secrets from the environment only. Run it from a trusted machine, not
 *   the browser or CI logs.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="service-role-key"
 *   $env:FIRST_ADMIN_EMAIL="principal@royalschool.edu"
 *   $env:FIRST_ADMIN_NAME="Principal"
 *   node scripts/provision-first-admin.mjs
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

const url = need("SUPABASE_URL");
const serviceKey = need("SUPABASE_SERVICE_ROLE_KEY");
const email = need("FIRST_ADMIN_EMAIL").toLowerCase();
const fullName = (process.env.FIRST_ADMIN_NAME || "Administrator").trim();
const redirectTo = process.env.ADMIN_SETUP_REDIRECT_URL || undefined;

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function findUserByEmail(addr) {
  // Page through admin.listUsers (no direct get-by-email in the API).
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === addr);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  console.log(`Provisioning first admin: ${email}`);

  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "admin" },
    });
    if (error) throw error;
    user = data.user;
    console.log("Created auth user.");
  } else {
    console.log("Auth user already exists; promoting to admin.");
  }

  // Authoritative role/status live in profiles. Upsert with service role.
  const { error: pErr } = await supabase.from("profiles").upsert(
    { id: user.id, email, full_name: fullName, role: "admin", status: "active" },
    { onConflict: "id" },
  );
  if (pErr) throw pErr;
  console.log("Profile set to role=admin, status=active.");

  // Issue a recovery link so the admin chooses their own password.
  const { data: link, error: lErr } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (lErr) throw lErr;

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "admin.provisioned",
    target: email,
    meta: { via: "provision-first-admin.mjs" },
  });

  const action = link?.properties?.action_link;
  console.log("\n✅ Admin ready. Open this one-time link to set the password:\n");
  console.log(action || "(No link returned — use the app's 'Forgot password' flow for this email.)");
  console.log("\nThis link is a secret. Share it only with the admin, over a secure channel.\n");
}

main().catch((e) => {
  console.error("\n❌ Provisioning failed:", e.message || e);
  process.exit(1);
});
