import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const mig = (f: string) =>
  readFileSync(path.resolve(dir, "../../supabase/migrations", f), "utf8");

/**
 * Boots an in-process Postgres (pglite), installs minimal `auth` and `storage`
 * shims that mirror Supabase, then runs the real migrations. RLS is genuinely
 * enforced because we execute queries under a non-owner `authenticated` role.
 */
export async function bootDb() {
  const db = new PGlite();

  // --- Supabase-like shims -------------------------------------------------
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;

    create schema if not exists auth;
    create table auth.users (id uuid primary key, email text unique);
    -- auth.uid() reads a per-connection GUC set by actAs().
    create or replace function auth.uid() returns uuid
      language sql stable as $$ select nullif(current_setting('kairo.uid', true), '')::uuid $$;

    create schema if not exists storage;
    create table storage.buckets (id text primary key, name text, public boolean default false);
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text not null,
      owner uuid,
      created_at timestamptz default now()
    );
    alter table storage.objects enable row level security;
  `);

  // --- Real migrations -----------------------------------------------------
  await db.exec(mig("0001_schema.sql"));
  await db.exec(mig("0002_rls.sql"));
  await db.exec(mig("0003_storage.sql"));
  await db.exec(mig("0004_seed.sql"));
  // Separate exec calls => separate transactions, so the enum value added in
  // 0005 is committed before 0006 (which references it) runs.
  await db.exec(mig("0005_super_admin_enum.sql"));
  await db.exec(mig("0006_super_admin.sql"));
  await db.exec(mig("0007_object_authz.sql"));
  await db.exec(mig("0008_roles_enum.sql"));
  await db.exec(mig("0009_multi_tenant_schema.sql"));
  await db.exec(mig("0010_multi_tenant_rls.sql"));
  await db.exec(mig("0011_seed_tenants.sql"));
  await db.exec(mig("0012_user_provisioning.sql"));
  await db.exec(mig("0013_audit_log_retention.sql"));

  // storage.objects needs select grant + the authorization helper in scope.
  await db.exec(`
    grant usage on schema public, auth, storage to authenticated, anon, service_role;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select, insert, update, delete on all tables in schema storage to authenticated;
    grant select on all tables in schema auth to authenticated;
    grant execute on all functions in schema public to authenticated;
  `);

  /** Create an auth user + profile with a given role/status. Returns the id. */
  async function createUser(opts: {
    email: string;
    role?: "super_admin" | "admin" | "principal" | "teacher_admin" | "teacher";
    status?: "active" | "suspended" | "deactivated";
    schoolId?: string | null;
  }): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
      [opts.email],
    );
    const id = rows[0].id;
    const sId = opts.schoolId ? `'${opts.schoolId}'` : "null";
    await db.exec(
      `insert into profiles (id, email, full_name, role, status, school_id)
       values ('${id}', '${opts.email}', '${opts.email}', '${opts.role ?? "teacher"}', '${opts.status ?? "active"}', ${sId})`,
    );
    return id;
  }

  /** Run `fn` as the given user under the `authenticated` role (RLS active). */
  async function actAs<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
    await db.exec(`set role authenticated; select set_config('kairo.uid', '${uid ?? ""}', false);`);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role; select set_config('kairo.uid', '', false);`);
    }
  }

  /** Run as table owner (service-role equivalent; bypasses RLS). */
  async function asService(fn: () => Promise<void>): Promise<void> {
    await db.exec(`reset role;`);
    await fn();
  }

  /** Convenience: run a single query as the owner and return its rows. */
  async function asServiceQuery<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    await db.exec(`reset role;`);
    const { rows } = await db.query<T>(sql, params);
    return rows;
  }

  return { db, createUser, actAs, asService, asServiceQuery };
}

export type Harness = Awaited<ReturnType<typeof bootDb>>;
