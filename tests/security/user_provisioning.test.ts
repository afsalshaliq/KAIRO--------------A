import { describe, it, expect, beforeAll } from "vitest";
import { bootDb, type Harness } from "./harness";

const ROYAL_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";
const OXFORD_SCHOOL_ID = "00000000-0000-0000-0000-000000000002";
const CANONICAL_SUPER_ADMIN_ID = "10e528c9-c6b1-417f-8c23-1427466fc0e0";

describe("User Provisioning & Super Admin Profile Governance", () => {
  let h: Harness;
  let superAdminId: string;
  let royalPrincipalId: string;
  let royalTeacherId: string;
  let oxfordTeacherId: string;

  beforeAll(async () => {
    h = await bootDb();

    // 1. Seed canonical super admin
    await h.asService(async () => {
      await h.db.query(
        `insert into auth.users (id, email)
         values ($1, 'superadmin@kairo.in')
         on conflict (id) do nothing`,
        [CANONICAL_SUPER_ADMIN_ID],
      );
      await h.db.query(
        `insert into profiles (id, email, full_name, role, status, school_id)
         values ($1, 'superadmin@kairo.in', 'Global Super Admin', 'super_admin', 'active', null)
         on conflict (id) do update set role = 'super_admin', status = 'active'`,
        [CANONICAL_SUPER_ADMIN_ID],
      );
    });
    superAdminId = CANONICAL_SUPER_ADMIN_ID;

    // 2. Create principal and teachers
    royalPrincipalId = await h.createUser({
      email: "principal@royal.edu",
      role: "principal",
      schoolId: ROYAL_SCHOOL_ID,
    });

    royalTeacherId = await h.createUser({
      email: "teacher@royal.edu",
      role: "teacher",
      schoolId: ROYAL_SCHOOL_ID,
    });

    oxfordTeacherId = await h.createUser({
      email: "teacher@oxford.edu",
      role: "teacher",
      schoolId: OXFORD_SCHOOL_ID,
    });
  });

  // =========================================================================
  // 1. Super Admin Profile Read Access (RLS Verification)
  // =========================================================================
  it("Super Admin CAN view all profiles across all schools and global realm", async () => {
    await h.actAs(superAdminId, async () => {
      const { rows } = await h.db.query<{ id: string; email: string }>(
        `select id, email from profiles order by created_at`,
      );
      // Must see at least all 4 created users
      expect(rows.length).toBeGreaterThanOrEqual(4);
      const emails = rows.map((r) => r.email);
      expect(emails).toContain("superadmin@kairo.in");
      expect(emails).toContain("principal@royal.edu");
      expect(emails).toContain("teacher@royal.edu");
      expect(emails).toContain("teacher@oxford.edu");
    });
  });

  it("Anonymous caller receives 0 profiles (Protected by RLS)", async () => {
    await h.actAs(null, async () => {
      const { rows } = await h.db.query(`select * from profiles`);
      expect(rows).toHaveLength(0);
    });
  });

  it("School Principal CANNOT view profiles outside their assigned school", async () => {
    await h.actAs(royalPrincipalId, async () => {
      const { rows } = await h.db.query<{ id: string }>(
        `select id from profiles where id = $1`,
        [oxfordTeacherId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("School Principal CAN view teacher profiles within their school", async () => {
    await h.actAs(royalPrincipalId, async () => {
      const { rows } = await h.db.query<{ id: string }>(
        `select id from profiles where id = $1`,
        [royalTeacherId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(royalTeacherId);
    });
  });

  it("Teachers CANNOT view other teachers in other schools", async () => {
    await h.actAs(royalTeacherId, async () => {
      const { rows } = await h.db.query<{ id: string }>(
        `select id from profiles where id = $1`,
        [oxfordTeacherId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  // =========================================================================
  // 2. Profile Integrity & Constraint Enforcement
  // =========================================================================
  it("Profile creation MUST reference a valid auth.users id (Foreign Key)", async () => {
    const nonExistentAuthId = "99999999-9999-9999-9999-999999999999";
    await expect(
      h.asService(async () => {
        await h.db.query(
          `insert into profiles (id, email, full_name, role, status)
           values ($1, 'orphan@test.edu', 'Orphan User', 'teacher', 'active')`,
          [nonExistentAuthId],
        );
      }),
    ).rejects.toThrow(/foreign key|violates foreign key constraint/);
  });

  it("Duplicate email in profiles is blocked by UNIQUE constraint", async () => {
    const newAuthId = "88888888-8888-8888-8888-888888888888";
    await h.asService(async () => {
      await h.db.query(
        `insert into auth.users (id, email) values ($1, 'duplicate@test.edu')`,
        [newAuthId],
      );
      await h.db.query(
        `insert into profiles (id, email, full_name, role, status)
         values ($1, 'duplicate@test.edu', 'First User', 'teacher', 'active')`,
        [newAuthId],
      );
    });

    const secondAuthId = "77777777-7777-7777-7777-777777777777";
    await expect(
      h.asService(async () => {
        await h.db.query(
          `insert into auth.users (id, email) values ($1, 'duplicate2@test.edu')`,
          [secondAuthId],
        );
        // Attempting to insert duplicate email
        await h.db.query(
          `insert into profiles (id, email, full_name, role, status)
           values ($1, 'duplicate@test.edu', 'Second User', 'teacher', 'active')`,
          [secondAuthId],
        );
      }),
    ).rejects.toThrow(/unique constraint/);
  });

  // =========================================================================
  // 3. Privilege Escalation Safeguards
  // =========================================================================
  it("Teacher CANNOT escalate their own role to super_admin or principal", async () => {
    await h.actAs(royalTeacherId, async () => {
      await expect(
        h.db.query(
          `update profiles set role = 'super_admin' where id = $1`,
          [royalTeacherId],
        ),
      ).rejects.toThrow();

      await expect(
        h.db.query(
          `update profiles set role = 'principal' where id = $1`,
          [royalTeacherId],
        ),
      ).rejects.toThrow();
    });
  });

  it("Principal CANNOT promote any user to super_admin", async () => {
    await h.actAs(royalPrincipalId, async () => {
      await expect(
        h.db.query(
          `update profiles set role = 'super_admin' where id = $1`,
          [royalTeacherId],
        ),
      ).rejects.toThrow();
    });
  });

  it("Super Admin CAN update profile attributes and assign roles", async () => {
    await h.actAs(superAdminId, async () => {
      const res = await h.db.query<{ id: string; full_name: string }>(
        `update profiles set full_name = 'Updated Teacher Name' where id = $1 returning id, full_name`,
        [royalTeacherId],
      );
      expect(res.rowCount).toBe(1);
      expect(res.rows[0].full_name).toBe("Updated Teacher Name");
    });
  });
});
