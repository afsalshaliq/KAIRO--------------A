// admin — privileged operations. Runs with the service role, but EVERY request
// re-verifies the caller is an active admin (client role claims are not trusted).
import { json, preflight } from "../_shared/cors.ts";
import {
  audit,
  HttpError,
  requireAdmin,
  serviceClient,
} from "../_shared/auth.ts";

const STATUSES = new Set(["active", "suspended", "deactivated"]);
const ROLES = new Set(["super_admin", "admin", "principal", "teacher_admin", "teacher"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let svc;
  try {
    svc = serviceClient();
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }

  try {
    const admin = await requireAdmin(req, svc);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    switch (action) {
      case "create_user": {
        const email = String(body.email ?? "").trim().toLowerCase();
        const fullName = String(body.fullName ?? "").trim();
        const role = String(body.role ?? "teacher").trim();
        const schoolId = body.schoolId ? String(body.schoolId).trim() : null;
        const password = body.password ? String(body.password) : undefined;
        const department = body.department ? String(body.department).trim() : "General";
        const phone = body.phone ? String(body.phone).trim() : "";

        // 1. Validation
        if (!EMAIL_RE.test(email)) {
          throw new HttpError(400, "A valid email address is required.");
        }
        if (!fullName) {
          throw new HttpError(400, "Full name is required.");
        }
        if (!ROLES.has(role)) {
          throw new HttpError(400, `Invalid role: ${role}.`);
        }
        if (password && password.length < 8) {
          throw new HttpError(400, "Password must be at least 8 characters long.");
        }

        // 2. Authorization check
        // Elevated roles (super_admin, admin, principal) require super_admin caller.
        // Teacher/teacher_admin can be created by super_admin or principal of the same school.
        if (role === "super_admin" || role === "admin" || role === "principal") {
          if (admin.role !== "super_admin") {
            throw new HttpError(403, "Only Super Administrators can provision administrative accounts.");
          }
        } else {
          // teacher or teacher_admin
          if (admin.role !== "super_admin") {
            // principal or admin
            if (!admin.school_id || admin.school_id !== schoolId) {
              throw new HttpError(403, "School administrators can only provision users for their own school.");
            }
          }
        }

        // Enforce school_id constraints:
        // super_admin accounts have schoolId = null
        const targetSchoolId = role === "super_admin" ? null : schoolId;

        // If a schoolId is specified, verify that the school exists
        if (targetSchoolId) {
          const { data: sch } = await svc.from("schools").select("id").eq("id", targetSchoolId).maybeSingle();
          if (!sch) {
            throw new HttpError(400, "Specified school tenant does not exist.");
          }
        }

        // 3. Existing account check (no duplicate profiles)
        const { data: existingProfile } = await svc
          .from("profiles")
          .select("id, email, role")
          .eq("email", email)
          .maybeSingle();

        if (existingProfile) {
          throw new HttpError(409, `An account with email "${email}" already exists.`);
        }

        // 4. Create Auth user via Supabase Auth Admin API
        const createAuthParams: Record<string, unknown> = {
          email,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            role,
            school_id: targetSchoolId,
            department,
          },
        };
        if (password) {
          createAuthParams.password = password;
        }

        const { data: authCreated, error: authErr } = await svc.auth.admin.createUser(createAuthParams);
        if (authErr) {
          if (authErr.message?.toLowerCase().includes("already registered") || authErr.message?.toLowerCase().includes("duplicate")) {
            throw new HttpError(409, `An account with email "${email}" already exists in Auth.`);
          }
          throw new HttpError(400, authErr.message);
        }

        const userId = authCreated.user.id;

        // 5. Create or upsert the corresponding profiles row with actual Auth UUID
        const { data: newProfile, error: profErr } = await svc
          .from("profiles")
          .upsert(
            {
              id: userId,
              email,
              full_name: fullName,
              role,
              status: "active",
              school_id: targetSchoolId,
              department,
              phone,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )
          .select("*")
          .single();

        if (profErr) {
          throw new HttpError(500, `Profile provisioning failed: ${profErr.message}`);
        }

        // 6. Record audit event
        await audit(svc, admin.id, "user.create", newProfile.id, {
          email,
          role,
          school_id: targetSchoolId,
          creator_role: admin.role,
        });

        return json({ ok: true, user: newProfile });
      }

      case "invite_teacher": {
        const email = String(body.email ?? "").trim().toLowerCase();
        const fullName = String(body.fullName ?? "").trim();
        if (!EMAIL_RE.test(email)) throw new HttpError(400, "A valid email is required.");
        if (!fullName) throw new HttpError(400, "Teacher name is required.");

        const schoolId = body.schoolId ? String(body.schoolId).trim() : admin.school_id;
        const department = body.department ? String(body.department).trim() : "General";

        let passwordToSet = body.password ? String(body.password).trim() : "";
        if (!passwordToSet) {
          let schoolSlug = "";
          if (schoolId) {
            const { data: schoolRow } = await svc
              .from("schools")
              .select("name, slug")
              .eq("id", schoolId)
              .maybeSingle();
            schoolSlug = schoolRow?.slug || schoolRow?.name?.toLowerCase().replace(/\s+/g, "") || "";
          }
          if (!schoolSlug) schoolSlug = "school";
          passwordToSet = `teacher@${schoolSlug}`;
        }

        let userId: string;
        const { data: created, error: createErr } = await svc.auth.admin.createUser({
          email,
          password: passwordToSet,
          email_confirm: true,
          user_metadata: { full_name: fullName, role: "teacher", school_id: schoolId, department },
        });

        if (createErr) {
          if (createErr.message?.toLowerCase().includes("already registered") || createErr.message?.toLowerCase().includes("duplicate")) {
            const { data: listData } = await svc.auth.admin.listUsers();
            const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email);
            if (existing) {
              await svc.auth.admin.updateUserById(existing.id, {
                password: passwordToSet,
                email_confirm: true,
                user_metadata: { full_name: fullName, role: "teacher", school_id: schoolId, department },
              });
              userId = existing.id;
            } else {
              throw new HttpError(400, createErr.message);
            }
          } else {
            throw new HttpError(400, createErr.message);
          }
        } else {
          userId = created.user.id;
        }

        await svc.from("profiles").upsert(
          {
            id: userId,
            email,
            full_name: fullName,
            role: "teacher",
            status: "active",
            school_id: schoolId,
            department,
          },
          { onConflict: "id" },
        );
        await svc.from("invitations").insert({
          email,
          full_name: fullName,
          role: "teacher",
          token_hash: "sent-via-supabase-auth",
          expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
          created_by: admin.id,
        });
        await audit(svc, admin.id, "teacher.invite", email, { fullName, school_id: schoolId }, schoolId);
        return json({ ok: true, invited: email });
      }

      case "resend_invite": {
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!EMAIL_RE.test(email)) throw new HttpError(400, "A valid email is required.");
        const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") ?? undefined;
        const { error } = await svc.auth.admin.inviteUserByEmail(email, { redirectTo });
        if (error) throw new HttpError(400, error.message);
        await audit(svc, admin.id, "teacher.resend_invite", email, { school_id: admin.school_id }, admin.school_id);
        return json({ ok: true });
      }

      case "set_status": {
        const targetId = String(body.teacherId ?? body.userId ?? "");
        const status = String(body.status ?? "");
        if (!STATUSES.has(status)) throw new HttpError(400, "Invalid status.");
        const { data: target } = await svc
          .from("profiles").select("id,role").eq("id", targetId).single();
        if (!target) throw new HttpError(404, "Account not found.");

        const isSuper = admin.role === "super_admin";
        // Principals may only change teachers. Super admins may change anyone
        // but themselves (guards against locking out the last super admin).
        if (!isSuper && target.role !== "teacher" && target.role !== "teacher_admin") {
          throw new HttpError(403, "Only teacher and teacher-admin accounts can be changed here.");
        }
        if (isSuper && target.id === admin.id) {
          throw new HttpError(400, "You cannot change your own status.");
        }

        const { error } = await svc.from("profiles").update({ status }).eq("id", targetId);
        if (error) throw new HttpError(400, error.message);
        // Revoke refresh tokens so a suspended/deactivated account loses access immediately.
        if (status !== "active") {
          await svc.auth.admin.signOut(targetId, "global").catch(() => {});
        }
        await audit(svc, admin.id, "account.set_status", targetId, { status, role: target.role, school_id: admin.school_id }, admin.school_id);
        return json({ ok: true });
      }

      case "invite_admin": {
        if (admin.role !== "super_admin") {
          throw new HttpError(403, "Super administrator access required.");
        }
        const email = String(body.email ?? "").trim().toLowerCase();
        const fullName = String(body.fullName ?? "").trim();
        if (!EMAIL_RE.test(email)) throw new HttpError(400, "A valid email is required.");
        if (!fullName) throw new HttpError(400, "Administrator name is required.");

        const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") ?? undefined;
        const { data: invited, error } = await svc.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName, role: "admin" },
          redirectTo,
        });
        if (error) throw new HttpError(400, error.message);

        const userId = invited.user?.id;
        if (userId) {
          await svc.from("profiles").upsert(
            { id: userId, email, full_name: fullName, role: "admin", status: "active" },
            { onConflict: "id" },
          );
        }
        await svc.from("invitations").insert({
          email,
          full_name: fullName,
          role: "admin",
          token_hash: "sent-via-supabase-auth",
          expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
          created_by: admin.id,
        });
        await audit(svc, admin.id, "admin.invite", email, { fullName });
        return json({ ok: true, invited: email });
      }

      case "set_role": {
        if (admin.role !== "super_admin") {
          throw new HttpError(403, "Super administrator access required.");
        }
        const targetId = String(body.userId ?? "");
        const role = String(body.role ?? "");
        if (!ROLES.has(role)) throw new HttpError(400, "Invalid role.");
        if (targetId === admin.id) throw new HttpError(400, "You cannot change your own role.");
        const { data: target } = await svc
          .from("profiles").select("id,role").eq("id", targetId).single();
        if (!target) throw new HttpError(404, "Account not found.");

        const { error } = await svc.from("profiles").update({ role }).eq("id", targetId);
        if (error) throw new HttpError(400, error.message);
        // Changing role may add/drop privileges — force re-auth to re-derive them.
        await svc.auth.admin.signOut(targetId, "global").catch(() => {});
        await audit(svc, admin.id, "admin.set_role", targetId, { from: target.role, to: role });
        return json({ ok: true });
      }

      case "password_recovery": {
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!EMAIL_RE.test(email)) throw new HttpError(400, "A valid email is required.");
        const redirectTo = Deno.env.get("RECOVERY_REDIRECT_URL") ?? undefined;
        const { error } = await svc.auth.admin.generateLink({
          type: "recovery",
          email,
          options: redirectTo ? { redirectTo } : undefined,
        });
        if (error) throw new HttpError(400, error.message);
        await audit(svc, admin.id, "teacher.password_recovery", email, {});
        return json({ ok: true });
      }

      default:
        throw new HttpError(400, `Unknown action: ${action || "(none)"}`);
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return json({ error: (e as Error).message }, status);
  }
});
